"""Local HTTP smoke, without cloud credentials or remote target support."""
import argparse
import json
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import urlopen


def check(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != 'http' or parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError('Smoke target must be a local HTTP server')
    with urlopen(url, timeout=10) as response:
        html = response.read(1024 * 1024).decode()
        if response.status != 200 or 'AgriclimaX' not in html or 'Données fictives' not in html:
            raise ValueError('Demo HTTP smoke failed')
    origin = f'{parsed.scheme}://{parsed.netloc}'
    for route in ('map', 'series', 'territory'):
        try:
            urlopen(f'{origin}/api/risks/{route}?date=2026-02-30', timeout=10)
        except HTTPError as error:
            body = json.loads(error.read())
            if (error.code != 400 or body['error']['code'] != 'INVALID_QUERY'
                    or error.headers.get('Cache-Control') != 'no-store'
                    or error.headers.get('X-Content-Type-Options') != 'nosniff'):
                raise ValueError('API validation smoke failed') from None
        else:
            raise ValueError('Invalid API query was accepted')
    with urlopen(f'{origin}/?mode=live', timeout=10) as response:
        html = response.read(1024 * 1024).decode()
        if response.status != 200 or 'data-demo="true"' in html or 'demo-fiction' in html:
            raise ValueError('Incomplete live context fell back to demo')
    print('Local demo, API validation and live isolation HTTP smoke passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:3000')
    check(parser.parse_args().url)
