import type { Role } from "../enums/role.js";

export interface User {
  id: string;
  /** Absent only for `superadmin` — every other role belongs to one company. */
  companyId?: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  active: boolean;
}
