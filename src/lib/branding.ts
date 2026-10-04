export type Branding = {
  name: string;
  short_name: string;
  login_domain: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  background_color_dark: string;
  default_language: "th" | "en";
  default_scheme_id: string | null;
  support_info: string;
  registration_open: boolean;
};
export const defaultBranding: Branding = {
  name: "School Ledger",
  short_name: "School Ledger",
  login_domain: "school-ledger.test",
  logo_url: "",
  primary_color: "#4264ad",
  secondary_color: "#f9dfeb",
  background_color: "#f4f6fc",
  background_color_dark: "#111522",
  default_language: "th",
  default_scheme_id: null,
  support_info: "",
  registration_open: false,
};
