import OpenAI from "openai";
import type { LLMRequest } from "../../../lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apiKey?: string;
    model?: string;
    locale?: string;
    prompt?: string;
    state: LLMRequest;
  };

  const key = body.apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing OpenAI API key" }), { status: 400 });
  }

  const client = new OpenAI({ apiKey: key });
  const model = body.model ?? "gpt-4o-mini";

  const systemPrompt = `You are a seasoned CASHFLOW coach. Analyze the JSON game state and recommend ONE action.
Respond strictly with JSON using this schema:
{
  "summary": "concise bilingual EN/ZH summary",
  "decision": "buy|sell|hold|joint-venture|loan|charity|roll",
  "details": { "reasoning": "...", "targets": ["..."], "cashNeeded": 0 }
}`;

  const userPrompt = `Game state (JSON):
${JSON.stringify(body.state, null, 2)}

Player prompt: ${body.prompt ?? "choose the financially sound action."}`;

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const textOutput =
      response.output
        ?.map((item) => ("content" in item ? item.content?.map((c) => ("text" in c ? c.text : "")).join("\n") : ""))
        .join("\n")
        .trim() ?? "";

    let parsed;
    try {
      parsed = JSON.parse(textOutput);
    } catch (error) {
      parsed = { summary: textOutput, decision: "hold", details: { error: String(error) } };
    }

    return new Response(JSON.stringify({ action: parsed, raw: textOutput }), {
      headers: { "content-type": "application/json" }
    });
  } catch (error: unknown) {
    console.error("LLM route error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
}
