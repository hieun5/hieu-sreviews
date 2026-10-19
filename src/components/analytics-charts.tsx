"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPayload } from "@/contracts/reporting";
import { formatRating } from "@/lib/ratings";

type ChartKind = "leaderboard" | "timeline" | "comparison" | "cuisines";

// Receives only server-aggregated chart data. Decimal -> number conversion
// happens after aggregation, exclusively for the chart renderer.
export function AnalyticsChart({
  kind,
  data,
}: {
  kind: ChartKind;
  data:
    | AnalyticsPayload["leaderboard"]
    | AnalyticsPayload["timeline"]
    | AnalyticsPayload["comparison"]
    | AnalyticsPayload["cuisines"];
}) {
  if (!data.length)
    return (
      <div className="flex h-[280px] flex-col items-center justify-center px-6 text-center">
        <p className="section-title mb-2">No ratings yet</p>
        <p className="muted max-w-xs text-xs">
          No recorded ratings match these filters. Try a wider range or log a
          visit.
        </p>
      </div>
    );
  const chartData = data.map((row) => ({
    name: "name" in row ? row.name : row.date,
    date: "date" in row ? row.date : undefined,
    average: row.average === null ? null : Number(row.average),
    exactAverage: row.average,
  }));
  const tooltip = (
    <Tooltip
      contentStyle={{ borderRadius: 10, borderColor: "#e6dfd2", fontSize: 12 }}
      formatter={(_value, _name, item) => [
        formatRating(item.payload.exactAverage),
        "Average rating",
      ]}
    />
  );
  const yAxis = (
    <YAxis
      domain={[0, 10]}
      tick={{ fill: "#71695f", fontSize: 10 }}
      tickLine={false}
      axisLine={false}
    />
  );
  return (
    <div className="chart-frame" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === "timeline" ? (
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, left: -25, bottom: 12 }}
          >
            <CartesianGrid stroke="#e9e2d7" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71695f", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(5)}
              minTickGap={24}
            />
            {yAxis}
            {tooltip}
            <Line
              dataKey="average"
              type="linear"
              stroke="#cf5339"
              strokeWidth={2.5}
              dot={{ fill: "#cf5339", r: 4.5, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 15, left: -25, bottom: 12 }}
          >
            <CartesianGrid stroke="#e9e2d7" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#71695f", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: string) =>
                value.length > 15 ? `${value.slice(0, 14)}…` : value
              }
              minTickGap={8}
            />
            {yAxis}
            {tooltip}
            <Bar
              dataKey="average"
              fill={kind === "cuisines" ? "#a58ac7" : "#ec9770"}
              radius={[9, 9, 0, 0]}
              maxBarSize={42}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
