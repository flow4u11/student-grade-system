import { expect, it } from "vitest";
import {
  loginBase,
  registrationSchema,
  profileSchema,
} from "../src/lib/accounts";
it("normalizes names and uses the first four surname letters", () => {
  expect(loginBase(" Mali ", "Example")).toBe("mali.exam");
  expect(loginBase("Anne-Marie", " O'Neill ")).toBe("annemarie.onei");
  expect(loginBase("José", "Li")).toBe("jose.li");
});
it("asks for Latin spellings for unsupported login characters", () => {
  expect(() => loginBase("ครู", "ทดสอบ")).toThrow();
  expect(() => loginBase("A@x", "B")).toThrow();
});
it("requires explicit identity confirmation and a strong password", () => {
  expect(
    registrationSchema.safeParse({
      first_name: "A",
      last_name: "B",
      password: "short",
      code: "x".repeat(32),
      confirmed: true,
    }).success,
  ).toBe(false);
});
it("rejects official identity or role fields in profile changes", () => {
  const p = {
    nickname: "A",
    contact_email: "",
    contact_phone: "",
    bio: "",
    teaching_request: "Math M.3/1",
    avatar: "book",
  };
  expect(profileSchema.safeParse(p).success).toBe(true);
  expect(profileSchema.safeParse({ ...p, role: "DEVELOPER" }).success).toBe(
    false,
  );
  expect(
    profileSchema.safeParse({ ...p, official_first_name: "B" }).success,
  ).toBe(false);
});
it("requires both Thai names for new registrations", () => {
  const input = {
    first_name: "Mali",
    last_name: "Example",
    password: "strong-password-test",
    code: "x".repeat(32),
    confirmed: true,
  };
  expect(registrationSchema.safeParse(input).success).toBe(false);
  expect(
    registrationSchema.safeParse({
      ...input,
      first_name_th: "มะลิ",
      last_name_th: "ตัวอย่าง",
    }).success,
  ).toBe(true);
});
