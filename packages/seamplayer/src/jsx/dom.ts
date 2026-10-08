// A small keyed DOM renderer, so the player's views can be plain JSX with no
// framework underneath. render() patches a container to match a tree of
// nodes and keeps every element it can (and with it focus, running
// animations and listeners). A changed key remounts, as in React.

export type Props = Record<string, unknown>;

export type VNode = {
  type: string;
  props: Props;
  children: VNode[];
  key: string | number | undefined;
  /**
   * Where it sits among its siblings: its key, or its position (empty
   * `cond && <x />` slots included), scoped by any list it came from. Nodes
   * match across renders by this, the way React matches them.
   */
  id: string;
  /** the text of a "#text" node */
  text?: string;
  /** a fragment's children, read when its parent collects it */
  raw?: Child;
  dom?: Element | Text;
};

export type Child =
  VNode | string | number | boolean | null | undefined | readonly Child[];

/** Called with the element once it's created, and with null once it's gone. */
export type Ref<T = Element> = (el: T | null) => void;

export type Style = Record<string, string | number | undefined>;

const TEXT = "#text";
const FRAGMENT = "#fragment";
const SVG_NS = "http://www.w3.org/2000/svg";

const collect = (child: Child, out: VNode[], scope: string, index: number) => {
  if (child == null || typeof child === "boolean") return;
  if (Array.isArray(child)) {
    const inner = `${scope}${index}/`;
    child.forEach((c: Child, i: number) => collect(c, out, inner, i));
  } else if (typeof child === "object") {
    const node = child as VNode;
    const id =
      node.key === undefined ? `${scope}${index}` : `${scope}k:${node.key}`;
    if (node.type === FRAGMENT) {
      const list = Array.isArray(node.raw) ? node.raw : [node.raw];
      list.forEach((c: Child, i: number) => collect(c, out, `${id}/`, i));
    } else out.push({ ...node, id });
  } else {
    out.push({
      type: TEXT,
      props: {},
      children: [],
      key: undefined,
      id: `${scope}${index}`,
      text: String(child),
    });
  }
};

/** A list of children as the nodes to put in the page, in order. */
export const normalize = (children: Child) => {
  const out: VNode[] = [];
  const list = Array.isArray(children) ? children : [children];
  list.forEach((c: Child, i: number) => collect(c, out, "", i));
  return out;
};

export const fragment = (children: Child): VNode => ({
  type: FRAGMENT,
  props: {},
  children: [],
  key: undefined,
  id: "",
  raw: children,
});

export const element = (
  type: string,
  props: Props,
  key: string | number | undefined
): VNode => {
  const { children, ...rest } = props;
  return {
    type,
    props: rest,
    children: normalize(children as Child),
    key,
    id: "",
  };
};

// ── attributes ─────────────────────────────────────────────────────────────

const attrName = (name: string, svg: boolean) => {
  if (name === "className") return "class";
  if (!svg) return name.toLowerCase();
  if (name === "viewBox") return name;
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
};

/** The attribute's text, or null to leave it off. aria-* keep "false". */
const attrValue = (attr: string, value: unknown) => {
  if (value == null) return null;
  const aria = attr.startsWith("aria-");
  if (value === false) return aria ? "false" : null;
  if (value === true) return aria ? "true" : "";
  return String(value);
};

const cssName = (name: string) =>
  name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// numbers that stay bare; every other number is pixels
const UNITLESS =
  /^(--.*|opacity|zIndex|flex|flexGrow|flexShrink|order|lineHeight|fontWeight|aspectRatio)$/;

const cssValue = (name: string, value: string | number) =>
  typeof value === "number" && !UNITLESS.test(name)
    ? `${value}px`
    : String(value);

const setStyle = (el: Element, prev: Style = {}, next: Style = {}) => {
  const style = (el as HTMLElement).style;
  for (const name in prev) {
    if (next[name] == null) style.removeProperty(cssName(name));
  }
  for (const name in next) {
    const value = next[name];
    if (value == null || prev[name] === value) continue;
    style.setProperty(cssName(name), cssValue(name, value));
  }
};

type Listening = Element & {
  __handlers?: Record<string, ((e: Event) => void) | undefined>;
};

const eventName = (prop: string) =>
  prop === "onDoubleClick" ? "dblclick" : prop.slice(2).toLowerCase();

const isEvent = (prop: string) => /^on[A-Z]/.test(prop);

// One listener per event type; it calls whatever handler the last render set.
const listen = (
  el: Listening,
  type: string,
  handler: ((e: Event) => void) | undefined
) => {
  if (!el.__handlers) el.__handlers = {};
  if (!(type in el.__handlers)) {
    el.addEventListener(type, (e) => el.__handlers?.[type]?.(e));
  }
  el.__handlers[type] = handler;
};

