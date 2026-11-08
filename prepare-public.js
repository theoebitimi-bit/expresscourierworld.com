const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const publicFiles = [
  "index.html",
  "admin.html",
  "privacy.html",
  "terms.html",
  "styles.css",
  "app.js",
  "admin.js",
  "logo.svg",
  "countries.json"
];

fs.mkdirSync(publicDir, { recursive: true });
for (const file of publicFiles) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(publicDir, file));
  }
}

const assetsDir = path.join(root, "assets");
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, path.join(publicDir, "assets"), { recursive: true });
}

require("./server");
