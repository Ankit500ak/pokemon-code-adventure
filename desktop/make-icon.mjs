// Generates the app icon (desktop/icon.png + desktop/icon.ico) with no
// external tooling: a Poké-ball-style mark drawn pixel by pixel into an
// RGBA buffer, encoded as PNG with Node's zlib, and wrapped as a
// PNG-compressed ICO (valid Vista+).
//   node desktop/make-icon.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 256;
const px = new Uint8Array(SIZE * SIZE * 4); // RGBA, starts transparent

function set(x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}

const RED = [213, 51, 43], WHITE = [245, 245, 245], BLACK = [24, 24, 28], GREY = [140, 148, 158];
const cx = SIZE / 2, cy = SIZE / 2, R = 118;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx + 0.5, dy = y - cy + 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) continue;                       // transparent outside
    let color = dy < 0 ? RED : WHITE;          // top red, bottom white
    if (Math.abs(dy) <= 11) color = BLACK;     // centre band
    if (d <= 30) color = BLACK;                // button rim
    if (d <= 21) color = WHITE;                // button face
    if (d <= 10) color = GREY;                 // button centre
    if (d > R - 5) color = BLACK;              // outline
    set(x, y, color);
  }
}

// --- minimal PNG encoder (filter 0 scanlines + zlib) ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = encodePNG(SIZE, px);

// --- ICO wrap (single 256x256 PNG-compressed entry) ---
const ico = Buffer.alloc(6 + 16);
ico.writeUInt16LE(0, 0);      // reserved
ico.writeUInt16LE(1, 2);      // type: icon
ico.writeUInt16LE(1, 4);      // image count
ico[6] = 0;                   // width  (0 = 256)
ico[7] = 0;                   // height (0 = 256)
ico[8] = 0;                   // palette colours
ico[9] = 0;                   // reserved
ico.writeUInt16LE(1, 10);     // colour planes
ico.writeUInt16LE(32, 12);    // bits per pixel
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(6 + 16, 18); // image data offset

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "icon.png"), png);
writeFileSync(join(dir, "icon.ico"), Buffer.concat([ico, png]));
console.log(`icon.png (${png.length} bytes) and icon.ico (${png.length + 22} bytes) written to ${dir}`);
