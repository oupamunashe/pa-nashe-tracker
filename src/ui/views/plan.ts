/* ===================== PLAN (from prototype ui2.js) ===================== */
import { balances } from '../../calc/balances';
import { planCalc, pmt } from '../../calc/plan';
import { SUMCATS } from '../../core/constants';
import { esc, fmt, fmt0, mName, pct, sum } from '../../core/format';
import { main, S } from '../../core/state';
import { num } from '../sheet';

export function viewPlan(k) {
  const m = main(), sid = S.ui.planScen || m.scenario || '1', P = planCalc(k, sid), sc: any = m.scen?.[sid] || {};
  const C = m.calc || {};
  const stat = s => `<span class="chip ${/On target|Within/.test(s) ? 'good' : /No actual/.test(s) ? '' : 'bad'}">${s}</span>`;
  const p1 = planCalc(k, '1');
  // calculators
  const e = C.emergency || {}, lv = C.lavie || {}, bb = C.baby || {}, bg = C.big || {};
  const s1 = id => p1.rows.find(r => r.k === id)?.plan || 0;
  const essentials = s1('sultana') + s1('lavie') + s1('household') + s1('protection') + s1('health') + s1('debt') + s1('family');
  const emerContrib = s1('emergency') - (+lv.fromEmergency || 0);
  const B = balances();
  const lvCarry = (+lv.levies || 0) + (+lv.bond || 0) + (+lv.cover || 0);
  const lvTarget = lvCarry * (+lv.months || 0) + (+lv.relet || 0) * (+lv.rent || 0) * 1.15 + (+lv.touchup || 0);
  const lvMonthly = (+lv.fromEmergency || 0) + (+lv.extraBond || 0) + (+lv.escalation || 0) * (+lv.rent || 0);
  const lvBal = B.g_lavie?.bal || 0;
  const babyTarget = (+bb.birth || 0) + (+bb.essentials || 0) + (+bb.monthly || 0) * (+bb.preMonths || 0) - (+bb.gifts || 0);
  const babyGap = (+bb.leaveMonths || 0) * Math.max(0, (+bb.salary || 0) * (1 - (+bb.employerPct || 0)) - (+bb.uif || 0));
  const babyBal = Math.max(0, B.g_baby?.bal || 0);
  const carTarget = Math.max(0, (+bg.depositPct || 0) * (+bg.carPrice || 0) - (+bg.tradeIn || 0)) + (+bg.upfront || 0);
  const inst = pmt((+bg.rate || 0) / 12, 48, (+bg.carPrice || 0) * (1 - (+bg.depositPct || 0)));
  const bigBal = Math.max(0, B.g_bigpurchase?.bal || 0);
  const sprint = (sc.b?.goals?.[1]) || m.scen?.['2']?.b?.goals?.[1] || 0;
  const standFull = ((+bg.standUsd || 0) * (1 + (+bg.transferPct || 0)) + (+bg.servicesUsd || 0)) * (+bg.fx || 0) * (1 + (+bg.fxBuffer || 0));
  const standDep = (+bg.depositShare || 0) * (+bg.standUsd || 0) * (+bg.fx || 0) * (1 + (+bg.fxBuffer || 0));
  const months = (target, have, per) => per > 0 ? Math.max(0, (target - have) / per).toFixed(1) + ' months' : '–';
  const inp = (path, v, step = 'any') => `<input class="inp sm num" style="max-width:130px;text-align:right" type="number" step="${step}" inputmode="decimal" data-calc="${path}" value="${v ?? ''}">`;
  const crow = (label, input, out) => `<tr><td>${label}</td><td>${input || ''}</td><td>${out ?? ''}</td></tr>`;
  return `<div class="stack">
    <div class="pagehead"><div><h1>Plan</h1><p class="muted">How ${mName(k)} compares with your three scenarios. Scenario 1 is the everyday yardstick.</p></div>
      <div class="seg">${['1', '2', '3'].map(s => `<button data-a="planscen" data-s="${s}" aria-pressed="${s === sid}">${s} · ${esc(m.scen?.[s]?.name || '')}</button>`).join('')}</div></div>
    <section class="panel"><p style="margin:0 0 10px">${esc(sc.desc || '')}</p>
      <div class="row wrap small"><label class="lab" for="pbase">Monthly earned take-home income (plan base, excl. La Vie rent)</label>
      <input id="pbase" class="inp sm num" style="max-width:140px" type="number" data-calc="__base" value="${m.planBase || 0}">
      <span class="muted">Actual this month: ${fmt(P.actBase)}</span>
      ${sid !== (m.scenario || '1') ? `<button class="btn sm" data-a="setdefscen" data-s="${sid}">Make scenario ${sid} the default</button>` : '<span class="chip good">Default scenario</span>'}</div>
    </section>
    <section class="panel flush"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Category</th><th>Target %</th><th>Plan</th><th>Actual</th><th>Actual %</th><th>Over / (under)</th><th>Status</th></tr></thead>
      <tbody>${SUMCATS.map(c => {
        const rs = P.rows.filter(r => r.cat === c.k), cc: any = P.cats.find(x => x.k === c.k);
        return `<tr class="g"><td>${esc(c.n)}</td><td>${pct(cc.planPct, 1)}</td><td>${fmt0(cc.plan)}</td><td>${fmt0(cc.act)}</td><td>${pct(cc.actPct, 1)}</td><td class="${(cc.save ? cc.act >= cc.plan : cc.act <= cc.plan) ? 'pos' : 'neg'}">${fmt0(cc.act - cc.plan)}</td><td></td></tr>` +
          rs.map(r => `<tr><td style="padding-left:22px">${esc(r.n)}</td><td><input class="inp sm num" style="width:74px;text-align:right" type="number" step="0.5" data-scen="${sid}.${r.k}" value="${+((m.scen?.[sid]?.b?.[r.k]?.[0] || 0) * 100).toFixed(2)}"></td>
            <td>${fmt0(r.plan)}${(m.scen?.[sid]?.b?.[r.k]?.[1]) ? `<div class="tiny muted">incl. ${fmt0(m.scen[sid].b[r.k][1])} fixed</div>` : ''}</td><td>${fmt0(r.act)}</td><td>${pct(r.actPct, 1)}</td><td class="${(r.save ? r.act >= r.plan : r.act <= r.plan) ? 'pos' : 'neg'}">${fmt0(r.diff)}</td><td>${stat(r.status)}</td></tr>`).join('');
      }).join('')}
      <tr class="t"><td>Total</td><td>${pct(P.base ? P.planTotal / P.base : 0, 1)}</td><td>${fmt0(P.planTotal)}</td><td>${fmt0(P.actTotal)}</td><td>${pct(P.actBase ? P.actTotal / P.actBase : 0, 1)}</td><td>${fmt0(P.actTotal - P.planTotal)}</td><td>${Math.abs(P.base - P.planTotal) < 100 ? stat('Within plan').replace('Within plan', 'Plan balances') : `<span class="chip warn">${fmt0(P.base - P.planTotal)} ${P.base > P.planTotal ? 'unplanned' : 'over income'}</span>`}</td></tr>
      <tr><td>Funded by drawdowns & loans</td><td>0%</td><td>R0</td><td>${fmt0(P.drawn)}</td><td>${pct(P.actBase ? P.drawn / P.actBase : 0, 1)}</td><td class="${P.drawn ? 'neg' : 'pos'}">${fmt0(P.drawn)}</td><td>${P.drawn ? `<span class="chip bad">Drew ${fmt0(P.drawn)}</span>` : '<span class="chip good">None</span>'}</td></tr>
      <tr class="t"><td>Net savings rate (savings less drawdowns)</td><td>${pct(P.base ? P.savePlan / P.base : 0, 1)}</td><td>${fmt0(P.savePlan)}</td><td>${fmt0(P.net)}</td><td>${pct(P.netRate, 1)}</td><td class="${P.net >= P.savePlan ? 'pos' : 'neg'}">${fmt0(P.net - P.savePlan)}</td><td>${stat(P.net >= P.savePlan ? 'On target' : 'Below target')}</td></tr>
      </tbody></table></div>
      <p class="small muted" style="padding:0 14px">Edit a target % to change this scenario. Fixed rand amounts (sprint project, maxed TFSAs) can be changed in the calculators below.</p>
    </section>
    <div class="grid2">
      <section class="panel"><h2>Emergency fund</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Essential monthly costs (Scenario 1 plan)', '', fmt0(essentials))}
        ${crow('First milestone (months)', inp('emergency.m1', e.m1), fmt0(essentials * (+e.m1 || 0)))}
        ${crow('Full target (months)', inp('emergency.m2', e.m2), fmt0(essentials * (+e.m2 || 0)))}
        ${crow('Saved so far', '', fmt0(B.g_emergency?.bal || 0))}
        ${crow('Time to first milestone', '', months(essentials * (+e.m1 || 0), B.g_emergency?.bal || 0, emerContrib))}
        ${crow('Repayment freed when Money Savers ends', inp('emergency.stepUp', e.stepUp), months(essentials * (+e.m1 || 0), B.g_emergency?.bal || 0, emerContrib + (+e.stepUp || 0)))}
      </tbody></table></section>
      <section class="panel"><h2>La Vie vacancy reserve</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Rent (per month)', inp('lavie.rent', lv.rent), '')}
        ${crow('Levies + bond + cover if vacant', `${inp('lavie.levies', lv.levies)}`, fmt0(lvCarry))}
        ${crow('Bond instalment', inp('lavie.bond', lv.bond), '')}
        ${crow('Months of vacancy to cover', inp('lavie.months', lv.months), '')}
        ${crow('Turnover touch-ups', inp('lavie.touchup', lv.touchup), '')}
        ${crow('<b>Reserve target</b>', '', `<b>${fmt0(lvTarget)}</b>`)}
        ${crow('Current reserve (from the goal account)', '', `<span class="${lvBal < 0 ? 'neg' : ''}">${fmt0(lvBal)}</span>`)}
        ${crow('Monthly contribution (from emergency + extra bond + escalation)', inp('lavie.fromEmergency', lv.fromEmergency), fmt0(lvMonthly))}
        ${crow('Time to target (after the seed lump sum)', inp('lavie.seed', lv.seed), months(lvTarget - (+lv.seed || 0), lvBal, lvMonthly))}
      </tbody></table></section>
      <section class="panel"><h2>Baby Fund</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Months until the baby arrives', inp('baby.monthsLeft', bb.monthsLeft), '')}
        ${crow('Birth – hospital & specialists', inp('baby.birth', bb.birth), '')}
        ${crow('Essentials & nursery', inp('baby.essentials', bb.essentials), '')}
        ${crow('Monthly baby costs × months pre-funded', inp('baby.monthly', bb.monthly), fmt0((+bb.monthly || 0) * (+bb.preMonths || 0)))}
        ${crow('<b>Baby Fund target</b>', '', `<b>${fmt0(babyTarget)}</b>`)}
        ${crow('Parental-leave income gap', inp('baby.leaveMonths', bb.leaveMonths), fmt0(babyGap))}
        ${crow('Current Baby Fund', '', fmt0(babyBal))}
        ${crow('Needed per month to be ready', '', fmt0((+bb.monthsLeft || 0) ? Math.max(0, babyTarget - babyBal) / bb.monthsLeft : 0))}
        ${crow('Shortfall at birth at planned contribution', inp('baby.planned', bb.planned), `<span class="neg">${fmt0(Math.max(0, babyTarget - babyBal - (+bb.planned || 0) * (+bb.monthsLeft || 0)))}</span>`)}
      </tbody></table></section>
      <section class="panel"><h2>Big purchase</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Everyday contribution (Scenario 1)', inp('big.everyday', bg.everyday), '')}
        ${crow('Car price', inp('big.carPrice', bg.carPrice), '')}
        ${crow('Deposit share (0.2 = 20%)', inp('big.depositPct', bg.depositPct, '0.01'), '')}
        ${crow('<b>Car savings target</b>', '', `<b>${fmt0(carTarget)}</b>`)}
        ${crow('Instalment over 48 months', inp('big.rate', bg.rate, '0.005'), `${fmt0(inst)} (${pct(m.planBase ? inst / m.planBase : 0, 1)} of income)`)}
        ${crow('Months to car target – everyday / sprint', '', months(carTarget, bigBal, +bg.everyday || 0) + ' / ' + months(carTarget, bigBal, sprint))}
        ${crow('Zimbabwe stand price (USD)', inp('big.standUsd', bg.standUsd), '')}
        ${crow('Exchange rate (R per US$)', inp('big.fx', bg.fx, '0.01'), '')}
        ${crow('Stand deposit / full cash target', '', fmt0(standDep) + ' / ' + fmt0(standFull))}
        ${crow('Months to full stand – sprint', '', months(standFull, bigBal, sprint))}
      </tbody></table></section>
    </div>
    <p class="small muted">A planning framework, not financial advice. Sources and reasoning for each target are in your 2026 spreadsheet’s Plan sheet.</p>
  </div>`;
}
