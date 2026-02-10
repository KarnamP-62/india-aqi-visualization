import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { MapContainer, TileLayer, useMap, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Component to fit bounds to India and provide map reference
function FitBoundsToIndia({ onMapReady }) {
  const map = useMap();

  useEffect(() => {
    // India bounds approximately (including disputed areas like J&K, Aksai Chin)
    map.fitBounds([
      [6.5, 68], // Southwest
      [37, 97.5], // Northeast (extended for disputed areas)
    ]);

    // Disable dragging outside bounds
    map.setMaxBounds([
      [4, 65],
      [40, 100],
    ]);

    // Pass map reference to parent
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
}

export default function Maps() {
  const [stationData, setStationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indiaGeoJSON, setIndiaGeoJSON] = useState(null);
  const [maskGeoJSON, setMaskGeoJSON] = useState(null);

  // Airflow animation state
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const animationRef = useRef();
  const dayAnimationRef = useRef();
  const particlesRef = useRef([]);
  const dailyDataRef = useRef({});
  const currentDayIndexRef = useRef(0);
  const sortedDatesRef = useRef([]);

  const [dailyData, setDailyData] = useState({});
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [sortedDates, setSortedDates] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const monthNames = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];

  // City coordinates lookup
  const cityCoordinates = {
    "Mumbai": [19.0760, 72.8777], "Pune": [18.5204, 73.8567], "Nagpur": [21.1458, 79.0882],
    "Delhi": [28.7041, 77.1025], "New Delhi": [28.6139, 77.2090], "Noida": [28.5355, 77.3910],
    "Gurugram": [28.4595, 77.0266], "Ghaziabad": [28.6692, 77.4538], "Faridabad": [28.4089, 77.3178],
    "Bengaluru": [12.9716, 77.5946], "Chennai": [13.0827, 80.2707], "Hyderabad": [17.3850, 78.4867],
    "Kolkata": [22.5726, 88.3639], "Ahmedabad": [23.0225, 72.5714], "Jaipur": [26.9124, 75.7873],
    "Lucknow": [26.8467, 80.9462], "Kanpur": [26.4499, 80.3319], "Patna": [25.5941, 85.1376],
    "Bhopal": [23.2599, 77.4126], "Indore": [22.7196, 75.8577], "Chandigarh": [30.7333, 76.7794],
    "Ludhiana": [30.9010, 75.8573], "Amritsar": [31.6340, 74.8723], "Varanasi": [25.3176, 82.9913],
    "Agra": [27.1767, 78.0081], "Surat": [21.1702, 72.8311], "Vadodara": [22.3072, 73.1812],
    "Nashik": [19.9975, 73.7898], "Coimbatore": [11.0168, 76.9558], "Visakhapatnam": [17.6868, 83.2185],
    "Bhubaneswar": [20.2961, 85.8245], "Ranchi": [23.3441, 85.3096], "Raipur": [21.2514, 81.6296],
    "Guwahati": [26.1445, 91.7362], "Dehradun": [30.3165, 78.0322], "Shimla": [31.1048, 77.1734],
    "Thiruvananthapuram": [8.5241, 76.9366], "Kochi": [9.9312, 76.2673], "Mysuru": [12.2958, 76.6394],
    "Jodhpur": [26.2389, 73.0243], "Udaipur": [24.5854, 73.7125], "Gwalior": [26.2183, 78.1828],
    "Jabalpur": [23.1815, 79.9864], "Vijayawada": [16.5062, 80.6480], "Warangal": [17.9689, 79.5941],
    "Madurai": [9.9252, 78.1198], "Tiruchirappalli": [10.7905, 78.7047], "Salem": [11.6643, 78.1460],
    "Howrah": [22.5958, 88.2636], "Durgapur": [23.5204, 87.3119], "Asansol": [23.6739, 86.9661],
    "Jamshedpur": [22.8046, 86.1889], "Dhanbad": [23.7957, 86.4304], "Cuttack": [20.4625, 85.8830],
    "Rohtak": [28.8955, 76.6066], "Panipat": [29.3909, 76.9635], "Sonipat": [28.9288, 77.0151],
    "Amravati": [20.9374, 77.7523], "Thane": [19.2183, 72.9781], "Rajkot": [22.3039, 70.8022],
    "Meerut": [28.9845, 77.7064], "Prayagraj": [25.4358, 81.8463], "Bareilly": [28.3670, 79.4304],
    "Aligarh": [27.8974, 78.0880], "Moradabad": [28.8386, 78.7733], "Gorakhpur": [26.7606, 83.3732],
    "Gaya": [24.7955, 84.9994], "Muzaffarpur": [26.1209, 85.3647], "Bhagalpur": [25.2425, 86.9842],
  };

  // AQI color with alpha for particles
  const getAQIColor = (aqi, alpha = 1) => {
    if (!aqi || aqi === 0) return `rgba(200, 200, 200, ${alpha})`;
    if (aqi <= 50) return `rgba(86, 153, 175, ${alpha})`; // Good
    if (aqi <= 100) return `rgba(135, 190, 177, ${alpha})`; // Satisfactory
    if (aqi <= 200) return `rgba(223, 191, 198, ${alpha})`; // Moderate
    if (aqi <= 300) return `rgba(222, 158, 175, ${alpha})`; // Poor
    if (aqi <= 400) return `rgba(224, 113, 146, ${alpha})`; // Very Poor
    return `rgba(193, 97, 107, ${alpha})`; // Severe
  };

  const getAQIColorHex = (aqi) => {
    if (!aqi || aqi === 0) return "#c8c8c8";
    if (aqi <= 50) return "#5699af";
    if (aqi <= 100) return "#87beb1";
    if (aqi <= 200) return "#dfbfc6";
    if (aqi <= 300) return "#de9eaf";
    if (aqi <= 400) return "#e07192";
    return "#c1616b";
  };

  const getAQIStatus = (aqi) => {
    if (!aqi || aqi === 0) return "No Data";
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Satisfactory";
    if (aqi <= 200) return "Moderate";
    if (aqi <= 300) return "Poor";
    if (aqi <= 400) return "Very Poor";
    return "Severe";
  };

  // Helper to get week number from date
  const getWeekNumber = (month, day) => {
    const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dayOfYear = day;
    for (let i = 1; i < month; i++) {
      dayOfYear += daysInMonth[i];
    }
    return Math.ceil(dayOfYear / 7);
  };

  // Get date range for a week
  const getWeekDateRange = (weekNum) => {
    const startDay = (weekNum - 1) * 7 + 1;
    const endDay = Math.min(weekNum * 7, 366);
    const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const getDayMonth = (dayOfYear) => {
      let remaining = dayOfYear;
      for (let m = 1; m <= 12; m++) {
        if (remaining <= daysInMonth[m]) {
          return { month: m, day: remaining };
        }
        remaining -= daysInMonth[m];
      }
      return { month: 12, day: 31 };
    };

    const start = getDayMonth(startDay);
    const end = getDayMonth(endDay);
    return `${monthNames[start.month].slice(0, 3)} ${start.day} - ${monthNames[end.month].slice(0, 3)} ${end.day}`;
  };

  // Get current month from date string (e.g., "1/15/24")
  const getCurrentMonth = () => {
    const currentDate = sortedDates[currentDayIndex];
    if (!currentDate) return 1;
    const [month] = currentDate.split("/").map(Number);
    return month;
  };

  // Format date for display (e.g., "1/15/24" -> "January 15, 2024")
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [month, day] = dateStr.split("/").map(Number);
    return `${monthNames[month]} ${day}, 2024`;
  };

  const getAQICategory = (aqi) => {
    if (!aqi || aqi === 0) return null;
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Satisfactory";
    if (aqi <= 200) return "Moderate";
    if (aqi <= 300) return "Poor";
    if (aqi <= 400) return "Very Poor";
    return "Severe";
  };

  // Get coordinates for a city [lat, lng] for Leaflet
  const getCoordinates = (area, state) => {
    if (cityCoordinates[area]) return cityCoordinates[area];
    const stateCentroids = {
      "Maharashtra": [19.5, 76.0], "Delhi": [28.6, 77.1], "Karnataka": [14.5, 76.5],
      "Tamil Nadu": [11.0, 78.5], "Gujarat": [22.5, 72.0], "Uttar Pradesh": [27.0, 80.5],
      "West Bengal": [23.5, 87.5], "Rajasthan": [27.0, 74.0], "Madhya Pradesh": [23.5, 78.0],
      "Bihar": [25.5, 85.5], "Telangana": [17.5, 79.0], "Andhra Pradesh": [15.5, 79.5],
      "Kerala": [10.0, 76.5], "Punjab": [31.0, 75.5], "Haryana": [29.0, 76.5],
      "Odisha": [20.5, 85.0], "Jharkhand": [23.5, 85.5], "Chhattisgarh": [21.5, 82.0],
      "Assam": [26.5, 93.0], "Uttarakhand": [30.0, 79.0],
    };
    if (stateCentroids[state]) {
      const base = stateCentroids[state];
      return [base[0] + (Math.random() - 0.5) * 1.5, base[1] + (Math.random() - 0.5) * 1.5];
    }
    return [22 + (Math.random() - 0.5) * 6, 78 + (Math.random() - 0.5) * 8];
  };

  // Load India GeoJSON with disputed areas and create mask
  useEffect(() => {
    // Using Survey of India compliant boundary with disputed areas (J&K, Aksai Chin, Arunachal Pradesh)
    fetch("https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch India boundary");
        return res.json();
      })
      .then((data) => {
        setIndiaGeoJSON(data);

        // Create mask by extracting coordinates from India boundary
        // For MultiPolygon, we create multiple mask features
        const createMaskFromFeature = (feature) => {
          const geom = feature.geometry;
          const masks = [];

          // World rectangle coordinates (counterclockwise for outer ring)
          const worldOuter = [[60, -5], [110, -5], [110, 45], [60, 45], [60, -5]];

          if (geom.type === "Polygon") {
            // Single polygon - use its outer ring as hole
            masks.push({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [worldOuter, ...geom.coordinates]
              }
            });
          } else if (geom.type === "MultiPolygon") {
            // MultiPolygon - combine all outer rings as holes in a single mask
            const holes = geom.coordinates.map(poly => poly[0]); // Get outer ring of each polygon
            masks.push({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [worldOuter, ...holes]
              }
            });
          }
          return masks;
        };

        let maskFeatures = [];
        if (data.type === "FeatureCollection" && data.features.length > 0) {
          maskFeatures = createMaskFromFeature(data.features[0]);
        } else if (data.type === "Feature") {
          maskFeatures = createMaskFromFeature(data);
        }

        if (maskFeatures.length > 0) {
          setMaskGeoJSON({
            type: "FeatureCollection",
            features: maskFeatures
          });
        }
      })
      .catch((err) => {
        console.error("Error loading India GeoJSON:", err);
      });
  }, []);

  // Load AQI data - both median for stations and weekly for animation
  useEffect(() => {
    d3.csv("/data/AQI.csv")
      .then((data) => {
        const data2024 = data.filter((d) => d.date.split("/")[2] === "24");

        // Group by station and collect all AQI values
        const stationMap = new Map();

        data2024.forEach((d) => {
          const key = `${d.state}-${d.area}`;
          const aqi = parseInt(d.aqi_value) || 0;

          if (!stationMap.has(key)) {
            const coords = getCoordinates(d.area, d.state);
            stationMap.set(key, {
              key,
              area: d.area,
              state: d.state,
              position: coords,
              aqiValues: [],
            });
          }

          if (aqi > 0) {
            stationMap.get(key).aqiValues.push(aqi);
          }
        });

        // Calculate median AQI for each station
        const stations = Array.from(stationMap.values())
          .filter((s) => s.aqiValues.length > 0)
          .map((s) => {
            const sorted = [...s.aqiValues].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const medianAQI = sorted.length % 2 === 0
              ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
              : sorted[mid];

            const category = getAQICategory(medianAQI);

            return {
              key: s.key,
              area: s.area,
              state: s.state,
              position: s.position,
              medianAQI,
              category,
              totalDays: s.aqiValues.length,
              min: sorted[0],
              max: sorted[sorted.length - 1],
            };
          });

        setStationData(stations);

        // Group AQI data by date for daily animation
        const byDate = {};
        data2024.forEach((d) => {
          const dateKey = d.date; // e.g., "1/15/24"
          const key = `${d.state}-${d.area}`;
          const aqi = parseInt(d.aqi_value) || 0;

          if (aqi > 0) {
            if (!byDate[dateKey]) byDate[dateKey] = {};
            byDate[dateKey][key] = aqi;
          }
        });

        // Sort dates chronologically
        const sortedDateKeys = Object.keys(byDate).sort((a, b) => {
          const [aMonth, aDay] = a.split("/").map(Number);
          const [bMonth, bDay] = b.split("/").map(Number);
          if (aMonth !== bMonth) return aMonth - bMonth;
          return aDay - bDay;
        });

        setDailyData(byDate);
        dailyDataRef.current = byDate;
        setSortedDates(sortedDateKeys);
        sortedDatesRef.current = sortedDateKeys;
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading CSV:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Handle map ready - store reference and set up canvas sync
  const handleMapReady = (map) => {
    mapRef.current = map;

    // Initialize particles after map is ready
    setTimeout(() => {
      if (stationData.length > 0) {
        initializeParticles();
      }
    }, 100);

    // Update canvas position when map moves
    const updateCanvas = () => {
      if (!canvasRef.current || !mapRef.current) return;

      // Reinitialize particles with new screen positions
      if (stationData.length > 0) {
        initializeParticles();
      }
    };

    map.on('move', updateCanvas);
    map.on('zoom', updateCanvas);
    map.on('moveend', updateCanvas);
    map.on('zoomend', updateCanvas);
  };

  // Initialize bubble particles
  const initializeParticles = () => {
    if (!mapRef.current || stationData.length === 0) {
      console.log("Cannot init particles:", { map: !!mapRef.current, stations: stationData.length });
      return;
    }
    console.log("Initializing bubbles for", stationData.length, "stations");

    const newParticles = [];
    const particlesPerStation = 12;

    stationData.forEach((station) => {
      const screenPos = mapRef.current.latLngToContainerPoint([station.position[0], station.position[1]]);

      for (let i = 0; i < particlesPerStation; i++) {
        newParticles.push({
          x: screenPos.x + (Math.random() - 0.5) * 20,
          y: screenPos.y + (Math.random() - 0.5) * 20,
          originX: screenPos.x,
          originY: screenPos.y,
          stationKey: station.key,
          area: station.area,
          state: station.state,
          lat: station.position[0],
          lng: station.position[1],
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 80,
          size: 3 + Math.random() * 6, // Bubble size
          speed: 0.3 + Math.random() * 0.4, // Rise speed
          wobbleOffset: Math.random() * Math.PI * 2, // Random wobble phase
          wobbleSpeed: 0.02 + Math.random() * 0.02,
          wobbleAmount: 0.3 + Math.random() * 0.4,
        });
      }
    });

    particlesRef.current = newParticles;
    console.log("Created", newParticles.length, "bubbles");
  };

  // Initialize particles when station data is ready and map is available
  useEffect(() => {
    if (stationData.length > 0 && mapRef.current) {
      initializeParticles();
    }
  }, [stationData]);

  // Also try to initialize particles periodically until successful
  useEffect(() => {
    if (particlesRef.current.length > 0) return; // Already initialized

    const tryInit = setInterval(() => {
      if (stationData.length > 0 && mapRef.current) {
        initializeParticles();
        if (particlesRef.current.length > 0) {
          clearInterval(tryInit);
        }
      }
    }, 200);

    return () => clearInterval(tryInit);
  }, [stationData]);

  // Animate through weeks (Jan to Dec)
  useEffect(() => {
    if (sortedDates.length === 0) return;

    const cycleDays = () => {
      setCurrentDayIndex((prev) => {
        const next = prev >= sortedDates.length - 1 ? 0 : prev + 1;
        currentDayIndexRef.current = next;
        return next;
      });
    };

    // Change day every 150ms (faster for daily data)
    dayAnimationRef.current = setInterval(cycleDays, 150);

    return () => {
      if (dayAnimationRef.current) {
        clearInterval(dayAnimationRef.current);
      }
    };
  }, [sortedDates]);

  // Animation loop - bubble particles
  useEffect(() => {
    if (stationData.length === 0) return;

    const animate = () => {
      const canvas = canvasRef.current;
      const map = mapRef.current;
      if (!canvas || !map) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentDateStr = sortedDatesRef.current[currentDayIndexRef.current];
      const currentDayData = dailyDataRef.current[currentDateStr] || {};
      const particles = particlesRef.current;

      // Update particle origins based on current map position
      particles.forEach((p) => {
        const screenPos = map.latLngToContainerPoint([p.lat, p.lng]);
        p.originX = screenPos.x;
        p.originY = screenPos.y;
      });

      // Update and draw bubbles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const aqi = currentDayData[p.stationKey] || 0;

        // Bubble rising movement with wobble
        const wobble = Math.sin(p.life * p.wobbleSpeed + p.wobbleOffset) * p.wobbleAmount;
        p.x += wobble;
        p.y -= p.speed; // Rise upward
        p.life += 1;

        // Calculate distance from origin
        const dy = p.originY - p.y;

        // Reset bubble when it rises too far or life ends
        if (dy > 60 || p.life > p.maxLife) {
          p.x = p.originX + (Math.random() - 0.5) * 20;
          p.y = p.originY + (Math.random() - 0.5) * 10;
          p.life = 0;
          p.size = 3 + Math.random() * 6;
          p.wobbleOffset = Math.random() * Math.PI * 2;
        }

        // Skip drawing if no AQI data
        if (aqi <= 0) continue;

        // Calculate alpha - fade in then fade out
        const riseRatio = Math.min(dy / 60, 1);
        const fadeIn = Math.min(p.life / 20, 1);
        const fadeOut = 1 - riseRatio * 0.7;
        const alpha = fadeIn * fadeOut * 0.7;

        // Draw bubble with gradient for 3D effect
        const gradient = ctx.createRadialGradient(
          p.x - p.size * 0.3, p.y - p.size * 0.3, 0,
          p.x, p.y, p.size
        );

        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
        gradient.addColorStop(0.3, getAQIColor(aqi, alpha * 0.6));
        gradient.addColorStop(1, getAQIColor(aqi, alpha * 0.2));

        // Draw main bubble
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw bubble outline
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.strokeStyle = getAQIColor(aqi, alpha * 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw highlight
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stationData]);

  // Handle mouse move for tooltips
  const handleMouseMove = (e) => {
    if (!canvasRef.current || !mapRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let nearest = null;
    let minDist = 30;

    const currentDateStr = sortedDates[currentDayIndex];
    const currentDayData = dailyData[currentDateStr] || {};

    stationData.forEach((station) => {
      const screenPos = mapRef.current.latLngToContainerPoint([station.position[0], station.position[1]]);
      const dx = screenPos.x - x;
      const dy = screenPos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    });

    if (nearest) {
      const aqi = currentDayData[nearest.key] || 0;
      setSelectedPoint({
        area: nearest.area,
        state: nearest.state,
        aqi: aqi,
        date: currentDateStr,
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setSelectedPoint(null);
    }
  };

  if (loading) return <p style={{ padding: "20px", color: "#333" }}>Loading map data...</p>;
  if (error) return <p style={{ color: "red", padding: "20px" }}>Error: {error}</p>;

  return (
    <div style={{
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      backgroundColor: "#fff",
      minHeight: "100vh",
      padding: "40px",
    }}>
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: "48px",
          fontWeight: "700",
          color: "#333",
          textAlign: "center",
          marginBottom: "10px",
        }}
      >
        India Air Quality 2024
      </h1>
      <p
        style={{
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: "24px",
          color: "#333",
          textAlign: "center",
          marginBottom: "30px",
          fontWeight: "400",
        }}
      >
        {sortedDates[currentDayIndex] ? formatDate(sortedDates[currentDayIndex]) : "Loading..."}
      </p>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Good", color: "#5699af", range: "0-50" },
          { label: "Satisfactory", color: "#87beb1", range: "51-100" },
          { label: "Moderate", color: "#dfbfc6", range: "101-200" },
          { label: "Poor", color: "#de9eaf", range: "201-300" },
          { label: "Very Poor", color: "#e07192", range: "301-400" },
          { label: "Severe", color: "#c1616b", range: "401+" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: item.color,
                borderRadius: "50%",
                boxShadow: `0 0 10px ${item.color}`,
              }}
            />
            <span style={{ fontSize: "12px", color: "#555" }}>
              {item.label} ({item.range})
            </span>
          </div>
        ))}
      </div>

      {/* Map and month scale container */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "30px",
        }}
      >
        {/* Map container with canvas overlay */}
        <div
          style={{
            position: "relative",
            width: "900px",
            height: "800px",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <MapContainer
            center={[22, 82]}
            zoom={5}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            scrollWheelZoom={true}
          >
            <FitBoundsToIndia onMapReady={handleMapReady} />

            {/* 3D Relief hillshade - ESRI World Hillshade */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
              className="relief-hillshade"
            />

            {/* Color overlay for terrain tint */}
            {indiaGeoJSON && (
              <GeoJSON
                key="terrain-tint"
                data={indiaGeoJSON}
                style={{
                  fillColor: "#343a40",
                  fillOpacity: 0.35,
                  color: "transparent",
                  weight: 0,
                }}
                className="terrain-tint"
              />
            )}

            {/* Mask to hide areas outside India - pure white */}
            {maskGeoJSON && (
              <GeoJSON
                key="mask"
                data={maskGeoJSON}
                style={{
                  fillColor: "#fff",
                  fillOpacity: 1,
                  color: "transparent",
                  weight: 0,
                }}
              />
            )}

            {/* India boundary outline */}
            {indiaGeoJSON && (
              <GeoJSON
                key="india-boundary"
                data={indiaGeoJSON}
                style={{
                  fillColor: "transparent",
                  fillOpacity: 0,
                  color: "#888",
                  weight: 0,
                }}
              />
            )}
          </MapContainer>

          {/* Canvas overlay for particle animation */}
          <canvas
            ref={canvasRef}
            width={900}
            height={800}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setSelectedPoint(null)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 1000,
              pointerEvents: "auto",
              cursor: "crosshair",
            }}
          />
        </div>

        {/* Month scale */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: 700,
            paddingTop: "50px",
            paddingBottom: "50px",
          }}
        >
          <div
            style={{
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: "2px",
                backgroundColor: "#ddd",
                transform: "translateX(-50%)",
              }}
            />

            {/* Month markers */}
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => (
              <div
                key={month}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  zIndex: 1,
                }}
              >
                {/* Dot indicator */}
                <div
                  style={{
                    width: getCurrentMonth() === index + 1 ? "14px" : "8px",
                    height: getCurrentMonth() === index + 1 ? "14px" : "8px",
                    borderRadius: "50%",
                    backgroundColor: getCurrentMonth() === index + 1 ? "#333" : "#bbb",
                    border: getCurrentMonth() === index + 1 ? "2px solid #333" : "none",
                    transition: "all 0.3s ease",
                    boxShadow: getCurrentMonth() === index + 1 ? "0 0 8px rgba(0,0,0,0.3)" : "none",
                  }}
                />
                {/* Month label */}
                <span
                  style={{
                    fontSize: getCurrentMonth() === index + 1 ? "14px" : "12px",
                    fontWeight: getCurrentMonth() === index + 1 ? "700" : "400",
                    color: getCurrentMonth() === index + 1 ? "#333" : "#888",
                    transition: "all 0.3s ease",
                    minWidth: "30px",
                  }}
                >
                  {month}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {selectedPoint && (
        <div
          style={{
            position: "fixed",
            left: selectedPoint.x + 15,
            top: selectedPoint.y + 15,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: `2px solid ${getAQIColorHex(selectedPoint.aqi)}`,
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: "700", fontSize: "14px", color: "#333", marginBottom: "4px" }}>
            {selectedPoint.area}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {selectedPoint.state}
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
            {selectedPoint.date ? formatDate(selectedPoint.date) : ""}
          </div>
          <div style={{
            fontSize: "16px",
            marginTop: "4px",
            fontWeight: "600",
            color: getAQIColorHex(selectedPoint.aqi),
          }}>
            AQI: {selectedPoint.aqi || "No data"}
          </div>
          {selectedPoint.aqi > 0 && (
            <div style={{
              fontSize: "11px",
              color: getAQIColorHex(selectedPoint.aqi),
              marginTop: "2px",
            }}>
              {getAQIStatus(selectedPoint.aqi)}
            </div>
          )}
        </div>
      )}

      {/* Info text */}
      <p
        style={{
          textAlign: "center",
          color: "#888",
          fontSize: "12px",
          marginTop: "20px",
        }}
      >
        Hover over stations to see details • Bubbles show daily AQI cycling through 2024
      </p>

      {/* CSS for 3D relief hillshade */}
      <style>{`
        .relief-hillshade {
          filter: contrast(1.8) brightness(1.05) saturate(0);
        }
        .terrain-tint {
          mix-blend-mode: multiply;
        }
        .leaflet-container {
          background: #ffffff;
        }
        .leaflet-tooltip {
          background: rgba(255, 255, 255, 0.95);
          border: none;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 8px 12px;
        }
        .leaflet-tooltip-top:before {
          border-top-color: rgba(255, 255, 255, 0.95);
        }
        .leaflet-control-attribution {
          display: none;
        }
        .leaflet-control-zoom {
          display: none;
        }
      `}</style>
    </div>
  );
}
