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

// Fail early rather than starting a server that can only return 404s.
const missing = publicFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Cannot prepare website: required file(s) missing: ${missing.join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
for (const file of publicFiles) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
}

const assetsDir = path.join(root, "assets");
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, path.join(publicDir, "assets"), { recursive: true, force: true });
}

require("./server");
