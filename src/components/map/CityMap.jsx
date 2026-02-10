import { useRef, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as d3 from "d3";

// City coordinates (latitude, longitude)
const CITIES = [
  { name: "Byrnihat", lat: 25.9833, lng: 91.8833, state: "Meghalaya" },
  { name: "Delhi", lat: 28.6139, lng: 77.2090, state: "Delhi" },
  { name: "New Delhi", lat: 28.6129, lng: 77.2295, state: "Delhi" },
  { name: "Mullanpur", lat: 30.7833, lng: 76.5167, state: "Punjab" },
  { name: "Faridabad", lat: 28.4089, lng: 77.3178, state: "Haryana" },
  { name: "Loni", lat: 28.7500, lng: 77.2833, state: "Uttar Pradesh" },
];

// Component to fit bounds to India
function FitBoundsToIndia() {
  const map = useMap();
  useEffect(() => {
    const indiaBounds = [
      [6.5, 68],
      [37, 97.5],
    ];
    map.fitBounds(indiaBounds, { padding: [20, 20] });
  }, [map]);
  return null;
}

// Component to capture map as SVG
function MapExporter({ mapRef, onExport }) {
  const map = useMap();

  useEffect(() => {
    if (mapRef) {
      mapRef.current = map;
    }
  }, [map, mapRef]);

  return null;
}

export default function CityMap() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  // Download as SVG function
  const downloadSVG = () => {
    // Create SVG manually with India outline and city markers
    const width = 800;
    const height = 900;

    // India bounding box
    const minLat = 6.5, maxLat = 37, minLng = 68, maxLng = 97.5;

    // Projection function
    const projectToSVG = (lat, lng) => {
      const x = 50 + ((lng - minLng) / (maxLng - minLng)) * (width - 100);
      const y = 50 + ((maxLat - lat) / (maxLat - minLat)) * (height - 100);
      return { x, y };
    };

    // Create SVG content
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .city-label { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 14px; font-weight: 600; }
    .state-label { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 10px; fill: #666; }
    .title { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 20px; font-weight: 600; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#fafafa"/>

  <!-- Title -->
  <text x="${width/2}" y="35" text-anchor="middle" class="title" fill="#333">Most Polluted Cities in India (2024)</text>

  <!-- India outline (simplified) -->
  <path d="M 380,100 L 420,95 L 460,100 L 500,95 L 540,105 L 580,100 L 620,115 L 650,140 L 670,170 L 680,210 L 670,260 L 680,310 L 695,360 L 700,420 L 690,480 L 665,540 L 630,600 L 580,660 L 520,720 L 450,770 L 380,800 L 310,810 L 250,790 L 200,750 L 170,690 L 150,620 L 140,550 L 135,480 L 140,410 L 155,340 L 180,280 L 210,220 L 250,170 L 300,130 L 340,110 Z" fill="#e0e0e0" stroke="#bbb" stroke-width="2"/>

  <!-- Cities -->`;

    CITIES.forEach((city, index) => {
      const { x, y } = projectToSVG(city.lat, city.lng);
      svgContent += `

  <!-- ${city.name} -->
  <circle cx="${x}" cy="${y}" r="18" fill="#EF3E5C" opacity="0.25"/>
  <circle cx="${x}" cy="${y}" r="10" fill="#EF3E5C" stroke="#fff" stroke-width="2"/>
  <text x="${x}" y="${y - 20}" text-anchor="middle" class="city-label" fill="#333">${city.name}</text>
  <text x="${x}" y="${y + 28}" text-anchor="middle" class="state-label">${city.state}</text>`;
    });

    svgContent += `

  <!-- Legend -->
  <rect x="${width - 170}" y="60" width="150" height="70" fill="#fff" stroke="#ddd" rx="6"/>
  <text x="${width - 95}" y="85" text-anchor="middle" class="city-label" fill="#333">Legend</text>
  <circle cx="${width - 145}" cy="108" r="8" fill="#EF3E5C"/>
  <text x="${width - 125}" y="112" font-family="Georgia, 'Times New Roman', Times, serif" font-size="11" fill="#555">Polluted City</text>

  <!-- Footer -->
  <text x="${width/2}" y="${height - 20}" text-anchor="middle" font-family="Georgia, 'Times New Roman', Times, serif" font-size="11" fill="#999">Data: 2024 World Air Quality Report</text>
</svg>`;

    // Download
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "india_polluted_cities_map.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px",
        minHeight: "100vh",
        backgroundColor: "#fff",
      }}
    >
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: "32px",
          fontWeight: "600",
          color: "#333",
          marginBottom: "10px",
        }}
      >
        Most Polluted Cities in India
      </h1>
      <p
        style={{
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: "16px",
          color: "#666",
          marginBottom: "20px",
        }}
      >
        Byrnihat, Delhi, New Delhi, Mullanpur, Faridabad, Loni
      </p>

      <button
        onClick={downloadSVG}
        style={{
          padding: "12px 24px",
          backgroundColor: "#4A90A4",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "16px",
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          cursor: "pointer",
          marginBottom: "30px",
          transition: "background-color 0.2s",
        }}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#3a7a8a")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "#4A90A4")}
      >
        Download SVG
      </button>

      {/* Leaflet Map */}
      <div
        ref={containerRef}
        style={{
          width: "900px",
          height: "700px",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <MapContainer
          center={[22, 82]}
          zoom={5}
          style={{ width: "100%", height: "100%" }}
          minZoom={4}
          maxZoom={10}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <FitBoundsToIndia />
          <MapExporter mapRef={mapRef} />

          {/* City markers */}
          {CITIES.map((city) => (
            <CircleMarker
              key={city.name}
              center={[city.lat, city.lng]}
              radius={12}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: "#EF3E5C",
                fillOpacity: 0.9,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <div style={{ textAlign: "center" }}>
                  <strong style={{ fontSize: "12px" }}>{city.name}</strong>
                  <br />
                  <span style={{ fontSize: "10px", color: "#666" }}>{city.state}</span>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: "20px",
          padding: "15px 25px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: "#EF3E5C",
            border: "2px solid #fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
        <span
          style={{
            fontFamily: "Georgia, 'Times New Roman', Times, serif",
            fontSize: "14px",
            color: "#333",
          }}
        >
          Most Polluted Cities (2024 World Air Quality Report)
        </span>
      </div>

      {/* City list */}
      <div
        style={{
          marginTop: "30px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "15px",
          maxWidth: "900px",
        }}
      >
        {CITIES.map((city) => (
          <div
            key={city.name}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              borderLeft: "4px solid #EF3E5C",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "14px",
                fontWeight: "600",
                color: "#333",
              }}
            >
              {city.name}
            </span>
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "12px",
                color: "#666",
                marginLeft: "8px",
              }}
            >
              ({city.state})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
