export const ROLES = {
  SCHOLAR: "scholar",
  TEACHER: "teacher",
  ADMIN: "admin",
  CURRICULUM_DESIGNER: "curriculum_designer",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
