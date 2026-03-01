import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { STATE_COORDINATES } from "./stateCoordinates";

// Color functions
const getStatusColor = (status) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("good")) return "#5699af";
  if (statusLower.includes("satisfactory")) return "#87beb1";
  if (statusLower.includes("moderate")) return "#dfbfc6";
  if (statusLower.includes("poor") && !statusLower.includes("very")) return "#de9eaf";
  if (statusLower.includes("very poor")) return "#e07192";
  if (statusLower.includes("severe")) return "#c1616b";
  return "#000000";
};

const getAQIStatus = (aqi) => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
};

const getAvgAQIColor = (avg) => {
  if (avg === 0 || !avg) return "#000000";
  if (avg <= 50) return "#5699af";
  if (avg <= 100) return "#87beb1";
  if (avg <= 200) return "#dfbfc6";
  if (avg <= 300) return "#de9eaf";
  if (avg <= 400) return "#e07192";
  return "#c1616b";
};

const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2024 leap year
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// AQI color by value
const getAQIColorByValue = (aqi) => {
  if (aqi <= 50) return "#5699af";
  if (aqi <= 100) return "#87beb1";
  if (aqi <= 200) return "#dfbfc6";
  if (aqi <= 300) return "#de9eaf";
  if (aqi <= 400) return "#e07192";
  return "#c1616b";
};

// Aggregate city-level monthly averages from raw data
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

