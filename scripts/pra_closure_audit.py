"""Offline closure evidence: original WFS conversion, department gaps, ECMWF mask.

Never changes the versioned reference, writes a database, or infers permanent
support from weather samples. All coordinates and source differences are retained.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr
from pyproj import CRS, Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform, unary_union

GML = "{http://www.opengis.net/gml/3.2}"
WFS = "{http://www.opengis.net/wfs/2.0}"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2,
                              allow_nan=False) + "\n")


def read_archive(path: Path, member: str | None = None) -> dict[str, Any]:
    """Read a bounded JSON member without extracting archive paths."""
    if zipfile.is_zipfile(path):
        if member is None:
            raise ValueError("ZIP requires an explicit GeoJSON member")
        with zipfile.ZipFile(path) as z:
            info = z.getinfo(member)
            if info.file_size > 128 * 1024**2:
                raise ValueError("GeoJSON exceeds 128 MiB")
            raw = z.read(info)
    elif path.suffix == ".gz":
        with gzip.open(path, "rb") as stream:
            raw = stream.read(128 * 1024**2 + 1)
    else:
        raw = path.read_bytes()
    if len(raw) > 128 * 1024**2:
        raise ValueError("GeoJSON exceeds 128 MiB")
    document: dict[str, Any] = json.loads(raw)
    return document


def convert_wfs(raw: bytes) -> tuple[dict[str, Any], dict[str, Any]]:
    """Strict adapter for the inspected OFB WFS2 / GML3.2 EPSG:3857 layer."""
    if len(raw) > 128 * 1024**2 or b"<!DOCTYPE" in raw or b"<!ENTITY" in raw:
        raise ValueError("Unsupported XML size/DTD")
    root = ET.fromstring(raw)
    if root.tag != WFS + "FeatureCollection":
        raise ValueError("Expected WFS 2 FeatureCollection")
    features: list[dict[str, Any]] = []
    crss = set()
    project = Transformer.from_crs(3857, 4326, always_xy=True).transform
    for member in root.findall(WFS + "member"):
        if len(member) != 1:
            raise ValueError("Expected exactly one feature per member")
        feature = member[0]
        attrs: dict[str, Any] = {}
        geom = None
        for field in feature:
            name = field.tag.split("}")[-1]
            if name != "geom":
                if len(field) or name in attrs:
                    raise ValueError("Unsupported nested/duplicate attribute")
                attrs[name] = field.text
                continue
            if len(field) != 1 or field[0].tag != GML + "MultiSurface":
                raise ValueError("Expected GML MultiSurface")
            surface = field[0]
            crs = surface.attrib.get("srsName", "")
            if not CRS.from_user_input(crs).equals(CRS.from_epsg(3857)):
                raise ValueError("Expected declared EPSG:3857, no axis guessing")
            if surface.attrib.get("srsDimension") != "2":
                raise ValueError("Expected two-dimensional coordinates")
            crss.add(crs)
            polygons = []
            for sm in surface:
                if sm.tag != GML + "surfaceMember" or len(sm) != 1 or sm[0].tag != GML + "Polygon":
                    raise ValueError("Unsupported GML surface")
                rings: list[list[tuple[float, float]]] = []
                for boundary in sm[0]:
                    expected = GML + ("exterior" if not rings else "interior")
                    if boundary.tag != expected:
                        raise ValueError("Unsupported polygon ring order")
                    pos = boundary.find(GML + "LinearRing/" + GML + "posList")
                    if pos is None:
                        raise ValueError("Expected GML posList")
                    values = [float(v) for v in (pos.text or "").split()]
                    if len(values) < 8 or len(values) % 2 or not all(map(math.isfinite, values)):
                        raise ValueError("Invalid coordinate list")
                    ring = list(zip(values[::2], values[1::2], strict=True))
                    if ring[0] != ring[-1]:
                        raise ValueError("Unclosed source ring; no repair")
                    rings.append(ring)
                if not rings:
                    raise ValueError("Empty polygon")
                polygons.append(Polygon(rings[0], rings[1:]))
            geom = MultiPolygon(polygons)
        if geom is None or geom.is_empty or not geom.is_valid:
            raise ValueError("Missing/invalid geometry; no automatic repair")
        code = attrs.get("code_pra")
        if not isinstance(code, str) or len(code) != 5 or attrs.get("code_ra") != code[2:]:
            raise ValueError("Invalid official text identity")
        for key in ("fid", "surf_ha"):
            if key in attrs:
                attrs[key] = int(attrs[key]) if key == "fid" else float(attrs[key])
        converted = transform(project, geom)
        if converted.is_empty or not converted.is_valid:
            raise ValueError("Invalid converted geometry; no automatic repair")
        features.append({"type": "Feature", "properties": attrs,
                         "geometry": mapping(converted)})
    codes = [f["properties"]["code_pra"] for f in features]
    if not features or len(codes) != len(set(codes)):
        raise ValueError("Empty/duplicate PRA codes")
    for key in ("numberMatched", "numberReturned"):
        if root.attrib.get(key) != str(len(features)):
            raise ValueError("Incomplete WFS response")
    return {"type": "FeatureCollection", "features": features}, {
        "xml_sha256": hashlib.sha256(raw).hexdigest(), "feature_count": len(features),
        "declared_crs": sorted(crss), "output_crs": "EPSG:4326",
        "server_response_timestamp": root.attrib.get("timeStamp"),
        "geometry_vintage": None, "nomenclature_year": 2017,
        "geometry_repaired": False,
    }


def wfs_audit(a: argparse.Namespace) -> None:
    document, report = convert_wfs(a.input.read_bytes())
    if a.expected_sha256 and report["xml_sha256"] != a.expected_sha256:
        raise ValueError("Original XML checksum mismatch")
    reference = json.loads((a.bundle / "reference.json").read_text())
    properties = json.loads((a.bundle / "source-properties.json").read_text())
    source = {f["properties"]["code_pra"]: f for f in document["features"]}
    versioned = {f["properties"]["code"]: f for f in reference["features"]}
    project = Transformer.from_crs(4326, 3035, always_xy=True).transform
    rows = []
    for code in sorted(source.keys() & versioned.keys()):
        left, right = source[code], versioned[code]
        lg, rg = shape(left["geometry"]), shape(right["geometry"])
        if not rg.is_valid or rg.is_empty:
            raise ValueError("Invalid versioned geometry")
        lp, rp = transform(project, lg), transform(project, rg)
        attrs = left["properties"]
        prior = properties[code]
        rows.append({"code": code, "attributes_equal": attrs == prior,
                     "shared_attribute_differences": {k: {"xml": attrs.get(k), "versioned": v}
                                                       for k, v in prior.items() if attrs.get(k) != v},
                     "xml_only_attributes": sorted(attrs.keys() - prior.keys()),
                     "topologically_equal": lg.equals(rg),
                     "symmetric_difference_m2": lp.symmetric_difference(rp).area,
                     "hausdorff_m": lp.hausdorff_distance(rp),
                     "source_area_m2": lp.area, "versioned_area_m2": rp.area})
    report.update({"only_xml_codes": sorted(source.keys() - versioned.keys()),
                   "only_versioned_codes": sorted(versioned.keys() - source.keys()),
                   "attribute_differences": sum(not r["attributes_equal"] for r in rows),
                   "shared_attribute_differences": sum(bool(r["shared_attribute_differences"]) for r in rows),
                   "geometry_differences": sum(not r["topologically_equal"] for r in rows),
                   "symmetric_difference_m2_sum": sum(r["symmetric_difference_m2"] for r in rows),
                   "maximum_hausdorff_m": max(r["hausdorff_m"] for r in rows), "rows": rows})
    save(a.output / "converted.geojson", document)
    save(a.output / "wfs-comparison.json", report)


def admin_audit(a: argparse.Namespace) -> None:
    metadata = json.loads(a.metadata.read_text())
    for key in ("source_url", "producer", "edition", "crs", "precision_description", "pra_compatibility"):
        if not metadata.get(key):
            raise ValueError("Administrative provenance field required: " + key)
    if digest(a.input) != metadata["archive_sha256"]:
        raise ValueError("Administrative archive checksum mismatch")
    document = read_archive(a.input, a.member)
    project = Transformer.from_crs(metadata["crs"], 3035, always_xy=True).transform
    departments = {}
    for f in document["features"]:
        code = f["properties"][a.code_field]
        if not isinstance(code, str) or code in departments:
            raise ValueError("Unique text department codes required")
        g = shape(f["geometry"])
        if not g.is_valid or g.is_empty or g.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError("Invalid independent boundary; no repair")
        departments[code] = transform(project, g)
    ref = json.loads((a.bundle / "reference.json").read_text())
    project_pra = Transformer.from_crs(4326, 3035, always_xy=True).transform
    grouped: dict[str, list[Any]] = {}
    for f in ref["features"]:
        grouped.setdefault(f["properties"]["department"], []).append(transform(project_pra, shape(f["geometry"])))
    expected = {f"{i:02d}" for i in range(1, 96) if i != 20} | {"2A", "2B"}
    if not expected <= departments.keys():
        raise ValueError("Missing metropolitan department boundaries")
    rows = []
    for dep in sorted(expected):
        boundary = departments[dep]
        pra = unary_union(grouped.get(dep, []))
        rows.append({"department": dep, "pra_count": len(grouped.get(dep, [])),
                     "administrative_area_km2": boundary.area / 1e6,
                     "gap_km2": boundary.difference(pra).area / 1e6,
                     "outside_assigned_department_km2": pra.difference(boundary).area / 1e6,
                     "paris_without_official_pra": dep == "75"})
    save(a.output / "administrative-comparison.json", {
        "source": metadata, "member": a.member, "area_crs": "EPSG:3035",
        "compatibility_verified": False,
        "status": "measured_requires_vintage_and_precision_review",
        "gap_total_km2": sum(r["gap_km2"] for r in rows),
        "gap_excluding_paris_km2": sum(r["gap_km2"] for r in rows if r["department"] != "75"),
        "outside_total_km2": sum(r["outside_assigned_department_km2"] for r in rows),
        "geometry_modified": False, "rows": rows})


def mask_audit(a: argparse.Namespace) -> None:
    weights = json.loads((a.bundle / "weights.json").read_text())
    probe = json.loads(a.probe.read_text())
    cells = {w["cell_id"]: w for w in weights}
    values = {}
    with xr.open_dataset(a.input) as ds:
        field = ds["lsm"]
        if field.sizes.get("time") != 1 or set(field.dims) != {"time", "latitude", "longitude"}:
            raise ValueError("Expected static ECMWF lat/lon lsm")
        field = field.isel(time=0).load()
        for key, w in sorted(cells.items()):
            lon = w["longitude"] % 360
            lat = w["latitude"]
            # Float32 official coordinates need <2e-5 degree tolerance. Never
            # choose a neighbouring cell, interpolate values or regrid the mask.
            li = np.flatnonzero(np.abs(field.latitude.values - lat) < 2e-5)
            lj = np.flatnonzero(np.abs(field.longitude.values - lon) < 2e-5)
            if len(li) != 1 or len(lj) != 1:
                raise ValueError("Mask/native cell centres do not align uniquely")
            v = float(field.isel(latitude=int(li[0]), longitude=int(lj[0])))
            if not math.isfinite(v) or not 0 <= v <= 1:
                raise ValueError("Invalid official land fraction")
            values[key] = v
    missing = set(probe["missing_cells"])
    if not missing <= cells.keys() or len(cells) != probe["native_cells"]:
        raise ValueError("Probe and correspondence cell sets differ")
    sea = {k for k, v in values.items() if v < .5}
    report = {"mask_sha256": digest(a.input), "mask_bytes": a.input.stat().st_size,
              "source_url": a.source_url, "native_cells": len(cells),
              "below_0_5": len(sea), "observed_missing": len(missing),
              "missing_below_0_5": len(missing & sea),
              "missing_at_or_above_0_5": sorted(missing - sea),
              "observed_present_below_0_5": sorted(sea - missing),
              "structural_support_verified": False,
              "reason": "Interpolated auxiliary mask is not an exact CDS support bitmap",
              "interpolation": False, "renormalization": False,
              "cells_file": "ecmwf-mask-cells.csv"}
    save(a.output / "ecmwf-mask-comparison.json", report)
    with (a.output / "ecmwf-mask-cells.csv").open("w", newline="") as stream:
        cell_writer = csv.writer(stream, lineterminator="\n")
        cell_writer.writerow(["cell_id", "land_fraction", "missing_in_two_instant_probe"])
        cell_writer.writerows((k, v, k in missing) for k, v in values.items())
    # A mask disagreement must never be promoted to verified_native_structural_support.
    from agriclimax.territories.availability import inventory

    reference = json.loads((a.bundle / "reference.json").read_text())
    result = inventory(reference, weights)
    save(a.output / "structural-inventory.json", result)
    with (a.output / "structural-inventory.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(result["rows"][0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(result["rows"])


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("mode", choices=("wfs", "admin", "mask"))
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--bundle", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--expected-sha256")
    p.add_argument("--metadata", type=Path)
    p.add_argument("--member")
    p.add_argument("--code-field", default="code")
    p.add_argument("--probe", type=Path)
    p.add_argument("--source-url")
    a = p.parse_args()
    checksums = json.loads((a.bundle / "checksums.json").read_text())
    for name, expected in checksums.items():
        if digest(a.bundle / name) != expected:
            raise ValueError("Versioned bundle checksum mismatch")
    if a.mode == "admin" and not a.metadata:
        p.error("admin requires --metadata")
    if a.mode == "mask" and not (a.probe and a.source_url):
        p.error("mask requires --probe and --source-url")
    {"wfs": wfs_audit, "admin": admin_audit, "mask": mask_audit}[a.mode](a)


if __name__ == "__main__":
    main()
