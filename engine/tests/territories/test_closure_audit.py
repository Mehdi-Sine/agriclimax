"""Synthetic adapter checks; never evidence of official or climatic coverage."""

import argparse
import json
import runpy
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pytest
import xarray as xr

AUDIT = runpy.run_path(str(Path(__file__).resolve().parents[3] / "scripts/pra_closure_audit.py"))
XML = b'''<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"
 xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:r="urn:synthetic"
 numberMatched="1" numberReturned="1" timeStamp="2026-01-01T00:00:00Z">
 <wfs:member><r:pra><r:fid>1</r:fid><r:code_pra>01123</r:code_pra>
 <r:code_ra>123</r:code_ra><r:libelle_pr>Synthetic</r:libelle_pr><r:surf_ha>1</r:surf_ha>
 <r:geom><gml:MultiSurface srsName="urn:ogc:def:crs:EPSG::3857" srsDimension="2">
 <gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing>
 <gml:posList>0 0 100 0 100 100 0 100 0 0</gml:posList>
 </gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember>
 </gml:MultiSurface></r:geom></r:pra></wfs:member></wfs:FeatureCollection>'''


def test_wfs_preserves_text_identity_and_does_not_date_geometry():
    document, report = AUDIT["convert_wfs"](XML)
    assert document["features"][0]["properties"]["code_pra"] == "01123"
    assert document["features"][0]["geometry"]["type"] == "MultiPolygon"
    assert report["geometry_vintage"] is None
    assert report["server_response_timestamp"] == "2026-01-01T00:00:00Z"


@pytest.mark.parametrize("raw", [
    XML.replace(b'numberMatched="1"', b'numberMatched="713"'),
    XML.replace(b'EPSG::3857', b'EPSG::4326'),
    XML.replace(b'100 100 0 100 0 0', b'100 100 0 100 0 1'),
    b'<!DOCTYPE x>' + XML,
    XML.replace(b'<r:code_ra>123', b'<r:code_ra>124'),
])
def test_wfs_rejects_truncated_wrong_crs_unclosed_or_unsafe_input(raw):
    with pytest.raises(ValueError):
        AUDIT["convert_wfs"](raw)


def test_manual_archive_is_read_without_extraction(tmp_path):
    path = tmp_path / "official.zip"
    with ZipFile(path, "w") as z:
        z.writestr("../../boundaries.geojson", '{"type":"FeatureCollection","features":[]}')
    assert AUDIT["read_archive"](path, "../../boundaries.geojson")["features"] == []
    assert not (tmp_path / "boundaries.geojson").exists()
    with pytest.raises(ValueError):
        AUDIT["read_archive"](path)


def test_mask_contradiction_remains_unknown_and_wrong_grid_is_rejected(tmp_path):
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    weights = [{"pra_id": "pra:01123", "cell_id": "era5land.45.0.1.0", "weight": 1,
                "latitude": 45., "longitude": 1.}]
    (bundle / "weights.json").write_text(json.dumps(weights))
    (bundle / "reference.json").write_text(json.dumps({"features": [
        {"properties": {"code": "01123", "name": "Synthetic", "department": "01"}}]}))
    probe = tmp_path / "probe.json"
    probe.write_text('{"native_cells":1,"missing_cells":[]}')
    mask = tmp_path / "mask.nc"
    data = xr.Dataset({"lsm": (("time", "latitude", "longitude"), np.array([[[0.25]]]))},
                      coords={"time": [0], "latitude": [45.], "longitude": [1.]})
    data.to_netcdf(mask)
    output = tmp_path / "output"
    args = argparse.Namespace(bundle=bundle, probe=probe, input=mask, output=output,
                              source_url="https://example.invalid/synthetic")
    AUDIT["mask_audit"](args)
    report = json.loads((output / "ecmwf-mask-comparison.json").read_text())
    assert report["observed_present_below_0_5"] == ["era5land.45.0.1.0"]
    assert report["structural_support_verified"] is False
    result = json.loads((output / "structural-inventory.json").read_text())
    assert result["classification"]["unknown"] == 1
    data.assign_coords(longitude=[1.1]).to_netcdf(mask, mode="w")
    with pytest.raises(ValueError, match="align uniquely"):
        AUDIT["mask_audit"](args)
