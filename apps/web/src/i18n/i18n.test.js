// Guards the bilingual UI:
//  1. every t("…") / msg("…") key has an Arabic translation, every tp("id") a plural table;
//  2. no English text is left in JSX, in common text props, in toasts or in error
//     fallbacks without going through t().
import fs from "fs";
import path from "path";
import { AR, AR_PLURAL_TABLE, EN_PLURAL_TABLE } from "./ar/index.js";

const SRC = path.resolve(__dirname, "..");

function sourceFiles(dir = SRC) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ["i18n", "test-utils"].includes(entry.name) && dir === SRC ? [] : sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name) && entry.name !== "setupTests.js" ? [full] : [];
  });
}

const FILES = sourceFiles().map((file) => ({
  file: path.relative(SRC, file),
  // Comments never reach the UI.
  code: fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1"),
}));

const lineOf = (code, index) => code.slice(0, index).split("\n").length;

function findAll(regex) {
  const hits = [];
  for (const { file, code } of FILES) {
    for (const match of code.matchAll(regex)) hits.push({ where: `${file}:${lineOf(code, match.index)}`, match });
  }
  return hits;
}

// Words that are the same in both languages (brands, codes, formats), and sample
// codes such as member numbers and barcodes ("M-0000001", "MAIN-0001874").
const UNTRANSLATED_OK = /^(BookSaw|TemplatesJungle|ISBN|CSV|PDF|EPUB|MP3|MP4|PO|EGP|ID|URL|API|AI|JSON|OK|×|—|·|\/|:|\(|\)|[A-Z]+-\d+|[\d\s.,:·/()+–—%#-]*)$/;
// Identifiers such as icon names ("check-circle-fill") are never shown as text.
const IDENTIFIER = /^[a-z0-9]+(-[a-z0-9]+)+$/;

const KEY = /\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g;
// Joi schemas' custom messages ({ "string.empty": "Enter a title." }) are shown through t().
const VALIDATION_MESSAGE = /"[a-z]+\.[\w.]+":\s*"((?:[^"\\]|\\.)*)"/g;

test("every translated text has an Arabic entry", () => {
  const missing = [...findAll(KEY), ...findAll(VALIDATION_MESSAGE)]
    .map(({ where, match }) => ({ where, key: JSON.parse(`"${match[1]}"`) }))
    .filter(({ key }) => !(key in AR));
  expect(missing.map(({ where, key }) => `${where}  ${JSON.stringify(key)}`)).toEqual([]);
});

test("an English text has one Arabic translation across the area files", () => {
  const dir = path.join(SRC, "i18n", "ar");
  const seen = {};
  for (const name of fs.readdirSync(dir).filter((file) => file !== "index.js")) {
    for (const [en, ar] of Object.entries(require(path.join(dir, name)).messages ?? {})) (seen[en] ??= new Set()).add(ar);
  }
  // Two meanings need two English texts ("Book" / "Book room"); the later file would win everywhere.
  expect(Object.keys(seen).filter((en) => seen[en].size > 1)).toEqual([]);
});

test("Arabic entries keep the same {placeholders}", () => {
  const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const broken = Object.entries(AR).filter(([en, ar]) => names(en) !== names(ar));
  expect(broken.map(([en]) => en)).toEqual([]);
});

test("every plural id has English and Arabic forms", () => {
  const used = new Set(findAll(/\btp\(\s*"([\w.-]+)"/g).map(({ match }) => match[1]));
  const problems = [...used].filter((id) => !EN_PLURAL_TABLE[id]?.one || !EN_PLURAL_TABLE[id]?.other || !AR_PLURAL_TABLE[id]?.other);
  expect(problems).toEqual([]);
});

test("no English text is left in JSX", () => {
  const hits = FILES.filter(({ file }) => file.endsWith(".jsx")).flatMap(({ file, code }) =>
    [...code.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)]
      .filter((m) => !UNTRANSLATED_OK.test(m[1].trim()))
      // Code between `/>` or `)>` and the next `<` is not JSX text (`a > b && c < d`, `<X />), y(<Z`,
      // `element: <X />, errorElement: <Y />`).
      .filter((m) => !/[=&|;"`]|\breturn\b|=>|\)\s*[,:)]|\?\s*\(|^\s*,\s*\w+:\s*$/.test(m[1]))
      .map((m) => `${file}:${lineOf(code, m.index)}  ${JSON.stringify(m[1].trim())}`)
  );
  expect(hits).toEqual([]);
});

test("text props, toasts and error fallbacks go through t()", () => {
  const PROP = /\b(aria-label|placeholder|title|label|alt|description|message|confirmLabel|documentTitle|hint|caption|empty)="([^"]*[A-Za-z][^"]*)"/g;
  const OBJECT_TEXT = /\b(title|message|confirmLabel|label|success|failure|description|text|placeholder|heading|note|empty|header|ariaLabel):\s*"([^"]*[A-Za-z][^"]*)"/g;
  const CALL = /\b(?:toast\.\w+|getErrorMessage\([^,()]+(?:\([^()]*\))?,|window\.alert(?=\()|(?<!")alert(?=\()|pluralize\([^,]+,\s*"[^"]+",)\(?\s*"([^"]*[A-Za-z][^"]*)"/g;
  // A template literal in a text prop whose fixed parts hold words or punctuation: `${a}, ${b}.`
  const TEMPLATE = /\b(?:title|message|confirmLabel|success|failure|description|text|placeholder|heading|note|ariaLabel):\s*`((?:[^`\\]|\\.)*)`/g;
  const templates = findAll(TEMPLATE).filter(({ match }) => /[A-Za-z,.;:?!]/.test(match[1].replace(/\$\{[^}]*\}/g, "")));
  const hits = [...findAll(PROP), ...findAll(OBJECT_TEXT), ...findAll(CALL)]
    .filter(({ match }) => !UNTRANSLATED_OK.test(match[match.length - 1].trim()) && !IDENTIFIER.test(match[match.length - 1].trim()))
    .concat(templates)
    .map(({ where, match }) => `${where}  ${match[0].slice(0, 90)}`);
  expect(hits).toEqual([]);
});
