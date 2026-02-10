import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// AQI color scale
const getAQIColor = (aqi) => {
  if (aqi <= 50) return "#5699af"; // Good - blue
  if (aqi <= 100) return "#87beb1"; // Satisfactory - teal
  if (aqi <= 200) return "#dfbfc6"; // Moderate - light pink
  if (aqi <= 300) return "#de9eaf"; // Poor - medium pink
  if (aqi <= 400) return "#e07192"; // Very Poor - darker pink
  return "#c1616b"; // Severe - darkest pink/red
};

export default function MonthlyAQIChart() {
  const [monthlyData, setMonthlyData] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    d3.csv("/data/AQI.csv").then((data) => {
      // Filter for 2024 data only
      const data2024 = data.filter((d) => {
        const parts = d.date?.split("/");
        return parts && parts.length === 3 && parts[2] === "24";
      });

      // Group by month and calculate average AQI
      const monthlyAQI = {};
      MONTHS.forEach((_, i) => {
        monthlyAQI[i + 1] = { total: 0, count: 0 };
      });

      data2024.forEach((d) => {
        const parts = d.date?.split("/");
        if (!parts || parts.length !== 3) return;

        const month = parseInt(parts[0]);
        const aqi = parseFloat(d.aqi_value);

        if (!isNaN(aqi) && month >= 1 && month <= 12) {
          monthlyAQI[month].total += aqi;
          monthlyAQI[month].count += 1;
        }
      });

      // Calculate averages
      const processed = MONTHS.map((name, i) => ({
        month: i + 1,
        name,
        abbr: MONTH_ABBR[i],
        avgAQI: monthlyAQI[i + 1].count > 0
          ? Math.round(monthlyAQI[i + 1].total / monthlyAQI[i + 1].count)
          : 0,
        count: monthlyAQI[i + 1].count,
      }));

      setMonthlyData(processed);
    });
  }, []);

  useEffect(() => {
    if (!monthlyData.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 900;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(monthlyData.map(d => d.abbr))
      .range([0, innerWidth])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, Math.max(...monthlyData.map(d => d.avgAQI)) * 1.1])
      .range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "#e0e0e0")
      .attr("stroke-dasharray", "3,3");

    g.selectAll(".grid .domain").remove();

    // AQI threshold lines
    const thresholds = [
      { value: 50, label: "Good", color: "#5699af" },
      { value: 100, label: "Satisfactory", color: "#87beb1" },
      { value: 200, label: "Moderate", color: "#dfbfc6" },
    ];

    thresholds.forEach(({ value, label, color }) => {
      if (value <= yScale.domain()[1]) {
        g.append("line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", yScale(value))
          .attr("y2", yScale(value))
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
          .attr("opacity", 0.7);

        g.append("text")
          .attr("x", innerWidth + 5)
          .attr("y", yScale(value) + 4)
          .attr("font-size", "10px")
          .attr("fill", color)
          .text(label);
      }
    });

    // Bars
    g.selectAll(".bar")
      .data(monthlyData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.abbr))
      .attr("y", d => yScale(d.avgAQI))
      .attr("width", xScale.bandwidth())
      .attr("height", d => innerHeight - yScale(d.avgAQI))
      .attr("fill", d => getAQIColor(d.avgAQI))
      .attr("rx", 4)
      .attr("ry", 4)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 0.8);
      })
      .on("mouseout", function() {
        d3.select(this).attr("opacity", 1);
      });

    // Value labels on bars
    g.selectAll(".bar-label")
      .data(monthlyData)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", d => xScale(d.abbr) + xScale.bandwidth() / 2)
      .attr("y", d => yScale(d.avgAQI) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#333")
      .text(d => d.avgAQI);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("font-size", "12px")
      .attr("fill", "#555");

    g.selectAll(".domain").attr("stroke", "#ccc");
    g.selectAll(".tick line").attr("stroke", "#ccc");

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll("text")
      .attr("font-size", "11px")
      .attr("fill", "#555");

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("fill", "#666")
      .text("Average AQI");

    // X axis label
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 45)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("fill", "#666")
      .text("Month (2024)");

  }, [monthlyData]);

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "auto" }} />

      {/* Legend */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "20px",
        marginTop: "20px",
        flexWrap: "wrap",
      }}>
        {[
          { label: "Good (0-50)", color: "#5699af" },
          { label: "Satisfactory (51-100)", color: "#87beb1" },
          { label: "Moderate (101-200)", color: "#dfbfc6" },
          { label: "Poor (201-300)", color: "#de9eaf" },
          { label: "Very Poor (301-400)", color: "#e07192" },
          { label: "Severe (400+)", color: "#c1616b" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "14px",
              height: "14px",
              borderRadius: "3px",
              backgroundColor: color,
            }} />
            <span style={{ fontSize: "11px", color: "#666" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
