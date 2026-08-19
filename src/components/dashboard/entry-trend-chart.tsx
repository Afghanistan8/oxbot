"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import type { EntryStatsPoint, EntryStatsSeries } from "@/server/queries/dashboard";

/**
 * A tasteful categorical palette for up to 7 giveaways + "other". Warm gold
 * leads (the top giveaway), the rest fan out through muted, similarly-toned
 * hues so the chart reads as one family rather than a rainbow — the site's
 * single-accent gold identity, extended just far enough to stay legible with
 * multiple series stacked together.
 */
const SERIES_COLORS = [
  "#D8A72A", // gold — primary
  "#E8B54A", // light amber
  "#C97B4A", // terracotta
  "#4A9C8E", // muted teal
  "#C97A93", // dusty rose
  "#8FA876", // sage
  "#6B7FA8", // slate blue
];
const OTHER_COLOR = "#6B6B63"; // neutral warm gray

function colorFor(key: string, series: EntryStatsSeries[]): string {
  if (key === "other") return OTHER_COLOR;
  const idx = series.findIndex((s) => s.key === key);
  return SERIES_COLORS[idx % SERIES_COLORS.length] ?? OTHER_COLOR;
}

export function EntryTrendChart({
  series,
  points,
}: {
  series: EntryStatsSeries[];
  points: EntryStatsPoint[];
}) {
  const data = points.map((p) => ({ bucket: p.bucket, ...p.values }));
  const totalEntries = series.reduce((sum, s) => sum + s.total, 0);

  if (totalEntries === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 text-center">
        <p className="text-sm font-medium text-white">No entries in this range</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Entries will show up here as soon as people start entering.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Custom legend — small square + name + share, not the default dot legend */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {series.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorFor(s.key, series) }}
            />
            <span className="max-w-[160px] truncate text-foreground/90">{s.title}</span>
            <span className="tabular-nums">
              {s.total} ({Math.round((s.total / totalEntries) * 100)}%)
            </span>
          </span>
        ))}
      </div>

      <div className="relative h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2A2722" strokeDasharray="0" />
            <XAxis
              dataKey="bucket"
              tick={{ fill: "#7A7264", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#2A2722" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#7A7264", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(216,167,42,0.06)" }}
              contentStyle={{
                background: "#131210",
                border: "1px solid #2A2722",
                borderRadius: 12,
                fontSize: 12,
                color: "#fff",
              }}
              labelStyle={{ color: "#B7AD92", marginBottom: 4 }}
              formatter={(value, name) => {
                const s = series.find((s) => s.key === name);
                return [value, s?.title ?? String(name)] as [number, string];
              }}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="entries"
                fill={colorFor(s.key, series)}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
