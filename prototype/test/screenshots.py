"""Regenerate the reference screenshots in prototype/screenshots/."""
import sys; sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from harness import *
OUT = ROOT / 'private' / 'screenshots'; OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('phone', {'width': 390, 'height': 844}), ('desktop', {'width': 1360, 'height': 900})]:
        pg = page(b, vp)
        for v in ['home', 'budget', 'people', 'accounts', 'plan', 'year', 'milestones', 'more', 'items']:
            pg.evaluate(f"closeAll();S.ui.view='{v}';render()"); pg.wait_for_timeout(150)
            pg.screenshot(path=str(OUT / f'{name}-{v}.png'), full_page=(name == 'phone'))
        pg.evaluate("S.ui.acc='pool_m';S.ui.view='account';render()"); pg.wait_for_timeout(120); pg.screenshot(path=str(OUT / f'{name}-account.png'))
        pg.evaluate("S.ui.msId='zim-2026';S.ui.view='milestone';render()"); pg.wait_for_timeout(120); pg.screenshot(path=str(OUT / f'{name}-milestone.png'))
        pg.evaluate("S.ui.view='budget';render();sheetTxn()"); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT / f'{name}-sheet-capture.png'))
        pg.evaluate("closeAll();sheetLine('2026-10','life-cover-death-income-protection-severe-critic')"); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT / f'{name}-sheet-line.png'))
        pg.evaluate("closeAll();sheetWho()"); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT / f'{name}-sheet-who.png'))
        pg.evaluate("closeAll();S.ui.view='year';render();sheetTrend('groceries')"); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT / f'{name}-sheet-trend.png'))
        pg.evaluate("closeAll();document.documentElement.dataset.theme='dark';S.ui.view='home';render()"); pg.wait_for_timeout(150); pg.screenshot(path=str(OUT / f'{name}-home-dark.png'))
        pg.close()
    b.close()
print('screenshots written to', OUT)
