import { llmsFull, text } from "@/lib/llms";

export const dynamic = "force-static";

export async function GET() {
  return text(await llmsFull());
}
