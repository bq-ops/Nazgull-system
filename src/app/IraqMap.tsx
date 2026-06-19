"use client";

import { useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

// Iraq ADM1 (governorate) boundaries — GADM 4.1, served from /public
const GEO_URL = "/iraq-governorates.geojson";

// [longitude, latitude] — react-simple-maps uses lon/lat order
const CITY_COORDS: Record<string, [number, number]> = {
  Baghdad:        [44.36, 33.31],
  Basra:          [47.78, 30.51],
  Mosul:          [43.13, 36.34],
  Erbil:          [44.01, 36.19],
  Sulaymaniyah:   [45.43, 35.56],
  Kirkuk:         [44.39, 35.47],
  Najaf:          [44.33, 32.00],
  Karbala:        [44.02, 32.61],
  Nasiriyah:      [46.26, 31.05],
  Hillah:         [44.43, 32.47],
  Amarah:         [47.14, 31.84],
  Diwaniyah:      [44.92, 31.99],
  Kut:            [45.82, 32.51],
  Ramadi:         [43.31, 33.42],
  Duhok:          [42.99, 36.87],
  Samawah:        [45.28, 31.33],
  Baqubah:        [44.64, 33.75],
  Tikrit:         [43.68, 34.61],
  Halabja:        [45.99, 35.18],
};

// Interpolate between blush (#F4DAD9) and oxblood (#4A1416)
function blendColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const r = Math.round(0xf4 + (0x4a - 0xf4) * c);
  const g = Math.round(0xda + (0x14 - 0xda) * c);
  const b = Math.round(0xd9 + (0x16 - 0xd9) * c);
  return `rgb(${r},${g},${b})`;
}

function markerRadius(value: number, maxValue: number): number {
  if (maxValue === 0 || value === 0) return 4;
  return 5 + Math.sqrt(value / maxValue) * 17;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface CityStats {
  orders: number;
  revenue: number;
}

interface TooltipState {
  city: string;
  stats: CityStats;
  x: number;
  y: number;
}

interface Props {
  cities: Map<string, CityStats>;
  metric: "orders" | "revenue";
  fmtRevenue: (n: number) => string;
}

export default function IraqMap({ cities, metric, fmtRevenue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const cityEntries = [...cities.entries()]
    .map(([name, stats]) => ({
      name,
      coords: CITY_COORDS[name] as [number, number] | undefined,
      stats,
    }))
    .filter((c) => c.coords !== undefined) as {
    name: string;
    coords: [number, number];
    stats: CityStats;
  }[];

  const maxValue = Math.max(
    ...cityEntries.map((c) =>
      metric === "orders" ? c.stats.orders : c.stats.revenue,
    ),
    1,
  );

  function updateTooltip(
    e: React.MouseEvent<SVGGElement>,
    city: string,
    stats: CityStats,
  ) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ city, stats, x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onMouseMove={(e) => {
        if (hoveredCity && tooltip) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltip((prev) =>
              prev
                ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
                : null,
            );
          }
        }
      }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1650, center: [44.3, 33.2] }}
        width={420}
        height={500}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#F4DAD9"
                stroke="#ECCFCD"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover:   { fill: "#F4DAD9", outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {cityEntries.map(({ name, coords, stats }) => {
          const value = metric === "orders" ? stats.orders : stats.revenue;
          const t     = value / maxValue;
          const r     = markerRadius(value, maxValue);
          const fill  = blendColor(t);
          const isHovered = hoveredCity === name;

          return (
            <Marker
              key={name}
              coordinates={coords}
              onMouseEnter={(e) => {
                setHoveredCity(name);
                updateTooltip(e, name, stats);
              }}
              onMouseMove={(e) => updateTooltip(e, name, stats)}
              onMouseLeave={() => {
                setHoveredCity(null);
                setTooltip(null);
              }}
            >
              <circle
                r={r}
                fill={fill}
                stroke={isHovered ? "#2E0A0A" : "#4A1416"}
                strokeWidth={isHovered ? 1.5 : 0.8}
                fillOpacity={0.88}
                style={{ cursor: "pointer", transition: "r 0.15s" }}
              />
              <text
                x={r + 3}
                y={3.5}
                fontSize={8.5}
                fontWeight={isHovered ? 600 : 400}
                fill={isHovered ? "#4A1416" : "#2B1A1B"}
                fontFamily="Inter, sans-serif"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {name}
              </text>
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 min-w-[120px] rounded-lg border border-border bg-surface px-3 py-2 shadow-md text-xs"
          style={{
            left: tooltip.x + 14,
            top:  tooltip.y - 12,
            transform: tooltip.x > 280 ? "translateX(-140%)" : undefined,
          }}
        >
          <p className="font-semibold text-brand-oxblood">{tooltip.city}</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-text-muted">
              Orders:{" "}
              <span className="tabular-nums font-medium text-text">
                {tooltip.stats.orders}
              </span>
            </p>
            <p className="text-text-muted">
              Revenue:{" "}
              <span className="tabular-nums font-medium text-text">
                {fmtRevenue(tooltip.stats.revenue)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
