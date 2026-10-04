export function studentPortalEnabled() {
  return process.env.STUDENT_PORTAL_ENABLED !== "false";
}

export function secureCookies() {
  const url = new URL(process.env.APP_URL!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && url.protocol !== "https:")
    throw new Error("Production APP_URL must use HTTPS");
  return url.protocol === "https:";
}
