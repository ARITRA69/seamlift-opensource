import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Type and spacing for docs pages. Sections sit 48px apart; inside one,
 * blocks sit 16px apart, so a heading always reads with its own content.
 */

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <H2 id={id}>{title}</H2>
      {children}
    </section>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="pt-4 font-semibold tracking-tight">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-prose break-words text-pretty">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-prose break-words marker:text-muted-foreground">
      {children}
    </ul>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-code">
      {children}
    </code>
  );
}

export function DocLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const className =
    "font-medium underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground";
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/** Reference rows: a name in mono, then what it does. */
export function Definitions({
  items,
}: {
  items: readonly (readonly [ReactNode, ReactNode])[];
}) {
  return (
    <dl className="divide-y border-y">
      {items.map(([name, description], index) => (
        <div key={index} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-6">
          <dt className="font-mono text-code">{name}</dt>
          <dd className="text-sm leading-6 text-muted-foreground sm:col-span-2">
            {description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Cards({
  items,
}: {
  items: readonly { title: string; href: string; description: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg border p-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="block text-sm font-medium">{item.title}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {item.description}
          </span>
        </Link>
      ))}
    </div>
  );
}
