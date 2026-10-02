import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/analytics/types";
import { chartColors } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from "lucide-react";

function Heatmap({ chart }: { chart: ChartSpec }) {
  const hm = chart.heatmap;
  if (!hm) return null;
  const vals = hm.z.flat().filter((v): v is number => typeof v === "number");
  const max = Math.max(0.01, ...vals.map((v) => Math.abs(v)));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {hm.x.map((x) => (
              <th key={x} className="max-w-20 truncate p-1 text-center font-medium text-ink-muted">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hm.y.map((y, i) => (
            <tr key={y}>
              <th className="truncate pr-2 text-left font-medium text-ink-muted">{y}</th>
              {hm.z[i]!.map((z, j) => {
                const v = z ?? 0;
                const t = Math.abs(v) / max;
                const bg =
                  v >= 0
                    ? `color-mix(in oklab, ${chartColors.navy} ${Math.round(t * 72)}%, ${chartColors.cream})`
                    : `color-mix(in oklab, ${chartColors.rose} ${Math.round(t * 72)}%, ${chartColors.cream})`;
                return (
                  <td
                    key={`${i}-${j}`}
                    className="size-10 text-center tabular"
                    style={{ background: bg, color: t > 0.55 ? chartColors.cream : chartColors.ink }}
                    title={`${hm.y[i]} × ${hm.x[j]}: ${z === null ? "—" : v.toFixed(2)}`}
                  >
                    {z === null ? "—" : v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shorten(v: unknown): string {
  const s = String(v ?? "");
  return s.length > 14 ? `${s.slice(0, 12)}…` : s;
}

function ChartBody({ chart }: { chart: ChartSpec }) {
  if (chart.type === "heatmap") return <Heatmap chart={chart} />;
  const tooltipStyle = {
    background: chartColors.cream,
    border: `1px solid ${chartColors.line}`,
    borderRadius: 8,
    fontSize: 12,
  };
  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={chartColors.line} strokeDasharray="3 3" />
          <XAxis dataKey={chart.xKey} tick={{ fill: chartColors.muted, fontSize: 11 }} tickFormatter={shorten} />
          <YAxis tick={{ fill: chartColors.muted, fontSize: 11 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={chart.yKey ?? "value"} stroke={chartColors.navy} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={chartColors.line} strokeDasharray="3 3" />
          <XAxis dataKey={chart.xKey} tick={{ fill: chartColors.muted, fontSize: 11 }} tickFormatter={shorten} />
          <YAxis tick={{ fill: chartColors.muted, fontSize: 11 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey={chart.yKey ?? "value"} type="monotone" stroke={chartColors.navy} fill={chartColors.navy} fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={chartColors.line} strokeDasharray="3 3" />
          <XAxis
            dataKey={chart.xKey}
            name={chart.xLabel}
            type="number"
            tick={{ fill: chartColors.muted, fontSize: 11 }}
            tickCount={5}
          />
          <YAxis
            dataKey={chart.yKey}
            name={chart.yLabel}
            type="number"
            tick={{ fill: chartColors.muted, fontSize: 11 }}
            width={48}
            tickCount={5}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chart.data} fill={chartColors.navy} fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "pie" || chart.type === "donut") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={chart.data}
            dataKey={chart.yKey ?? "value"}
            nameKey={chart.xKey}
            innerRadius={chart.type === "donut" ? 48 : 0}
            outerRadius={88}
            paddingAngle={chart.type === "donut" ? 2 : 0}
          >
            {chart.data.map((_, index) => (
              <Cell key={index} fill={chartColors.series[index % chartColors.series.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "treemap") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <Treemap
          data={chart.data}
          dataKey={chart.yKey ?? "value"}
          nameKey={chart.xKey}
          stroke={chartColors.cream}
          fill={chartColors.navy}
        >
          <Tooltip contentStyle={tooltipStyle} />
        </Treemap>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "stacked-bar" && chart.seriesKeys?.length) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={chartColors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fill: chartColors.muted, fontSize: 11 }} tickFormatter={shorten} />
          <YAxis tick={{ fill: chartColors.muted, fontSize: 11 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          {chart.seriesKeys.map((series, index) => (
            <Bar key={series.key} dataKey={series.key} name={series.label} stackId="series" fill={chartColors.series[index % chartColors.series.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const yKey = chart.yKey ?? "count";
  const angled = chart.data.length > 5;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: angled ? 28 : 8 }}>
        <CartesianGrid stroke={chartColors.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={chart.xKey}
          tick={{ fill: chartColors.muted, fontSize: 11 }}
          tickFormatter={shorten}
          interval={0}
          angle={angled ? -24 : 0}
          textAnchor={angled ? "end" : "middle"}
          height={angled ? 48 : 28}
        />
        <YAxis tick={{ fill: chartColors.muted, fontSize: 11 }} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={64}>
          {chart.data.map((_, i) => (
            <Cell key={i} fill={chartColors.series[i % chartColors.series.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartCard({
  chart,
  onExplain,
}: {
  chart: ChartSpec;
  onExplain?: (chart: ChartSpec) => void;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <CardHeader className="mb-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{chart.title}</CardTitle>
          <CardDescription className="mt-1">{chart.description}</CardDescription>
        </div>
        {onExplain ? (
          <Button variant="ghost" size="sm" onClick={() => onExplain(chart)} className="shrink-0">
            <MessageSquareText />
            Explain
          </Button>
        ) : null}
      </CardHeader>
      <div className="min-w-0">
        <ChartBody chart={chart} />
      </div>
      {chart.note ? <p className="mt-2 text-xs text-ink-subtle">{chart.note}</p> : null}
    </Card>
  );
}
