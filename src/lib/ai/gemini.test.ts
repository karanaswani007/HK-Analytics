import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGeminiRequestBody, extractGeminiText } from "./gemini.ts";

test("builds a Gemini request with system instructions and native conversation roles", () => {
  assert.deepEqual(
    buildGeminiRequestBody("Stay grounded.", [
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
    ]),
    {
      systemInstruction: { parts: [{ text: "Stay grounded." }] },
      contents: [
        { role: "user", parts: [{ text: "Question" }] },
        { role: "model", parts: [{ text: "Answer" }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
    },
  );
});

test("extracts text across Gemini response parts", () => {
  assert.equal(
    extractGeminiText({
      candidates: [{ content: { parts: [{ text: " Grounded" }, { text: " answer. " }] } }],
    }),
    "Grounded answer.",
  );
});

test("returns empty text for blocked or malformed Gemini responses", () => {
  assert.equal(extractGeminiText({ candidates: [] }), "");
  assert.equal(extractGeminiText({ candidates: [{ finishReason: "SAFETY" }] }), "");
  assert.equal(extractGeminiText(null), "");
});
