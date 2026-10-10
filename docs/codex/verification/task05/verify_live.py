"""Read-only checks of Task 04 endpoints and Task 05's explicit live-empty shell.
Run against next start using the configured DEV credentials; no database writes.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
from playwright.sync_api import sync_playwright

OUTPUT = Path(__file__).parent
BASE = os.environ.get('TASK05_BASE_URL', 'http://127.0.0.1:3000')
COMMON = 'production=wheat_soft&indicator=tmax_days_above&rule=demo-rule&version=1.0'
MAP = COMMON + '&date=2026-07-01&bbox=-5,43,1,49'
QUERIES = {'map': MAP, 'series': COMMON + '&cell=demo-001&start=2026-07-01&end=2026-07-01', 'territory': COMMON + '&start=2026-07-01&end=2026-07-01&bbox=-5,43,1,49'}
result = {'tested_at': datetime.now(timezone.utc).isoformat(), 'endpoints': {}, 'ui': []}
for kind, query in QUERIES.items():
    with urlopen(BASE + '/api/risks/' + kind + '?' + query, timeout=30) as response:
        payload = json.load(response)
        assert response.status == 200
        assert response.headers.get('Cache-Control') == 'no-store'
        secret = os.environ.get('SUPABASE_SECRET_KEY')
        encoded = json.dumps(payload)
        assert not secret or secret not in encoded
        assert 'SUPABASE_SECRET_KEY' not in encoded and 'sb_secret_' not in encoded
        if kind == 'map': assert payload['features'] == [] and not payload['truncated']
        elif kind == 'series': assert payload == []
        else: assert payload['groups'] == []
        result['endpoints'][kind] = {'status': response.status, 'body': payload, 'cache_control': 'no-store', 'secret_absent': True}
try:
    urlopen(BASE + '/api/risks/map?bbox=invalid', timeout=10)
    raise AssertionError('Invalid query accepted')
except HTTPError as error:
    assert error.code == 400
    result['invalid_query'] = {'status': error.code, 'body': json.load(error)}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, w, h in [('desktop', 1440, 900), ('tablet', 1024, 768), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': w, 'height': h})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        assert page.goto(BASE + '/?mode=live&' + MAP).status == 200
        page.get_by_text('Données live', exact=True).first.wait_for()
        assert page.get_by_text('Données absentes', exact=True).first.is_visible()
        assert page.locator('[data-demo="true"]').count() == 0
        assert page.locator('.risk').count() == 0
        assert page.get_by_text('demo-fiction', exact=True).count() == 0
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(OUTPUT / (name + '-live-empty.png')), full_page=True)
        page.get_by_role('button', name='Veille', exact=True).click()
        page.wait_for_url('**view=watch')
        assert all(part in page.url for part in ['mode=live', 'rule=demo-rule', 'version=1.0', 'bbox='])
        assert page.locator('[data-demo="true"]').count() == 0
        if name == 'mobile':
            page.get_by_role('button', name='Filtres', exact=True).click()
            form = page.get_by_role('dialog', name='Filtrer le contexte')
        else: form = page.locator('.context-bar .desktop-only')
        form.get_by_label('Production', exact=True).select_option('dairy_cattle')
        page.wait_for_url('**production=dairy_cattle**')
        assert 'mode=live' in page.url and 'rule=demo-rule' in page.url and 'bbox=' in page.url
        if name == 'mobile': page.keyboard.press('Escape')
        page.get_by_text('Données absentes', exact=True).filter(visible=True).first.wait_for()
        assert page.locator('[data-demo="true"]').count() == 0
        page.add_script_tag(path=os.environ.get('AXE_PATH', 'work/axe.min.js'))
        audit = page.evaluate("async () => {const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations,passes:r.passes.length};}")
        assert not audit['violations'], audit['violations']
        assert not errors, errors
        result['ui'].append({'viewport': name, 'empty_state': True, 'demo_absent': True, 'live_context_preserved': True, 'overflow': False, 'errors': errors, 'axe': audit})
        page.close()
    browser.close()
(OUTPUT / 'live-http-ui.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print('map/series/territory: HTTP 200, payloads live vides, no-store, aucun secret ; UI live vide OK aux 3 résolutions.')
