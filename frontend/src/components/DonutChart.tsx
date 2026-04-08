import type { CSSProperties } from "react";

type Slice = { label: string; value: number; color: string };

type DonutChartProps = {
  slices: Slice[];
  size?: number;
  strokeWidth?: number;
  title?: string;
};

export default function DonutChart({ slices, size = 180, strokeWidth = 28, title }: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;

  return (
    <div style={wrapperStyle}>
      {title ? <strong style={{ fontSize: 15, marginBottom: 8 }}>{title}</strong> : null}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice) => {
          const pct = slice.value / total;
          const dashLength = circumference * pct;
          const dashOffset = circumference * (1 - accumulated) + circumference * 0.25;
          accumulated += pct;
          return (
            <circle
              key={slice.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          );
        })}
        <text x={center} y={center - 6} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">
          {total}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize={12} fill="#64748b">
          total
        </text>
      </svg>
      <div style={legendStyle}>
        {slices.map((slice) => (
          <div key={slice.label} style={legendItemStyle}>
            <span style={{ ...legendDotStyle, background: slice.color }} />
            <span>{slice.label}</span>
            <strong>{slice.value}</strong>
            <span style={{ color: "#94a3b8" }}>({total > 0 ? Math.round((slice.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const legendStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  width: "100%",
};

const legendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
};

const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};
