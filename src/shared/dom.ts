/** querySelector that throws if the element is missing, narrowed to `T`. */
export const qs = <T extends Element = HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T => {
  const found = parent.querySelector<T>(selector);
  if (found === null) throw new Error(`No element matches selector: ${selector}`);
  return found;
};

/** querySelectorAll as a real array. */
export const qsa = <T extends Element = HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T[] => Array.from(parent.querySelectorAll<T>(selector));

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
