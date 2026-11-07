"""Targeted token contrast and simulated colour-vision checks, not a WCAG certification."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
css = (ROOT / 'apps/web/styles/tokens.css').read_text()

def properties(block):
    return dict(re.findall(r'(--[a-z0-9-]+)\s*:\s*(#[a-fA-F0-9]{6})\s*;', block))

light = {}
for block in re.findall(r':root\s*\{([^}]+)', css):
    light.update(properties(block))
dark = {**light, **properties(re.search(r'\[data-theme="dark"\]\s*\{([^}]+)', css)[1])}

def linear(ink):
    rgb = [int(ink[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]

def luminance(ink):
    return sum(a*b for a, b in zip(linear(ink), [.2126, .7152, .0722]))

def contrast(a, b):
    x, y = sorted([luminance(a), luminance(b)])
    return (y+.05)/(x+.05)

report = {'contrast': [], 'colour_vision': [], 'scope': 'Token checks; numerical legends and keyboard territory selectors complement colour.'}
for theme, tokens in [('light', light), ('dark', dark)]:
    for text in ['--text-primary', '--text-muted']:
        for surface in ['--surface-base', '--surface-raised', '--surface-subtle']:
            ratio = contrast(tokens[text], tokens[surface])
            report['contrast'].append({'theme': theme, 'text': text, 'surface': surface, 'ratio': round(ratio, 2), 'minimum': 4.5})
            assert ratio >= 4.5, (theme, text, surface, ratio)
    ratio = contrast(tokens['--control-border'], tokens['--surface-raised'])
    report['contrast'].append({'theme': theme, 'text': '--control-border', 'surface': '--surface-raised', 'ratio': round(ratio, 2), 'minimum': 3})
    assert ratio >= 3

# Machado et al. 2009, severity 1.0, applied to linear RGB; CIE76 distance is a diagnostic.
matrices = {
    'protanopia': [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
    'deuteranopia': [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]],
    'tritanopia': [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]],
}

def lab(rgb):
    xyz = [sum(a*b for a, b in zip(rgb, row))/white for row, white in zip([[.4124564, .3575761, .1804375], [.2126729, .7151522, .0721750], [.0193339, .1191920, .9503041]], [.95047, 1, 1.08883])]
    f = [v**(1/3) if v > .008856 else 7.787*v+16/116 for v in xyz]
    return [116*f[1]-16, 500*(f[0]-f[1]), 200*(f[1]-f[2])]

families = {name: [f'--map-{name}-{i}' for i in range(1, 6)] for name in ['rain', 'dry', 'agri', 'gdd']}
families['thermal'] = ['--map-cool', '--map-cool-light', '--map-mid', '--map-warm-light', '--map-warm']
for family, keys in families.items():
    for condition, matrix in matrices.items():
        transformed = [lab([max(0, min(1, sum(a*b for a, b in zip(linear(light[key]), row)))) for row in matrix]) for key in keys]
        distances = [math.dist(a, b) for a, b in zip(transformed, transformed[1:])]
        report['colour_vision'].append({'family': family, 'condition': condition, 'minimum_adjacent_delta_e76': round(min(distances), 2)})
        assert min(distances) > 5, (family, condition, distances)
output = ROOT / 'docs/codex/task30/evidence/accessibility.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print('Task30 token contrast and three colour-vision simulations passed; not a full accessibility certification.')
