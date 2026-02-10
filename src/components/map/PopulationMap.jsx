import { useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// State coordinates (approximate center points)
const STATE_COORDINATES = {
  "Andaman and Nicobar Islands": [11.7401, 92.6586],
  "Andhra Pradesh": [15.9129, 79.7400],
  "Arunachal Pradesh": [28.2180, 94.7278],
  "Assam": [26.2006, 92.9376],
  "Bihar": [25.0961, 85.3131],
  "Chandigarh": [30.7333, 76.7794],
  "Chhattisgarh": [21.2787, 81.8661],
  "Dadra & Nagar Haveli and Daman & Diu": [20.2667, 73.0167],
  "Delhi": [28.7041, 77.1025],
  "Goa": [15.4909, 73.8278],
  "Gujarat": [22.2587, 71.1924],
  "Haryana": [29.0588, 76.0856],
  "Himachal Pradesh": [31.1048, 77.1734],
  "Jammu & Kashmir": [33.7782, 76.5762],
  "Jharkhand": [23.6102, 85.2799],
  "Karnataka": [15.3173, 75.7139],
  "Kerala": [10.8505, 76.2711],
  "Lakshadweep": [10.5667, 72.6417],
  "Madhya Pradesh": [23.4734, 77.9469],
  "Maharashtra": [19.7515, 75.7139],
  "Manipur": [24.6637, 93.9063],
  "Meghalaya": [25.4670, 91.3662],
  "Mizoram": [23.1645, 92.9376],
  "Nagaland": [26.1584, 94.5624],
  "Odisha": [20.9517, 85.0985],
  "Puducherry": [11.9416, 79.8083],
  "Punjab": [31.1471, 75.3412],
  "Rajasthan": [27.0238, 74.2179],
  "Sikkim": [27.5330, 88.5122],
  "Tamil Nadu": [11.1271, 78.6569],
  "Telangana": [18.1124, 79.0193],
  "Tripura": [23.9408, 91.9882],
  "Uttar Pradesh": [26.8467, 80.9462],
  "Uttarakhand": [30.0668, 79.0193],
  "West Bengal": [22.9868, 87.8550],
};

// States to show labels for (high population states)
const LABELED_STATES = ["Uttar Pradesh", "Maharashtra", "Bihar", "West Bengal", "Tamil Nadu", "Rajasthan", "Karnataka"];

// Pollutant colors
const POLLUTANT_COLORS = {
  "PM10": "#e65100",
  "PM2.5": "#d32f2f",
  "O3": "#7b1fa2",
  "CO": "#455a64",
  "SO2": "#f9a825",
  "NO2": "#2e7d32",
  "NH3": "#0277bd",
};

const POLLUTANT_NAMES = Object.keys(POLLUTANT_COLORS);

// City coordinates for weather data
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

// Color scales for weather maps
function getTempColor(temp, minTemp, maxTemp) {
  const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
  return d3.interpolateRdYlBu(1 - t);
}

function getRainfallColor(rain, maxRain) {
  const t = Math.max(0, Math.min(1, rain / maxRain));
  return d3.interpolateBlues(0.2 + t * 0.8);
}

// Weather bubble marker
function WeatherBubbleMarker({ city, value, unit, position, color, size = 40, textColor = "#333" }) {
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

// Compass direction helper
function compassDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
}

// Animated wind visualization — smoke effect
function WindMarker({ city, avgWind, avgGust, avgDir, position, maxWind, markerSize = 160, hideText = false }) {
  const size = markerSize;
  const half = size / 2;
  const ratio = maxWind > 0 ? Math.min(avgWind / maxWind, 1) : 0;

  // Flow direction: smoke moves where wind blows TO
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

  // Many smoke particles for dense effect
  const numParticles = 45 + Math.floor(ratio * 30);
  const particles = [];

  for (let i = 0; i < numParticles; i++) {
    const r1 = prng(i, 1), r2 = prng(i, 2), r3 = prng(i, 3), r4 = prng(i, 4), r5 = prng(i, 5), r6 = prng(i, 6), r7 = prng(i, 7);

    // Starting spread - smoke emerges from a region
    const startSpread = (r1 - 0.5) * 30;
    const phase = r2 * 25;

    // Smoke particle size - starts small, grows as it travels
    const startRadius = 3 + r3 * 4;
    const endRadius = startRadius * (2 + r7 * 1.5); // Grows 2-3.5x

    // Animation timing - faster with stronger wind
    const dur = 4 + r4 * 3 - ratio * 1.5;
    const delay = r5 * dur;

    // Opacity - smoke fades as it disperses
    const startOpacity = 0.15 + r6 * 0.25;
    const endOpacity = 0.02;

    // Travel distance - further with stronger wind
    const travel = 55 + ratio * 35;

    // Add drift/turbulence perpendicular to wind direction
    const drift = (r7 - 0.5) * 25;

    // Start position
    const sx = startSpread * perpX - phase * dx;
    const sy = startSpread * perpY - phase * dy;

    // End position with drift
    const ex = sx + dx * travel + drift * perpX;
    const ey = sy + dy * travel + drift * perpY;

    // Mid point with slight curve for organic movement
    const midDrift = (r3 - 0.5) * 15;
    const mx = (sx + ex) / 2 + midDrift * perpX;
    const my = (sy + ey) / 2 + midDrift * perpY;

    particles.push({
      id: i, sx, sy, mx, my, ex, ey, dur, delay,
      startOpacity, endOpacity, startRadius, endRadius
    });
  }

  // CSS keyframes for smoke effect - particles grow and fade
  const kf = particles.map(p =>
    `@keyframes s${uid}${p.id}{` +
    `0%{transform:translate(${p.sx.toFixed(1)}px,${p.sy.toFixed(1)}px) scale(1);opacity:0}` +
    `10%{opacity:${p.startOpacity.toFixed(3)}}` +
    `50%{transform:translate(${p.mx.toFixed(1)}px,${p.my.toFixed(1)}px) scale(${(1 + (p.endRadius/p.startRadius - 1) * 0.5).toFixed(2)});opacity:${(p.startOpacity * 0.7).toFixed(3)}}` +
    `90%{opacity:${p.endOpacity.toFixed(3)}}` +
    `100%{transform:translate(${p.ex.toFixed(1)}px,${p.ey.toFixed(1)}px) scale(${(p.endRadius/p.startRadius).toFixed(2)});opacity:0}}`
  ).join('');

  // Color based on wind intensity
  const getColor = (idx) => {
    const t = prng(idx, 8);
    if (ratio > 0.6) {
      // Strong wind - c1616b
      return t > 0.5 ? 'rgba(193,97,107,1)' : 'rgba(193,97,107,0.8)';
    } else if (ratio > 0.3) {
      // Moderate - de9eaf
      return t > 0.5 ? 'rgba(222,158,175,1)' : 'rgba(222,158,175,0.8)';
    } else {
      // Light wind - 5699af
      return t > 0.5 ? 'rgba(86,153,175,1)' : 'rgba(86,153,175,0.8)';
    }
  };

  // Smoke particles - soft blurred circles with red/yellow colors
  const smokeElements = particles.map(p => {
    const color = getColor(p.id);
    return `<circle cx="0" cy="0" r="${p.startRadius.toFixed(1)}" ` +
      `fill="${color}" ` +
      `filter="url(#blur${uid})" ` +
      `style="animation:s${uid}${p.id} ${p.dur.toFixed(1)}s ease-out ${p.delay.toFixed(2)}s infinite;opacity:0"/>`;
  }).join('');

  const textElements = hideText ? '' :
    `<text x="${half}" y="${size - 13}" text-anchor="middle" font-size="10" font-weight="600" ` +
    `font-family="Georgia, 'Times New Roman', Times, serif" fill="rgba(0,0,0,0.7)">${city}</text>` +
    `<text x="${half}" y="${size - 2}" text-anchor="middle" font-size="8.5" font-weight="400" ` +
    `font-family="Georgia, 'Times New Roman', Times, serif" fill="rgba(0,0,0,0.45)">` +
    `${avgWind.toFixed(1)} km/h ${compassDir(avgDir)}</text>`;

  const svg =
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><filter id="blur${uid}" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/></filter></defs>` +
    `<style>${kf}</style>` +
    `<g transform="translate(${half},${half})" pointer-events="none">${smokeElements}</g>` +
    textElements +
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

// Aggregate pollutant data by state from AQI.csv
function aggregatePollutantsByState(data) {
  const stateMap = new Map();

  data.forEach((row) => {
    const dateParts = row.date?.split("/");
    if (!dateParts || dateParts.length !== 3) return;
    if (dateParts[2] !== "24") return;

    const state = row.state?.trim();
    if (!state || !STATE_COORDINATES[state]) return;

    const rawPollutants = row.prominent_pollutants || "";
    // Split by comma, clean up quotes and whitespace
    const pollutants = rawPollutants
      .split(",")
      .map((p) => p.replace(/"/g, "").trim())
      .filter((p) => POLLUTANT_COLORS[p]);

    if (!stateMap.has(state)) {
      stateMap.set(state, {});
      POLLUTANT_NAMES.forEach((p) => { stateMap.get(state)[p] = 0; });
    }

    pollutants.forEach((p) => {
      stateMap.get(state)[p] += 1;
    });
  });

  const result = [];
  stateMap.forEach((counts, state) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    result.push({ state, coords: STATE_COORDINATES[state], counts, total });
  });

  return result;
}

// Generate SVG for pollutant cluster at a state
function renderPollutantCluster(counts, total, size, globalMaxCounts) {
  const centerX = size / 2;
  const centerY = size / 2;

  // Arrange pollutant dots in a circle around center
  const activePollutants = POLLUTANT_NAMES.filter((p) => counts[p] > 0);
  if (activePollutants.length === 0) return "";

  const minR = 3;
  const maxR = size * 0.25;

  // Position dots in a circle
  const angleStep = (2 * Math.PI) / Math.max(activePollutants.length, 1);
  const orbitRadius = activePollutants.length === 1 ? 0 : size * 0.25;

  const dots = activePollutants.map((p, i) => {
    // Use global max for this pollutant to compare across states
    const globalMax = globalMaxCounts[p] || 1;
    const ratio = counts[p] / globalMax;
    const r = minR + ratio * (maxR - minR);
    const angle = -Math.PI / 2 + i * angleStep;
    const x = centerX + orbitRadius * Math.cos(angle);
    const y = centerY + orbitRadius * Math.sin(angle);
    const color = POLLUTANT_COLORS[p];

    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="0.8"/>`;
  }).join("");

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${dots}
    </svg>
  `;
}

// Pollutant cluster marker
function PollutantClusterMarker({ state, counts, total, position, globalMaxCounts }) {
  const size = 60;

  const svgContent = useMemo(
    () => renderPollutantCluster(counts, total, size, globalMaxCounts),
    [counts, total, size, globalMaxCounts]
  );

  const icon = useMemo(
    () =>
      L.divIcon({
        html: svgContent,
        className: "pollutant-cluster-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    [svgContent, size]
  );

  // Build tooltip content
  const activePollutants = POLLUTANT_NAMES.filter((p) => counts[p] > 0);

  return (
    <Marker position={position} icon={icon}>
      <Tooltip direction="top" offset={[0, -size / 2]}>
        <div style={{ textAlign: "left" }}>
          <strong>{state}</strong>
          <br />
          {activePollutants.map((p) => (
            <div key={p} style={{ fontSize: "11px" }}>
              <span style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: POLLUTANT_COLORS[p],
                marginRight: "4px",
              }} />
              {p}: {counts[p]} days
            </div>
          ))}
        </div>
      </Tooltip>
    </Marker>
  );
}

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

// Generate bubble SVG - size and color darkness encode population
function renderBubbleSVG(population, maxPopulation) {
  const minRadius = 8;
  const maxRadius = 45;
  const ratio = population / maxPopulation;
  const radius = minRadius + ratio * (maxRadius - minRadius);
  const size = radius * 2 + 4;

  // Color darkness based on population - darker = more population
  // Using pink/magenta color scheme
  const darkness = 0.3 + ratio * 0.7; // 0.3 to 1.0
  const r = Math.round(199 * darkness);
  const g = Math.round(21 * darkness);
  const b = Math.round(133 * darkness);
  const color = `rgb(${r}, ${g}, ${b})`;

  // Lighter version for gradient
  const lightR = Math.min(255, r + 80);
  const lightG = Math.min(255, g + 40);
  const lightB = Math.min(255, b + 60);
  const lightColor = `rgb(${lightR}, ${lightG}, ${lightB})`;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bubbleGrad-${Math.round(population)}" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${lightColor}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.85"/>
        </radialGradient>
      </defs>
      <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        fill="url(#bubbleGrad-${Math.round(population)})"
        stroke="rgba(255,255,255,0.3)"
        stroke-width="1"
      />
    </svg>
  `;
}

