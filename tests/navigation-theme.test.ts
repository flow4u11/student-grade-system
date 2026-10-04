import { expect, it } from "vitest";
import { NavigationCache } from "../src/lib/navigation-cache";
import { palettePreset, themePresets } from "../src/lib/theme";
import { settingsSchema } from "../src/lib/accounts";
it("hands off only the requested student resource once within its lifetime", () => {
  let time = 0;
  const cache = new NavigationCache(() => time);
  cache.put("student-a", { name: "A" });
  expect(cache.peek("student-b")).toBeUndefined();
  expect(cache.take("student-a")).toEqual({ name: "A" });
  expect(cache.take("student-a")).toBeUndefined();
  cache.put("student-b", { name: "B" });
  time = 15_001;
  expect(cache.peek("student-b")).toBeUndefined();
});
it("does not carry prefetched records between accounts or keep abandoned handoffs", () => {
  const a = new NavigationCache(),
    b = new NavigationCache();
  a.put("student-a", {});
  expect(b.peek("student-a")).toBeUndefined();
  a.put("student-b", {});
  expect(a.peek("student-a")).toBeUndefined();
});
it("recognizes presets and treats a background-only change as Custom", () => {
  expect(palettePreset(themePresets[0])?.id).toBe("blue");
  expect(
    palettePreset({ ...themePresets[0], background_color: "#aaaaaa" }),
  ).toBeUndefined();
  expect(
    palettePreset({ ...themePresets[0], primary_color: "#4264AD" })?.id,
  ).toBe("blue");
});
it("accepts legacy settings without overwriting backgrounds and rejects malformed colors", () => {
  const legacy = {
    name: "School",
    short_name: "S",
    login_domain: "school.test",
    logo_url: "",
    primary_color: "#4264ad",
    secondary_color: "#f9dfeb",
    default_language: "th",
    default_scheme_id: "",
    support_info: "",
  };
  expect(settingsSchema.parse(legacy).background_color).toBeUndefined();
  expect(
    settingsSchema.parse({
      ...legacy,
      background_color: "#000000",
      background_color_dark: "#ffffff",
    }).background_color,
  ).toBe("#000000");
  expect(
    settingsSchema.safeParse({ ...legacy, background_color: "red" }).success,
  ).toBe(false);
  expect(
    settingsSchema.safeParse({ ...legacy, background_color_dark: "#fff" })
      .success,
  ).toBe(false);
});
