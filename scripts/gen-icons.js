// One-off Freight Terminal icon generator. Renders brand SVGs → PNG assets via
// resvg, using the real JetBrains Mono ExtraBold for the "TN" monogram.
// Run: node scripts/gen-icons.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
const FONT = path.join(ROOT, 'node_modules/@expo-google-fonts/jetbrains-mono/800ExtraBold/JetBrainsMono_800ExtraBold.ttf');

const BG    = '#0A0A0B';
const TEAL  = '#00C896';
const AMBER = '#E8A020';
const GRID  = '#15403B';

// Faint 64px grid across a SIZE×SIZE canvas.
function grid(size, opacity = 0.4) {
  const step = size / 16;
  let lines = '';
  for (let i = 1; i < 16; i++) {
    const p = Math.round(i * step);
    lines += `<line x1="${p}" y1="0" x2="${p}" y2="${size}" stroke="${GRID}" stroke-width="${size/512}" stroke-opacity="${opacity}"/>`;
    lines += `<line x1="0" y1="${p}" x2="${size}" y2="${p}" stroke="${GRID}" stroke-width="${size/512}" stroke-opacity="${opacity}"/>`;
  }
  return lines;
}

// The TN monogram + amber accent bar, scaled to a canvas of `size`, with the
// glyph centered. `scale` shrinks the mark (for Android adaptive safe zone).
function mark(size, scale = 1) {
  const cx = size / 2;
  const fs = size * 0.42 * scale;
  const baseline = cx + fs * 0.35;        // center caps vertically
  const barW = size * 0.30 * scale;
  const barH = size * 0.022;
  const barY = baseline + fs * 0.16;
  return `
    <text x="${cx}" y="${baseline}" font-family="JetBrains Mono" font-weight="800"
          font-size="${fs}" letter-spacing="${-fs*0.02}" fill="${TEAL}"
          text-anchor="middle">TN</text>
    <rect x="${cx - barW/2}" y="${barY}" width="${barW}" height="${barH}" rx="${barH*0.2}" fill="${AMBER}"/>
  `;
}

function svgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${grid(size)}
    <rect x="${size*0.06}" y="${size*0.06}" width="${size*0.88}" height="${size*0.88}" fill="none"
          stroke="${TEAL}" stroke-opacity="0.22" stroke-width="${size/170}"/>
    ${mark(size)}
  </svg>`;
}

function svgTransparentMark(size, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${mark(size, scale)}
  </svg>`;
}

function svgBackground(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${grid(size, 0.5)}
  </svg>`;
}

function render(svg, outPath, size) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles: [FONT], loadSystemFonts: true, defaultFontFamily: 'JetBrains Mono' },
    background: 'rgba(0,0,0,0)',
  });
  fs.writeFileSync(outPath, r.render().asPng());
  console.log('wrote', path.relative(ROOT, outPath));
}

const A = (f) => path.join(ROOT, 'assets', f);
render(svgIcon(1024),                 A('icon.png'), 1024);
render(svgIcon(1024),                 A('splash-icon.png'), 1024);          // dark mark for native splash
render(svgBackground(1024),           A('android-icon-background.png'), 1024);
render(svgTransparentMark(1024, 0.62),A('android-icon-foreground.png'), 1024); // safe-zone padded
render(svgTransparentMark(1024, 0.62),A('android-icon-monochrome.png'), 1024);
render(svgIcon(64),                   A('favicon.png'), 64);
console.log('done');
