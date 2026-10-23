import { ConflictError } from "../../../core/http-errors.js";
import { withDefaults } from "../constants/library-settings.js";

const KEY = "library";
const CACHE_MS = 30_000;

/**
 * Library policies (see library-settings.js). Reads are cached briefly: several
 * API instances converge within CACHE_MS of a change.
 */
export class SettingsService {
  #settings;
  #audit;
  #cache = null;

  constructor({ settingRepository, auditService }) {
    this.#settings = settingRepository;
    this.#audit = auditService;
  }

  /** Resolves the full settings object (defaults filled in). */
  async get() {
    if (this.#cache && this.#cache.expiresAt > Date.now()) return this.#cache.value;
    const stored = await this.#settings.findByKey(KEY);
    const value = { ...withDefaults(stored?.value), version: stored?.version ?? 0 };
    this.#cache = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }

  /**
   * Replaces the settings. `version` must be the version that was read, so two
   * administrators editing at once cannot silently overwrite each other.
   */
  async update({ version, ...changes }, actor) {
    const before = await this.get();
    const next = withDefaults(changes);
    const saved = await this.#settings.replaceValue(KEY, next, version);
    if (!saved) throw new ConflictError("Settings were changed by someone else. Reload and try again.");
    this.#cache = null;
    const { version: _previous, ...previous } = before;
    await this.#audit.record(actor, { action: "settings.update", entity: "Setting", entityId: KEY, before: previous, after: next });
    return this.get();
  }

  /** For tests and after migrations. */
  clearCache() {
    this.#cache = null;
  }
}
