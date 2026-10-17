import bcrypt from "bcryptjs";

export class PasswordHasher {
  #saltRounds;

  constructor(saltRounds) {
    this.#saltRounds = saltRounds;
  }

  hash(plaintext) {
    return bcrypt.hashSync(plaintext, this.#saltRounds);
  }

  compare(plaintext, hashValue) {
    return bcrypt.compareSync(plaintext, hashValue);
  }
}
