import { useState } from "react";
import { ArrowUp, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { askAnalyst } from "@/lib/ai/analyst";
import { computeFacts, SUGGESTED_QUESTIONS } from "@/lib/analytics/facts";
import { compactContext } from "@/lib/analytics/insights";
import { useAppStore } from "@/lib/store";

export function AnalystPanel() {
  const result = useAppStore((s) => s.result)!;
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState(0);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    if (turns >= 20) {
      toast.error("This session has reached the analyst question limit.");
      return;
    }
    setPending(true);
    addMessage({ role: "user", content: q });
    setText("");
    const facts = computeFacts(q, result);
    try {
      const res = await askAnalyst({
        data: {
          question: q,
          context: compactContext(result).slice(0, 20000),
          facts,
          history: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
          mode: "chat",
        },
      });
      if (!res.ok) {
        addMessage({ role: "assistant", content: res.error });
        toast.error(res.error);
      } else {
        addMessage({
          role: "assistant",
          content: res.text,
          evidence: facts.slice(0, 6).map((f) => `${f.label}: ${f.value}`),
        });
        setTurns((n) => n + 1);
      }
    } catch {
      addMessage({
        role: "assistant",
        content: "The AI Analyst could not be reached. Insights and downloads still work.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">AI Analyst</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Questions are answered from the profile, tests, and aggregations already computed. Numbers you
          see as evidence were calculated in the engine, not guessed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending}
            onClick={() => void send(q)}
            className="rounded-full bg-surface px-3 py-2 text-left text-xs text-ink-muted shadow-[var(--shadow-border)] hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <Card className={m.role === "user" ? "max-w-[85%] bg-navy p-4 text-navy-fg" : "max-w-[90%] p-4"}>
              {m.role === "assistant" ? (
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-navy">
                  <Bot className="size-3.5" />
                  Analyst
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              {m.evidence?.length ? (
                <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">
                  <div className="mb-1 font-medium text-ink">Evidence</div>
                  <ul className="space-y-1">
                    {m.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </div>
        ))}
        {pending ? <p className="text-sm text-ink-subtle">Computing facts, then asking the analyst…</p> : null}
      </div>
      <form
        className="sticky bottom-3 flex gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this dataset…"
          className="h-11 flex-1 rounded-lg bg-transparent px-3 text-sm text-ink placeholder:text-ink-subtle"
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
