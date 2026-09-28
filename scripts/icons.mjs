// Renders the app icons from assets/*.svg: node scripts/icons.mjs
import sharp from "sharp";

const render = (src, size, out, { flatten = false } = {}) => {
  let img = sharp(src, { density: 384 }).resize(size, size);
  if (flatten) img = img.flatten({ background: "#022851" });
  return img.png().toFile(out);
};

await Promise.all([
  render("assets/icon.svg", 192, "public/icon-192.png"),
  render("assets/icon.svg", 512, "public/icon-512.png"),
  render("assets/icon-maskable.svg", 512, "public/icon-maskable-512.png"),
  // iOS rounds the corners itself but needs an opaque square.
  render("assets/icon.svg", 180, "app/apple-icon.png", { flatten: true }),
  render("assets/icon.svg", 48, "app/icon.png"),
]);
console.log("icons written");
