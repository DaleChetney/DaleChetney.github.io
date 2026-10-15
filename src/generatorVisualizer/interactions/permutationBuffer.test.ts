import { describe, it, expect } from "vitest";
import { PermutationBuffer } from "./permutationBuffer";

describe("PermutationBuffer", () => {
  it("starts empty", () => {
    const buffer = new PermutationBuffer();
    expect(buffer.size).toBe(0);
    expect(buffer.shift()).toBeUndefined();
  });

  it("gives permutations back in the order they were queued", () => {
    const buffer = new PermutationBuffer();
    buffer.push([2, 1, 3]);
    buffer.push([1, 3, 2]);
    expect(buffer.size).toBe(2);
    expect(buffer.shift()).toEqual([2, 1, 3]);
    expect(buffer.shift()).toEqual([1, 3, 2]);
    expect(buffer.size).toBe(0);
  });

  it("can be emptied", () => {
    const buffer = new PermutationBuffer();
    buffer.push([2, 1]);
    buffer.push([2, 1]);
    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.shift()).toBeUndefined();
  });
});