// Format population number
function formatPopulation(pop) {
  if (pop >= 10000000) {
    return (pop / 10000000).toFixed(1) + " Cr";
  } else if (pop >= 100000) {
    return (pop / 100000).toFixed(1) + " L";
  }
  return pop.toLocaleString();
}

// Bubble marker component
function BubbleMarker({ state, population, position, maxPopulation }) {
  const minRadius = 8;
  const maxRadius = 50;
  const ratio = population / maxPopulation;
  const radius = minRadius + ratio * (maxRadius - minRadius);
  const size = radius * 2 + 4;

  const svgContent = useMemo(
    () => renderBubbleSVG(population, maxPopulation),
    [population, maxPopulation]
  );

  const icon = useMemo(
    () =>
      L.divIcon({
        html: svgContent,
        className: "bubble-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    [svgContent, size]
  );

  return (
    <Marker position={position} icon={icon}>
      <Tooltip
        direction="top"
        offset={[0, -radius - 5]}
        className="population-tooltip"
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <strong>{state}</strong>
          <br />
          <span style={{ color: "#ff69b4" }}>{formatPopulation(population)}</span>
        </div>
      </Tooltip>
    </Marker>
  );
}

// State label marker - positioned next to bubble
function StateLabel({ state, position, population, maxPopulation }) {
  const minRadius = 8;
  const maxRadius = 50;
  const ratio = population / maxPopulation;
  const radius = minRadius + ratio * (maxRadius - minRadius);

  const labelHtml = `
    <div style="
      white-space: nowrap;
      font-family: Georgia, 'Times New Roman', Times, serif;
      font-size: 10px;
      font-weight: 500;
      color: #fff;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
      pointer-events: none;
      background: rgba(0,0,0,0.5);
      padding: 2px 6px;
      border-radius: 3px;
    ">${state}</div>
  `;

  const icon = L.divIcon({
    html: labelHtml,
    className: "state-label-marker",
    iconSize: [120, 20],
    iconAnchor: [-radius - 5, 10],
  });

  return <Marker position={position} icon={icon} interactive={false} />;
}

// Generate full population map SVG for download
function generatePopulationMapSVG(populationData, maxPopulation) {
  const width = 900;
  const height = 950;

  // India bounds
  const minLat = 6.5, maxLat = 37;
  const minLng = 68, maxLng = 97.5;

  // Convert lat/lng to x/y
  const toXY = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * height;
    return { x, y };
  };

  // Generate gradient definitions
  const gradients = populationData.map(({ state, population }) => {
    const ratio = population / maxPopulation;
    const darkness = 0.3 + ratio * 0.7;
    const r = Math.round(199 * darkness);
    const g = Math.round(21 * darkness);
    const b = Math.round(133 * darkness);
    const color = `rgb(${r}, ${g}, ${b})`;

    const lightR = Math.min(255, r + 80);
    const lightG = Math.min(255, g + 40);
    const lightB = Math.min(255, b + 60);
    const lightColor = `rgb(${lightR}, ${lightG}, ${lightB})`;

    const gradId = `popGrad-${state.replace(/\s+/g, '-').replace(/&/g, 'and')}`;

    return `<radialGradient id="${gradId}" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${lightColor}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.85"/>
    </radialGradient>`;
  }).join("\n    ");

  // Generate circles
  const circles = populationData.map(({ state, coords, population }) => {
    const { x, y } = toXY(coords[0], coords[1]);
    const minRadius = 8;
    const maxRadius = 45;
    const ratio = population / maxPopulation;
    const radius = minRadius + ratio * (maxRadius - minRadius);
    const gradId = `popGrad-${state.replace(/\s+/g, '-').replace(/&/g, 'and')}`;

    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="url(#${gradId})" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;
  }).join("\n  ");

  // Generate labels for high population states
  const labels = populationData
    .filter(({ state }) => LABELED_STATES.includes(state))
    .map(({ state, coords, population }) => {
      const { x, y } = toXY(coords[0], coords[1]);
      const ratio = population / maxPopulation;
      const radius = 8 + ratio * 37;

      return `<text x="${(x + radius + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-family="Georgia, 'Times New Roman', Times, serif" font-size="10" font-weight="500" fill="#ffffff">${state}</text>`;
    }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${gradients}
  </defs>
  <rect width="${width}" height="${height}" fill="#1a1a2e"/>
  <text x="${width/2}" y="60" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="14" fill="#aaaaaa" letter-spacing="3">POPULATION DENSITY MAP</text>
  <text x="${width/2}" y="110" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="48" font-weight="700" fill="#ffffff" letter-spacing="8">INDIA</text>
  <text x="${width/2}" y="135" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="10" fill="#666666">STATE POPULATION 2024 - BUBBLE SIZE AND COLOR = POPULATION</text>
  ${circles}
  ${labels}
</svg>`;
}

// Generate pollutant map SVG for download
function generatePollutantMapSVG(pollutantData) {
  const width = 900;
  const height = 950;

  // India bounds
  const minLat = 6.5, maxLat = 37;
  const minLng = 68, maxLng = 97.5;

  // Convert lat/lng to x/y
  const toXY = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * height;
    return { x, y };
  };

  // Generate pollutant clusters for each state
  const clusters = pollutantData.map(({ state, coords, counts }) => {
    const { x, y } = toXY(coords[0], coords[1]);
    const size = 60;
    const centerX = x;
    const centerY = y;

    const activePollutants = POLLUTANT_NAMES.filter((p) => counts[p] > 0);
    if (activePollutants.length === 0) return "";

    const maxCount = Math.max(...activePollutants.map((p) => counts[p]));
    const minR = 3;
    const maxR = size * 0.25;

    const angleStep = (2 * Math.PI) / Math.max(activePollutants.length, 1);
    const orbitRadius = activePollutants.length === 1 ? 0 : size * 0.25;

    const dots = activePollutants.map((p, i) => {
      const ratio = counts[p] / maxCount;
      const r = minR + ratio * (maxR - minR);
      const angle = -Math.PI / 2 + i * angleStep;
      const dotX = centerX + orbitRadius * Math.cos(angle);
      const dotY = centerY + orbitRadius * Math.sin(angle);
      const color = POLLUTANT_COLORS[p];

      return `<circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="0.85" stroke="#ffffff" stroke-width="0.8"/>`;
    }).join("\n  ");

    return dots;
  }).join("\n  ");

  // Generate legend
  const legendX = width / 2 - 300;
  const legendY = height - 50;
  const legend = POLLUTANT_NAMES.map((p, i) => {
    const x = legendX + i * 90;
    return `<circle cx="${x}" cy="${legendY}" r="5" fill="${POLLUTANT_COLORS[p]}"/>
    <text x="${x + 10}" y="${legendY + 4}" font-family="Georgia, 'Times New Roman', Times, serif" font-size="11" fill="#444444">${p}</text>`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f5f5f5"/>
  <text x="${width/2}" y="30" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="18" font-weight="600" fill="#333333">Prominent Pollutants by State - 2024</text>
  <text x="${width/2}" y="50" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="12" fill="#666666">Bubble size = frequency of pollutant as prominent</text>
  ${clusters}
  <rect x="${legendX - 20}" y="${legendY - 15}" width="640" height="30" fill="#ffffff" fill-opacity="0.95" rx="6"/>
  ${legend}
</svg>`;
}

// Main PopulationMap component
export default function PopulationMap() {
  const [populationData, setPopulationData] = useState([]);
  const [pollutantData, setPollutantData] = useState([]);
  const [cityWeather, setCityWeather] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      d3.csv("/data/Population.csv"),
      d3.csv("/data/AQI.csv"),
      d3.csv("/data/india_2000_2024_daily_weather.csv"),
    ])
      .then(([popData, aqiData, weatherData]) => {
        const processed = popData
          .map((row) => {
            const state = row["States/Uts"]?.trim();
            const population = parseInt(row["population(2024)"]?.replace(/,/g, "")) || 0;
            const coords = STATE_COORDINATES[state];

            return coords ? { state, population, coords } : null;
          })
          .filter(Boolean);

        setPopulationData(processed);
        setPollutantData(aggregatePollutantsByState(aqiData));

        // Process weather data for 2024
        const filtered = weatherData.filter((d) => {
          const parts = d.date?.split("/");
          return parts && parts.length === 3 && parts[2] === "24";
        });

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

        const weatherResult = [];
        cityAgg.forEach((val, city) => {
          const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

          // Circular mean for wind direction
          let avgDir = 0;
          if (val.dirs.length > 0) {
            const sinSum = val.dirs.reduce((s, d) => s + Math.sin(d * Math.PI / 180), 0);
            const cosSum = val.dirs.reduce((s, d) => s + Math.cos(d * Math.PI / 180), 0);
            avgDir = (Math.atan2(sinSum / val.dirs.length, cosSum / val.dirs.length) * 180 / Math.PI + 360) % 360;
          }

          weatherResult.push({
            city,
            coords: CITY_COORDINATES[city],
            avgTemp: avg(val.temps),
            avgRain: avg(val.rains),
            avgWind: avg(val.winds),
            avgGust: avg(val.gusts),
            avgDir,
          });
        });

        setCityWeather(weatherResult);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const maxPopulation = useMemo(
    () => Math.max(...populationData.map((d) => d.population), 1),
    [populationData]
  );

  // Calculate global max counts for each pollutant across all states
  const globalMaxCounts = useMemo(() => {
    const maxCounts = {};
    POLLUTANT_NAMES.forEach((p) => {
      maxCounts[p] = Math.max(...pollutantData.map((d) => d.counts[p] || 0), 1);
    });
    return maxCounts;
  }, [pollutantData]);

  const { minTemp, maxTemp, maxRain, maxWind } = useMemo(() => {
    if (cityWeather.length === 0) return { minTemp: 15, maxTemp: 40, maxRain: 10, maxWind: 20 };
    const temps = cityWeather.map((c) => c.avgTemp);
    const rains = cityWeather.map((c) => c.avgRain);
    const winds = cityWeather.map((c) => c.avgWind);
    return {
      minTemp: Math.floor(Math.min(...temps)),
      maxTemp: Math.ceil(Math.max(...temps)),
      maxRain: Math.max(...rains),
      maxWind: Math.max(...winds),
    };
  }, [cityWeather]);

  // Download SVG function for population map
  const downloadSVG = () => {
    const svgContent = generatePopulationMapSVG(populationData, maxPopulation);
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "population_map_india.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download SVG function for pollutant map
  const downloadPollutantSVG = () => {
    const svgContent = generatePollutantMapSVG(pollutantData);
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pollutant_map_india.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate and download Temperature SVG
  const downloadTemperatureSVG = () => {
    const width = 900;
    const height = 950;
    const minLat = 6.5, maxLat = 37;
    const minLng = 68, maxLng = 97.5;

    const toXY = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - lat) / (maxLat - minLat)) * height;
      return { x, y };
    };

    // Generate gradient for legend
    const gradientStops = Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      const color = d3.interpolateRdYlBu(1 - t);
      return `<stop offset="${(t * 100).toFixed(0)}%" stop-color="${color}"/>`;
    }).join("");

    const circles = cityWeather.map((c) => {
      const { x, y } = toXY(c.coords[0], c.coords[1]);
      const color = getTempColor(c.avgTemp, minTemp, maxTemp);
      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="1.5"/>
        <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="#333">${c.avgTemp.toFixed(1)}°</text>
        <text x="${x.toFixed(1)}" y="${(y + 35).toFixed(1)}" text-anchor="middle" font-size="9" fill="#666">${c.city}</text>
      `;
    }).join("");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f5f5f5"/>
  <defs>
    <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      ${gradientStops}
    </linearGradient>
  </defs>
  <text x="${width/2}" y="30" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="18" font-weight="600" fill="#333">Average Temperature — 2024</text>
  <text x="${width/2}" y="50" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="12" fill="#666">10 Major Cities</text>
  ${circles}
  <rect x="${width/2 - 100}" y="${height - 50}" width="200" height="12" fill="url(#tempGradient)" rx="2"/>
  <text x="${width/2 - 110}" y="${height - 40}" text-anchor="end" font-size="10" fill="#666">${minTemp}°C</text>
  <text x="${width/2 + 110}" y="${height - 40}" text-anchor="start" font-size="10" fill="#666">${maxTemp}°C</text>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "temperature_map_india.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate and download Rainfall SVG
  const downloadRainfallSVG = () => {
    const width = 900;
    const height = 950;
    const minLat = 6.5, maxLat = 37;
    const minLng = 68, maxLng = 97.5;

    const toXY = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - lat) / (maxLat - minLat)) * height;
      return { x, y };
    };

    // Generate gradient for legend
    const gradientStops = Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      const color = d3.interpolateBlues(0.2 + t * 0.8);
      return `<stop offset="${(t * 100).toFixed(0)}%" stop-color="${color}"/>`;
    }).join("");

    const circles = cityWeather.map((c) => {
      const { x, y } = toXY(c.coords[0], c.coords[1]);
      const ratio = maxRain > 0 ? c.avgRain / maxRain : 0;
      const radius = 14 + ratio * 16;
      const color = getRainfallColor(c.avgRain, maxRain);
      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="1.5"/>
        <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">${c.avgRain.toFixed(1)}</text>
        <text x="${x.toFixed(1)}" y="${(y + radius + 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#666">${c.city}</text>
      `;
    }).join("");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f5f5f5"/>
  <defs>
    <linearGradient id="rainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      ${gradientStops}
    </linearGradient>
  </defs>
  <text x="${width/2}" y="30" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="18" font-weight="600" fill="#333">Average Rainfall — 2024</text>
  <text x="${width/2}" y="50" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="12" fill="#666">10 Major Cities · Bubble size = rainfall amount</text>
  ${circles}
  <rect x="${width/2 - 100}" y="${height - 50}" width="200" height="12" fill="url(#rainGradient)" rx="2"/>
  <text x="${width/2 - 110}" y="${height - 40}" text-anchor="end" font-size="10" fill="#666">0 mm</text>
  <text x="${width/2 + 110}" y="${height - 40}" text-anchor="start" font-size="10" fill="#666">${maxRain.toFixed(1)} mm</text>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rainfall_map_india.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate SVG for a single pollutant
  const generateSinglePollutantSVG = (pollutantName) => {
    const width = 900;
    const height = 950;
    const minLat = 6.5, maxLat = 37;
    const minLng = 68, maxLng = 97.5;

    const toXY = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - lat) / (maxLat - minLat)) * height;
      return { x, y };
    };

    // Find max count for this pollutant across all states
    const maxCount = Math.max(...pollutantData.map(d => d.counts[pollutantName] || 0), 1);
    const color = POLLUTANT_COLORS[pollutantName];

    // Generate circles for each state
    const circles = pollutantData
      .filter(({ counts }) => counts[pollutantName] > 0)
      .map(({ state, coords, counts }) => {
        const { x, y } = toXY(coords[0], coords[1]);
        const count = counts[pollutantName];
        const ratio = count / maxCount;
        const minR = 5;
        const maxR = 40;
        const radius = minR + ratio * (maxR - minR);

        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.7" stroke="#ffffff" stroke-width="1"/>
    <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="8" fill="#ffffff" font-weight="600">${count}</text>`;
      }).join("\n  ");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f5f5f5"/>
  <text x="${width/2}" y="40" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="24" font-weight="600" fill="${color}">${pollutantName}</text>
  <text x="${width/2}" y="65" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="14" fill="#666666">Days as Prominent Pollutant by State - 2024</text>
  <text x="${width/2}" y="85" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="11" fill="#999999">Bubble size = number of days</text>
  ${circles}
</svg>`;
  };

  // Download all individual pollutant SVGs
  const downloadAllPollutantSVGs = () => {
    POLLUTANT_NAMES.forEach((pollutantName, index) => {
      setTimeout(() => {
        const svgContent = generateSinglePollutantSVG(pollutantName);
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `pollutant_${pollutantName.replace('.', '')}_india.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, index * 300); // Stagger downloads to avoid browser blocking
    });
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#1a1a2e"
      }}>
        <p style={{ color: "#fff" }}>Loading population data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#1a1a2e"
      }}>
        <p style={{ color: "#ff6b6b" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      <style>
        {`
          .bubble-marker {
            background: transparent !important;
            border: none !important;
          }
          .state-label-marker {
            background: transparent !important;
            border: none !important;
          }
          .pollutant-cluster-marker {
            background: transparent !important;
            border: none !important;
          }
          .weather-bubble-marker {
            background: transparent !important;
            border: none !important;
          }
          .wind-marker {
            background: transparent !important;
            border: none !important;
          }
          .grayscale-terrain {
            filter: grayscale(100%) brightness(0.9) contrast(1.6) sepia(18%) hue-rotate(180deg) saturate(0.7);
          }
          .elevation-grayscale {
            filter: grayscale(100%) contrast(1.4) brightness(0.85);
          }
          .population-tooltip {
            background: rgba(26, 26, 46, 0.95) !important;
            border: 1px solid #c71585 !important;
            border-radius: 4px !important;
            color: #fff !important;
          }
          .population-tooltip .leaflet-tooltip-tip {
            border-top-color: rgba(26, 26, 46, 0.95) !important;
          }
        `}
      </style>

      {/* Wind Direction & Speed Map */}
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        {/* Title overlay */}
        <div style={{
          position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.9)", padding: "10px 24px",
          borderRadius: "8px", textAlign: "center",
          border: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#333", letterSpacing: "0.3px" }}>
            Wind Direction &amp; Speed
          </div>
          <div style={{ fontSize: "10px", color: "#999", marginTop: "3px" }}>
            Smoke flows in dominant wind direction · Hover for details
          </div>
        </div>

        {/* Himalayan Mountain Range label */}
        <div style={{
          position: "absolute", top: "24%", left: "60%", transform: "translateX(-50%) rotate(-8deg)",
          zIndex: 1000,
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: "14px",
          fontWeight: "500",
          fontStyle: "italic",
          color: "#666",
          letterSpacing: "3px",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}>
          Himalayan Mountain Range
        </div>

        {/* Legend overlay */}
        <div style={{
          position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.9)", padding: "9px 20px",
          borderRadius: "8px", display: "flex", gap: "22px", alignItems: "center",
          border: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          {[
            { label: "Light", color: "#5699af" },
            { label: "Moderate", color: "#de9eaf" },
            { label: "Strong", color: "#c1616b" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%", background: color,
                boxShadow: `0 0 6px ${color}`,
              }} />
              <span style={{ fontSize: "10px", color: "#555", letterSpacing: "0.2px" }}>{label}</span>
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
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          {/* Elevation/terrain overlay - darker and more prominent */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"
            opacity={0.55}
            className="elevation-grayscale"
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
              markerSize={180}
              hideText={true}
            />
          ))}
        </MapContainer>
      </div>

      {/* Pollutant Map Section */}
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        {/* Title overlay */}
        <div style={{
          position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.95)", padding: "10px 24px",
          borderRadius: "8px", textAlign: "center",
          border: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#333", letterSpacing: "0.3px" }}>
            Prominent Pollutants by State
          </div>
          <div style={{ fontSize: "10px", color: "#999", marginTop: "3px" }}>
            2024 · Bubble size = frequency as dominant pollutant
          </div>
        </div>

        {/* Legend overlay */}
        <div style={{
          position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(255,255,255,0.95)", padding: "9px 20px",
          borderRadius: "8px", display: "flex", gap: "16px", alignItems: "center",
          border: "1px solid rgba(0,0,0,0.08)", flexWrap: "wrap", justifyContent: "center",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        }}>
          {POLLUTANT_NAMES.map((p) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: POLLUTANT_COLORS[p],
              }} />
              <span style={{ fontSize: "10px", color: "#555" }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Download buttons */}
        <div style={{
          position: "absolute", top: "12px", right: "12px", zIndex: 1000,
          display: "flex", gap: "8px",
        }}>
          <button
            onClick={downloadPollutantSVG}
            style={{
              background: "rgba(255,255,255,0.95)", border: "1px solid #ddd",
              borderRadius: "6px", padding: "6px 12px", fontSize: "11px",
              cursor: "pointer", color: "#555",
            }}
          >
            Download Combined SVG
          </button>
          <button
            onClick={downloadAllPollutantSVGs}
            style={{
              background: "rgba(255,255,255,0.95)", border: "1px solid #ddd",
              borderRadius: "6px", padding: "6px 12px", fontSize: "11px",
              cursor: "pointer", color: "#555",
            }}
          >
            Download Individual SVGs
          </button>
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
          {pollutantData.map((d) => (
            <PollutantClusterMarker
              key={d.state}
              state={d.state}
              counts={d.counts}
              total={d.total}
              position={d.coords}
              globalMaxCounts={globalMaxCounts}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

// Standalone Wind Map component for use in other sections
export function WindMap() {
  const [cityWeather, setCityWeather] = useState([]);
  const [maxWind, setMaxWind] = useState(20);

  useEffect(() => {
    // Load weather data
    d3.csv("/data/india_2000_2024_daily_weather.csv").then((data) => {
      const cityAgg = new Map();
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length || 0;

      // Filter for 2024 data
      const filtered = data.filter((d) => {
        const parts = d.date?.split("/");
        return parts && parts.length === 3 && parts[2] === "24";
      });

      filtered.forEach((d) => {
        const city = d.city?.trim();
        if (!city || !CITY_COORDINATES[city]) return;
        const wind = parseFloat(d.wind_speed_10m_max);
        const gust = parseFloat(d.wind_gusts_10m_max);
        const dir = parseFloat(d.wind_direction_10m_dominant);

        if (!cityAgg.has(city)) {
          cityAgg.set(city, { winds: [], gusts: [], dirs: [] });
        }
        const entry = cityAgg.get(city);
        if (!isNaN(wind)) entry.winds.push(wind);
        if (!isNaN(gust)) entry.gusts.push(gust);
        if (!isNaN(dir)) entry.dirs.push(dir);
      });

      const weatherArr = [];
      cityAgg.forEach((val, city) => {
        // Circular mean for wind direction
        let sinSum = 0, cosSum = 0;
        val.dirs.forEach(d => {
          sinSum += Math.sin(d * Math.PI / 180);
          cosSum += Math.cos(d * Math.PI / 180);
        });
        const avgDir = ((Math.atan2(sinSum, cosSum) * 180 / Math.PI) + 360) % 360;

        weatherArr.push({
          city,
          coords: CITY_COORDINATES[city],
          avgWind: avg(val.winds),
          avgGust: avg(val.gusts),
          avgDir,
        });
      });

      setCityWeather(weatherArr);
      const winds = weatherArr.map((c) => c.avgWind);
      setMaxWind(Math.max(...winds));
    });
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{`
        .wind-marker { pointer-events: auto !important; }
        .elevation-grayscale {
          filter: grayscale(100%) contrast(1.4) brightness(0.85);
        }
      `}</style>

      <MapContainer
        center={[22, 82]}
        zoom={4.2}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        {/* White/grey basemap */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        {/* Elevation/terrain overlay - darker and more prominent */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"
          opacity={0.55}
          className="elevation-grayscale"
        />
        {cityWeather.map((c) => (
          <WindMarker
            key={c.city}
            city={c.city}
            avgWind={c.avgWind}
            avgGust={c.avgGust}
            avgDir={c.avgDir}
            position={c.coords}
            maxWind={maxWind}
            markerSize={150}
            hideText={true}
          />
        ))}
      </MapContainer>
    </div>
  );
}
