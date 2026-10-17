import { UserResponseDto } from "./user.dto.js";

/** User account administration. */
export class UserService {
  #users;

  constructor({ userRepository }) {
    this.#users = userRepository;
  }

  async listUsers() {
    return UserResponseDto.fromList(await this.#users.listWithoutSecrets());
  }
}
