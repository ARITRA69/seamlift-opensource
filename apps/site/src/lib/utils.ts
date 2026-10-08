import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the font sizes from globals.css, or it reads
// text-nav as a color and drops it next to text-muted-foreground.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["prose", "nav", "code"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
