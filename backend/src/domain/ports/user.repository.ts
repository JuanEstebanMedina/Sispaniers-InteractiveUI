import type { User } from "../logistics/user.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** Case-insensitive exact match. */
  findByEmail(email: string): Promise<User | null>;
  /** `undefined` returns every user — the superadmin case. */
  findAllByCompany(companyId?: string): Promise<User[]>;
  save(user: User): Promise<void>;
}
