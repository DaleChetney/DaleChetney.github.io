/** querySelector that throws if the element is missing, narrowed to `T`. */
export const qs = <T extends Element = HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T => {
  const found = parent.querySelector<T>(selector);
  if (found === null) throw new Error(`No element matches selector: ${selector}`);
  return found;
};

type Child = Node | string;

/** Create an element, assigning properties and appending children in one call. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
};

/** Replace the contents of `root` with `node`. */
export const mount = (root: Element, node: Node): void => {
  root.replaceChildren(node);
};

/**
 * Rebuild part of the page without losing keyboard focus.
 *
 * Mounting replaces every node under a host, which drops focus and would make
 * the controls unusable from the keyboard. `identify` turns the focused element
 * into a selector that will still match after the rebuild — usually via a data
 * attribute carrying the thing's identity rather than its position — and
 * returns null for anything the caller does not own, leaving that focus alone.
 */
export const preservingFocus = (
  identify: (active: Element) => string | null,
  rebuild: () => void,
): void => {
  const active = document.activeElement;
  const selector = active instanceof Element ? identify(active) : null;
  rebuild();
  if (selector === null) return;
  const target = document.querySelector(selector);
  if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
};
