import { useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CITY_COORDINATES = {
  Mumbai: [19.076, 72.8777],
  Delhi: [28.7041, 77.1025],
  Bangalore: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Kolkata: [22.5726, 88.3639],
  Hyderabad: [17.385, 78.4867],
  Ahmedabad: [23.0225, 72.5714],
  Jaipur: [26.9124, 75.7873],
  Lucknow: [26.8467, 80.9462],
  Pune: [18.5204, 73.8567],
};

// Fit bounds to India
function FitBoundsToIndia() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([
      [6.5, 68],
      [37, 97.5],
    ]);
    map.setMaxBounds([
      [4, 65],
      [40, 100],
    ]);
  }, [map]);
  return null;
}

// Color scales
function getTempColor(temp, minTemp, maxTemp) {
  const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
  return d3.interpolateRdYlBu(1 - t);
}

function getRainfallColor(rain, maxRain) {
  const t = Math.max(0, Math.min(1, rain / maxRain));
  return d3.interpolateBlues(0.2 + t * 0.8);
}

function getWindColor(wind, maxWind) {
  const t = Math.max(0, Math.min(1, wind / maxWind));
  return d3.interpolateYlOrRd(t);
}

// Generic bubble marker
function BubbleMarker({ city, value, unit, position, color, size = 40, textColor = "#333" }) {
  const svgContent = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="1.5"/>
      <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
        font-size="10" font-weight="600" font-family="Georgia, 'Times New Roman', Times, serif" fill="${textColor}">
        ${value}
      </text>
    </svg>
  `;

  const icon = L.divIcon({
    html: svgContent,
    className: "weather-bubble-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return (
    <Marker position={position} icon={icon}>
      <Tooltip direction="top" offset={[0, -size / 2]}>
        <div style={{ textAlign: "center" }}>
          <strong>{city}</strong>
          <br />
          {value} {unit}
        </div>
      </Tooltip>
    </Marker>
  );
}

// Gradient legend bar
function GradientLegend({ minLabel, maxLabel, colorFn, steps = 50 }) {
  const width = 160;
  const barHeight = 12;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "10px", color: "#777" }}>{minLabel}</span>
      <svg width={width} height={barHeight}>
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          return (
            <rect
              key={i}
              x={(i * width) / steps}
              y={0}
              width={width / steps + 1}
              height={barHeight}
              fill={colorFn(t)}
            />
          );
        })}
      </svg>
      <span style={{ fontSize: "10px", color: "#777" }}>{maxLabel}</span>
    </div>
  );
}

// Single map panel
function MapPanel({ title, children, legend }) {
  return (
    <div style={{ flex: 1, position: "relative", borderRight: "1px solid #ddd" }}>
      <div style={{
        position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)",
        zIndex: 1000, background: "rgba(255,255,255,0.9)", padding: "5px 14px",
        borderRadius: "6px", fontSize: "13px", fontWeight: 600, color: "#333",
        whiteSpace: "nowrap",
      }}>
        {title}
      </div>

      <div style={{
        position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)",
        zIndex: 1000, background: "rgba(255,255,255,0.9)", padding: "6px 10px",
        borderRadius: "6px",
      }}>
        {legend}
      </div>

      <MapContainer
        center={[22, 82]}
        zoom={5}
        style={{ width: "100%", height: "100%" }}
        minZoom={4}
        maxZoom={8}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        <FitBoundsToIndia />
        {children}
      </MapContainer>
    </div>
  );
}

// Compass direction helper
function compassDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
}

// Animated wind visualization — tumbling asteroid particles with comet tails
function WindMarker({ city, avgWind, avgGust, avgDir, position, maxWind }) {
  const size = 160;
  const half = size / 2;
  const ratio = maxWind > 0 ? Math.min(avgWind / maxWind, 1) : 0;

  // Flow direction: particles move where wind blows TO
  const flowDeg = (avgDir + 180) % 360;
  const flowRad = (flowDeg * Math.PI) / 180;
  const dx = Math.sin(flowRad);
  const dy = -Math.cos(flowRad);
  const perpX = dy;
  const perpY = -dx;

  const uid = city.replace(/[^a-zA-Z]/g, '');

  // Deterministic pseudo-random
  const prng = (i, k) => {
    const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // Three-layer asteroid system: background (dust), midground, foreground (rocks)
  // rd = tumble rotation duration per layer
  const layerDefs = [
    { n: 8,  sc: 0.4,  pk: 1.0, bl: 1.2, sp: 36, bd: 12.0, rd: 14 },
    { n: 6,  sc: 0.7,  pk: 1.0, bl: 0.5, sp: 24, bd: 9.0,  rd: 9 },
    { n: 4,  sc: 1.1,  pk: 1.0, bl: 0,   sp: 14, bd: 7.0,  rd: 6 },
  ];

  const travel = 50 + ratio * 25;
  const particles = [];
  let id = 0;

  layerDefs.forEach((lay, li) => {
    for (let j = 0; j < lay.n; j++) {
      const r1 = prng(id, 1), r2 = prng(id, 2), r3 = prng(id, 3);
      const r4 = prng(id, 4), r5 = prng(id, 5), r6 = prng(id, 6);
      const spread = (r1 - 0.5) * 2 * lay.sp;
      const phase = r2 * travel * 0.35;
      const dur = lay.bd - ratio * 1.0 + (r3 - 0.5) * 0.8;
      const delay = r4 * dur;
      const wobble = (r5 - 0.5) * 5;
      const rotStart = Math.round(r6 * 360);
      const rotDir = id % 2 === 0 ? 1 : -1;

      const sx = spread * perpX - phase * dx;
      const sy = spread * perpY - phase * dy;
      const ex = sx + dx * travel;
      const ey = sy + dy * travel;
      const mx = (sx + ex) / 2 + wobble * perpX;
      const my = (sy + ey) / 2 + wobble * perpY;

      particles.push({
        id: id++, li, sc: lay.sc, pk: lay.pk, bl: lay.bl,
        dur: Math.max(dur, 4), delay, sx, sy, mx, my, ex, ey,
        rd: lay.rd + (r5 - 0.5) * 2, rotStart, rotDir,
      });
    }
  });

  // Color palette for light background: saturated and dark enough to be visible
  const [cr, cg, cb] = ratio > 0.65
    ? [200, 60, 20]
    : ratio > 0.35
    ? [40, 100, 180]
    : [20, 130, 190];

  // Asteroid SVG path — irregular rocky polygon with jagged edges
  const asteroid = (s) =>
    `M0 ${(-3.2*s).toFixed(1)}` +
    `L${(1.8*s).toFixed(1)} ${(-2.6*s).toFixed(1)}` +
    `L${(3*s).toFixed(1)} ${(-0.8*s).toFixed(1)}` +
    `L${(2.6*s).toFixed(1)} ${(1.2*s).toFixed(1)}` +
    `L${(1.2*s).toFixed(1)} ${(2.8*s).toFixed(1)}` +
    `L${(-0.8*s).toFixed(1)} ${(2.5*s).toFixed(1)}` +
    `L${(-2.5*s).toFixed(1)} ${(1.5*s).toFixed(1)}` +
    `L${(-3.2*s).toFixed(1)} ${(-0.3*s).toFixed(1)}` +
    `L${(-2*s).toFixed(1)} ${(-2.2*s).toFixed(1)}Z`;

  // CSS keyframes — translation + opacity (slow drift)
  const kf = particles.map(p =>
    `@keyframes d${uid}${p.id}{` +
    `0%{transform:translate(${p.sx.toFixed(1)}px,${p.sy.toFixed(1)}px);opacity:0}` +
    `6%{opacity:${(p.pk * 0.3).toFixed(2)}}` +
    `15%{opacity:${p.pk.toFixed(2)}}` +
    `50%{transform:translate(${p.mx.toFixed(1)}px,${p.my.toFixed(1)}px)}` +
    `80%{opacity:${(p.pk * 0.5).toFixed(2)}}` +
    `94%{opacity:0}` +
    `100%{transform:translate(${p.ex.toFixed(1)}px,${p.ey.toFixed(1)}px);opacity:0}}`
  ).join('');

  // CSS keyframes — asteroid tumbling rotation
  const rotKf = particles.map(p =>
    `@keyframes r${uid}${p.id}{` +
    `0%{transform:rotate(${p.rotStart}deg)}` +
    `100%{transform:rotate(${p.rotStart + p.rotDir * 360}deg)}}`
  ).join('');

  // Particle SVG: tumbling asteroids with comet-like tails
  const pels = particles.map(p => {
    const filt = p.bl > 0.3 ? ` filter="url(#gb${uid}${p.li})"` : '';
    // Comet tail: tapered triangle streaming behind the asteroid
    const tailLen = (p.li === 2 ? 16 : p.li === 1 ? 11 : 7) * p.sc;
    const tailW = (p.li === 2 ? 1.2 : 0.7) * p.sc;
    const tailOp = p.li === 2 ? 0.5 : p.li === 1 ? 0.35 : 0.2;
    const bx = -dx * tailLen, by = -dy * tailLen;
    const tail =
      `<path d="M${(perpX * tailW).toFixed(1)},${(perpY * tailW).toFixed(1)} ` +
      `L${(-perpX * tailW).toFixed(1)},${(-perpY * tailW).toFixed(1)} ` +
      `L${bx.toFixed(1)},${by.toFixed(1)}Z" fill="rgba(${cr},${cg},${cb},${tailOp})"/>` +
      `<line x1="0" y1="0" x2="${(bx * 1.2).toFixed(1)}" y2="${(by * 1.2).toFixed(1)}" ` +
      `stroke="rgba(${cr},${cg},${cb},${(tailOp * 0.5).toFixed(3)})" ` +
      `stroke-width="${(0.3 * p.sc).toFixed(1)}" stroke-linecap="round"/>`;
    return (
      `<g style="animation:d${uid}${p.id} ${p.dur.toFixed(1)}s linear ${p.delay.toFixed(2)}s infinite;will-change:transform,opacity;opacity:0">` +
      tail +
      `<path d="${asteroid(p.sc)}" fill="rgba(${cr},${cg},${cb},${p.pk.toFixed(2)})" ` +
      `style="animation:r${uid}${p.id} ${p.rd.toFixed(1)}s linear infinite;transform-origin:0 0"${filt}/>` +
      `</g>`
    );
  }).join('');

  const svg =
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<filter id="gb${uid}0" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.2"/></filter>` +
    `<filter id="gb${uid}1" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="0.5"/></filter>` +
    `</defs>` +
    `<style>${kf}${rotKf}</style>` +
    // Particle field only
    `<g transform="translate(${half},${half})" pointer-events="none">${pels}</g>` +
    // City label — dark text for light map
    `<text x="${half}" y="${size - 13}" text-anchor="middle" font-size="10" font-weight="600" ` +
    `font-family="Georgia, 'Times New Roman', Times, serif" fill="rgba(0,0,0,0.7)">${city}</text>` +
    // Speed label
    `<text x="${half}" y="${size - 2}" text-anchor="middle" font-size="8.5" font-weight="400" ` +
    `font-family="Georgia, 'Times New Roman', Times, serif" fill="rgba(0,0,0,0.45)">` +
    `${avgWind.toFixed(1)} km/h ${compassDir(avgDir)}</text>` +
    `</svg>`;

  const icon = L.divIcon({
    html: svg,
    className: 'wind-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return (
    <Marker position={position} icon={icon}>
      <Tooltip direction="top" offset={[0, -size / 2]}>
        <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
          <strong style={{ fontSize: '13px' }}>{city}</strong><br />
          Wind: {avgWind.toFixed(1)} km/h {compassDir(avgDir)}<br />
          Gusts: {avgGust.toFixed(1)} km/h<br />
          <span style={{ color: '#999', fontSize: '11px' }}>Direction: {avgDir.toFixed(0)}°</span>
        </div>
      </Tooltip>
    </Marker>
  );
}

