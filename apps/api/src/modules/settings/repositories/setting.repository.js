import { settingModel } from "../models/setting.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

const DUPLICATE_KEY = 11000;

export class SettingRepository extends BaseRepository {
  constructor(model = settingModel) {
    super(model);
  }

  findByKey(key) {
    return this.findOne({ key });
  }

  /**
   * Optimistic concurrency: saves only if the stored version is still
   * `expectedVersion` (0: never saved). Resolves null when someone saved first.
   */
  async replaceValue(key, value, expectedVersion) {
    if (expectedVersion === 0) {
      try {
        return await this.create({ key, value, version: 1 });
      } catch (error) {
        if (error.code === DUPLICATE_KEY) return null;
        throw error;
      }
    }
    return this.updateWhere({ key, version: expectedVersion }, { $set: { value }, $inc: { version: 1 } });
  }
}
