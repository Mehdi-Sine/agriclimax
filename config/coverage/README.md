# Metropolitan spatial support

`france-metropolitan.geojson` is the metropolitan subset of the France feature
from <https://github.com/datasets/geo-countries/blob/master/data/countries.geojson>,
retrieved 2026-10-15 (Natural Earth administrative boundaries, ODC-PDDL-1.0).
Only polygon components wholly inside [-6,41,10,52] were retained; overseas
components are excluded. Ten components include the mainland and Corsica.
The committed file and Git history pin the exact mask used for the estimates.

At the CDS regular 0.1° grid, 6,429 centers fall inside this mask. Coastline and
border cells are selected by their **center**, not by intersecting agricultural
land. Very small islands without a native center cannot be resolved at this scale.
This is a cartographic filter; it does not establish crop or cattle exposure.
No spatial resampling or interpolation is performed. Do not equate this regular
CDS grid with station measurements, nor with a 0.1° agricultural exposure layer.

The official DPObs catalogue is fetched separately with
`scripts/select_france_stations.py`. Selection uses deterministic farthest-point
sampling of 96 stations in the metropolitan bounding box. This is a geographic
coverage heuristic, not a validated climate network design. Official catalogue
metadata and checksums are retained; DPClim station membership is verified before
archive acquisition by Task11. Availability of humidity or ETP is never assumed.
