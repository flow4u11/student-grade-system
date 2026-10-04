export const isAdmin = (role?: string) =>
  role === "ADMIN" || role === "DEVELOPER";
export const isStaff = (role?: string) => isAdmin(role) || role === "TEACHER";