// Life Expectancy Gains dumbbell plot component
function LifeExpectancyPlot({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    // Add XML declaration and namespace
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "life-expectancy-gains-pm25.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const margin = { top: 20, right: 40, bottom: 120, left: 70 };
  const width = 1100;
  const height = 500;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Sort by WHO guideline value (descending)
  const sortedData = [...data].sort((a, b) => b.whoGain - a.whoGain);

  const maxGain = Math.max(...data.map(d => d.whoGain), 10);
  const barSpacing = plotW / sortedData.length;

  const yScale = (val) => margin.top + plotH - (val / maxGain) * plotH;

  // Colors
  const whoColor = "#5699af"; // Blue for WHO
  const nationalColor = "#c1616b"; // Red for National

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", background: "#fff" }}>
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} width={width} height={height - 30} style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" }}>
          {/* Grid lines */}
          {[0, 2, 4, 6, 8, 10].filter(v => v <= maxGain).map((val) => (
            <g key={val}>
              <line
                x1={margin.left}
                y1={yScale(val)}
                x2={margin.left + plotW}
                y2={yScale(val)}
                stroke="#e5e5e5"
                strokeWidth={1}
              />
              <text
                x={margin.left - 10}
                y={yScale(val) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#888"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Y-axis label */}
          <text
            x={18}
            y={margin.top + plotH / 2}
            transform={`rotate(-90, 18, ${margin.top + plotH / 2})`}
            textAnchor="middle"
            fontSize="12"
            fill="#555"
            fontWeight="500"
          >
            Life Expectancy Gain (Years)
          </text>

          {/* WHO Area (blue) - rendered first so it's behind */}
          <path
            d={(() => {
              const baseline = margin.top + plotH;
              let path = `M ${margin.left + barSpacing / 2} ${baseline}`;
              sortedData.forEach((d, i) => {
                const x = margin.left + i * barSpacing + barSpacing / 2;
                const y = yScale(d.whoGain);
                path += ` L ${x} ${y}`;
              });
              // Close path back to baseline
              const lastX = margin.left + (sortedData.length - 1) * barSpacing + barSpacing / 2;
              path += ` L ${lastX} ${baseline} Z`;
              return path;
            })()}
            fill={whoColor}
            fillOpacity={0.2}
          />

          {/* National Area (red) - rendered second so it's on top */}
          <path
            d={(() => {
              const baseline = margin.top + plotH;
              let path = `M ${margin.left + barSpacing / 2} ${baseline}`;
              sortedData.forEach((d, i) => {
                const x = margin.left + i * barSpacing + barSpacing / 2;
                const y = yScale(d.nationalGain);
                path += ` L ${x} ${y}`;
              });
              // Close path back to baseline
              const lastX = margin.left + (sortedData.length - 1) * barSpacing + barSpacing / 2;
              path += ` L ${lastX} ${baseline} Z`;
              return path;
            })()}
            fill={nationalColor}
            fillOpacity={0.2}
          />

          {/* WHO Line (blue) */}
          <path
            d={sortedData.map((d, i) => {
              const x = margin.left + i * barSpacing + barSpacing / 2;
              const y = yScale(d.whoGain);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
            fill="none"
            stroke={whoColor}
            strokeWidth={2}
          />

          {/* National Line (red) */}
          <path
            d={sortedData.map((d, i) => {
              const x = margin.left + i * barSpacing + barSpacing / 2;
              const y = yScale(d.nationalGain);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
            fill="none"
            stroke={nationalColor}
            strokeWidth={2}
          />

          {/* Data points and labels */}
          {sortedData.map((d, i) => {
            const x = margin.left + i * barSpacing + barSpacing / 2;
            const yWho = yScale(d.whoGain);
            const yNat = yScale(d.nationalGain);

            return (
              <g key={d.state}>
                {/* WHO dot (top) */}
                <circle
                  cx={x}
                  cy={yWho}
                  r={5}
                  fill={whoColor}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    const rect = e.target.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 10,
                      state: d.state,
                      type: "WHO Guideline (5 μg/m³)",
                      value: d.whoGain,
                      pm25: d.pm25,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />

                {/* National dot (bottom) */}
                <circle
                  cx={x}
                  cy={yNat}
                  r={5}
                  fill={nationalColor}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    const rect = e.target.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 10,
                      state: d.state,
                      type: "National Standard (40 μg/m³)",
                      value: d.nationalGain,
                      pm25: d.pm25,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />

                {/* State label (rotated) */}
                <text
                  x={x}
                  y={margin.top + plotH + 10}
                  textAnchor="start"
                  fontSize="9"
                  fill="#555"
                  transform={`rotate(45, ${x}, ${margin.top + plotH + 10})`}
                >
                  {d.state.length > 18 ? d.state.substring(0, 16) + "..." : d.state}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${width - 280}, 5)`}>
            <circle cx={0} cy={0} r={5} fill={whoColor} />
            <text x={10} y={4} fontSize="10" fill="#555">WHO Guideline (5 μg/m³)</text>
            <circle cx={150} cy={0} r={5} fill={nationalColor} />
            <text x={160} y={4} fontSize="10" fill="#555">National Std (40 μg/m³)</text>
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              background: "rgba(0,0,0,0.88)",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              pointerEvents: "none",
              zIndex: 1001,
              whiteSpace: "nowrap",
            }}
          >
            <strong>{tooltip.state}</strong>
            <br />
            <span style={{ color: "#aaa" }}>{tooltip.type}</span>
            <br />
            Gain: <strong>{tooltip.value.toFixed(2)} years</strong>
            <br />
            <span style={{ color: "#aaa", fontSize: "10px" }}>2023 PM2.5: {tooltip.pm25} μg/m³</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Strip plot component
function AQIStripPlot({ cityMonthlyData }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    // Add XML declaration and namespace
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "monthly_aqi_by_city_2024.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const width = 900;
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

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", background: "#fff" }}>
      <div style={{ position: "relative" }}>
        {/* Download button */}
        <button
          onClick={downloadSVG}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 1001,
            padding: "5px 10px",
            fontSize: "11px",
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#555"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#333"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          SVG
        </button>
        <svg ref={svgRef} width={width} height={height} style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" }}>
          {/* Background bands */}
          {bands.map((band) => {
            const y1 = yScale(band.max);
            const y2 = yScale(band.min);
            return (
              <rect
                key={band.label}
                x={margin.left}
                y={y1}
                width={plotW}
                height={y2 - y1}
                fill={band.color}
                opacity={0.08}
              />
            );
          })}

          {/* Threshold lines */}
          {[50, 100, 200, 300, 400, 500].map((val) => (
            <g key={val}>
              <line
                x1={margin.left}
                y1={yScale(val)}
                x2={margin.left + plotW}
                y2={yScale(val)}
                stroke="#ddd"
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              <text
                x={margin.left - 8}
                y={yScale(val) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#999"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Band labels on right */}
          {bands.map((band) => {
            const midY = yScale((band.min + band.max) / 2);
            return (
              <text
                key={`label-${band.label}`}
                x={margin.left + plotW + 6}
                y={midY + 3}
                fontSize="9"
                fill={band.color}
                fontWeight="600"
              >
                {band.label}
              </text>
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
            AQI Value
          </text>

          {/* Month columns */}
          {MONTH_NAMES.map((name, i) => {
            const x = margin.left + i * colWidth + colWidth / 2;
            return (
              <g key={name}>
                {/* Column separator */}
                <line
                  x1={margin.left + i * colWidth}
                  y1={margin.top}
                  x2={margin.left + i * colWidth}
                  y2={margin.top + plotH}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                />
                {/* Month label */}
                <text
                  x={x}
                  y={margin.top + plotH + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#666"
                  fontWeight="500"
                >
                  {name}
                </text>
              </g>
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

          {/* Title */}
          <text
            x={margin.left}
            y={20}
            fontSize="14"
            fontWeight="600"
            fill="#333"
          >
            Monthly Average AQI by City — 2024
          </text>
          <text
            x={margin.left}
            y={34}
            fontSize="11"
            fill="#888"
          >
            Each bar represents a city's monthly average AQI
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              pointerEvents: "none",
              zIndex: 1001,
              whiteSpace: "nowrap",
            }}
          >
            <strong>{tooltip.area}</strong>
            <br />
            {tooltip.month} — AQI: {tooltip.aqi.toFixed(0)}
            <br />
            {getAQIStatus(tooltip.aqi)}
          </div>
        )}
      </div>
    </div>
  );
}

// Generate mini circular visualization SVG string
function renderMiniCircularViz(stateData, stateName, size = 80) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;
  const dashLength = size * 0.25;
  const dashWidth = Math.max(1, size / 40);
  const totalDays = 366;
  const anglePerDay = (2 * Math.PI) / totalDays;
  const startAngleOffset = (3 * Math.PI) / 2;

  // Build day data array
  const allDays = [];
  let dayOfYear = 0;
  daysInMonth.forEach((daysInThisMonth, monthIdx) => {
    for (let day = 1; day <= daysInThisMonth; day++) {
      const dateKey = `${monthIdx + 1}-${day}`;
      const dayData = stateData.dateMap?.get(dateKey);
      allDays.push({
        dayOfYear,
        month: monthIdx + 1,
        day,
        status: dayData?.status,
        aqiValue: dayData?.aqiValue || 0,
      });
      dayOfYear++;
    }
  });

  const avgAQI = stateData.avgAQI || 0;
  const centerColor = getAvgAQIColor(avgAQI);
  const uniqueId = stateName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

  // Build radial lines
  const lines = allDays.map((dayInfo) => {
    const color = dayInfo.status ? getStatusColor(dayInfo.status) : "#ced4da";
    const angle = startAngleOffset + dayInfo.dayOfYear * anglePerDay;
    const innerR = radius - dashLength / 2;
    const outerR = radius + dashLength / 2;
    const innerX = centerX + innerR * Math.cos(angle);
    const innerY = centerY + innerR * Math.sin(angle);
    const outerX = centerX + outerR * Math.cos(angle);
    const outerY = centerY + outerR * Math.sin(angle);

    return `<line x1="${innerX}" y1="${innerY}" x2="${outerX}" y2="${outerY}" stroke="${color}" stroke-width="${dashWidth}" opacity="0.8"/>`;
  }).join("");

  // Build line graph
  const dataPoints = allDays
    .filter((d) => d.status)
    .map((d) => {
      const angle = startAngleOffset + d.dayOfYear * anglePerDay;
      const minRadius = size * 0.15;
      const maxRadius = radius - dashLength / 2 - 2;
      const aqiRadius = minRadius + (d.aqiValue / 500) * (maxRadius - minRadius);
      return {
        x: centerX + aqiRadius * Math.cos(angle),
        y: centerY + aqiRadius * Math.sin(angle),
        dayOfYear: d.dayOfYear,
      };
    });

  // Build segments for line graph
  let lineGraphPath = "";
  if (dataPoints.length > 0) {
    const segments = [];
    let currentSegment = [dataPoints[0]];

    for (let i = 1; i < dataPoints.length; i++) {
      if (dataPoints[i].dayOfYear - dataPoints[i - 1].dayOfYear > 1) {
        segments.push(currentSegment);
        currentSegment = [dataPoints[i]];
      } else {
        currentSegment.push(dataPoints[i]);
      }
    }
    segments.push(currentSegment);

    lineGraphPath = segments
      .map((segment) => {
        if (segment.length === 1) {
          return `<circle cx="${segment[0].x}" cy="${segment[0].y}" r="0.5" fill="#6c757d" opacity="0.6"/>`;
        }
        const pathData = segment
          .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ");
        return `<path d="${pathData}" fill="none" stroke="#4b5563" stroke-width="1" opacity="0.5"/>`;
      })
      .join("");
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="centerGlow-${uniqueId}">
          <stop offset="0%" stop-color="${centerColor}" stop-opacity="0.9"/>
          <stop offset="50%" stop-color="${centerColor}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${centerColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${centerX}" cy="${centerY}" r="${size * 0.12}" fill="url(#centerGlow-${uniqueId})"/>
      ${lines}
      ${lineGraphPath}
    </svg>
  `;
}

// AQI categories with colors
const AQI_CATEGORIES = [
  { key: "good", label: "Good", min: 0, max: 50, color: "#5699af" },
  { key: "satisfactory", label: "Satisfactory", min: 51, max: 100, color: "#87beb1" },
  { key: "moderate", label: "Moderate", min: 101, max: 200, color: "#dfbfc6" },
  { key: "poor", label: "Poor", min: 201, max: 300, color: "#de9eaf" },
  { key: "veryPoor", label: "Very Poor", min: 301, max: 400, color: "#e07192" },
  { key: "severe", label: "Severe", min: 401, max: 999, color: "#c1616b" },
];

// Get category key from AQI value
function getAQICategoryKey(aqi) {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "satisfactory";
  if (aqi <= 200) return "moderate";
  if (aqi <= 300) return "poor";
  if (aqi <= 400) return "veryPoor";
  return "severe";
}

// Aggregate CSV data by state with category day counts
function aggregateByState(data) {
  const stateMap = new Map();

  data.forEach((row) => {
    // AQI.csv uses M/D/YY format
    const dateParts = row.date?.split("/");
    if (!dateParts || dateParts.length !== 3) return;

    const year = dateParts[2];
    if (year !== "24") return;

    const month = parseInt(dateParts[0], 10);
    const day = parseInt(dateParts[1], 10);
    const state = row.state?.trim();
    const aqiValue = parseFloat(row.aqi_value) || 0;
    const status = row.air_quality_status || "";

    if (!state || !STATE_COORDINATES[state]) return;

    if (!stateMap.has(state)) {
      stateMap.set(state, {
        dayData: new Map(),
        aqiValues: [],
      });
    }

    const stateEntry = stateMap.get(state);
    const dateKey = `${month}-${day}`;

    if (!stateEntry.dayData.has(dateKey)) {
      stateEntry.dayData.set(dateKey, { aqiSum: 0, count: 0, status: "" });
    }

    const dayEntry = stateEntry.dayData.get(dateKey);
    dayEntry.aqiSum += aqiValue;
    dayEntry.count += 1;
    if (aqiValue > (dayEntry.maxAqi || 0)) {
      dayEntry.maxAqi = aqiValue;
      dayEntry.status = status;
    }
  });

  const result = {};
  stateMap.forEach((value, state) => {
    const dateMap = new Map();
    const aqiValues = [];

    // Initialize category counts
    const categoryCounts = {
      good: 0,
      satisfactory: 0,
      moderate: 0,
      poor: 0,
      veryPoor: 0,
      severe: 0,
    };

    value.dayData.forEach((dayEntry, dateKey) => {
      const avgAqi = dayEntry.aqiSum / dayEntry.count;
      const status = dayEntry.status || getAQIStatus(avgAqi);
      dateMap.set(dateKey, { aqiValue: avgAqi, status });
      aqiValues.push(avgAqi);

      // Count days per category
      const categoryKey = getAQICategoryKey(avgAqi);
      categoryCounts[categoryKey]++;
    });

    const avgAQI = aqiValues.length > 0
      ? aqiValues.reduce((sum, val) => sum + val, 0) / aqiValues.length
      : 0;

    result[state] = {
      dateMap,
      avgAQI,
      dataCount: aqiValues.length,
      categoryCounts,
    };
  });

  return result;
}

// Generate bubble cluster SVG string
function renderBubbleCluster(stateData, stateName, size = 90) {
  const centerX = size / 2;
  const centerY = size / 2;
  const counts = stateData.categoryCounts || {};

  // Find max count for scaling
  const maxCount = Math.max(...Object.values(counts), 1);

  // Bubble positions in a cluster arrangement (like reference image)
  // Positions are offsets from center, arranged in a flower-like pattern
  const bubblePositions = [
    { angle: -90, dist: 0.32 },   // top
    { angle: 30, dist: 0.32 },    // bottom-right
    { angle: 150, dist: 0.32 },   // bottom-left
    { angle: -30, dist: 0.18 },   // right
    { angle: -150, dist: 0.18 }, // left
    { angle: 90, dist: 0.1 },     // bottom-center (smaller, closer)
  ];

  const bubbles = AQI_CATEGORIES.map((cat, i) => {
    const count = counts[cat.key] || 0;
    if (count === 0) return "";

    // Scale radius: min 3px, max based on size
    const minR = 3;
    const maxR = size * 0.22;
    const radius = minR + (count / maxCount) * (maxR - minR);

    const pos = bubblePositions[i];
    const angleRad = (pos.angle * Math.PI) / 180;
    const dist = pos.dist * size;
    const x = centerX + dist * Math.cos(angleRad);
    const y = centerY + dist * Math.sin(angleRad);

    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${cat.color}" opacity="0.85" stroke="#fff" stroke-width="1"/>`;
  }).join("");

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${bubbles}
    </svg>
  `;
}

// State AQI Category Grid visualization component
function StateAQICategoryGrid({ stateData }) {
  const [tooltip, setTooltip] = useState(null);

  // Sort states alphabetically
  const sortedStates = Object.entries(stateData).sort((a, b) => a[0].localeCompare(b[0]));

  // Generate SVG string for a single state's bubbles
  const generateStateBubblesSVG = (stateName, data, size = 100) => {
    const centerX = size / 2;
    const centerY = size / 2;
    const counts = data.categoryCounts || {};
    const maxCount = Math.max(...Object.values(counts), 1);

    const bubblePositions = [
      { angle: -135, dist: 0.28 },
      { angle: -45, dist: 0.28 },
      { angle: 0, dist: 0.18 },
      { angle: 180, dist: 0.18 },
      { angle: 135, dist: 0.28 },
      { angle: 90, dist: 0.22 },
    ];

    const orderedCategories = [
      AQI_CATEGORIES.find(c => c.key === "poor"),
      AQI_CATEGORIES.find(c => c.key === "veryPoor"),
      AQI_CATEGORIES.find(c => c.key === "severe"),
      AQI_CATEGORIES.find(c => c.key === "moderate"),
      AQI_CATEGORIES.find(c => c.key === "good"),
      AQI_CATEGORIES.find(c => c.key === "satisfactory"),
    ];

    const bubbles = orderedCategories.map((cat, i) => {
      const count = counts[cat.key] || 0;
      if (count === 0) return "";

      const minR = 4;
      const maxR = size * 0.28;
      const radius = minR + (count / maxCount) * (maxR - minR);

      const pos = bubblePositions[i];
      const angleRad = (pos.angle * Math.PI) / 180;
      const dist = pos.dist * size;
      const x = centerX + dist * Math.cos(angleRad);
      const y = centerY + dist * Math.sin(angleRad);

      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${cat.color}" opacity="0.9" stroke="#fff" stroke-width="1.5"/>`;
    }).join("");

    return bubbles;
  };

  // Download SVG function
  const downloadSVG = () => {
    const cols = 6;
    const cellWidth = 160;
    const cellHeight = 150;
    const bubbleSize = 100;
    const padding = 40;
    const headerHeight = 120;

    const rows = Math.ceil(sortedStates.length / cols);
    const svgWidth = cols * cellWidth + padding * 2;
    const svgHeight = headerHeight + rows * cellHeight + padding * 2;

    // Generate legend
    const legendItems = AQI_CATEGORIES.map((cat, i) => {
      const x = padding + i * 150;
      return `
        <circle cx="${x + 7}" cy="${headerHeight - 30}" r="7" fill="${cat.color}" stroke="#fff" stroke-width="1"/>
        <text x="${x + 20}" y="${headerHeight - 26}" font-family="Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" font-size="11" fill="#555">${cat.label}</text>
      `;
    }).join("");

    // Generate state cells
    const stateCells = sortedStates.map(([stateName, data], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * cellWidth;
      const y = headerHeight + row * cellHeight;
      const bubbleX = x + (cellWidth - bubbleSize) / 2;
      const bubbleY = y + 35;

      const bubbles = generateStateBubblesSVG(stateName, data, bubbleSize);

      return `
        <g transform="translate(${x}, ${y})">
          <text x="${cellWidth / 2}" y="25" font-family="Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#333" text-anchor="middle">${stateName}</text>
          <g transform="translate(${(cellWidth - bubbleSize) / 2}, 35)">
            ${bubbles}
          </g>
        </g>
      `;
    }).join("");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="#fafafa"/>

  <!-- Title -->
  <text x="${svgWidth / 2}" y="${padding + 20}" font-family="Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#333" text-anchor="middle">AQI Category Distribution by State</text>
  <text x="${svgWidth / 2}" y="${padding + 42}" font-family="Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" font-size="12" fill="#666" text-anchor="middle">Bubble size represents the number of days in each AQI category during 2024</text>

  <!-- Legend -->
  <g transform="translate(${(svgWidth - 900) / 2}, 0)">
    ${legendItems}
  </g>

  <!-- State Grid -->
  ${stateCells}
</svg>`;

    // Create download link
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aqi_category_distribution_by_state.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderStateBubbles = (stateName, data, size = 100) => {
    const centerX = size / 2;
    const centerY = size / 2;
    const counts = data.categoryCounts || {};

    // Find max count for scaling
    const maxCount = Math.max(...Object.values(counts), 1);

    // Bubble positions arranged in a clustered flower pattern matching reference
    // Positions: [top-left, top-right, center-right, center-left, bottom-center, small-center]
    const bubblePositions = [
      { angle: -135, dist: 0.28 },  // top-left (severe/very poor - large)
      { angle: -45, dist: 0.28 },   // top-right (poor - medium)
      { angle: 0, dist: 0.18 },     // center-right (moderate - small)
      { angle: 180, dist: 0.18 },   // center-left (satisfactory - small)
      { angle: 135, dist: 0.28 },   // bottom-left (good - large)
      { angle: 90, dist: 0.22 },    // bottom-center (satisfactory - medium)
    ];

    // Order categories by severity for visual arrangement
    const orderedCategories = [
      { key: "poor", ...AQI_CATEGORIES.find(c => c.key === "poor") },
      { key: "veryPoor", ...AQI_CATEGORIES.find(c => c.key === "veryPoor") },
      { key: "severe", ...AQI_CATEGORIES.find(c => c.key === "severe") },
      { key: "moderate", ...AQI_CATEGORIES.find(c => c.key === "moderate") },
      { key: "good", ...AQI_CATEGORIES.find(c => c.key === "good") },
      { key: "satisfactory", ...AQI_CATEGORIES.find(c => c.key === "satisfactory") },
    ];

    const bubbles = orderedCategories.map((cat, i) => {
      const count = counts[cat.key] || 0;
      if (count === 0) return null;

      // Scale radius: min 4px, max based on size
      const minR = 4;
      const maxR = size * 0.28;
      const radius = minR + (count / maxCount) * (maxR - minR);

      const pos = bubblePositions[i];
      const angleRad = (pos.angle * Math.PI) / 180;
      const dist = pos.dist * size;
      const x = centerX + dist * Math.cos(angleRad);
      const y = centerY + dist * Math.sin(angleRad);

      return (
        <circle
          key={cat.key}
          cx={x}
          cy={y}
          r={radius}
          fill={cat.color}
          opacity={0.9}
          stroke="#fff"
          strokeWidth={1.5}
        />
      );
    });

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {bubbles}
      </svg>
    );
  };

  return (
    <div style={{
      padding: "40px 20px",
      background: "#fafafa",
      borderTop: "1px solid #eee",
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Title and Download Button */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginBottom: "8px" }}>
          <h3 style={{
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            fontSize: "18px",
            fontWeight: "600",
            color: "#333",
            margin: 0,
          }}>
            AQI Category Distribution by State
          </h3>
          <button
            onClick={downloadSVG}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#555"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#333"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download SVG
          </button>
        </div>
        <p style={{
          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
          fontSize: "13px",
          color: "#666",
          marginBottom: "30px",
          textAlign: "center",
        }}>
          Bubble size represents the number of days in each AQI category during 2024
        </p>

        {/* Legend */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}>
          {AQI_CATEGORIES.map((cat) => (
            <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: cat.color,
                border: "1px solid #fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }} />
              <span style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "11px",
                color: "#555",
              }}>
                {cat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Grid of states */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "20px",
          justifyItems: "center",
        }}>
          {sortedStates.map(([stateName, data]) => (
            <div
              key={stateName}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "10px",
                background: "#fff",
                borderRadius: "8px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                setTooltip({ stateName, data });
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)";
                setTooltip(null);
              }}
            >
              {/* State name */}
              <div style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "13px",
                fontWeight: "500",
                color: "#333",
                marginBottom: "8px",
                textAlign: "center",
                minHeight: "32px",
                display: "flex",
                alignItems: "center",
              }}>
                {stateName}
              </div>

              {/* Bubble cluster */}
              {renderStateBubbles(stateName, data, 100)}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.9)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            zIndex: 1001,
            minWidth: "200px",
          }}
        >
          <strong style={{ fontSize: "14px" }}>{tooltip.stateName}</strong>
          <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
            {AQI_CATEGORIES.map((cat) => (
              tooltip.data.categoryCounts[cat.key] > 0 && (
                <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color }} />
                  <span>{cat.label}: {tooltip.data.categoryCounts[cat.key]} days</span>
                </div>
              )
            ))}
          </div>
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #444", color: "#aaa" }}>
            Average AQI: {tooltip.data.avgAQI?.toFixed(0) || "N/A"}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone Circular Visualization Map component (exportable)
export function CircularVizMap() {
  const [stateData, setStateData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    d3.csv("/data/AQI.csv")
      .then((aqiData) => {
        const aggregated = aggregateByState(aqiData);
        setStateData(aggregated);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      position: "relative",
      width: "900px",
      height: "950px",
    }}>
      {/* India map background */}
      <img
        src="/indiamap.svg"
        alt="India Map"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Circular visualizations positioned on map */}
      {Object.entries(stateData).map(([stateName, data]) => {
        const coords = STATE_COORDINATES[stateName];
        if (!coords) return null;

        const minLat = 6.5, maxLat = 37;
        const minLng = 68, maxLng = 97.5;
        const mapWidth = 900;
        const mapHeight = 950;

        const svgOffsetX = 106.43 / 1000;
        const svgOffsetY = 19.91 / 1000;
        const svgScaleX = 874 / 1000;
        const svgScaleY = 982 / 1000;

        const rawX = (coords[1] - minLng) / (maxLng - minLng);
        const rawY = (maxLat - coords[0]) / (maxLat - minLat);

        const x = (svgOffsetX + rawX * svgScaleX) * mapWidth;
        const y = (svgOffsetY + rawY * svgScaleY) * mapHeight;

        const size = 90;

        return (
          <div
            key={stateName}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              cursor: "pointer",
            }}
            title={`${stateName}\nAvg AQI: ${data.avgAQI?.toFixed(0) || "N/A"}\nDays with data: ${data.dataCount || 0}`}
          >
            <div
              dangerouslySetInnerHTML={{ __html: renderMiniCircularViz(data, stateName, size) }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Main StateAQIMap component
export default function StateAQIMap() {
  const [stateData, setStateData] = useState({});
  const [cityMonthlyData, setCityMonthlyData] = useState([]);
  const [lifeExpData, setLifeExpData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      d3.csv("/data/AQI.csv"),
      d3.csv("/data/india_pm25_life_expectancy_data.csv"),
    ])
      .then(([aqiData, lifeExpCsv]) => {
        // Process AQI data
        const aggregated = aggregateByState(aqiData);
        setStateData(aggregated);

        const cityMonthly = aggregateCityMonthly(aqiData);
        setCityMonthlyData(cityMonthly);

        // Process life expectancy data
        const lifeExpProcessed = lifeExpCsv
          .filter((row) => row["State/UT"] && row["State/UT"].trim())
          .map((row) => ({
            state: row["State/UT"].trim(),
            population: parseFloat(row["Population (Lakhs)"]) || 0,
            pm25: parseFloat(row["Annual Average 2023 PM2.5 Concentration (μg/m³)"]) || 0,
            whoGain: parseFloat(row["Life_Expectancy_Gains_WHO_PM25_guideline"]) || 0,
            nationalGain: parseFloat(row["Life_Expectancy_Gains_National_PM25_standard"]) || 0,
          }));
        setLifeExpData(lifeExpProcessed);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading AQI data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {/* Static Map section with circular visualizations */}
      <div style={{
        width: "100%",
        padding: "40px 20px",
        background: "#fafafa",
        display: "flex",
        justifyContent: "center",
      }}>
        <div style={{
          position: "relative",
          width: "900px",
          height: "950px",
        }}>
          {/* India map background */}
          <img
            src="/indiamap.svg"
            alt="India Map"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              
            }}
          />

          {/* Circular visualizations positioned on map */}
          {Object.entries(stateData).map(([stateName, data]) => {
            const coords = STATE_COORDINATES[stateName];
            if (!coords) return null;

            // Convert lat/lng to x/y positions on the map
            // India bounds adjusted for the SVG offset
            const minLat = 6.5, maxLat = 37;
            const minLng = 68, maxLng = 97.5;
            const mapWidth = 900;
            const mapHeight = 950;

            // SVG has viewBox 0 0 1000 1000, image at translate(106.43, 19.91) with size 874x982
            // Adjust for the offset in the SVG
            const svgOffsetX = 106.43 / 1000;
            const svgOffsetY = 19.91 / 1000;
            const svgScaleX = 874 / 1000;
            const svgScaleY = 982 / 1000;

            // Calculate position (lat is inverted for y)
            const rawX = (coords[1] - minLng) / (maxLng - minLng);
            const rawY = (maxLat - coords[0]) / (maxLat - minLat);

            // Apply SVG offset and scale
            const x = (svgOffsetX + rawX * svgScaleX) * mapWidth;
            const y = (svgOffsetY + rawY * svgScaleY) * mapHeight;

            const size = 90;

            return (
              <div
                key={stateName}
                style={{
                  position: "absolute",
                  left: x - size / 2,
                  top: y - size / 2,
                  cursor: "pointer",
                }}
                title={`${stateName}\nAvg AQI: ${data.avgAQI?.toFixed(0) || "N/A"}\nDays with data: ${data.dataCount || 0}`}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: renderMiniCircularViz(data, stateName, size) }}
                />
              </div>
            );
          })}

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              background: "rgba(255,255,255,0.95)",
              padding: "12px 16px",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000,
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontSize: "11px",
            }}
          >
            <div style={{ fontWeight: "600", marginBottom: "8px", fontSize: "12px" }}>
              Daily AQI Calendar (2024)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {AQI_CATEGORIES.map((cat) => (
                <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: cat.color,
                      border: "1px solid #fff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  />
                  <span style={{ color: "#555" }}>
                    {cat.label} ({cat.min}–{cat.max > 500 ? "500+" : cat.max})
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #eee", color: "#888", fontSize: "10px" }}>
              Each radial line = one day of the year
            </div>
          </div>
        </div>
      </div>

      {/* Life expectancy gains section */}
      {lifeExpData.length > 0 && <LifeExpectancyPlot data={lifeExpData} />}
    </div>
  );
}

export { LifeExpectancyPlot };
