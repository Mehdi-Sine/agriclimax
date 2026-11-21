"""Build and publish an exact native index from a retained numeric weather cycle."""
from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Callable, TypeVar
from urllib.error import URLError

from couv05_masks import DAYS, capture_path, run as build_index
from couv05_store import plan
from pra_weather_store import BUCKET, MAX_OBJECT, STORAGE_GUARD, ArchiveStore

NAMESPACE = "forecast-native/v1"
DIGEST = re.compile(r"[a-f0-9]{64}")
VERSION = "forecast-native-binding-1"
MAX_CYCLE = 256 * 1024**2
T = TypeVar("T")


def retry(operation: Callable[[], T]) -> T:
    for attempt in range(3):
        try:
            return operation()
        except (URLError, TimeoutError, RuntimeError) as error:
            if attempt == 2 or (isinstance(error, RuntimeError)
                                and not re.fullmatch(r"Private archive HTTP (429|5\d\d); no credential diagnostics", str(error))):
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("Retry limit")


def binding_path(archive: str) -> str:
    if not DIGEST.fullmatch(archive):
        raise ValueError("Invalid numeric archive SHA-256")
    return f"{NAMESPACE}/{archive}/binding.json"


def published_binding(store: ArchiveStore, archive: str) -> dict[str, Any] | None:
    raw = retry(lambda: store.request(f"object/{BUCKET}/{binding_path(archive)}"))
    if not raw:
        return None
    binding = json.loads(raw)
    if (binding.get("version") != VERSION or binding.get("archive_sha256") != archive
            or not DIGEST.fullmatch(binding.get("index_sha256", ""))
            or binding.get("layout") not in {"cycle", "shared"}):
        raise ValueError("Invalid native catalogue binding")
    return binding


def stored_path(path: str, archive: str, layout: str) -> str:
    return f"{NAMESPACE}/{archive}/{path}" if layout == "cycle" else path


def prune_for_capacity(store: ArchiveStore, inventory: dict[str, int], weather: list[dict[str, Any]],
                       archive: str, new_bytes: int) -> list[str]:
    """Keep the newest committed cycle while retiring older cycle-scoped objects."""
    if sum(inventory.values()) + new_bytes <= STORAGE_GUARD:
        return []
    chronology = sorted(((datetime.fromisoformat(e["run_at"]), e["sha256"]) for e in weather if e.get("run_at")),
                        reverse=True)
    target_run = next(run for run, checksum in chronology if checksum == archive)
    managed = [(run, checksum) for run, checksum in chronology if checksum != archive
               and any(path.startswith(f"{NAMESPACE}/{checksum}/forecast-masks/") for path in inventory)]
    current = next(((run, checksum) for run, checksum in managed if binding_path(checksum) in inventory), None)
    if not current or current[0] >= target_run:
        return []
    kept = published_binding(store, current[1])
    if not kept or kept["layout"] != "cycle":
        return []
    path = stored_path(f"forecast-masks/indexes/{kept['index_sha256']}.json.gz", current[1], "cycle")
    retry(lambda: store.blob(path, kept["index_sha256"]))
    eligible = [(checksum, sorted(path for path in inventory
                  if path.startswith(f"{NAMESPACE}/{checksum}/") and path != binding_path(checksum)))
                for run, checksum in reversed(managed)
                if run < current[0] and datetime.now(UTC) - run > timedelta(hours=36)]
    projected = sum(inventory.values()) + new_bytes
    selected = []
    for checksum, paths in eligible:
        binding = binding_path(checksum)
        projected -= sum(inventory[p] for p in paths) + inventory.get(binding, 0)
        selected.append((checksum, binding, paths))
        if projected <= STORAGE_GUARD:
            break
    if projected > STORAGE_GUARD:
        return []
    for checksum, binding, paths in selected:
        if binding in inventory:
            store.remove_native_cycle_objects(checksum, [binding])
        for offset in range(0, len(paths), 100):
            store.remove_native_cycle_objects(checksum, paths[offset:offset + 100])
    return [checksum for checksum, _, _ in selected]


