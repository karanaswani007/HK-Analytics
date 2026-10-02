import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildGeminiRequestBody, extractGeminiText } from "./gemini";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const InputSchema = z.object({
  question: z.string().min(1).max(2000),
  context: z.string().max(24000),
  facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .max(40),
  history: z.array(MessageSchema).max(8).optional(),
  mode: z.enum(["chat", "explain-chart"]).optional(),
});

export const askAnalyst = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error:
          "The Gemini AI Analyst is unavailable in this environment. Core analytics still work — use Insights, Dashboard, and Downloads.",
      };
    }

    const factBlock = data.facts
      .map((f) => `- ${f.label}: ${f.value}`)
      .join("\n");

    const system = [
      "You are the HK Analytics AI Analyst for HK SoftTech.",
      "You answer ONLY from the provided analytics context and computed facts.",
      "Never invent a number, column, or statistic that is not in the context or facts.",
      "If the data cannot support an answer, say so plainly.",
      "Never claim causation. Use “associated with”, “differs by”, “correlated with”.",
      "Structure every answer as:",
      "1) Direct answer",
      "2) Evidence (cite the given metrics, with record counts)",
      "3) Interpretation",
      "4) Caveat or next step",
      "Be concise. Professional tone. No emoji. No markdown tables unless necessary.",
      data.mode === "explain-chart"
        ? "The user clicked Explain this chart. Describe notable differences or trends in the aggregated values. Do not overclaim."
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const user = [
      `Question: ${data.question}`,
      "",
      "Computed facts (authoritative — prefer these numbers):",
      factBlock || "(none)",
      "",
      "Analytics context:",
      data.context,
    ].join("\n");

    const messages = [
      ...(data.history ?? []).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1200),
      })),
      { role: "user" as const, content: user },
    ];

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(buildGeminiRequestBody(system, messages)),
        },
      );
      if (!res.ok) {
        return {
          ok: false as const,
          error:
            res.status === 429
              ? "The Gemini free-tier limit was reached. Try again later."
              : res.status === 400 || res.status === 403
                ? "Gemini rejected the request. Check your API key and model access."
                : `Gemini request failed (${res.status}).`,
        };
      }
      const text = extractGeminiText(await res.json());
      if (!text) {
        return { ok: false as const, error: "Gemini returned no text for this response." };
      }
      return { ok: true as const, text };
    } catch {
      return {
        ok: false as const,
        error: "Could not reach Gemini. Check the connection and try again.",
      };
    }
  });
