#!/usr/bin/env python3
"""Generate or verify a SHA-256 inventory of the exact, retained object bytes."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys

KEY = re.compile(r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*")
SHA256 = re.compile(r"[0-9a-f]{64}")


def inventory(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as stream:
        rows = [json.loads(line) for line in stream if line.strip()]
    seen = set()
    for row in rows:
        key = row["key"]
        if (not isinstance(key, str) or not KEY.fullmatch(key)
                or any(part in {".", ".."} for part in key.split("/")) or key in seen):
            raise ValueError("Clé absente, ambiguë ou dupliquée dans l’inventaire")
        if type(row["bytes"]) is not int or row["bytes"] < 0:
            raise ValueError(f"Taille invalide pour {key}")
        seen.add(key)
    if not rows:
        raise ValueError("Inventaire vide")
    return rows


def file_digest(root: Path, key: str, size: int) -> str:
    path = root.joinpath(*PurePosixPath(key).parts)
    if path.resolve() != path or not path.is_file() or path.stat().st_size != size:
        raise ValueError(f"Fichier absent, indirect ou de taille différente pour {key}")
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["keys", "seal", "verify"])
    parser.add_argument("inventory", type=Path)
    parser.add_argument("root", type=Path, nargs="?")
    args = parser.parse_args()
    rows = inventory(args.inventory)
    if args.action == "keys":
        print("\n".join(row["key"] for row in rows))
        return
    if args.root is None:
        parser.error("le répertoire d’objets est requis")
    root = args.root.resolve(strict=True)
    for row in rows:
        sha256 = file_digest(root, row["key"], row["bytes"])
        if args.action == "seal":
            print(json.dumps({**row, "sha256": sha256}, ensure_ascii=False))
        elif not SHA256.fullmatch(row.get("sha256", "")) or row["sha256"] != sha256:
            raise ValueError(f"SHA-256 différent pour {row['key']}")
    if args.action == "verify":
        print(f"{len(rows)} objets vérifiés")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        sys.exit(str(error))
