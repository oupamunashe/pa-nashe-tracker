/* ===================== bar chart (from prototype ui2.js) ===================== */
import { esc, fmt0 } from '../core/format';

export function barChart(series, labels, opts: any = {}) {
  const W = 720, H = opts.h || 220, pad = 34, n = labels.length;
  const vals = series.flatMap(s => s.v);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const y = v => H - pad - (v - min) / (max - min) * (H - pad - 14);
  const bw = (W - pad) / n, gw = bw * 0.72 / series.length;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'chart')}">`;
  [0, .25, .5, .75, 1].forEach(f => { const v = min + (max - min) * f; out += `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad - 4}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--faint)">${Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text>`; });
  labels.forEach((l, i) => {
    series.forEach((s, j) => {
      if (s.line) return;
      const v = s.v[i] || 0, x = pad + i * bw + bw * 0.14 + j * gw;
      out += `<rect x="${x}" y="${Math.min(y(v), y(0))}" width="${Math.max(1, gw - 2)}" height="${Math.abs(y(v) - y(0))}" rx="2" fill="${s.c}"><title>${esc(s.n)} ${esc(l)}: ${fmt0(v)}</title></rect>`;
    });
    out += `<text x="${pad + i * bw + bw / 2}" y="${H - 12}" font-size="10.5" text-anchor="middle" fill="var(--muted)">${esc(l)}</text>`;
  });
  series.filter(s => s.line).forEach(s => {
    const pts = s.v.map((v, i) => `${pad + i * bw + bw / 2},${y(v || 0)}`).join(' ');
    out += `<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2.5"/>` + s.v.map((v, i) => `<circle cx="${pad + i * bw + bw / 2}" cy="${y(v || 0)}" r="3.5" fill="${s.c}"><title>${esc(s.n)} ${esc(labels[i])}: ${fmt0(v)}</title></circle>`).join('');
  });
  return out + '</svg>';
}
