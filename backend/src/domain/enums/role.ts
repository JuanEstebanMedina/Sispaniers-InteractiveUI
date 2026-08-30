export const ROLES = ["user", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];
