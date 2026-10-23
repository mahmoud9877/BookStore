// Arabic dictionaries, one file per area of the app (merged here).
// Each file exports `messages` ({ "English text": "النص العربي" }) and optionally
// `plurals` ({ id: { en: { one, other }, ar: { zero, one, two, few, many, other } } }).
import * as common from "./common.js";
import * as landing from "./landing.js";
import * as catalog from "./catalog.js";
import * as circulation from "./circulation.js";
import * as inventory from "./inventory.js";
import * as administration from "./administration.js";
import * as reports from "./reports.js";
import * as shop from "./shop.js";

const AREAS = [common, landing, catalog, circulation, inventory, administration, reports, shop];

export const AR = Object.assign({}, ...AREAS.map((area) => area.messages ?? {}));
export const EN_PLURAL_TABLE = {};
export const AR_PLURAL_TABLE = {};
for (const area of AREAS) {
  for (const [id, forms] of Object.entries(area.plurals ?? {})) {
    EN_PLURAL_TABLE[id] = forms.en;
    AR_PLURAL_TABLE[id] = forms.ar;
  }
}
