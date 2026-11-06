// Generates the placeholder PWA icons from the brand tokens. Run: npm run icons
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const tokens = JSON.parse(await readFile("_brand/tokens.json", "utf8"));
const { primary, surface, goldTint } = tokens.color;

const mark = `
  <path d="M13 33v-7a11 11 0 0 1 22 0v7h-7v-5a4 4 0 0 0-8 0v5z" fill="${surface}"/>
  <path d="M9 33V21l1.5-3 1.5 3v12zM36 33V21l1.5-3 1.5 3v12z" fill="${surface}"/>
  <rect x="8" y="34" width="32" height="2.5" rx="1" fill="${goldTint}"/>
  <circle cx="24" cy="11.5" r="2.5" fill="${goldTint}"/>`;

// Full-bleed square, with the mark scaled down into the maskable safe zone.
const square = (scale) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="${primary}"/>
    <g transform="translate(24 24) scale(${scale}) translate(-24 -24)">${mark}</g>
  </svg>`;

const outputs = [
  ["public/icons/icon-192.png", 192, 1],
  ["public/icons/icon-512.png", 512, 1],
  ["public/icons/maskable-512.png", 512, 0.72],
  ["app/apple-icon.png", 180, 0.9],
  ["app/icon.png", 48, 1],
];

for (const [path, size, scale] of outputs) {
  await sharp(Buffer.from(square(scale)), { density: 600 }).resize(size, size).png().toFile(path);
  console.log(path);
}
