"""Optional browser checks. Run from repo root with Playwright, Chromium and local server.
AXE_PATH points to an extracted axe-core/axe.min.js (4.14.0 used for this report).
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT = Path(__file__).parent
BASE = os.environ.get('TASK05_BASE_URL', 'http://127.0.0.1:3000')
AXE = os.environ.get('AXE_PATH', 'work/axe.min.js')
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, width, height in [('desktop', 1440, 900), ('tablet', 1024, 768), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, locale='fr-FR')
        errors, external = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if not request.url.startswith(BASE) else None)
        assert page.goto(BASE).status == 200
        page.evaluate('document.fonts.ready')
        page.get_by_role('heading', name='Observer les territoires').wait_for()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(OUTPUT / f'{name}.png'), full_page=True)
        page.screenshot(path=str(OUTPUT / f'{name}-viewport.png'))
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.className') == 'skip-link'
        page.keyboard.press('Enter')
        assert page.evaluate('document.activeElement.id') == 'main'
        if name == 'mobile':
            trigger = page.get_by_role('button', name='Filtres', exact=True)
            trigger.click()
            dialog = page.get_by_role('dialog', name='Filtrer le contexte')
            assert dialog.is_visible()
            # Focus remains within modal even when keyboard cycles.
            for _ in range(12):
                page.keyboard.press('Tab')
                assert page.evaluate('!!document.activeElement.closest("dialog")')
            page.keyboard.press('Escape')
            assert not dialog.is_visible()
            assert trigger.evaluate('(node) => node === document.activeElement')
            page.get_by_role('button', name='Veille', exact=True).click()
            page.get_by_role('heading', name='Veille climatique').wait_for()
            assert 'view=watch' in page.url
            page.screenshot(path=str(OUTPUT / 'mobile-watch.png'), full_page=True)
            page.get_by_role('button', name='Voir le diagnostic').filter(visible=True).click()
        else:
            page.get_by_role('button', name='Voir le diagnostic').first.click()
        dialog = page.get_by_role('dialog', name='Diagnostic · démonstration').filter(visible=True)
        assert dialog.is_visible()
        assert dialog.get_by_text('Source : demo-fiction (fictive)', exact=True).is_visible()
        page.screenshot(path=str(OUTPUT / f'{name}-diagnostic.png'))
        page.keyboard.press('Escape')
        if name == 'tablet':
            page.get_by_role('button', name='Replier la veille').click()
            assert not page.locator('.watch-panel').is_visible()
            page.get_by_role('button', name='Afficher la veille').click()
            assert page.locator('.watch-panel').is_visible()
        if name == 'mobile':
            page.get_by_role('button', name='Carte', exact=True).click()
            page.get_by_role('button', name='Filtres', exact=True).click()
            form = page.get_by_role('dialog', name='Filtrer le contexte')
        else:
            form = page.locator('.context-bar .desktop-only')
        form.get_by_label('Production', exact=True).select_option('dairy_cattle')
        page.get_by_text('Données absentes', exact=True).first.wait_for()
        assert 'production=dairy_cattle' in page.url
        if name == 'mobile':
            page.keyboard.press('Escape')
        page.goto(BASE + '/?production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&territory=demo-001&compare=2026-06-30')
        if name == 'mobile':
            page.get_by_role('button', name='Veille', exact=True).click()
        else:
            page.get_by_role('button', name='Veille', exact=True).click()
        page.wait_for_url('**view=watch')
        assert all(part in page.url for part in ['production=wheat_soft', 'indicator=tmax_days_above', 'date=2026-07-01', 'territory=demo-001', 'compare=2026-06-30'])
        page.go_back()
        page.get_by_role('heading', name='Observer les territoires').wait_for()
        page.get_by_role('button', name='Activer le thème sombre').click()
        page.reload()
        assert page.evaluate('document.documentElement.dataset.theme') == 'dark'
        page.screenshot(path=str(OUTPUT / f'{name}-dark.png'), full_page=True)
        page.goto(BASE + '/design-system')
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('.skeleton').evaluate('(node) => getComputedStyle(node).animationName') == 'none'
        for theme in ['light', 'dark']:
            for route in ['/', '/design-system']:
                page.goto(BASE + route)
                page.evaluate(f"document.documentElement.dataset.theme = '{theme}'")
                page.evaluate('document.fonts.ready')
                page.add_script_tag(path=AXE)
                audit = page.evaluate("async () => { const r = await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa']}}); return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:r.passes.length}; }")
                results.append({'viewport': name, 'theme': theme, 'route': route, **audit})
                assert not audit['violations'], audit['violations']
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not errors, errors
        assert not external, external
        print(f'{name}: responsive, clavier, contexte URL, thèmes, reduced motion, axe AA OK')
        page.close()
    browser.close()
(OUTPUT / 'axe.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