def publish(candidate: dict[str, Any], *, shared: bool = False,
            protect_current: bool = False, allow_retention: bool = False, verify_metadata: bool = False) -> dict[str, Any]:
    store = ArchiveStore()
    bucket = retry(lambda: store.request(f"bucket/{BUCKET}"))
    config = json.loads(bucket)
    if config.get("id") != BUCKET or config.get("public") is not False:
        raise ValueError("Existing private archive bucket required")
    max_object = min(MAX_OBJECT, int(config.get("file_size_limit") or MAX_OBJECT))
    catalogue = retry(store.catalogue)
    archive = candidate["archive_sha256"]
    registered = next((entry for entry in catalogue["weather"] if entry["sha256"] == archive), None)
    if not registered or registered.get("method_version") != "pra-national-weather-daily-1":
        raise ValueError("Exact numeric cycle is missing from the weather catalogue")
    if protect_current and max(catalogue["weather"], key=lambda e: e.get("run_at", e["run_date"]))["sha256"] != archive:
        raise ValueError("Selected cycle is no longer the latest published weather cycle")
    retry(lambda: store.blob(registered["path"], archive))
    layout = "shared" if shared else "cycle"
    index = candidate["index"]
    binding = {"version": VERSION, "archive_sha256": archive,
               "index_sha256": Path(index).name.split(".")[0],
               "run_at": registered["run_at"], "layout": layout}
    prior = published_binding(store, archive)
    if prior and prior != binding:
        raise ValueError("Different immutable index already bound to this weather archive")
    raw_binding = json.dumps(binding, sort_keys=True, separators=(",", ":")).encode()
    objects = {stored_path(path, archive, layout): raw for path, raw in candidate["objects"].items()}
    total_existing = retry(store.inventory)
    new_bytes = sum(len(raw) for path, raw in objects.items() if path not in total_existing)
    if binding_path(archive) not in total_existing:
        new_bytes += len(raw_binding)
    if any(len(raw) > max_object for raw in objects.values()):
        raise ValueError("Native object exceeds the private bucket upload limit")
    before = sum(total_existing.values())
    retired = prune_for_capacity(store, total_existing, catalogue["weather"], archive, new_bytes) if allow_retention else []
    if retired:
        total_existing = retry(store.inventory)
    if sum(total_existing.values()) + new_bytes > STORAGE_GUARD:
        raise ValueError("Private Storage inventory plus candidate exceeds the 900 MiB guard")

    index_path = stored_path(index, archive, layout)

    def put(path: str) -> None:
        raw = objects[path]
        put_object = store.put_immutable_verified_metadata if verify_metadata and path != index_path else store.put_immutable
        retry(lambda: put_object(path, raw))
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(put, sorted(set(objects) - {index_path})))
    put(index_path)
    # This immutable object is the catalogue commit. Readers discover only verified snapshots.
    retry(lambda: store.put_immutable(binding_path(archive), raw_binding))
    if published_binding(ArchiveStore(read_only=True), archive) != binding:
        raise ValueError("Published catalogue binding could not be verified")
    return {**binding, "objects_verified": len(objects), "private_bucket_bytes_before": before, "retired_cycles": retired,
            "new_bytes": new_bytes, "cycle_bytes": candidate["bytes"],
            "storage_writes": store.writes, "source_requests": 0,
            "blob_verification": "metadata_with_byte_fallback" if verify_metadata else "full_bytes"}


def latest(root: Path, output: Path, *, publish_remote: bool, allow_retention: bool = False, verify_metadata: bool = False) -> dict[str, Any]:
    report = root / "report.json"
    if not report.exists() and publish_remote:
        status = health()
        if status["status"] == "healthy":
            return {**status, "status": "already_indexed"}
        raise ValueError(f"No acquisition checkpoint for {status['run_at']}; {status['status']}")
    receipt = json.loads(report.read_text())
    if receipt.get("status") not in {"complete", "no_new_data"}:
        raise ValueError("No successful numeric cycle receipt for native publication")
    cycle = datetime.fromisoformat(receipt["run"])
    archive = receipt.get("archive_sha256") or receipt["archive"]["sha256"]
    store = ArchiveStore(read_only=True) if publish_remote else None
    if store and (existing := published_binding(store, archive)):
        path = stored_path(f"forecast-masks/indexes/{existing['index_sha256']}.json.gz",
                           archive, existing["layout"])
        retry(lambda: store.blob(path, existing["index_sha256"]))
        return {**existing, "status": "already_indexed"}
    checkpoint = root / "cycles" / cycle.strftime("%Y%m%dT%H")
    if not (checkpoint / "cycle.compact.json.gz").is_file():
        raise ValueError(f"Missing native checkpoint for {cycle.isoformat()}; restore forecast artifact")
    if any(capture_path(checkpoint, model, cycle.date() + timedelta(days=offset)) is None
           for model, offsets in DAYS.items() for offset in offsets):
        from couv05_replay import replay_cycle
        replayed = output / "replay" / archive
        replay_cycle(checkpoint, replayed)
        checkpoint = replayed
    return build(checkpoint, output, archive, cycle, publish_remote=publish_remote,
                 require_latest=True, allow_retention=allow_retention, verify_metadata=verify_metadata)


