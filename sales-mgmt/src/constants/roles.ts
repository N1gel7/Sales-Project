export const UserRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES: 'sales',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
