import stylesheet from "./styles.css" with { type: "text" };

export const styles: string = stylesheet;

// React's <style href="seamplayer"> (hoisted by React 19, inline in 18) or
// one this function added before
const EXISTING =
  'style[data-seamplayer], style[data-href="seamplayer"], style[href="seamplayer"]';

/**
 * Add the player's stylesheet once per document (or per shadow root, for a
 * player inside one), so no CSS import is needed.
 */
export const injectStyles = (el: Element) => {
  const root = el.getRootNode() as Document | ShadowRoot;
  const inShadow = "host" in root;
  const scope = inShadow ? root : el.ownerDocument;
  if (scope.querySelector(EXISTING)) return;
  const style = el.ownerDocument.createElement("style");
  style.setAttribute("data-seamplayer", "");
  style.textContent = styles;
  (inShadow ? root : el.ownerDocument.head).append(style);
};
