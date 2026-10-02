import { toast } from "sonner";
import type { ChartSpec } from "@/lib/analytics/types";
import { chartFacts } from "@/lib/analytics/facts";
import { compactContext } from "@/lib/analytics/insights";
import { askAnalyst } from "@/lib/ai/analyst";
import { useAppStore } from "@/lib/store";

export function useExplain() {
  const result = useAppStore((s) => s.result);
  const addMessage = useAppStore((s) => s.addMessage);
  const setTab = useAppStore((s) => s.setTab);

  return async (chart: ChartSpec) => {
    if (!result) return;
    setTab("analyst");
    const question = `Explain this chart: ${chart.title}`;
    addMessage({ role: "user", content: question });
    toast.message("Asking the analyst to explain the chart…");
    const res = await askAnalyst({
      data: {
        question,
        context: compactContext(result).slice(0, 20000),
        facts: chartFacts(chart),
        mode: "explain-chart",
      },
    });
    if (!res.ok) {
      addMessage({ role: "assistant", content: res.error });
      toast.error(res.error);
      return;
    }
    addMessage({
      role: "assistant",
      content: res.text,
      evidence: chartFacts(chart).map((f) => `${f.label}: ${f.value}`),
    });
  };
}
