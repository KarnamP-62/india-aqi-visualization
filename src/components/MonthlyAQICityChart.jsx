import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// AQI color by value
function getAQIColorByValue(aqi) {
  if (aqi <= 50) return "#5699af";
  if (aqi <= 100) return "#87beb1";
  if (aqi <= 200) return "#dfbfc6";
  if (aqi <= 300) return "#de9eaf";
  if (aqi <= 400) return "#e07192";
  return "#c1616b";
}

// AQI status text
function getAQIStatus(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

// Aggregate city monthly data
function aggregateCityMonthly(data) {
  const cityMonth = new Map();

  data.forEach((row) => {
    const dateParts = row.date?.split("/");
    if (!dateParts || dateParts.length !== 3) return;
    if (dateParts[2] !== "24") return;

    const month = parseInt(dateParts[0], 10);
    const area = row.area?.trim();
    const aqiValue = parseFloat(row.aqi_value);
    if (!area || isNaN(aqiValue)) return;

    const key = `${area}__${month}`;
    if (!cityMonth.has(key)) {
      cityMonth.set(key, { area, month, values: [] });
    }
    cityMonth.get(key).values.push(aqiValue);
  });

  const result = [];
  cityMonth.forEach((entry) => {
    const sorted = [...entry.values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    result.push({ area: entry.area, month: entry.month, avgAQI: med });
  });

  return result;
}

export default function MonthlyAQICityChart() {
  const [cityMonthlyData, setCityMonthlyData] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef(null);

  useEffect(() => {
    d3.csv("/data/AQI.csv").then((data) => {
      const cityMonthly = aggregateCityMonthly(data);
      setCityMonthlyData(cityMonthly);
      setLoading(false);
    });
  }, []);

  const margin = { top: 20, right: 80, bottom: 50, left: 60 };
  const width = 1100;
  const height = 500;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const maxAQI = 500;
  const colWidth = plotW / 12;
  const dashWidth = colWidth * 0.5;

  // AQI threshold bands
  const bands = [
    { label: "Good", min: 0, max: 50, color: "#5699af" },
    { label: "Satisfactory", min: 50, max: 100, color: "#87beb1" },
    { label: "Moderate", min: 100, max: 200, color: "#dfbfc6" },
    { label: "Poor", min: 200, max: 300, color: "#de9eaf" },
    { label: "Very Poor", min: 300, max: 400, color: "#e07192" },
    { label: "Severe", min: 400, max: 500, color: "#c1616b" },
  ];

  const yScale = (aqi) => margin.top + plotH - (Math.min(aqi, maxAQI) / maxAQI) * plotH;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <p>Loading chart data...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "20px 0", background: "#fff", display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: `${width}px` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height - 30}`}
          style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", width: "100%", height: "auto" }}
        >
          {/* Category lines and labels */}
          {bands.map((band) => {
            const y1 = yScale(band.max);
            const y2 = yScale(band.min);
            const midY = (y1 + y2) / 2;
            return (
              <g key={band.label}>
                {/* Horizontal line at threshold */}
                <line
                  x1={margin.left}
                  y1={y1}
                  x2={margin.left + plotW}
                  y2={y1}
                  stroke="#ddd"
                  strokeWidth={1}
                />
                {/* Label on right side */}
                <text
                  x={margin.left + plotW + 6}
                  y={midY + 3}
                  fontSize="9"
                  fill={band.color}
                  fontWeight="600"
                >
                  {band.label}
                </text>
              </g>
            );
          })}

          {/* Y-axis label */}
          <text
            x={15}
            y={margin.top + plotH / 2}
            transform={`rotate(-90, 15, ${margin.top + plotH / 2})`}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
            fontWeight="500"
          >
            AQI Category
          </text>

          {/* Month labels */}
          {MONTH_NAMES.map((name, i) => {
            const x = margin.left + i * colWidth + colWidth / 2;
            return (
              <text
                key={name}
                x={x}
                y={margin.top + plotH + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#666"
                fontWeight="500"
              >
                {name}
              </text>
            );
          })}

          {/* Data dashes */}
          {cityMonthlyData.map((d, i) => {
            const colX = margin.left + (d.month - 1) * colWidth + colWidth / 2;
            const y = yScale(d.avgAQI);
            const color = getAQIColorByValue(d.avgAQI);

            return (
              <rect
                key={i}
                x={colX - dashWidth / 2}
                y={y - 1.5}
                width={dashWidth}
                height={3}
                fill={color}
                opacity={0.8}
                rx={1}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    area: d.area,
                    month: MONTH_NAMES[d.month - 1],
                    aqi: d.avgAQI,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              backgroundColor: "rgba(255, 255, 255, 0.97)",
              padding: "12px 16px",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              border: "1px solid #e0e0e0",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              pointerEvents: "none",
              zIndex: 1001,
              minWidth: "150px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#333",
                marginBottom: "8px",
                borderBottom: "1px solid #eee",
                paddingBottom: "6px",
              }}
            >
              {tooltip.area}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#999" }}>Month:</span> {tooltip.month}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#999" }}>AQI:</span> <strong style={{ color: "#333" }}>{tooltip.aqi.toFixed(0)}</strong>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: getAQIColorByValue(tooltip.aqi),
                fontWeight: "500",
              }}
            >
              {getAQIStatus(tooltip.aqi)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
