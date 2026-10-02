import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";

export function CleaningPanel() {
  const result = useAppStore((s) => s.result)!;
  const logs = result.cleaning.logs.filter((l) => l.rowsAffected > 0 || l.operation === "standardize_names");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Strategy</CardTitle>
            <CardDescription>
              {result.cleaning.originalRowCount.toLocaleString()} original rows →{" "}
              {result.cleaning.cleanedRowCount.toLocaleString()} cleaned rows.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="space-y-2 text-sm text-ink-muted">
          {result.cleaning.strategyNotes.map((n, i) => (
            <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
              {n}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cleaning summary</CardTitle>
            <CardDescription>Every transform is logged. Nothing silent.</CardDescription>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="pb-2 pr-3">Operation</th>
                <th className="pb-2 pr-3">Column</th>
                <th className="pb-2 pr-3">Rows</th>
                <th className="pb-2 pr-3">Method</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{l.operation}</td>
                  <td className="py-2 pr-3">{l.column ?? "—"}</td>
                  <td className="py-2 pr-3 tabular">{l.rowsAffected}</td>
                  <td className="py-2 pr-3 text-ink-muted">{l.method}</td>
                  <td className="py-2 text-ink-muted">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
