import { expect, it } from "vitest";
import { schemas } from "../src/lib/validation";
import { contrastText } from "../src/lib/theme";
it("keeps unspecified catalog credits distinct from zero and rejects invalid precision", () => {
  const subject = {
    code: "TEST",
    name_th: "ทดสอบ",
    name_en: "Test",
    active: true,
  };
  expect(
    schemas.subjects.parse({ ...subject, default_credits: null })
      .default_credits,
  ).toBeNull();
  expect(
    schemas.subjects.parse({ ...subject, default_credits: 0 }).default_credits,
  ).toBe(0);
  expect(
    schemas.subjects.parse({ ...subject, default_credits: 1.5 })
      .default_credits,
  ).toBe(1.5);
  for (const value of [-1, 101, 1.234])
    expect(
      schemas.subjects.safeParse({ ...subject, default_credits: value })
        .success,
    ).toBe(false);
});
it("keeps primary button text readable for dark school colors and light pastels", () => {
  expect(contrastText("#4264ad")).toBe("#ffffff");
  expect(contrastText("#f9dfeb")).toBe("#000000");
  expect(contrastText("#000000")).toBe("#ffffff");
  expect(contrastText("#ffffff")).toBe("#000000");
});
