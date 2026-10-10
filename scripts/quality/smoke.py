"""Local HTTP smoke, without cloud credentials or remote target support."""
import argparse
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
    print('Local demo HTTP smoke passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:3000')
    check(parser.parse_args().url)