def build(checkpoint: Path, output: Path, archive: str, cycle: datetime,
          *, publish_remote: bool, require_latest: bool = False, allow_retention: bool = False,
          verify_metadata: bool = False) -> dict[str, Any]:
    if not DIGEST.fullmatch(archive):
        raise ValueError("Invalid numeric archive SHA-256")
    destination = output / archive
    stats = build_index(checkpoint, destination, cycle.date(), True, archive,
                        require_complete=True, expected_run=cycle)
    index_sha = stats["spatial_index"]["sha256"]
    candidate = plan(destination, index_sha, MAX_CYCLE)
    result = publish(candidate, protect_current=require_latest, allow_retention=allow_retention,
                     verify_metadata=verify_metadata) if publish_remote else {
        "archive_sha256": archive, "index_sha256": index_sha, "cycle_bytes": candidate["bytes"],
        "objects_verified": len(candidate["objects"]), "source_requests": 0}
    return {**result, "status": "published" if publish_remote else "qualified",
            "qualification_seconds": stats["seconds"], "matrix_rows": stats["matrix_rows"]}


def health() -> dict[str, Any]:
    store = ArchiveStore(read_only=True)
    weather = sorted((e for e in retry(store.catalogue)["weather"]
                      if e.get("method_version") == "pra-national-weather-daily-1" and e.get("run_at")),
                     key=lambda e: datetime.fromisoformat(e["run_at"]), reverse=True)
    if not weather:
        raise ValueError("No national weather cycle in the private catalogue")
    newest = weather[0]
    binding = published_binding(store, newest["sha256"])
    if binding:
        path = stored_path(f"forecast-masks/indexes/{binding['index_sha256']}.json.gz",
                           newest["sha256"], binding["layout"])
        retry(lambda: store.blob(path, binding["index_sha256"]))
    age = datetime.now(UTC) - datetime.fromisoformat(newest["run_at"])
    return {"run_at": newest["run_at"], "archive_sha256": newest["sha256"],
            "index_sha256": binding and binding["index_sha256"],
            "status": "stale" if age > timedelta(hours=36) else "missing_index" if not binding else "healthy"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("work/national-weather"))
    parser.add_argument("--output", type=Path, default=Path("work/forecast-native"))
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--archive-sha256")
    parser.add_argument("--run", type=datetime.fromisoformat)
    parser.add_argument("--existing-package", type=Path)
    parser.add_argument("--index-sha256")
    parser.add_argument("--shared-composites", action="store_true")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--retain-within-budget", action="store_true")
    parser.add_argument("--verify-metadata", action="store_true")
    args = parser.parse_args()
    if args.health:
        result = health()
    elif args.existing_package:
        if not args.index_sha256:
            parser.error("--existing-package requires --index-sha256")
        candidate = plan(args.existing_package, args.index_sha256, MAX_CYCLE)
        if args.publish:
            result = publish(candidate, shared=args.shared_composites,
                             protect_current=not args.shared_composites, verify_metadata=args.verify_metadata)
        else:
            result = {k: v for k, v in candidate.items() if k != "objects"}
    elif args.checkpoint:
        if not args.archive_sha256 or not args.run:
            parser.error("--checkpoint requires --archive-sha256 and --run")
        result = build(args.checkpoint, args.output, args.archive_sha256, args.run,
                       publish_remote=args.publish, require_latest=True, verify_metadata=args.verify_metadata)
    else:
        result = latest(args.root, args.output, publish_remote=args.publish,
                        allow_retention=args.retain_within_budget, verify_metadata=args.verify_metadata)
    print(json.dumps(result), flush=True)
    if args.health and result["status"] != "healthy":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
