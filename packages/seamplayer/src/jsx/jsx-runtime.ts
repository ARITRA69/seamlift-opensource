// The automatic JSX runtime for the player's own views (see tsconfig's
// jsxImportSource). Components are plain functions, called right away.

import {
  element,
  fragment,
  type Child,
  type Props,
  type Ref,
  type Style,
  type VNode,
} from "./dom";

type Component = (props: Props) => VNode | null;

export const Fragment = (props: { children?: Child }) =>
  fragment(props.children);

export const jsx = (
  type: string | Component,
  props: Props,
  key?: string | number
): VNode => {
  if (typeof type === "string") return element(type, props, key);
  const out = type(props) ?? fragment(null);
  return key === undefined ? out : { ...out, key };
};

export const jsxs = jsx;

type Handler<E extends Event> = (e: E) => void;

type IntrinsicProps = {
  children?: Child;
  key?: string | number;
  ref?: Ref<never>;
  style?: Style;
  className?: string;
  onClick?: Handler<MouseEvent>;
  onDoubleClick?: Handler<MouseEvent>;
  onContextMenu?: Handler<MouseEvent>;
  onKeyDown?: Handler<KeyboardEvent>;
  onFocus?: Handler<FocusEvent>;
  onBlur?: Handler<FocusEvent>;
  onPointerDown?: Handler<PointerEvent>;
  onPointerUp?: Handler<PointerEvent>;
  onPointerMove?: Handler<PointerEvent>;
  onPointerEnter?: Handler<PointerEvent>;
  onPointerLeave?: Handler<PointerEvent>;
  onPointerCancel?: Handler<PointerEvent>;
  [prop: string]: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = VNode;
  export interface IntrinsicElements {
    [tag: string]: IntrinsicProps;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
}