const setProp = (
  el: Element,
  name: string,
  prev: unknown,
  value: unknown,
  svg: boolean
) => {
  if (name === "key" || name === "ref" || name === "children") return;
  if (name === "style") {
    setStyle(el, prev as Style | undefined, value as Style | undefined);
  } else if (isEvent(name)) {
    listen(el, eventName(name), value as ((e: Event) => void) | undefined);
  } else {
    const attr = attrName(name, svg);
    const text = attrValue(attr, value);
    if (text === null) el.removeAttribute(attr);
    else el.setAttribute(attr, text);
  }
};

/** Bring an element's attributes, styles and listeners from one set to the next. */
export const patchProps = (
  el: Element,
  prev: Props,
  next: Props,
  svg = false
) => {
  for (const name in prev) {
    if (!(name in next)) setProp(el, name, prev[name], undefined, svg);
  }
  for (const name in next) {
    if (prev[name] !== next[name]) {
      setProp(el, name, prev[name], next[name], svg);
    }
  }
};

// ── reconciling ────────────────────────────────────────────────────────────

const create = (doc: Document, node: VNode, svg: boolean): Element | Text => {
  if (node.type === TEXT) {
    return (node.dom = doc.createTextNode(node.text ?? ""));
  }
  const inSvg = svg || node.type === "svg";
  const el = inSvg
    ? doc.createElementNS(SVG_NS, node.type)
    : doc.createElement(node.type);
  node.dom = el;
  patchProps(el, {}, node.props, inSvg);
  patchChildren(el, [], node.children, inSvg);
  (node.props.ref as Ref | undefined)?.(el);
  return el;
};

const unmount = (node: VNode, remove: boolean) => {
  // Media events can arrive after removal (notably pause after destroy).
  // Clear dispatch targets so detached nodes release their owners and never
  // invoke a callback on a destroyed player.
  const el = node.dom as Listening | undefined;
  if (el?.__handlers) el.__handlers = {};
  for (const child of node.children) unmount(child, false);
  (node.props.ref as Ref | undefined)?.(null);
  if (remove) node.dom?.remove();
};

const patch = (prev: VNode, next: VNode, svg: boolean) => {
  const dom = prev.dom!;
  next.dom = dom;
  if (next.type === TEXT) {
    if (prev.text !== next.text) dom.nodeValue = next.text ?? "";
    return;
  }
  const inSvg = svg || next.type === "svg";
  patchProps(dom as Element, prev.props, next.props, inSvg);
  patchChildren(dom as Element, prev.children, next.children, inSvg);
};

// Children match their previous selves by id and type; the rest are
// created, and the leftovers removed first, so a ref hears null before its
// replacement arrives.
const patchChildren = (
  parent: Element,
  prev: VNode[],
  next: VNode[],
  svg: boolean
) => {
  const byId = new Map<string, VNode>();
  for (const node of prev) byId.set(node.id, node);

  const matches = next.map((node) => {
    const old = byId.get(node.id);
    if (!old || old.type !== node.type) return undefined;
    byId.delete(node.id);
    return old;
  });
  for (const old of byId.values()) unmount(old, true);

  const doc = parent.ownerDocument;
  let cursor = parent.firstChild;
  next.forEach((node, i) => {
    const old = matches[i];
    if (old) patch(old, node, svg);
    else create(doc, node, svg);
    const dom = node.dom!;
    if (dom === cursor) cursor = cursor.nextSibling;
    else parent.insertBefore(dom, cursor);
  });
};

type Host = Element & { __vnodes?: VNode[] };

/** Make the container's children match `child`. render(null, el) empties it. */
export const render = (child: Child, container: Element) => {
  const host = container as Host;
  const next = normalize(child);
  patchChildren(
    container,
    host.__vnodes ?? [],
    next,
    container.namespaceURI === SVG_NS
  );
  host.__vnodes = next;
};

// ── to a string, for server rendering ──────────────────────────────────────

const VOID = new Set(["br", "hr", "img", "input", "source", "track", "wbr"]);

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

const nodeHtml = (node: VNode, svg: boolean): string => {
  if (node.type === TEXT) return escape(node.text ?? "");
  const inSvg = svg || node.type === "svg";
  let attrs = "";
  for (const [name, value] of Object.entries(node.props)) {
    if (name === "key" || name === "ref" || isEvent(name)) continue;
    if (name === "style") {
      const css = Object.entries((value ?? {}) as Style)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${cssName(k)}:${cssValue(k, v!)}`)
        .join(";");
      if (css) attrs += ` style="${escape(css)}"`;
      continue;
    }
    const attr = attrName(name, inSvg);
    const text = attrValue(attr, value);
    if (text !== null)
      attrs += text ? ` ${attr}="${escape(text)}"` : ` ${attr}`;
  }
  if (!inSvg && VOID.has(node.type)) return `<${node.type}${attrs}>`;
  const inner = node.children.map((c) => nodeHtml(c, inSvg)).join("");
  return `<${node.type}${attrs}>${inner}</${node.type}>`;
};

/** The HTML for a tree, without listeners: what the server sends. */
export const renderToString = (child: Child) =>
  normalize(child)
    .map((node) => nodeHtml(node, false))
    .join("");
