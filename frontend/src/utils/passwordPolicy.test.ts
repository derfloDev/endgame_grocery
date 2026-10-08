import { describe, expect, it } from "vitest";
import { getPasswordPolicyError } from "./passwordPolicy";

describe("getPasswordPolicyError", () => {
  it("accepts 8 characters up to 72 bytes", () => {
    expect(getPasswordPolicyError("12345678")).toBeNull();
    expect(getPasswordPolicyError("a".repeat(72))).toBeNull();
    expect(getPasswordPolicyError("ä".repeat(36))).toBeNull();
  });

  it("reports passwords that are too short", () => {
    expect(getPasswordPolicyError("1234567")).toBe("tooShort");
    expect(getPasswordPolicyError("")).toBe("tooShort");
  });

  it("counts UTF-8 bytes, not characters, for the upper limit", () => {
    expect(getPasswordPolicyError("a".repeat(73))).toBe("tooLong");
    expect(getPasswordPolicyError("ä".repeat(37))).toBe("tooLong");
  });
});
