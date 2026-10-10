"""WCAG presentation token pairs; no scientific classification thresholds."""
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
css = (ROOT / 'apps/web/styles/tokens.css').read_text()
blocks = re.findall(r'(?:\:root|\[data-theme[^\]]+\])\s*\{([^}]+)\}', css)
def tokens(block):
    return dict(re.findall(r'--([\w-]+):\s*(#[\da-fA-F]{6})\s*;', block))
def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    channels = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
    return sum(c * w for c, w in zip(channels, [.2126, .7152, .0722]))
def ratio(a, b):
    bright, dark = sorted([luminance(a), luminance(b)], reverse=True)
    return (bright + .05) / (dark + .05)
checks = []
base = tokens(blocks[0])
for theme, palette in [('light', base), ('dark', base | tokens(blocks[1]))]:
    pairs = [(ink, bg, 4.5) for ink in ['text-primary', 'text-muted', 'interactive'] for bg in ['surface-base', 'surface-raised', 'surface-subtle']]
    pairs += [('on-interactive', 'interactive', 4.5), ('demo-ink', 'demo-bg', 4.5)]
    pairs += [('critical-ink' if level == 'critical' else 'risk-ink', 'risk-' + level, 4.5) for level in ['low', 'moderate', 'high', 'critical', 'unavailable']]
    pairs += [(ink, bg, 3) for ink in ['focus', 'control-border'] for bg in ['surface-base', 'surface-raised', 'surface-subtle']]
    for ink, bg, minimum in pairs:
        actual = ratio(palette[ink], palette[bg])
        checks.append({'theme': theme, 'foreground': ink, 'background': bg, 'ratio': round(actual, 3), 'minimum': minimum})
        assert actual >= minimum, (theme, ink, bg, actual)
Path(__file__).with_name('contrast.json').write_text(json.dumps(checks, indent=2))
print(f'{len(checks)} contrastes texte/focus/contrôles validés en clair et sombre.')
