import { asText } from "@/lib/analytics/format";
import { cn } from "@/lib/utils";

export function DataTable({
  rows,
  columns,
  maxRows = 12,
  className,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  maxRows?: number;
  className?: string;
}) {
  const shown = rows.slice(0, maxRows);
  if (!columns.length) {
    return <p className="text-sm text-ink-muted">No columns to display.</p>;
  }
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line", className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-t border-line even:bg-surface-2/60">
              {columns.map((c) => (
                <td key={c} className="max-w-48 truncate px-3 py-2 tabular text-ink">
                  {asText(row[c]) || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
