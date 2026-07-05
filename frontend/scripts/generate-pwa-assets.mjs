/**
 * PWA install-asset generator (issue #395).
 *
 * Deterministic, sharp-only. Generates into frontend/public/:
 *   - Maskable app icons (192, 512): full-bleed #1a1a2e with the logo inside
 *     the maskable safe zone (~80% of the icon, centered).
 *   - iOS apple-touch-startup-image splash screens (portrait only) for the
 *     device table below: solid #1a1a2e with the logo centered at ~25% of the
 *     shorter (width) dimension.
 *   - Shortcut icons (96) for the manifest shortcuts.
 *
 * It also PRINTS the exact <link rel="apple-touch-startup-image"> block to
 * paste into index.html.
 *
 * Run: node scripts/generate-pwa-assets.mjs   (via `pnpm run generate:pwa-assets`)
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(FRONTEND_DIR, "public");

// Highest-resolution source art available (2000x2000).
const SOURCE_LOGO = path.join(PUBLIC_DIR, "Semaphore S.png");

// Brand background (theme_color / background_color).
const BG = { r: 0x1a, g: 0x1a, b: 0x2e, alpha: 1 };

// Maskable safe-zone: content occupies ~80% of the icon, centered.
const MASKABLE_SAFE_RATIO = 0.8;
// Splash logo size: ~25% of the shorter (portrait width) dimension.
const SPLASH_LOGO_RATIO = 0.25;
// Shortcut icon logo size: ~80% of the 96px tile.
const SHORTCUT_LOGO_RATIO = 0.8;

/**
 * iOS device table (portrait). Pixel width/height are the splash-image size;
 * deviceWidth/deviceHeight/pixelRatio drive the <link media=...> query.
 */
const IOS_DEVICES = [
  { name: "iPhone SE/8", width: 750, height: 1334, deviceWidth: 375, deviceHeight: 667, pixelRatio: 2 },
  { name: "iPhone X/XS/11 Pro/12 mini/13 mini", width: 1125, height: 2436, deviceWidth: 375, deviceHeight: 812, pixelRatio: 3 },
  { name: "iPhone XR/11", width: 828, height: 1792, deviceWidth: 414, deviceHeight: 896, pixelRatio: 2 },
  { name: "iPhone XS Max/11 Pro Max", width: 1242, height: 2688, deviceWidth: 414, deviceHeight: 896, pixelRatio: 3 },
  { name: "iPhone 12/13/14", width: 1170, height: 2532, deviceWidth: 390, deviceHeight: 844, pixelRatio: 3 },
  { name: "iPhone 12/13 Pro Max/14 Plus", width: 1284, height: 2778, deviceWidth: 428, deviceHeight: 926, pixelRatio: 3 },
  { name: "iPhone 14 Pro/15/16", width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, pixelRatio: 3 },
  { name: "iPhone 14 Pro Max/15 Plus/16 Plus", width: 1290, height: 2796, deviceWidth: 430, deviceHeight: 932, pixelRatio: 3 },
  { name: "iPad 10.2", width: 1620, height: 2160, deviceWidth: 810, deviceHeight: 1080, pixelRatio: 2 },
  { name: "iPad Pro 11", width: 1668, height: 2388, deviceWidth: 834, deviceHeight: 1194, pixelRatio: 2 },
  { name: "iPad Pro 12.9", width: 2048, height: 2732, deviceWidth: 1024, deviceHeight: 1366, pixelRatio: 2 },
];

/** Solid brand-colored background of the given size, as a PNG buffer. */
function background(width, height) {
  return sharp({
    create: { width, height, channels: 4, background: BG },
  }).png();
}

/** Resize the source logo to fit within `size`x`size` (contain), transparent pad. */
async function logoContained(size) {
  return sharp(SOURCE_LOGO)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Composite the logo (sized to `logoSize`) centered on a `width`x`height` brand bg. */
async function composeCentered(width, height, logoSize, outPath) {
  const logo = await logoContained(logoSize);
  await background(width, height)
    .composite([{ input: logo, gravity: "center" }])
    .toFile(outPath);
}

const outputs = [];

async function generateMaskableIcons() {
  for (const size of [192, 512]) {
    const logoSize = Math.round(size * MASKABLE_SAFE_RATIO);
    const out = path.join(PUBLIC_DIR, `pwa-${size}x${size}-maskable.png`);
    await composeCentered(size, size, logoSize, out);
    outputs.push({ file: out, width: size, height: size });
  }
}

async function generateSplashScreens() {
  for (const d of IOS_DEVICES) {
    const shorter = Math.min(d.width, d.height);
    const logoSize = Math.round(shorter * SPLASH_LOGO_RATIO);
    const out = path.join(PUBLIC_DIR, `apple-splash-${d.width}x${d.height}.png`);
    await composeCentered(d.width, d.height, logoSize, out);
    outputs.push({ file: out, width: d.width, height: d.height });
  }
}

async function generateShortcutIcons() {
  const size = 96;
  const logoSize = Math.round(size * SHORTCUT_LOGO_RATIO);
  for (const name of ["shortcut-messages-96", "shortcut-notifications-96"]) {
    const out = path.join(PUBLIC_DIR, `${name}.png`);
    await composeCentered(size, size, logoSize, out);
    outputs.push({ file: out, width: size, height: size });
  }
}

/** Print the index.html <link> block for the generated splash screens. */
function printAppleStartupLinks() {
  console.log("\n===== Paste into frontend/index.html (after apple meta tags) =====\n");
  console.log("    <!-- iOS splash screens (generated by scripts/generate-pwa-assets.mjs) -->");
  for (const d of IOS_DEVICES) {
    const media =
      `(device-width: ${d.deviceWidth}px) and (device-height: ${d.deviceHeight}px) ` +
      `and (-webkit-device-pixel-ratio: ${d.pixelRatio}) and (orientation: portrait)`;
    console.log(
      `    <link rel="apple-touch-startup-image" media="${media}" href="/apple-splash-${d.width}x${d.height}.png" />`
    );
  }
  console.log("\n=================================================================\n");
}

/** Assert each output exists at the exact expected pixel dimensions. */
async function verifyOutputs() {
  let ok = true;
  for (const o of outputs) {
    const meta = await sharp(o.file).metadata();
    const bytes = fs.statSync(o.file).size;
    const pass = meta.width === o.width && meta.height === o.height;
    ok = ok && pass;
    console.log(
      `${pass ? "OK " : "FAIL"}  ${path.basename(o.file).padEnd(34)} ${meta.width}x${meta.height}  ${bytes} bytes`
    );
  }
  if (!ok) {
    throw new Error("One or more generated assets have unexpected dimensions.");
  }
}

async function main() {
  if (!fs.existsSync(SOURCE_LOGO)) {
    throw new Error(`Source logo not found: ${SOURCE_LOGO}`);
  }
  await generateMaskableIcons();
  await generateSplashScreens();
  await generateShortcutIcons();
  printAppleStartupLinks();
  console.log(`Generated ${outputs.length} assets into ${PUBLIC_DIR}:\n`);
  await verifyOutputs();
  console.log(`\nDone. ${outputs.length} files verified.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
