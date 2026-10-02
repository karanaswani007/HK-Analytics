export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildGeminiRequestBody(systemInstruction: string, messages: GeminiMessage[]) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
  };
}

export function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("candidates" in payload)) return "";
  const candidates = payload.candidates;
  if (!Array.isArray(candidates)) return "";
  const content = candidates[0]?.content;
  if (!content || typeof content !== "object" || !("parts" in content)) return "";
  if (!Array.isArray(content.parts)) return "";

  return content.parts
    .map((part: unknown) =>
      part && typeof part === "object" && "text" in part && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("")
    .trim();
}
