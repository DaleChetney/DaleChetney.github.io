// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { generatorForKey } from "./permutationKeys";

/** A key press as the document would hear it, from `target` (the body by default). */
const press = (code: string, init: KeyboardEventInit = {}, target: Element = document.body) => {
  const event = new KeyboardEvent("keydown", { code, bubbles: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return event;
};

describe("generatorForKey", () => {
  it("runs the first nine generators from 1 to 9, and the tenth from 0", () => {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    expect(digits.map((digit) => generatorForKey(press(`Digit${digit}`)))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("runs the eleventh from - and the twelfth from =", () => {
    expect(generatorForKey(press("Minus"))).toBe(10);
    expect(generatorForKey(press("Equal"))).toBe(11);
  });

  it("leaves the numpad and every other key alone", () => {
    expect(generatorForKey(press("Numpad1"))).toBeNull();
    expect(generatorForKey(press("NumpadSubtract"))).toBeNull();
    expect(generatorForKey(press("KeyA"))).toBeNull();
  });

  it("leaves a digit alone with a modifier held", () => {
    for (const modifier of ["shiftKey", "ctrlKey", "altKey", "metaKey"]) {
      expect(generatorForKey(press("Digit1", { [modifier]: true }))).toBeNull();
    }
  });

  it("does not repeat while the key is held down", () => {
    expect(generatorForKey(press("Digit1", { repeat: true }))).toBeNull();
  });

  it("leaves a digit to a field, a dropdown or a slider that has the focus", () => {
    for (const tag of ["input", "select", "textarea"]) {
      expect(generatorForKey(press("Digit1", {}, document.createElement(tag)))).toBeNull();
    }
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(generatorForKey(press("Digit1", {}, editable))).toBeNull();
  });

  it("runs from a button that has the focus, such as a play button", () => {
    expect(generatorForKey(press("Digit2", {}, document.createElement("button")))).toBe(1);
  });
});
