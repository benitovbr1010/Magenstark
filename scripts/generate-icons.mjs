import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("./icon-source.svg", import.meta.url));

const targets = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/maskable-512.png", size: 512 },
  { file: "public/icons/apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(t.file);
  console.log("wrote", t.file);
}
