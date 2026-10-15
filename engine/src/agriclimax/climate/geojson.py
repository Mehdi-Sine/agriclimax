"""Map-compatible native grid point transport, deliberately separate from risk layers."""

from .models import ReferenceDay


def reference_geojson(references: list[ReferenceDay]) -> dict[str, object]:
    return {
        "type": "FeatureCollection",
        "spatial_support": "era5_land_grid_points",
        "interpolation": "none",
        "risk_computed": False,
        "features": [
            {
                "type": "Feature",
                "id": f"{ref.cell_id}.{ref.batch.valid_date}",
                "geometry": {"type": "Point", "coordinates": [ref.longitude, ref.latitude]},
                "properties": {
                    "cell_id": ref.cell_id,
                    "valid_date": str(ref.batch.valid_date),
                    "source_id": "era5-land",
                    "dataset_version": ref.dataset.dataset_version,
                    "resolution": ref.dataset.resolution,
                    "status": ref.batch.status,
                    "values": {
                        r.variable: {"value": r.value, "unit": r.unit}
                        for r in ref.batch.observations
                    },
                },
            }
            for ref in references
        ],
    }
