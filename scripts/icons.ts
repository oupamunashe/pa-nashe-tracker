/* npm run icons – builds the app icons in public/ from the logo dot: Munny brown (left) and Piepie lavender
   (right), exactly as app.css draws .brandmark .dot (conic-gradient, lavender first from 12 o'clock). */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PP = '#dfc5fe', MM = '#ae8774', BG = '#EEF2EF';
const dot = (size: number, d: number) => {
  const c = size / 2, r = d / 2;
  return `<path d="M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} Z" fill="${PP}"/><path d="M${c} ${c + r} A${r} ${r} 0 0 1 ${c} ${c - r} Z" fill="${MM}"/>`;
};
const svg = (size: number, share: number, bg = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ''}${dot(size, size * share)}</svg>`;

mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', svg(64, 1, false));
const png = (file: string, size: number, share: number) => sharp(Buffer.from(svg(size, share))).png().toFile('public/' + file);
await Promise.all([
  png('icon-192.png', 192, 0.62),
  png('icon-512.png', 512, 0.62),
  png('icon-maskable-512.png', 512, 0.5),      // stays inside the 80% safe zone when Android crops it
  png('apple-touch-icon.png', 180, 0.62),
]);
console.log('icons written to public/');
