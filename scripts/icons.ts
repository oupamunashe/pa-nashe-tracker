/* npm run icons – the app's logo and icons from the owners' artwork “Linktree Art.png” (project root, git-ignored:
   it is a personal photo). Only the white “PM.” mark is lifted out of it – pixel by pixel, near-white and
   unsaturated = mark, everything else transparent – so none of the photo ends up in the published files.
   Writes public/pm-mark.png (white mark, transparent, used in the app header via a CSS mask); favicon.ico (32),
   icon-192 and icon-512 as the mark on a transparent background; favicon.svg, the same mark that turns dark
   on light browser tabs (a white mark alone would vanish there); and, on the app's base colour #1C1E26,
   apple-touch-icon (180 – iOS fills transparency with black) and the maskable 512 (Android crops it to a shape). */
import { existsSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = process.argv[2] || 'Linktree Art.png';
const BG = { r: 0x1c, g: 0x1e, b: 0x26 }, INK = { r: 0xe8, g: 0xe9, b: 0xee };
if (!existsSync(SRC)) { console.error(`${SRC} not found – put the artwork in the project root.`); process.exit(1); }

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
// the mark sits in the middle band of the artwork, above the “piepie na munny” line
const R = { x0: Math.round(W * 0.15), y0: Math.round(H * 0.27), x1: Math.round(W * 0.85), y1: Math.round(H * 0.585) };
const alphaAt = (x: number, y: number) => {
  const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return clamp((mn - 120) / (205 - 120)) * clamp((70 - (mx - mn)) / 40);
};
// keep only the large shapes (stem, bowl, two strokes, dot): small light specks in the photo are dropped
const RW = R.x1 - R.x0, RH = R.y1 - R.y0, label = new Int32Array(RW * RH);
const solid = (x: number, y: number) => alphaAt(R.x0 + x, R.y0 + y) > 0.5;
const sizes: number[] = [0];
for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
  if (label[y * RW + x] || !solid(x, y)) continue;
  const id = sizes.length; let n = 0; const stack = [y * RW + x]; label[y * RW + x] = id;
  while (stack.length) {
    const q = stack.pop()!, qx = q % RW, qy = (q / RW) | 0; n++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = qx + dx, ny = qy + dy;
      if (nx < 0 || ny < 0 || nx >= RW || ny >= RH || label[ny * RW + nx] || !solid(nx, ny)) continue;
      label[ny * RW + nx] = id; stack.push(ny * RW + nx);
    }
  }
  sizes.push(n);
}
const biggest = Math.max(...sizes), keep = new Set(sizes.map((n, i) => (i && n > biggest * 0.05 ? i : 0)).filter(Boolean));
console.log(`shapes kept: ${keep.size} of ${sizes.length - 1}`);
const kept = (x: number, y: number) => { const rx = x - R.x0, ry = y - R.y0; return rx >= 0 && ry >= 0 && rx < RW && ry < RH && keep.has(label[ry * RW + rx]); };
const nearKept = (x: number, y: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (kept(x + dx, y + dy)) return true; return false; };
let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (kept(x, y)) {
  if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
}
const pad = 6; bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;
const mw = bx1 - bx0 + 1, mh = by1 - by0 + 1;
const rgba = Buffer.alloc(mw * mh * 4);
for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
  const o = (y * mw + x) * 4, a = nearKept(bx0 + x, by0 + y) ? alphaAt(bx0 + x, by0 + y) : 0;
  rgba[o] = INK.r; rgba[o + 1] = INK.g; rgba[o + 2] = INK.b; rgba[o + 3] = Math.round(a * 255);
}
const mark = sharp(rgba, { raw: { width: mw, height: mh, channels: 4 } });
const markPng = await mark.png().toBuffer();
console.log(`mark found at ${bx0},${by0} – ${mw}×${mh}px (aspect ${(mw / mh).toFixed(3)})`);

await sharp(markPng).resize({ height: 256 }).png().toFile('public/pm-mark.png');

/** the mark centred on #1C1E26 (or on transparency with `clear`), `share` of the width */
async function icon(size: number, share: number, clear = false) {
  const w = Math.round(size * share), h = Math.round(w * mh / mw);
  const m = await sharp(markPng).resize({ width: w, height: h }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...BG, alpha: clear ? 0 : 1 } } })
    .composite([{ input: m, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }]).png().toBuffer();
}
writeFileSync('public/icon-192.png', await icon(192, 0.86, true));
writeFileSync('public/icon-512.png', await icon(512, 0.86, true));
writeFileSync('public/icon-maskable-512.png', await icon(512, 0.56));   // inside the 80% safe zone Android crops to
writeFileSync('public/apple-touch-icon.png', await icon(180, 0.72));

// favicon.ico: one 32×32 PNG in an ICO container (supported by every current browser)
const fav = await icon(32, 0.94, true);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);                 // header: icon, 1 image
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);   // 32×32, no palette
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(fav.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([ico, fav]));
// favicon.svg: the mark as an alpha mask over one colour – #1C1E26 on light tabs, near-white on dark ones
const m64 = (await sharp(markPng).resize({ height: 96 }).png().toBuffer()).toString('base64'), vw = Math.round(96 * mw / mh);
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vw} ${vw}">
<style>rect{fill:#1C1E26}@media (prefers-color-scheme:dark){rect{fill:#E8E9EE}}</style>
<mask id="m" style="mask-type:alpha"><image width="${vw}" height="96" y="${(vw - 96) / 2}" xlink:href="data:image/png;base64,${m64}"/></mask>
<rect width="${vw}" height="${vw}" mask="url(#m)"/></svg>
`);
console.log('written: public/pm-mark.png, favicon.ico, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png');
