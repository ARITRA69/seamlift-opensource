import { llmsIndex, text } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return text(llmsIndex());
}
