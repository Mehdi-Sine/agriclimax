"""Python contract validation for archived T33 briefings, with no database or network."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'engine' / 'src'))
from agriclimax.editorial.contracts import read_briefing


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    bundle = read_briefing(args.bundle.read_bytes(),
                           root / 'contracts/jsonschema/editorial-briefing-1.schema.json')
    print(f"Valid {bundle['version']}: {bundle['bundle_id']}")


if __name__ == '__main__':
    main()