export default function CalendarHeatmap() {
  const [cityWeather, setCityWeather] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    d3.csv("/data/india_2000_2024_daily_weather.csv")
      .then((data) => {
        // Filter for 2024 data
        const filtered = data.filter((d) => {
          const parts = d.date?.split("/");
          return parts && parts.length === 3 && parts[2] === "24";
        });

        // Aggregate per city
        const cityAgg = new Map();

        filtered.forEach((d) => {
          const city = d.city?.trim();
          if (!city || !CITY_COORDINATES[city]) return;

          const tempMax = parseFloat(d.temperature_2m_max);
          const tempMin = parseFloat(d.temperature_2m_min);
          const rain = parseFloat(d.rain_sum);
          const wind = parseFloat(d.wind_speed_10m_max);

          const gust = parseFloat(d.wind_gusts_10m_max);
          const dir = parseFloat(d.wind_direction_10m_dominant);

          if (!cityAgg.has(city)) {
            cityAgg.set(city, { temps: [], rains: [], winds: [], gusts: [], dirs: [] });
          }
          const entry = cityAgg.get(city);
          if (!isNaN(tempMax) && !isNaN(tempMin)) entry.temps.push((tempMax + tempMin) / 2);
          if (!isNaN(rain)) entry.rains.push(rain);
          if (!isNaN(wind)) entry.winds.push(wind);
          if (!isNaN(gust)) entry.gusts.push(gust);
          if (!isNaN(dir)) entry.dirs.push(dir);
        });

        const result = [];
        cityAgg.forEach((val, city) => {
          const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

          // Circular mean for wind direction
          let avgDir = 0;
          if (val.dirs.length > 0) {
            const sinSum = val.dirs.reduce((s, d) => s + Math.sin(d * Math.PI / 180), 0);
            const cosSum = val.dirs.reduce((s, d) => s + Math.cos(d * Math.PI / 180), 0);
            avgDir = (Math.atan2(sinSum / val.dirs.length, cosSum / val.dirs.length) * 180 / Math.PI + 360) % 360;
          }

          result.push({
            city,
            coords: CITY_COORDINATES[city],
            avgTemp: avg(val.temps),
            avgRain: avg(val.rains),
            avgWind: avg(val.winds),
            avgGust: avg(val.gusts),
            avgDir,
          });
        });

        setCityWeather(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading weather data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const { minTemp, maxTemp, maxRain, maxWind, maxGust } = useMemo(() => {
    if (cityWeather.length === 0) return { minTemp: 15, maxTemp: 40, maxRain: 10, maxWind: 20, maxGust: 30 };
    const temps = cityWeather.map((c) => c.avgTemp);
    const rains = cityWeather.map((c) => c.avgRain);
    const winds = cityWeather.map((c) => c.avgWind);
    const gusts = cityWeather.map((c) => c.avgGust);
    return {
      minTemp: Math.floor(Math.min(...temps)),
      maxTemp: Math.ceil(Math.max(...temps)),
      maxRain: Math.max(...rains),
      maxWind: Math.max(...winds),
      maxGust: Math.max(...gusts),
    };
  }, [cityWeather]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>Loading weather data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", color: "#EF3E5C" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>
      <style>
        {`
          .weather-bubble-marker, .wind-marker {
            background: transparent !important;
            border: none !important;
          }
          .grayscale-terrain {
            filter: grayscale(100%) brightness(0.9) contrast(1.6) sepia(18%) hue-rotate(180deg) saturate(0.7);
          }
        `}
      </style>

      {/* Title */}
      <div style={{
        textAlign: "center",
        padding: "12px 0 6px",
        position: "relative",
        zIndex: 1000,
      }}>
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "#333" }}>
          India Weather Overview — 2024
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
          Average temperature, rainfall, and max wind speed across 10 major cities
        </p>
      </div>

      {/* Three maps side by side */}
      <div style={{ display: "flex", width: "100%", height: "50vh" }}>

        {/* Temperature Map */}
        <MapPanel
          title="Avg Temperature (\u00B0C)"
          legend={
            <GradientLegend
              minLabel={`${minTemp}\u00B0C`}
              maxLabel={`${maxTemp}\u00B0C`}
              colorFn={(t) => d3.interpolateRdYlBu(1 - t)}
            />
          }
        >
          {cityWeather.map((c) => (
            <BubbleMarker
              key={c.city}
              city={c.city}
              value={`${c.avgTemp.toFixed(1)}\u00B0`}
              unit="\u00B0C"
              position={c.coords}
              color={getTempColor(c.avgTemp, minTemp, maxTemp)}
              textColor="#333"
            />
          ))}
        </MapPanel>

        {/* Rainfall Map */}
        <MapPanel
          title="Avg Rainfall (mm/day)"
          legend={
            <GradientLegend
              minLabel="0 mm"
              maxLabel={`${maxRain.toFixed(1)} mm`}
              colorFn={(t) => d3.interpolateBlues(0.2 + t * 0.8)}
            />
          }
        >
          {cityWeather.map((c) => {
            const ratio = maxRain > 0 ? c.avgRain / maxRain : 0;
            const size = Math.round(28 + ratio * 32);
            return (
              <BubbleMarker
                key={c.city}
                city={c.city}
                value={c.avgRain.toFixed(1)}
                unit="mm/day"
                position={c.coords}
                color={getRainfallColor(c.avgRain, maxRain)}
                size={size}
                textColor="#fff"
              />
            );
          })}
        </MapPanel>

        {/* Wind Speed Map */}
        <MapPanel
          title="Avg Max Wind Speed (km/h)"
          legend={
            <GradientLegend
              minLabel="0 km/h"
              maxLabel={`${maxWind.toFixed(0)} km/h`}
              colorFn={(t) => d3.interpolateYlOrRd(t)}
            />
          }
        >
          {cityWeather.map((c) => {
            const ratio = maxWind > 0 ? c.avgWind / maxWind : 0;
            const size = Math.round(28 + ratio * 32);
            return (
              <BubbleMarker
                key={c.city}
                city={c.city}
                value={c.avgWind.toFixed(1)}
                unit="km/h"
                position={c.coords}
                color={getWindColor(c.avgWind, maxWind)}
                size={size}
                textColor={ratio > 0.5 ? "#fff" : "#333"}
              />
            );
          })}
        </MapPanel>
      </div>

      {/* Wind Direction & Speed — Light Theme */}
      <div style={{ width: "100%", height: "60vh", position: "relative", borderTop: "1px solid #ddd" }}>

        {/* Title overlay */}
        <div style={{
          position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.88)", padding: "10px 24px",
          borderRadius: "8px", textAlign: "center",
          border: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#333", letterSpacing: "0.3px" }}>
            Wind Direction &amp; Speed
          </div>
          <div style={{ fontSize: "10px", color: "#999", marginTop: "3px" }}>
            Asteroid flow shows dominant wind direction &middot; Hover for details
          </div>
        </div>

        {/* Legend overlay */}
        <div style={{
          position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.88)", padding: "9px 20px",
          borderRadius: "8px", display: "flex", gap: "22px", alignItems: "center",
          border: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          {[
            { label: "Light", color: "#5699af" },
            { label: "Moderate", color: "#de9eaf" },
            { label: "Strong", color: "#c1616b" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%", background: color,
              }} />
              <span style={{ fontSize: "10px", color: "#666", letterSpacing: "0.2px" }}>{label}</span>
            </div>
          ))}
        </div>

        <MapContainer
          center={[22, 82]}
          zoom={5}
          style={{ width: "100%", height: "100%" }}
          minZoom={4}
          maxZoom={8}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"
            className="grayscale-terrain"
          />
          <FitBoundsToIndia />
          {cityWeather.map((c) => (
            <WindMarker
              key={c.city}
              city={c.city}
              avgWind={c.avgWind}
              avgGust={c.avgGust}
              avgDir={c.avgDir}
              position={c.coords}
              maxWind={maxWind}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
