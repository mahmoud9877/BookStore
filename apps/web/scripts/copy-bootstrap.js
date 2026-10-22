// Copies Bootstrap's LTR and RTL builds into public/vendor so the app can switch
// between them at runtime (Arabic uses bootstrap.rtl.min.css). Runs before
// `npm start` and `npm run build`; the copies are git-ignored.
const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..", "node_modules", "bootstrap", "dist", "css");
const target = path.join(__dirname, "..", "public", "vendor");
fs.mkdirSync(target, { recursive: true });
for (const file of ["bootstrap.min.css", "bootstrap.rtl.min.css"]) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
