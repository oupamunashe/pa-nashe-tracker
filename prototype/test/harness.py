"""Run the prototype in headless Chromium with an in-memory mock of the claude.ai runtime.
Usage from the package root:  pip install playwright && playwright install chromium
                              python private/tests/test_flows.py
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright  # noqa: F401  (re-exported for tests)

ROOT = Path(__file__).resolve().parents[2]
HTML = (ROOT / 'prototype' / 'index.html').read_text()
MOCK = (ROOT / 'prototype' / 'test' / 'mock.js').read_text()
XLSX_CANDIDATES = [ROOT / 'node_modules' / 'xlsx' / 'dist' / 'xlsx.full.min.js']

def store_from_backup(path):
    b = json.loads(Path(path).read_text())
    s = {}
    for k, v in b.get('config', {}).items(): s['config/' + k] = v
    for k, v in b.get('months', {}).items(): s['months/' + k] = v
    for k, v in b.get('milestones', {}).items(): s['milestones/' + k] = v
    return s

def page(browser, viewport, me='P', errs=None, backup=ROOT / 'private' / 'data' / 'seed-reference' / 'backup.json'):
    xl = next((p.read_text() for p in XLSX_CANDIDATES if p.exists()), None)
    pg = browser.new_page(viewport=viewport)
    def route(r):
        u = r.request.url
        if u.startswith('http://app.test'): r.fulfill(body=HTML, content_type='text/html')
        elif 'xlsx.full.min.js' in u and xl: r.fulfill(body=xl, content_type='application/javascript')
        else: r.abort()
    pg.route('**/*', route)
    if errs is not None:
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    init = 'window.__SEED__=' + json.dumps(json.dumps(store_from_backup(backup))) + ';'
    if me: init += 'try{localStorage.setItem("pn_me","%s")}catch(e){};' % me
    pg.add_init_script(init + MOCK)
    pg.goto('http://app.test/'); pg.wait_for_timeout(900)
    return pg
