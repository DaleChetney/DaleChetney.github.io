import { describe, it, expect } from "vitest";
import { texToUnicode } from "./tex";

describe("texToUnicode", () => {
  it("leaves a name with nothing to render alone", () => {
    expect(texToUnicode("He")).toBe("He");
  });

  it.each([
    ["C_1", "C₁"],
    ["C_{56}", "C₅₆"],
    ["D_{24}", "D₂₄"],
    ["C_2^2", "C₂²"],
    ["C_2^4", "C₂⁴"],
    ["C_3^2", "C₃²"],
  ])("renders %s as %s", (tex, expected) => {
    expect(texToUnicode(tex)).toBe(expected);
  });

  it.each([
    ["C_3:C_4", "C₃ ⋊ C₄"],
    ["C_{17}:C_4", "C₁₇ ⋊ C₄"],
    ["C_3:Q_8", "C₃ ⋊ Q₈"],
    ["C_2\\times D_8", "C₂ × D₈"],
    ["C_5\\times Q_{16}", "C₅ × Q₁₆"],
    ["C_2\\times \\OD_{16}", "C₂ × OD₁₆"],
    ["C_3\\times \\SD_{16}", "C₃ × SD₁₆"],
    ["C_2\\times \\SL(2,3)", "C₂ × SL(2,3)"],
    ["C_2\\times C_3^2:C_4", "C₂ × C₃² ⋊ C₄"],
    ["C_2^2\\times C_{10}", "C₂² × C₁₀"],
  ])("renders %s as %s", (tex, expected) => {
    expect(texToUnicode(tex)).toBe(expected);
  });

  it("keeps a non-split extension as a dot, unlike a semidirect product", () => {
    // LMFDB writes `.` for a non-split extension and `:` for a split one.
    expect(texToUnicode("C_6.C_2^4")).toBe("C₆.C₂⁴");
  });

  it("renders the remaining macros our bounds reach", () => {
    expect(texToUnicode("\\PSU(3,3)")).toBe("PSU(3,3)");
    expect(texToUnicode("\\SOPlus(4,2)")).toBe("SO⁺(4,2)");
    expect(texToUnicode("C_2\\wr C_2")).toBe("C₂ ≀ C₂");
    expect(texToUnicode("\\PGL(2,7)")).toBe("PGL(2,7)");
    expect(texToUnicode("\\PSL(2,7)")).toBe("PSL(2,7)");
    expect(texToUnicode("C_5^2:\\Unitary(2,3)")).toBe("C₅² ⋊ U(2,3)");
    expect(texToUnicode("\\SU(3,2)")).toBe("SU(3,2)");
    expect(texToUnicode("\\PU(3,2)")).toBe("PU(3,2)");
    expect(texToUnicode("C_2^2.\\GL(2,\\mathbb{Z}/4)")).toBe("C₂².GL(2,ℤ/4)");
  });

  it("raises on a macro it does not know", () => {
    // A new macro is a change in LMFDB's data, not something to render blindly.
    expect(() => texToUnicode("\\Sp(4,2)")).toThrow(RangeError);
  });
});
