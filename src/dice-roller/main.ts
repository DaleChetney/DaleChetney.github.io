import { Rng } from "@shared/rng";
import { load, save } from "@shared/storage";
import { qs, el, mount } from "@shared/dom";
import { clamp } from "@shared/math";

interface LastRoll {
  count: number;
  results: number[];
}

const isLastRoll = (value: unknown): value is LastRoll =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as LastRoll).count === "number" &&
  Array.isArray((value as LastRoll).results) &&
  (value as LastRoll).results.every((n) => typeof n === "number");

const STORAGE_KEY = "dice-roller:last";
const rng = new Rng(Date.now());
const output = qs("#output");
const countInput = qs<HTMLInputElement>("#count");

const render = (roll: LastRoll): void => {
  const total = roll.results.reduce((sum, n) => sum + n, 0);
  mount(
    output,
    el("div", {}, [
      el("p", {}, [`${roll.count}d6 \u2192 ${roll.results.join(", ")}`]),
      el("p", {}, [`Total: ${total}`]),
    ]),
  );
};

qs("#roll").addEventListener("click", () => {
  const min = Number(countInput.min);
  const max = Number(countInput.max);
  const count = clamp(countInput.valueAsNumber || min, min, max);
  const results = Array.from({ length: count }, () => rng.int(1, 6));
  const roll: LastRoll = { count, results };
  save(STORAGE_KEY, roll);
  render(roll);
});

const previous = load<unknown>(STORAGE_KEY, null);
if (isLastRoll(previous)) {
  countInput.value = String(previous.count);
  render(previous);
}
