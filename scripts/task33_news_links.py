"""Read-only T33 adapter: reuse T34 qualification and matching without collecting feeds."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'engine' / 'src'))
from agriclimax.news.matching import match
from agriclimax.news.models import EditorialNewsBundle, Event


def main() -> None:
    request = json.load(sys.stdin)
    bundle = EditorialNewsBundle.model_validate(request['news'])
    events = [Event.model_validate(event) for event in request['events']]
    links = match(bundle.publications, events)
    print(json.dumps([link.model_dump(mode='json') for link in links]))


if __name__ == '__main__':
    main()
