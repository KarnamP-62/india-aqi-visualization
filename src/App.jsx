import { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";
import { CircularVizMap, LifeExpectancyPlot } from "./components/map/StateAQIMap";
import MonthlyAQICityChart from "./components/MonthlyAQICityChart";

// Mapbox access token - using public demo token
mapboxgl.accessToken = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const svgRef = useRef();
  const [stateData, setStateData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState({}); // { stateName: areaName }
  const [activeStateIndex, setActiveStateIndex] = useState(0);
  const [mapCentroids, setMapCentroids] = useState(null); // Computed state centroids for map overlay
  const stateRefs = useRef([]);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [colorizedCount, setColorizedCount] = useState(0); // 0, 1, 2, or 3
  const [highlightedYearIndex, setHighlightedYearIndex] = useState(-1); // index in highlight sequence (-1 = none)
  const [clickedYear, setClickedYear] = useState(null); // year clicked to show popup
  const [isExplorationPhase, setIsExplorationPhase] = useState(false); // true when past 2024, allowing free exploration
    const [activeMapIndex, setActiveMapIndex] = useState(0); // 0 = Delhi, 1 = Six Cities
  const [activeWeatherMapIndex, setActiveWeatherMapIndex] = useState(0); // 0 = Climate, 1 = Wind
  const [activePopRainfallIndex, setActivePopRainfallIndex] = useState(0); // 0 = AQI/Population, 1 = Rainfall, 2 = Wind
  const [activePollutantIndex, setActivePollutantIndex] = useState(0); // 0-6 for 7 pollutants
  const [visibleSources, setVisibleSources] = useState(0); // 0-8 for sources of pollution
  const [cyclingProgress, setCyclingProgress] = useState(0); // 0-1 for cycling animation
  const [hoveredSource, setHoveredSource] = useState(null); // index of hovered source
  const [sourceTooltipPos, setSourceTooltipPos] = useState({ x: 0, y: 0 }); // position for source tooltip
  const [delhiHovered, setDelhiHovered] = useState(false); // Delhi hover state
  const [delhiTooltipPos, setDelhiTooltipPos] = useState({ x: 0, y: 0 }); // Delhi tooltip position
  const [hoveredCity, setHoveredCity] = useState(null); // hovered city in Six Cities map
  const [cityTooltipPos, setCityTooltipPos] = useState({ x: 0, y: 0 }); // tooltip position for Six Cities
  const [lifeExpData, setLifeExpData] = useState([]); // life expectancy data for visualization
  const [populationData, setPopulationData] = useState([]); // population data by state (includes rainfall)
  const [windData, setWindData] = useState([]); // wind direction data by city for 2024
  const [windMapLoaded, setWindMapLoaded] = useState(false); // track when wind map SVG is loaded
  const [statePollutantData, setStatePollutantData] = useState([]); // pollutant breakdown by state
  const [hoveredRadialState, setHoveredRadialState] = useState(null); // hovered state in radial chart
  const [radialTooltipPos, setRadialTooltipPos] = useState({ x: 0, y: 0 }); // tooltip position for radial chart
  const [showCircularHelp, setShowCircularHelp] = useState(null); // which help tooltip to show
  const [hoveredStateIndex, setHoveredStateIndex] = useState(null); // index of hovered state in grid
  const [gridTooltipPos, setGridTooltipPos] = useState({ x: 0, y: 0 }); // position for grid tooltip
  const [sortOrder, setSortOrder] = useState("alphabetical"); // "alphabetical", "highToLow", "lowToHigh"
  const [viewMode, setViewMode] = useState("overview"); // "overview" or "scrollable"
  const [isViewTransitioning, setIsViewTransitioning] = useState(false); // track view mode transition
  const [mapMorphProgress, setMapMorphProgress] = useState(0); // 0-1 for map morph transition
  const [activeScatterIndex, setActiveScatterIndex] = useState(0); // 0 = Population, 1 = Rainfall, 2 = Geography
  const scatterTextRefs = useRef([]); // refs for scatter plot text sections
  const [hoveredScatterPoint, setHoveredScatterPoint] = useState(null); // hovered point in scatter plot
  const [scatterTooltipPos, setScatterTooltipPos] = useState({ x: 0, y: 0 }); // tooltip position for scatter plot
  const [hoveredAQIMapState, setHoveredAQIMapState] = useState(null); // hovered state in AQI choropleth map
  const [aqiMapTooltipPos, setAqiMapTooltipPos] = useState({ x: 0, y: 0 }); // tooltip position for AQI map

  // Handler for smooth view mode transition
  const handleViewModeChange = (newMode, scrollToIndex = null) => {
    if (newMode === viewMode) return;

    // Start transition - fade out
    setIsViewTransitioning(true);

    // After fade out, change view mode
    setTimeout(() => {
      setViewMode(newMode);
      // For scrollable mode, use provided index or default to current activeStateIndex (0)
      const targetIndex = scrollToIndex !== null ? scrollToIndex : activeStateIndex;
      if (scrollToIndex !== null) {
        setActiveStateIndex(scrollToIndex);
      }

      // After view change, fade back in
      setTimeout(() => {
        setIsViewTransitioning(false);

        // Scroll to state in scrollable mode (always scroll to position properly)
        if (newMode === "scrollable") {
          setTimeout(() => {
            stateRefs.current[targetIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }
      }, 50);
    }, 250);
  };
  const indiaMapRef = useRef(null); // ref for India map SVG object
  const populationMapRef = useRef(null); // ref for population India map SVG
  const standAloneAqiMapRef = useRef(null); // ref for standalone AQI map
  const rainfallMapRef = useRef(null); // ref for rainfall map SVG
  const introRef = useRef(null);
  const imagesSectionRef = useRef(null);
  const timelineRef = useRef(null);
  const timelineScrollRef = useRef(null); // container for scroll-based highlighting
  const mapScrollRef = useRef(null); // container for Delhi/Six Cities scrollytelling
  const delhiTextRef = useRef(null);
  const delhiMapRef = useRef(null); // ref for Delhi highlighted map
  const sixCitiesMapRef = useRef(null); // ref for Six Cities map
  const sixCitiesTextRef = useRef(null);
  const weatherText1Ref = useRef(null);
  const weatherText2Ref = useRef(null);
  const populationTextRef = useRef(null); // ref for AQI vs population text section
  const rainfallTextRef = useRef(null); // ref for rainfall text section
  const windTextRef = useRef(null); // ref for wind text section
  const windMapRef = useRef(null); // ref for wind map SVG
  const windMapboxContainerRef = useRef(null); // ref for Mapbox container
  const windMapboxRef = useRef(null); // ref for Mapbox map instance
  const pollutantRefs = useRef([]);
  const sourcesScrollRef = useRef(null);
  const cyclingRef = useRef(null); // ref for cycling animation section
  const gridSectionRef = useRef(null); // ref for grid of circular visualizations
  const mainVisualizationRef = useRef(null); // ref for main visualization section
  const circularGridRef = useRef(null); // ref for the circular visualizations grid container
  const itemPositionsRef = useRef({}); // store positions before sort change
  const smallMapRef = useRef(null); // ref for small India map position tracking

  // Handler for sort change with FLIP animation
  const handleSortChange = (newSortOrder) => {
    if (newSortOrder === sortOrder) return;

    // FIRST: Capture current positions of all items
    if (circularGridRef.current) {
      const items = circularGridRef.current.querySelectorAll("[data-state-id]");
      const positions = {};
      items.forEach((item) => {
        const stateId = item.getAttribute("data-state-id");
        const rect = item.getBoundingClientRect();
        positions[stateId] = { x: rect.left, y: rect.top };
      });
      itemPositionsRef.current = positions;
    }

    // Update sort order
    setSortOrder(newSortOrder);
  };

  // Effect to animate after sort change (FLIP - Last, Invert, Play)
  useEffect(() => {
    if (Object.keys(itemPositionsRef.current).length === 0) return;
    if (!circularGridRef.current) return;

    const items = circularGridRef.current.querySelectorAll("[data-state-id]");
    const oldPositions = itemPositionsRef.current;

    items.forEach((item, index) => {
      const stateId = item.getAttribute("data-state-id");
      const oldPos = oldPositions[stateId];

      if (oldPos) {
        // LAST: Get new position
        const newRect = item.getBoundingClientRect();

        // INVERT: Calculate the delta
        const deltaX = oldPos.x - newRect.left;
        const deltaY = oldPos.y - newRect.top;

        if (deltaX !== 0 || deltaY !== 0) {
          // Apply inverse transform (item appears in old position)
          item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          item.style.transition = "none";

          // PLAY: Animate to new position
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              item.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
              item.style.transitionDelay = `${index * 0.01}s`;
              item.style.transform = "translate(0, 0)";
            });
          });
        }
      }
    });

    // Clear stored positions
    itemPositionsRef.current = {};
  }, [sortOrder]);

  // Sources of pollution data
  const pollutionSources = [
    { svg: "/vehicleemission.svg", label: "Vehicle Emissions", description: "Road transport is a major contributor to India’s air pollution, and vehicular emissions are expected to rise with economic growth. Fuel standards in India lag behind global norms, making it crucial to implement Bharat-5 (Euro-5 equivalent) or higher nationwide to curb emissions. Staggered implementation delays air quality improvements, especially as heavy-duty diesel vehicles on lower-grade fuel emit high PM levels. Shifting public transport and para-transit vehicles to CNG successfully done in Delhi with buses, rickshaws, and taxis offers a cleaner alternative, but India’s large population and high reliance on transport continue to drive fuel consumption and pollution." },
    { svg: "/roaddust.svg", label: "Road Dust", description: "Road dust is a major air pollution source in many Indian cities, made up of particles from tire and brake wear as well as materials from roads and pavements. Dust levels become even worse on unpaved streets. Street cleaning is often done manually, but poorer neighborhoods usually receive limited service, while wealthier or commercial areas are cleaned more regularly. Even then, much of the swept dust is left along the roadside and gets stirred back into the air once traffic resumes. Mechanized sweeping with vacuum trucks or water sprinkling can better prevent dust resuspension, often at costs comparable to labor-intensive manual methods. Since road dust contributes nearly 30–40% of PM10 pollution in many cities, controlling it is one of the quickest and most effective interventions." },
    { svg: "/industrialemission.svg", label: "Industrial Emissions", description: "Industrial activity is a major source of air pollution in India, responsible for an estimated 51% of emissions. Thermal power plants and other industrial units release sulfur dioxide, nitrogen oxides, and particulate matter (PM10 and PM2.5), which can cause respiratory and cardiovascular problems. Although flue gas desulfurization (FGD) systems are mandated for nearly 540 power plants, compliance has been poor, with only 8% of units meeting the deadline as of 2024. Byrnihat, an industrial town on the Assam-Meghalaya border, was ranked the world’s most polluted city in 2024, with PM2.5 levels far exceeding WHO guidelines. While industry is the main contributor, vehicle emissions and hill cutting also worsen air quality." },
    { svg: "/garbage.svg", label: "Garbage Burning", description: "India generates 35–45 million tons of municipal waste annually, expected to exceed 150 million tons by 2030. Collection efficiency varies (50–90%), and improving waste burning requires stronger, nationwide waste management systems, yet only a few cities have functioning landfills and organized collection. Open waste burning is especially severe in small and medium cities where collection and disposal facilities are limited or absentand releases harmful pollutants like NOx, SO2, VOCs, and dioxins, though exact emissions are uncertain." },
    { svg: "/deisel_generator.svg", label: "Diesel Generators", description: "In 2011, India’s peak electricity demand (~122 GW) exceeded supply (~110 GW), leaving rural areas without reliable access and urban areas facing frequent power cuts. To cope, diesel generator (DG) sets are widely used in homes, businesses, hospitals, and telecom towers, contributing significantly to air pollution, up to 10–15% of PM10 in major cities. Rural DG use for agriculture is also high. Solutions include expanding power generation, improving transmission, adopting renewables, and tightening DG emission standards." },
    { svg: "/cropburning.svg", label: "Crop Burning", description: "Crop residue burning is a major source of air pollution in India, particularly in the northern states of Punjab, Haryana, and Uttar Pradesh. India generates about 500 Mt of crop residue annually, of which 140 Mt is surplus, and 92 Mt is burned each year. Small-scale farmers often burn crop waste because it is inexpensive and convenient. This practice releases large amounts of CO2, CO, N2O, and NOx, causing severe air pollution, with air quality in northern India reaching nearly twice the Indian standard and ten times the WHO standard, especially in November and December. Despite government interventions like monitoring, penalties, and promotion of alternative uses, crop burning continues due to socioeconomic constraints, lack of awareness, and limited access to technology." },
    { svg: "/construction.svg", label: "Construction and Demolition Activity", description: "Construction activities including cutting, excavation, demolition, mixing, and vehicle movement release significant particulate matter, often combined with road dust in studies. In six cities, construction contributes up to 10% of annual emissions, highlighting the need for best practices in the industry." },
    { svg: "/coalpowerplant.svg", label: "Coal Power Plants", description: "In 2011–12, India had 111 coal-fired power plants (121 GW) whose emissions were linked to 80,000–115,000 premature deaths and over 20 million asthma cases annually from PM2.5 exposure. Indian coal has low sulfur but high ash content, contributing to coarse PM. Regulations lag behind other countries, with few standards for key pollutants. Stronger pollution controls like flue gas desulfurization, stricter emission limits, and improved ash management could cut PM2.5 by 30–40%. Fugitive dust from coal handling and low ash utilization in construction remain additional concerns." },
  ];

  // Timeline events data
  const timelineEvents = {
    1981: {
      title: "Air (Prevention and Control of Pollution) Act",
      description: "This Act was enacted by the Government of India to prevent, control, and reduce air pollution and to maintain the quality of air in the country. Key objectives were to establish Central and State Pollution Control Boards (CPCB & SPCBs) and to assign powers and functions to these boards setting air quality standards and trying to regulate industrial emissions. This was India's first dedicated air pollution act.",
      row: 1,
      index: 1
    },
    1986: {
      title: "Environment (Protection) Act",
      description: "The Environment (Protection) Act, 1986 was enacted after the Bhopal Gas Tragedy to provide a comprehensive legal framework for environmental protection and to prevent industrial disasters.",
      row: 1,
      index: 6
    },
    1994: {
      title: "National Ambient Air Quality Standards (NAAQS)",
      description: "The National Ambient Air Quality Standards (NAAQS) in India were notified by the Central Pollution Control Board (CPCB) on April 11, 1994, under the Air (Prevention and Control of Pollution) Act, 1981, with immediate effect.",
      row: 2,
      index: 4
    },
    1998: {
      title: "Environment Pollution (Prevention & Control) Authority (EPCA)",
      description: "EPCA was established to address air pollution in the national capital region (NCR) of Delhi. National ambient air quality standards were introduced to provide a framework for monitoring and controlling air pollution levels.",
      row: 2,
      index: 8
    },
    2009: {
      title: "NAAQS",
      description: "The National Ambient Air Quality Standards (NAAQS), 2009 were issued by the Central Pollution Control Board (CPCB) to prescribe permissible limits for 12 major air pollutants in ambient air, including PM2.5. They aim to protect public health and the environment by regulating air quality across India. The standards specify limits based on different exposure durations.",
      row: 3,
      index: 9
    },
    2014: {
      title: "National AQI System",
      description: "The National Air Quality Index (AQI) was launched in India in 2014 by the Ministry of Environment, Forest and Climate Change (MoEFCC) along with the Central Pollution Control Board (CPCB). Its main objective is to provide the public with clear, understandable, and real-time information about air quality and its impact on human health. It covers eight major pollutants, including PM2.5, PM10, NO₂, SO₂, CO, O₃, NH₃, and Pb. The AQI is divided into six categories Good, Satisfactory, Moderate, Poor, Very Poor, and Severe, each linked to specific health advisories.",
      row: 4,
      index: 4
    },
    2016: {
      title: "GRAP",
      description: "The Graded Response Action Plan (GRAP) was introduced in 2016 by the Ministry of Environment, Forest and Climate Change (MoEFCC) for the National Capital Region (NCR) to tackle severe air pollution. It is a set of emergency measures that are implemented in phases based on the severity of air pollution levels. The actions include restricting construction activities, banning diesel generator use, stopping truck entry, closing brick kilns, and regulating vehicular movement.",
      row: 4,
      index: 6
    },
    2018: {
      title: "EPCA Reconstituted",
      description: "EPCA was reconstituted with new members from the government, academia, and civil society. The National Clean Air Programme (NCAP) draft was released with INR 637 crores budget. 102 non-attainment cities were announced, with 20 additional non-attainment cities added later.",
      row: 4,
      index: 8
    },
    2019: {
      title: "NCAP",
      description: "The National Clean Air Programme (NCAP) was launched by the Government of India in 2019 to systematically address the problem of air pollution across the country. Its primary objective is to reduce particulate matter (PM10 and PM2.5) concentrations by 20–30% (later revised to 40%) by 2025–26, using 2017 as the base year. NCAP adopts a comprehensive, long-term, and multi-sectoral approach involving central, state, and local governments.",
      row: 4,
      index: 9
    },
    2024: {
      title: "Expanding Monitoring Stations",
      description: "In 2024, India expanded its air quality monitoring under the National Clean Air Programme (NCAP), increasing Continuous Ambient Air Quality Monitoring Stations from 551 to 559, with new stations added in states like Tamil Nadu and West Bengal to strengthen real-time pollution tracking and policy response.",
      row: 5,
      index: 4
    }
  };

  useEffect(() => {
    d3.csv("/data/AQI.csv")
      .then((data) => {
        console.log("Total rows loaded:", data.length);

        // Filter for 2024 data
        const data2024 = data.filter((d) => {
          const year = d.date.split("/")[2];
          return year === "24";
        });

        console.log("2024 rows:", data2024.length);

        // Process data by state, area, month, and day
        const stateMap = new Map();

        data2024.forEach((d) => {
          const [month, day] = d.date.split("/");
          const monthNum = parseInt(month);
          const dayNum = parseInt(day);
          const state = d.state;
          const area = d.area || "";
          const status = d.air_quality_status.trim();
          const aqiValue = parseInt(d.aqi_value) || 0;
          const pollutants = d.prominent_pollutants || "";

          if (!stateMap.has(state)) {
            stateMap.set(state, { areas: new Set(), areaData: new Map() });
          }

          // Track areas
          if (area) {
            stateMap.get(state).areas.add(area);
          }

          // Store data by area
          if (!stateMap.get(state).areaData.has(area)) {
            stateMap.get(state).areaData.set(area, new Map());
          }

          const monthKey = `${monthNum}`;
          if (!stateMap.get(state).areaData.get(area).has(monthKey)) {
            stateMap.get(state).areaData.get(area).set(monthKey, new Map());
          }

          // Store status, aqi_value, and pollutants for this day
          stateMap.get(state).areaData.get(area).get(monthKey).set(dayNum, { status, aqiValue, pollutants });
        });

        // Convert to array format with pre-calculated avgAQI
        const processedData = Array.from(stateMap.entries())
          .map(([state, stateInfo]) => {
            // Calculate average AQI for sorting
            const aqiValues = [];
            stateInfo.areaData.forEach((areaMonths) => {
              areaMonths.forEach((days) => {
                days.forEach((dayData) => {
                  if (dayData.aqiValue && !isNaN(dayData.aqiValue)) {
                    aqiValues.push(dayData.aqiValue);
                  }
                });
              });
            });
            const avgAQI = aqiValues.length > 0
              ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
              : 0;

            return {
              state,
              areas: Array.from(stateInfo.areas).sort(),
              areaData: stateInfo.areaData,
              avgAQI,
            };
          })
          .sort((a, b) => a.state.localeCompare(b.state));

        console.log("States processed:", processedData.length);
        setStateData(processedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading CSV:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Load life expectancy data
  useEffect(() => {
    d3.csv("/data/india_pm25_life_expectancy_data.csv")
      .then((data) => {
        const processed = data
          .filter((row) => row["State/UT"] && row["State/UT"].trim())
          .map((row) => ({
            state: row["State/UT"].trim(),
            population: parseFloat(row["Population (Lakhs)"]) || 0,
            pm25: parseFloat(row["Annual Average 2023 PM2.5 Concentration (μg/m³)"]) || 0,
            whoGain: parseFloat(row["Life_Expectancy_Gains_WHO_PM25_guideline"]) || 0,
            nationalGain: parseFloat(row["Life_Expectancy_Gains_National_PM25_standard"]) || 0,
          }));
        setLifeExpData(processed);
      })
      .catch((err) => {
        console.error("Error loading life expectancy data:", err);
      });
  }, []);

  // Load population data (includes rainfall and region)
  useEffect(() => {
    d3.csv("/data/Population.csv")
      .then((data) => {
        const processed = data.map((row) => ({
          state: row["States/Uts"],
          population: parseInt(row["population(2024)"].replace(/,/g, "")) || 0,
          rainfall: parseFloat(row["Rainfall"]) || 0,
          region: row["Region"] || "Unknown",
        }));
        setPopulationData(processed);
      })
      .catch((err) => {
        console.error("Error loading population data:", err);
      });
  }, []);

  // Load wind data for 2024
  useEffect(() => {
    d3.csv("/data/india_2000_2024_daily_weather.csv")
      .then((data) => {
        // Filter for 2024 data (date format is M/D/YY)
        const data2024 = data.filter(row => row.date && row.date.endsWith("/24"));

        // City coordinates for positioning
        const cityCoords = {
          "Delhi": [28.7041, 77.1025],
          "Mumbai": [19.0760, 72.8777],
          "Bangalore": [12.9716, 77.5946],
          "Chennai": [13.0827, 80.2707],
          "Kolkata": [22.5726, 88.3639],
          "Hyderabad": [17.3850, 78.4867],
          "Pune": [18.5204, 73.8567],
          "Ahmedabad": [23.0225, 72.5714],
          "Jaipur": [26.9124, 75.7873],
          "Lucknow": [26.8467, 80.9462],
        };

        // Group by city and calculate average wind direction and speed
        const cityGroups = d3.group(data2024, d => d.city);
        const processed = [];

        cityGroups.forEach((rows, city) => {
          if (!cityCoords[city]) return;

          // Calculate circular mean for wind direction
          const directions = rows.map(r => parseFloat(r.wind_direction_10m_dominant)).filter(d => !isNaN(d));
          const speeds = rows.map(r => parseFloat(r.wind_speed_10m_max)).filter(s => !isNaN(s));
          const gusts = rows.map(r => parseFloat(r.wind_gusts_10m_max)).filter(g => !isNaN(g));

          if (directions.length > 0 && speeds.length > 0) {
            // Convert to radians and calculate mean using circular statistics
            const sinSum = directions.reduce((sum, d) => sum + Math.sin(d * Math.PI / 180), 0);
            const cosSum = directions.reduce((sum, d) => sum + Math.cos(d * Math.PI / 180), 0);
            const avgDirection = Math.atan2(sinSum / directions.length, cosSum / directions.length) * 180 / Math.PI;
            const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
            const avgGust = gusts.length > 0 ? gusts.reduce((a, b) => a + b, 0) / gusts.length : 0;

            processed.push({
              city,
              lat: cityCoords[city][0],
              lon: cityCoords[city][1],
              direction: avgDirection < 0 ? avgDirection + 360 : avgDirection,
              speed: avgSpeed,
              gust: avgGust,
            });
          }
        });

        setWindData(processed);
      })
      .catch((err) => {
        console.error("Error loading wind data:", err);
      });
  }, []);

  // Load and process state-level pollutant data
  useEffect(() => {
    d3.csv("/data/AQI.csv")
      .then((data) => {
        // State coordinates for positioning radial charts
        const stateCoords = {
          "Andhra Pradesh": [15.9129, 79.7400],
          "Arunachal Pradesh": [28.2180, 94.7278],
          "Assam": [26.2006, 92.9376],
          "Bihar": [25.0961, 85.3131],
          "Chhattisgarh": [21.2787, 81.8661],
          "Delhi": [28.7041, 77.1025],
          "Goa": [15.2993, 74.1240],
          "Gujarat": [22.2587, 71.1924],
          "Haryana": [29.0588, 76.0856],
          "Himachal Pradesh": [31.1048, 77.1734],
          "Jharkhand": [23.6102, 85.2799],
          "Karnataka": [15.3173, 75.7139],
          "Kerala": [10.8505, 76.2711],
          "Madhya Pradesh": [23.4734, 77.9469],
          "Maharashtra": [19.7515, 75.7139],
          "Manipur": [24.6637, 93.9063],
          "Meghalaya": [25.4670, 91.3662],
          "Mizoram": [23.1645, 92.9376],
          "Nagaland": [26.1584, 94.5624],
          "Odisha": [20.9517, 85.0985],
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

        // Pollutant colors (6 pollutants, excluding NH3)
        const pollutantColors = {
          "PM10": "#c1616b",
          "PM2.5": "#e07192",
          "O3": "#de9eaf",
          "CO": "#dfbfc6",
          "SO2": "#87beb1",
          "NO2": "#5699af",
        };

        // Group data by state and count pollutants
        const stateGroups = d3.group(data, d => d.state);
        const processed = [];

        stateGroups.forEach((rows, state) => {
          if (!stateCoords[state]) return;

          // Count each pollutant type
          const pollutantCounts = {};
          rows.forEach(row => {
            // Clean the pollutant name (remove quotes, trim)
            let pollutantStr = row.prominent_pollutants?.replace(/"/g, "").trim();
            if (pollutantStr) {
              // Split by comma if multiple pollutants are listed
              const pollutants = pollutantStr.split(",").map(p => p.trim());
              pollutants.forEach(pollutant => {
                if (pollutant) {
                  pollutantCounts[pollutant] = (pollutantCounts[pollutant] || 0) + 1;
                }
              });
            }
          });

          // Convert to array and calculate total
          const pollutants = Object.entries(pollutantCounts).map(([name, count]) => ({
            name,
            count,
            color: pollutantColors[name] || "#999",
          }));

          const total = pollutants.reduce((sum, p) => sum + p.count, 0);

          if (total > 0) {
            processed.push({
              state,
              lat: stateCoords[state][0],
              lon: stateCoords[state][1],
              pollutants: pollutants.sort((a, b) => b.count - a.count),
              total,
            });
          }
        });

        setStatePollutantData(processed);
      })
      .catch((err) => {
        console.error("Error loading state pollutant data:", err);
      });
  }, []);

  // Render animated wind arrows on map when Wind tab is active
  useEffect(() => {
    if (!windMapRef.current || windData.length === 0 || activeScatterIndex !== 2) return;

    const svgDoc = windMapRef.current.contentDocument;
    if (!svgDoc) return;

    // Style the map with light grey base
    const paths = svgDoc.querySelectorAll("path");
    paths.forEach((path) => {
      path.style.fill = "#e8e8e8";
      path.style.stroke = "#fff";
      path.style.strokeWidth = "0.5";
    });

    // Remove existing wind arrows and animations
    const existingArrows = svgDoc.querySelectorAll(".wind-arrow");
    existingArrows.forEach(a => a.remove());
    const existingDefs = svgDoc.querySelector("defs.wind-animations");
    if (existingDefs) existingDefs.remove();

    // Get SVG dimensions for coordinate conversion
    const svgElement = svgDoc.querySelector("svg");
    if (!svgElement) return;
    const viewBox = svgElement.getAttribute("viewBox")?.split(" ").map(Number) || [0, 0, 612, 696];
    const svgWidth = viewBox[2];
    const svgHeight = viewBox[3];

    // Lat/long bounds for India (approximate)
    const latMin = 6, latMax = 37;
    const lonMin = 68, lonMax = 98;

    // Add CSS animations via style element
    let styleEl = svgDoc.querySelector("style.wind-style");
    if (!styleEl) {
      styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.setAttribute("class", "wind-style");
      styleEl.textContent = `
        @keyframes pulseGust {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.15); }
        }
        @keyframes flowArrow {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes rotateRing {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 12; }
        }
        .wind-gust-ring {
          animation: pulseGust 2s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .wind-flow-line {
          stroke-dasharray: 5, 3;
          animation: flowArrow 0.8s linear infinite;
        }
        .wind-rotating-ring {
          animation: rotateRing 1.5s linear infinite;
        }
      `;
      svgElement.insertBefore(styleEl, svgElement.firstChild);
    }

    // Calculate speed and gust range for sizing
    const speeds = windData.map(d => d.speed);
    const gusts = windData.map(d => d.gust);
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);
    const maxGust = Math.max(...gusts);
    const minGust = Math.min(...gusts);

    // Add wind direction arrows for each city
    windData.forEach((cityData, idx) => {
      const { lat, lon, direction, speed, gust } = cityData;

      // Convert lat/lon to SVG coordinates
      const x = ((lon - lonMin) / (lonMax - lonMin)) * svgWidth;
      const y = ((latMax - lat) / (latMax - latMin)) * svgHeight;

      // Size based on wind speed (min 30, max 60)
      const speedIntensity = (speed - minSpeed) / (maxSpeed - minSpeed);
      const arrowLength = 30 + (speedIntensity * 30);

      // Gust ring size (min 15, max 35)
      const gustIntensity = (gust - minGust) / (maxGust - minGust);
      const gustRadius = 15 + (gustIntensity * 20);

      // Create arrow group
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "wind-arrow");
      g.setAttribute("transform", `translate(${x}, ${y}) rotate(${direction})`);

      // Animated gust ring (pulsing outer ring)
      const gustRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      gustRing.setAttribute("cx", 0);
      gustRing.setAttribute("cy", 0);
      gustRing.setAttribute("r", gustRadius);
      gustRing.setAttribute("fill", "#5699af");
      gustRing.setAttribute("fill-opacity", "0.2");
      gustRing.setAttribute("stroke", "#3d9bb2");
      gustRing.setAttribute("stroke-width", "1.5");
      gustRing.setAttribute("stroke-dasharray", "4,2");
      gustRing.setAttribute("class", "wind-gust-ring");
      gustRing.style.animationDelay = `${idx * 0.2}s`;

      // Animated rotating dashed ring
      const rotatingRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      rotatingRing.setAttribute("cx", 0);
      rotatingRing.setAttribute("cy", 0);
      rotatingRing.setAttribute("r", gustRadius * 0.7);
      rotatingRing.setAttribute("fill", "none");
      rotatingRing.setAttribute("stroke", "#5699af");
      rotatingRing.setAttribute("stroke-width", "1");
      rotatingRing.setAttribute("stroke-dasharray", "3,3");
      rotatingRing.setAttribute("class", "wind-rotating-ring");
      rotatingRing.style.animationDuration = `${1 + speedIntensity}s`;

      // Animated arrow line (flowing dashes)
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", 0);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", 0);
      line.setAttribute("y2", -arrowLength);
      line.setAttribute("stroke", "#3d9bb2");
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("class", "wind-flow-line");
      line.style.animationDuration = `${0.5 + (1 - speedIntensity) * 0.5}s`;

      // Static base line for visibility
      const baseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      baseLine.setAttribute("x1", 0);
      baseLine.setAttribute("y1", 0);
      baseLine.setAttribute("x2", 0);
      baseLine.setAttribute("y2", -arrowLength);
      baseLine.setAttribute("stroke", "#3d9bb2");
      baseLine.setAttribute("stroke-width", "1.5");
      baseLine.setAttribute("stroke-opacity", "0.4");
      baseLine.setAttribute("stroke-linecap", "round");

      // Arrow head
      const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const headSize = 8;
      arrowHead.setAttribute("points", `0,${-arrowLength - headSize} ${-headSize},${-arrowLength + headSize/2} ${headSize},${-arrowLength + headSize/2}`);
      arrowHead.setAttribute("fill", "#3d9bb2");

      // Circle at base
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", 0);
      circle.setAttribute("cy", 0);
      circle.setAttribute("r", 6);
      circle.setAttribute("fill", "#5699af");
      circle.setAttribute("stroke", "#3d7a91");
      circle.setAttribute("stroke-width", "1.5");

      g.appendChild(gustRing);
      g.appendChild(rotatingRing);
      g.appendChild(baseLine);
      g.appendChild(line);
      g.appendChild(arrowHead);
      g.appendChild(circle);
      svgElement.appendChild(g);
    });
  }, [windData, activeScatterIndex, windMapLoaded]);

  // Initialize Mapbox map for all visualization tabs (Population, Climate, Wind, Geography)
  useEffect(() => {
    // Only initialize when container is available
    if (!windMapboxContainerRef.current) return;

    // Don't reinitialize if map already exists
    if (windMapboxRef.current) {
      return;
    }

    // Create the map with grey terrain style
    const map = new mapboxgl.Map({
      container: windMapboxContainerRef.current,
      style: {
        version: 8,
        sources: {
          "raster-tiles": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            attribution: "Tiles &copy; Esri"
          }
        },
        layers: [
          {
            id: "simple-tiles",
            type: "raster",
            source: "raster-tiles",
            minzoom: 0,
            maxzoom: 22,
            paint: {
              "raster-saturation": -1, // Make it greyscale
              "raster-contrast": 0.1,
              "raster-brightness-min": 0.1,
              "raster-brightness-max": 0.9
            }
          }
        ]
      },
      center: [82, 22], // Center of India
      zoom: 4,
      minZoom: 3.5,
      maxZoom: 6,
      interactive: false, // Disable interactions for cleaner visualization
      attributionControl: false
    });

    windMapboxRef.current = map;

    map.on("load", () => {
      // Resize map to fit container
      map.resize();

      // Fit bounds to India
      map.fitBounds([
        [68, 6],   // Southwest corner (lon, lat)
        [98, 37]   // Northeast corner (lon, lat)
      ], {
        padding: 20,
        duration: 0
      });

      // Add India state boundaries from GeoJSON
      fetch("https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson")
        .then(response => response.json())
        .then(data => {
          map.addSource("india-states", {
            type: "geojson",
            data: data
          });

          // Add state boundary lines
          map.addLayer({
            id: "india-state-boundaries",
            type: "line",
            source: "india-states",
            paint: {
              "line-color": "#666",
              "line-width": 0.25,
              "line-opacity": 0.6
            }
          });

          // Add subtle fill for states
          map.addLayer({
            id: "india-state-fill",
            type: "fill",
            source: "india-states",
            paint: {
              "fill-color": "#fff",
              "fill-opacity": 0.1
            }
          }, "india-state-boundaries");
        })
        .catch(err => console.error("Error loading India states GeoJSON:", err));

      // Add disputed territories (Jammu & Kashmir, Ladakh with Aksai Chin, Arunachal Pradesh claim line)
      const disputedBoundaries = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Line of Control (LoC)" },
            geometry: {
              type: "LineString",
              coordinates: [
                [73.5, 32.5], [74.0, 33.0], [74.5, 33.5], [75.0, 34.0], [75.5, 34.5],
                [76.0, 35.0], [76.5, 35.3], [77.0, 35.5], [77.8, 35.5]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "Line of Actual Control (LAC) - Aksai Chin" },
            geometry: {
              type: "LineString",
              coordinates: [
                [77.8, 35.5], [78.5, 35.2], [79.0, 34.8], [79.5, 34.5], [80.0, 34.0],
                [80.2, 33.5], [80.0, 33.0], [79.5, 32.5], [79.0, 32.0], [78.8, 31.5]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "India Claimed Boundary - North" },
            geometry: {
              type: "LineString",
              coordinates: [
                [73.5, 36.9], [74.5, 36.8], [75.5, 36.5], [76.5, 36.2], [77.5, 36.0],
                [78.5, 35.8], [79.5, 35.5], [80.5, 35.0], [80.2, 33.5]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "McMahon Line - Arunachal Pradesh" },
            geometry: {
              type: "LineString",
              coordinates: [
                [91.5, 28.0], [92.0, 28.2], [92.5, 28.3], [93.0, 28.5], [93.5, 28.3],
                [94.0, 28.5], [94.5, 28.7], [95.0, 28.5], [96.0, 28.2], [97.0, 28.0]
              ]
            }
          }
        ]
      };

      map.addSource("disputed-boundaries", {
        type: "geojson",
        data: disputedBoundaries
      });

      // Add disputed boundary lines (dashed)
      map.addLayer({
        id: "disputed-boundary-lines",
        type: "line",
        source: "disputed-boundaries",
        paint: {
          "line-color": "#888",
          "line-width": 1,
          "line-opacity": 0.7,
          "line-dasharray": [3, 2]
        }
      });

      // Add Himalayan mountain range label (hidden by default, shown only for Geography)
      const himalayaLabel = document.createElement("div");
      himalayaLabel.className = "himalaya-label";
      himalayaLabel.style.cssText = `
        font-family: Avenir, 'Avenir Next', Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: #555;
        letter-spacing: 3px;
        text-transform: uppercase;
        white-space: nowrap;
        transform: rotate(-8deg);
        text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s ease;
      `;
      himalayaLabel.textContent = "Himalayan Mountain Range";
      new mapboxgl.Marker({ element: himalayaLabel, anchor: "center" })
        .setLngLat([82, 30.5])
        .addTo(map);
      map._himalayaLabel = himalayaLabel;

      // Add wind speed legend
      const legendContainer = document.createElement("div");
      legendContainer.className = "wind-legend";
      legendContainer.style.cssText = `
        position: absolute;
        bottom: 15px;
        right: 15px;
        background: rgba(255, 255, 255, 0.95);
        padding: 12px 15px;
        border-radius: 6px;
        font-family: Avenir, 'Avenir Next', Helvetica, Arial, sans-serif;
        font-size: 11px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 10;
        display: none;
      `;
      legendContainer.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 6px; color: #333;">Wind Speed</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <div style="width: 20px; height: 3px; background: #c1616b; border-radius: 2px;"></div>
          <span style="color: #666;">Slow</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <div style="width: 20px; height: 3px; background: #de9eaf; border-radius: 2px;"></div>
          <span style="color: #666;">Moderate</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <div style="width: 20px; height: 3px; background: #87beb1; border-radius: 2px;"></div>
          <span style="color: #666;">Fast</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 20px; height: 3px; background: #5699af; border-radius: 2px;"></div>
          <span style="color: #666;">Very Fast</span>
        </div>
      `;
      map.getContainer().appendChild(legendContainer);
      map._windLegend = legendContainer;

      // Create animated wind flow canvas overlay (for Wind and Geography sections)
      if (windData.length > 0 && (activeScatterIndex === 2 || activeScatterIndex === 3)) {
        const canvas = document.createElement("canvas");
        canvas.id = "wind-canvas";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.width = "100%";
        canvas.style.height = "100%";

        const container = map.getContainer();
        canvas.width = container.offsetWidth * 2;
        canvas.height = container.offsetHeight * 2;
        canvas.style.width = container.offsetWidth + "px";
        canvas.style.height = container.offsetHeight + "px";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        ctx.scale(2, 2);

        const speeds = windData.map(d => d.speed);
        const gusts = windData.map(d => d.gust);
        const maxSpeed = Math.max(...speeds);
        const minSpeed = Math.min(...speeds);
        const maxGust = Math.max(...gusts);
        const minGust = Math.min(...gusts);

        // Color scale based on wind speed (pink for slow, blue for fast)
        const getSpeedColor = (speed, alpha) => {
          const intensity = (speed - minSpeed) / (maxSpeed - minSpeed);
          if (intensity < 0.25) return `rgba(193, 97, 107, ${alpha})`;      // Red/Pink - slowest
          if (intensity < 0.5) return `rgba(222, 158, 175, ${alpha})`;      // Light pink
          if (intensity < 0.75) return `rgba(135, 190, 177, ${alpha})`;     // Teal
          return `rgba(86, 153, 175, ${alpha})`;                             // Blue - fastest
        };

        // Get wind at geographic position by interpolating from cities
        const getWindAtPosition = (lng, lat) => {
          let totalWeight = 0;
          let dirX = 0, dirY = 0, speed = 0, gust = 0;

          windData.forEach(city => {
            const dx = lng - city.lon;
            const dy = lat - city.lat;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (dist * dist + 0.5);

            const rad = (city.direction - 90) * Math.PI / 180;
            dirX += Math.cos(rad) * weight;
            dirY += Math.sin(rad) * weight;
            speed += city.speed * weight;
            gust += city.gust * weight;
            totalWeight += weight;
          });

          return {
            dx: dirX / totalWeight,
            dy: dirY / totalWeight,
            speed: speed / totalWeight,
            gust: gust / totalWeight
          };
        };

        // Spawn particle near a city (in geographic coordinates)
        const spawnParticle = () => {
          const city = windData[Math.floor(Math.random() * windData.length)];
          return {
            lng: city.lon + (Math.random() - 0.5) * 8,
            lat: city.lat + (Math.random() - 0.5) * 8,
            age: 0,
            maxAge: 80 + Math.random() * 120,
            trail: []
          };
        };

        // Create particles in geographic coordinates
        const numParticles = 1200;
        const particles = [];
        for (let i = 0; i < numParticles; i++) {
          particles.push(spawnParticle());
        }

        // Animation loop
        let animationId;
        const animate = () => {
          ctx.clearRect(0, 0, container.offsetWidth, container.offsetHeight);

          const bounds = map.getBounds();
          const visibleMinLng = bounds.getWest();
          const visibleMaxLng = bounds.getEast();
          const visibleMinLat = bounds.getSouth();
          const visibleMaxLat = bounds.getNorth();

          particles.forEach(p => {
            // Get wind at current position
            const wind = getWindAtPosition(p.lng, p.lat);
            const speedFactor = (wind.speed - minSpeed) / (maxSpeed - minSpeed);

            // Move in geographic space (scale by zoom-independent amount)
            const moveScale = 0.015 + speedFactor * 0.025;
            p.lng += wind.dx * moveScale;
            p.lat -= wind.dy * moveScale; // Negative because lat increases northward

            // Convert to screen coordinates
            const screenPos = map.project([p.lng, p.lat]);

            // Store trail in screen coordinates
            if (!p.trail) p.trail = [];
            p.trail.push({ x: screenPos.x, y: screenPos.y });
            if (p.trail.length > 15) p.trail.shift();

            // Check if visible
            const isVisible = p.lng >= visibleMinLng && p.lng <= visibleMaxLng &&
                             p.lat >= visibleMinLat && p.lat <= visibleMaxLat;

            if (isVisible && p.trail.length > 1) {
              const baseAlpha = Math.min(0.7, (p.maxAge - p.age) / 40, p.age / 10);
              ctx.lineWidth = 1 + speedFactor * 0.8;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";

              // Draw trail
              for (let i = 1; i < p.trail.length; i++) {
                const alpha = baseAlpha * (i / p.trail.length);
                ctx.strokeStyle = getSpeedColor(wind.speed, alpha);
                ctx.beginPath();
                ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
                ctx.lineTo(p.trail[i].x, p.trail[i].y);
                ctx.stroke();
              }
            }

            p.age++;

            // Respawn if too old or out of India bounds
            const outOfBounds = p.lng < 68 || p.lng > 98 || p.lat < 6 || p.lat > 37;
            if (p.age > p.maxAge || outOfBounds) {
              const newP = spawnParticle();
              p.lng = newP.lng; p.lat = newP.lat;
              p.age = 0; p.maxAge = newP.maxAge; p.trail = [];
            }
          });

          animationId = requestAnimationFrame(animate);
        };

        animate();

        map._windAnimationId = animationId;
        map._windCanvas = canvas;
      }
    });

    // Cleanup - only on unmount, not when switching between Wind/Geography
  }, [activeScatterIndex, windData]);

  // Show/hide Himalayan label based on active section
  useEffect(() => {
    const showHideLabel = () => {
      if (!windMapboxRef.current || !windMapboxRef.current._himalayaLabel) return;

      const label = windMapboxRef.current._himalayaLabel;
      if (activeScatterIndex === 3) {
        // Show label for Geography section
        label.style.opacity = "1";
      } else {
        // Hide label for other sections
        label.style.opacity = "0";
      }
    };

    // Try immediately and also with a delay (in case map is still loading)
    showHideLabel();
    const timeoutId = setTimeout(showHideLabel, 500);

    return () => clearTimeout(timeoutId);
  }, [activeScatterIndex]);

  // Create/destroy wind canvas when switching to/from Wind and Geography tabs
  useEffect(() => {
    const map = windMapboxRef.current;
    if (!map || !map.loaded() || windData.length === 0) return;

    const shouldShowWind = activeScatterIndex === 2 || activeScatterIndex === 3;

    // If we should show wind and canvas doesn't exist, create it
    if (shouldShowWind && !map._windCanvas) {
      const canvas = document.createElement("canvas");
      canvas.id = "wind-canvas";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const container = map.getContainer();
      canvas.width = container.offsetWidth * 2;
      canvas.height = container.offsetHeight * 2;
      canvas.style.width = container.offsetWidth + "px";
      canvas.style.height = container.offsetHeight + "px";
      container.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);

      const speeds = windData.map(d => d.speed);
      const maxSpeed = Math.max(...speeds);
      const minSpeed = Math.min(...speeds);

      const getSpeedColor = (speed, alpha) => {
        const intensity = (speed - minSpeed) / (maxSpeed - minSpeed || 1);
        if (intensity < 0.25) return `rgba(193, 97, 107, ${alpha})`;
        if (intensity < 0.5) return `rgba(222, 158, 175, ${alpha})`;
        if (intensity < 0.75) return `rgba(135, 190, 177, ${alpha})`;
        return `rgba(86, 153, 175, ${alpha})`;
      };

      const getWindAtPosition = (lng, lat) => {
        let totalWeight = 0;
        let dirX = 0, dirY = 0, speed = 0;

        windData.forEach(city => {
          const dx = lng - city.lon;
          const dy = lat - city.lat;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const weight = 1 / (dist * dist + 0.5);

          const rad = (city.direction - 90) * Math.PI / 180;
          dirX += Math.cos(rad) * weight;
          dirY += Math.sin(rad) * weight;
          speed += city.speed * weight;
          totalWeight += weight;
        });

        return { dx: dirX / totalWeight, dy: dirY / totalWeight, speed: speed / totalWeight };
      };

      const spawnParticle = () => {
        const city = windData[Math.floor(Math.random() * windData.length)];
        return {
          lng: city.lon + (Math.random() - 0.5) * 8,
          lat: city.lat + (Math.random() - 0.5) * 8,
          age: 0,
          maxAge: 80 + Math.random() * 120,
          trail: []
        };
      };

      const particles = [];
      for (let i = 0; i < 1200; i++) {
        particles.push(spawnParticle());
      }

      const animate = () => {
        ctx.clearRect(0, 0, container.offsetWidth, container.offsetHeight);

        const bounds = map.getBounds();
        const visibleMinLng = bounds.getWest();
        const visibleMaxLng = bounds.getEast();
        const visibleMinLat = bounds.getSouth();
        const visibleMaxLat = bounds.getNorth();

        particles.forEach(p => {
          const wind = getWindAtPosition(p.lng, p.lat);
          const speedFactor = (wind.speed - minSpeed) / (maxSpeed - minSpeed || 1);

          const moveScale = 0.015 + speedFactor * 0.025;
          p.lng += wind.dx * moveScale;
          p.lat -= wind.dy * moveScale;

          const screenPos = map.project([p.lng, p.lat]);

          if (!p.trail) p.trail = [];
          p.trail.push({ x: screenPos.x, y: screenPos.y });
          if (p.trail.length > 15) p.trail.shift();

          const isVisible = p.lng >= visibleMinLng && p.lng <= visibleMaxLng &&
                           p.lat >= visibleMinLat && p.lat <= visibleMaxLat;

          if (isVisible && p.trail.length > 1) {
            const baseAlpha = Math.min(0.7, (p.maxAge - p.age) / 40, p.age / 10);
            ctx.lineWidth = 1 + speedFactor * 0.8;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (let i = 1; i < p.trail.length; i++) {
              const alpha = baseAlpha * (i / p.trail.length);
              ctx.strokeStyle = getSpeedColor(wind.speed, alpha);
              ctx.beginPath();
              ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
              ctx.lineTo(p.trail[i].x, p.trail[i].y);
              ctx.stroke();
            }
          }

          p.age++;

          const outOfBounds = p.lng < 68 || p.lng > 98 || p.lat < 6 || p.lat > 37;
          if (p.age > p.maxAge || outOfBounds) {
            const newP = spawnParticle();
            p.lng = newP.lng; p.lat = newP.lat;
            p.age = 0; p.maxAge = newP.maxAge; p.trail = [];
          }
        });

        map._windAnimationId = requestAnimationFrame(animate);
      };

      animate();
      map._windCanvas = canvas;
    }

    // If we shouldn't show wind and canvas exists, destroy it
    if (!shouldShowWind && map._windCanvas) {
      if (map._windAnimationId) {
        cancelAnimationFrame(map._windAnimationId);
        map._windAnimationId = null;
      }
      map._windCanvas.remove();
      map._windCanvas = null;
    }

    // Show/hide wind legend
    if (map._windLegend) {
      map._windLegend.style.display = shouldShowWind ? "block" : "none";
    }
  }, [activeScatterIndex, windData]);

  // Separate cleanup effect for component unmount only
  useEffect(() => {
    return () => {
      if (windMapboxRef.current) {
        if (windMapboxRef.current._windAnimationId) {
          cancelAnimationFrame(windMapboxRef.current._windAnimationId);
        }
        if (windMapboxRef.current._windCanvas) {
          windMapboxRef.current._windCanvas.remove();
        }
        windMapboxRef.current.remove();
        windMapboxRef.current = null;
      }
    };
  }, []);

  // Wind and Geography sections now show the same view - no zoom effect needed

  // Render rainfall bubbles on map using state-level rainfall data from populationData
  useEffect(() => {
    if (!rainfallMapRef.current || populationData.length === 0) return;

    const svgDoc = rainfallMapRef.current.contentDocument;
    if (!svgDoc) return;

    // State coordinates for rainfall bubbles
    const stateCoords = {
      "Andaman and Nicobar Islands": [11.7401, 92.6586],
      "Andhra Pradesh": [15.9129, 79.7400],
      "Arunachal Pradesh": [28.2180, 94.7278],
      "Assam": [26.2006, 92.9376],
      "Bihar": [25.0961, 85.3131],
      "Chandigarh": [30.7333, 76.7794],
      "Chhattisgarh": [21.2787, 81.8661],
      "Delhi": [28.7041, 77.1025],
      "Goa": [15.2993, 74.1240],
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

    // Style the map with light grey base
    const paths = svgDoc.querySelectorAll("path");
    paths.forEach((path) => {
      path.style.fill = "#e8e8e8";
      path.style.stroke = "#fff";
      path.style.strokeWidth = "0.5";
    });

    // Remove existing rainfall circles
    const existingCircles = svgDoc.querySelectorAll(".rainfall-circle");
    existingCircles.forEach(c => c.remove());

    // Filter states with rainfall data
    const statesWithRainfall = populationData.filter(d => d.rainfall > 0);
    if (statesWithRainfall.length === 0) return;

    // Calculate rainfall range for sizing
    const rainfallValues = statesWithRainfall.map(d => d.rainfall);
    const maxRainfall = Math.max(...rainfallValues);
    const minRainfall = Math.min(...rainfallValues);

    // Get SVG dimensions for coordinate conversion
    const svgElement = svgDoc.querySelector("svg");
    if (!svgElement) return;

    const viewBox = svgElement.getAttribute("viewBox")?.split(" ").map(Number) || [0, 0, 600, 700];
    const svgWidth = viewBox[2];
    const svgHeight = viewBox[3];

    // Lat/long bounds for India (approximate)
    const latMin = 6, latMax = 37;
    const lonMin = 68, lonMax = 98;

    // Add rainfall bubbles for each state
    statesWithRainfall.forEach((stateData) => {
      const coords = stateCoords[stateData.state];
      if (!coords) return;

      const [lat, lon] = coords;

      // Convert lat/lon to SVG coordinates
      const x = ((lon - lonMin) / (lonMax - lonMin)) * svgWidth;
      const y = ((latMax - lat) / (latMax - latMin)) * svgHeight;

      // Size based on rainfall (min 8, max 35)
      const rainfallIntensity = (stateData.rainfall - minRainfall) / (maxRainfall - minRainfall);
      const radius = 8 + (rainfallIntensity * 27);

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", "#5699af");
      circle.setAttribute("fill-opacity", "0.7");
      circle.setAttribute("stroke", "#3d7a91");
      circle.setAttribute("stroke-width", "1");
      circle.setAttribute("class", "rainfall-circle");

      svgElement.appendChild(circle);
    });
  }, [populationData]);

  // Intersection Observer to track which state is in view
  useEffect(() => {
    if (stateData.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.index);
            setActiveStateIndex(index);
          }
        });
      },
      {
        root: null,
        rootMargin: "-200px 0px -40% 0px",
        threshold: 0,
      }
    );

    stateRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [stateData, viewMode]);

  // Observer for image expansion animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setImageExpanded(true);
          } else if (entry.isIntersecting) {
            setImageExpanded(false);
          }
        });
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px",
      }
    );

    if (introRef.current) {
      observer.observe(introRef.current);
    }

    return () => observer.disconnect();
  }, [loading]);

  // Scroll listener for colorizing images progressively
  useEffect(() => {
    const handleScroll = () => {
      if (!imagesSectionRef.current || !imageExpanded) {
        setColorizedCount(0);
        return;
      }

      // Get the outer scroll container (the tall wrapper)
      const scrollContainer = imagesSectionRef.current;
      const rect = scrollContainer.getBoundingClientRect();

      // Calculate how far we've scrolled through the container
      // Progress goes from 0 (container just entering view) to 1 (container leaving view)
      const containerHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // When top of container is at bottom of viewport: progress = 0
      // When bottom of container is at top of viewport: progress = 1
      const scrollProgress = (viewportHeight - rect.top) / (containerHeight);

      // Map scroll progress to colorization stages
      // 0-45%: all grey, 45-55%: 1st colors, 55-70%: 2nd colors, 70%+: 3rd colors
      if (scrollProgress < 0.45) {
        setColorizedCount(0);
      } else if (scrollProgress < 0.55) {
        setColorizedCount(1);
      } else if (scrollProgress < 0.70) {
        setColorizedCount(2);
      } else {
        setColorizedCount(3);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [imageExpanded]);

  // Scroll listener for timeline - handles sequential year highlighting
  // highlightSequence defined at module level for use in both scroll handler and render
  const highlightSequence = [1981, 1986, 1994, 1998, 2009, 2014, 2016, 2018, 2019, 2024];

  useEffect(() => {
    const handleTimelineScroll = () => {
      if (!timelineScrollRef.current) return;

      const viewportHeight = window.innerHeight;
      const scrollRect = timelineScrollRef.current.getBoundingClientRect();
      const scrollProgress = (viewportHeight - scrollRect.top) / scrollRect.height;

      // Divide scroll range into segments for each year
      // Leave space after 2024 for exploration phase
      const startProgress = 0.15;
      const endProgress = 0.75;
      const explorationStart = 0.82; // After this, enter exploration phase (no auto-popup)
      const totalRange = endProgress - startProgress;
      const segmentSize = totalRange / highlightSequence.length;

      let indexToHighlight = -1;
      for (let i = 0; i < highlightSequence.length; i++) {
        const segmentStart = startProgress + (i * segmentSize);
        if (scrollProgress >= segmentStart) {
          indexToHighlight = i;
        }
      }

      setHighlightedYearIndex(indexToHighlight);
      setIsExplorationPhase(scrollProgress >= explorationStart);
    };

    window.addEventListener("scroll", handleTimelineScroll);
    handleTimelineScroll();

    return () => {
      window.removeEventListener("scroll", handleTimelineScroll);
    };
  }, [highlightSequence]);

  // Scroll listener for Delhi/Six Cities map sections
  useEffect(() => {

    const handleMapScroll = () => {
      if (!delhiTextRef.current || !sixCitiesTextRef.current) return;

      const viewportCenter = window.innerHeight / 2;
      const sixCitiesRect = sixCitiesTextRef.current.getBoundingClientRect();

      // Determine active section based on which section has scrolled past the trigger point
      if (sixCitiesRect.top < viewportCenter) {
        setActiveMapIndex(1);
      } else {
        setActiveMapIndex(0);
      }
    };

    window.addEventListener("scroll", handleMapScroll);
    handleMapScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleMapScroll);
  }, []);

  // Weather section scroll handler
  useEffect(() => {

    const handleWeatherScroll = () => {
      if (!weatherText1Ref.current || !weatherText2Ref.current) return;

      const viewportCenter = window.innerHeight / 2;
      const text2Rect = weatherText2Ref.current.getBoundingClientRect();

      // Switch to wind map when second text section is in view
      if (text2Rect.top < viewportCenter) {
        setActiveWeatherMapIndex(1);
      } else {
        setActiveWeatherMapIndex(0);
      }
    };

    window.addEventListener("scroll", handleWeatherScroll);
    handleWeatherScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleWeatherScroll);
  }, []);

  // Population/Rainfall/Wind section scroll handler
  useEffect(() => {
    const handlePopRainfallScroll = () => {
      if (!populationTextRef.current || !rainfallTextRef.current) return;

      const viewportCenter = window.innerHeight / 2;
      const rainfallRect = rainfallTextRef.current.getBoundingClientRect();
      const windRect = windTextRef.current?.getBoundingClientRect();

      // Switch between maps based on which text section is in view
      if (windRect && windRect.top < viewportCenter) {
        setActivePopRainfallIndex(2); // Wind map
      } else if (rainfallRect.top < viewportCenter) {
        setActivePopRainfallIndex(1); // Rainfall map
      } else {
        setActivePopRainfallIndex(0); // Population map
      }
    };

    window.addEventListener("scroll", handlePopRainfallScroll);
    handlePopRainfallScroll(); // Initial check

    return () => window.removeEventListener("scroll", handlePopRainfallScroll);
  }, []);

  // Map morph transition scroll handler - small map to large map
  useEffect(() => {
    const handleMapMorphScroll = () => {
      if (!gridSectionRef.current || !populationTextRef.current) return;

      const gridRect = gridSectionRef.current.getBoundingClientRect();
      const popRect = populationTextRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate transition based on distance between grid bottom and population section top
      const gridBottom = gridRect.bottom;
      const popTop = popRect.top;

      // Fast transition - narrow scroll range
      const startThreshold = viewportHeight * 0.55;
      const endThreshold = viewportHeight * 0.45;

      if (gridBottom > startThreshold) {
        // Grid section still mostly in view - no transition yet
        setMapMorphProgress(0);
      } else if (popTop < endThreshold) {
        // Population section is in view - transition complete
        setMapMorphProgress(1);
      } else {
        // In transition zone - direct linear interpolation for fast response
        const totalDistance = startThreshold - endThreshold;
        const currentPosition = startThreshold - gridBottom;
        const progress = currentPosition / totalDistance;
        setMapMorphProgress(Math.max(0, Math.min(1, progress)));
      }
    };

    window.addEventListener("scroll", handleMapMorphScroll);
    handleMapMorphScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleMapMorphScroll);
  }, []);

  // Pollutant section scroll handler
  useEffect(() => {

    const handlePollutantScroll = () => {
      if (!pollutantRefs.current || pollutantRefs.current.length === 0) return;

      const viewportCenter = window.innerHeight / 2;
      let newIndex = 0;

      for (let i = 0; i < pollutantRefs.current.length; i++) {
        const ref = pollutantRefs.current[i];
        if (ref) {
          const rect = ref.getBoundingClientRect();
          if (rect.top < viewportCenter) {
            newIndex = i;
          }
        }
      }

      setActivePollutantIndex(newIndex);
    };

    window.addEventListener("scroll", handlePollutantScroll);
    handlePollutantScroll(); // Initial check

    return () => window.removeEventListener("scroll", handlePollutantScroll);
  }, []);

  // Scatter plot section scroll handler
  useEffect(() => {
    const handleScatterScroll = () => {
      if (!scatterTextRefs.current || scatterTextRefs.current.length === 0) return;

      const viewportCenter = window.innerHeight / 2;
      let newIndex = 0;

      for (let i = 0; i < scatterTextRefs.current.length; i++) {
        const ref = scatterTextRefs.current[i];
        if (ref) {
          const rect = ref.getBoundingClientRect();
          if (rect.top < viewportCenter) {
            newIndex = i;
          }
        }
      }

      setActiveScatterIndex(newIndex);
    };

    window.addEventListener("scroll", handleScatterScroll);
    handleScatterScroll();

    return () => window.removeEventListener("scroll", handleScatterScroll);
  }, []);

  // Sources of pollution scroll handler - track which card is in view
  const sourceCardRefs = useRef([]);

  useEffect(() => {
    const handleSourcesScroll = () => {
      if (!sourcesScrollRef.current) return;

      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;

      // Count how many source cards have their top above viewport center
      let visibleCount = 0;
      sourceCardRefs.current.forEach((cardEl) => {
        if (cardEl) {
          const cardRect = cardEl.getBoundingClientRect();
          if (cardRect.top < viewportCenter) {
            visibleCount++;
          }
        }
      });

      setVisibleSources(visibleCount);
    };

    window.addEventListener("scroll", handleSourcesScroll);
    handleSourcesScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleSourcesScroll);
  }, []);

  // GSAP Cycling animation scroll handler
  const cyclistRef = useRef(null);
  const backWheelRef = useRef(null);
  const frontWheelRef = useRef(null);
  const pedalsRef = useRef(null);
  // Cyclist leg 1 segments
  const leg1ThighRef = useRef(null);
  const leg1ShinRef = useRef(null);
  const leg1FootRef = useRef(null);
  // Cyclist leg 2 segments
  const leg2ThighRef = useRef(null);
  const leg2ShinRef = useRef(null);
  const leg2FootRef = useRef(null);
  const progressTextRef = useRef(null);
  // Walking man refs
  const walkerRef = useRef(null);
  // Walker leg 1 segments
  const walkerLeg1ThighRef = useRef(null);
  const walkerLeg1ShinRef = useRef(null);
  const walkerLeg1FootRef = useRef(null);
  // Walker leg 2 segments
  const walkerLeg2ThighRef = useRef(null);
  const walkerLeg2ShinRef = useRef(null);
  const walkerLeg2FootRef = useRef(null);
  // Walker arms
  const walkerArm1Ref = useRef(null);
  const walkerArm2Ref = useRef(null);

  // Function to calculate leg joint positions using inverse kinematics
  const calculateLegPositions = (pedalAngle, hipX, hipY, pedalCenterX, pedalCenterY, crankLength, thighLength, shinLength) => {
    // Convert angle to radians (negate for forward pedaling direction)
    const angleRad = (-pedalAngle * Math.PI) / 180;

    // Calculate foot/pedal position
    const footX = pedalCenterX + crankLength * Math.sin(angleRad);
    const footY = pedalCenterY + crankLength * Math.cos(angleRad);

    // Calculate distance from hip to foot
    const dx = footX - hipX;
    const dy = footY - hipY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp distance to valid range for the leg
    const maxDist = thighLength + shinLength - 1;
    const minDist = Math.abs(thighLength - shinLength) + 1;
    const clampedDist = Math.max(minDist, Math.min(maxDist, dist));

    // Use law of cosines to find knee angle
    const cosKneeAngle = (thighLength * thighLength + shinLength * shinLength - clampedDist * clampedDist) / (2 * thighLength * shinLength);
    const kneeAngle = Math.acos(Math.max(-1, Math.min(1, cosKneeAngle)));

    // Find angle from hip to foot
    const hipToFootAngle = Math.atan2(dx, dy);

    // Find angle offset for knee position
    const cosOffset = (thighLength * thighLength + clampedDist * clampedDist - shinLength * shinLength) / (2 * thighLength * clampedDist);
    const offset = Math.acos(Math.max(-1, Math.min(1, cosOffset)));

    // Calculate knee position (knee bends forward/right)
    const kneeX = hipX + thighLength * Math.sin(hipToFootAngle + offset);
    const kneeY = hipY + thighLength * Math.cos(hipToFootAngle + offset);

    return { hipX, hipY, kneeX, kneeY, footX, footY };
  };

  // Function to calculate walking leg positions
  const calculateWalkingLegPositions = (swingAngle, hipX, hipY, thighLength, shinLength) => {
    // Convert swing angle to radians
    const angleRad = (swingAngle * Math.PI) / 180;

    // Thigh swings from hip
    const kneeX = hipX + thighLength * Math.sin(angleRad);
    const kneeY = hipY + thighLength * Math.cos(angleRad * 0.3 + 0.1); // Slight vertical movement

    // Shin hangs from knee with slight bend
    const shinAngle = angleRad * 0.5; // Shin follows but with less angle
    const footX = kneeX + shinLength * Math.sin(shinAngle);
    const footY = kneeY + shinLength * Math.cos(Math.abs(angleRad) * 0.2);

    return { hipX, hipY, kneeX, kneeY, footX, footY };
  };

  useEffect(() => {
    // Wait for refs to be available
    const timer = setTimeout(() => {
      if (!cyclingRef.current || !cyclistRef.current) return;

      // Create ScrollTrigger for the cycling section
      // Only activates when the section enters the viewport
      const scrollTrigger = ScrollTrigger.create({
        trigger: cyclingRef.current,
        start: "top top",  // Start when top of section reaches top of viewport
        end: "bottom bottom", // End when bottom of section reaches bottom of viewport
        scrub: 0.5,
        // markers: true, // Debug markers disabled
        onUpdate: (self) => {
          // Only animate if we're actually in the section
          if (!self.isActive) return;

          const progress = self.progress;
          setCyclingProgress(progress);

          // Animate cyclist position
          if (cyclistRef.current) {
            gsap.set(cyclistRef.current, {
              left: `${5 + progress * 85}%`
            });
          }

          // Animate wheel rotations (wheels at 45,200 and 155,200 in new SVG)
          const rotation = progress * 1440;
          if (backWheelRef.current) {
            gsap.set(backWheelRef.current, {
              rotation: rotation,
              svgOrigin: "45 200"
            });
          }
          if (frontWheelRef.current) {
            gsap.set(frontWheelRef.current, {
              rotation: rotation,
              svgOrigin: "155 200"
            });
          }

          // Animate pedals (chainring at 85,200)
          if (pedalsRef.current) {
            gsap.set(pedalsRef.current, {
              rotation: rotation,
              svgOrigin: "85 200"
            });
          }

          // Animate legs with inverse kinematics
          // Leg geometry constants
          const hipX = 95;    // Hip position X
          const hipY = 145;   // Hip position Y
          const pedalCenterX = 85;
          const pedalCenterY = 200;
          const crankLength = 18;
          const thighLength = 35;
          const shinLength = 40;

          // Leg 1 (follows pedal directly)
          const leg1Angle = rotation;
          const leg1Pos = calculateLegPositions(leg1Angle, hipX, hipY, pedalCenterX, pedalCenterY, crankLength, thighLength, shinLength);

          if (leg1ThighRef.current) {
            leg1ThighRef.current.setAttribute('x1', leg1Pos.hipX);
            leg1ThighRef.current.setAttribute('y1', leg1Pos.hipY);
            leg1ThighRef.current.setAttribute('x2', leg1Pos.kneeX);
            leg1ThighRef.current.setAttribute('y2', leg1Pos.kneeY);
          }
          if (leg1ShinRef.current) {
            leg1ShinRef.current.setAttribute('x1', leg1Pos.kneeX);
            leg1ShinRef.current.setAttribute('y1', leg1Pos.kneeY);
            leg1ShinRef.current.setAttribute('x2', leg1Pos.footX);
            leg1ShinRef.current.setAttribute('y2', leg1Pos.footY);
          }
          if (leg1FootRef.current) {
            leg1FootRef.current.setAttribute('cx', leg1Pos.footX);
            leg1FootRef.current.setAttribute('cy', leg1Pos.footY + 4);
          }

          // Leg 2 (180 degrees offset from leg 1)
          const leg2Angle = rotation + 180;
          const leg2Pos = calculateLegPositions(leg2Angle, hipX, hipY, pedalCenterX, pedalCenterY, crankLength, thighLength, shinLength);

          if (leg2ThighRef.current) {
            leg2ThighRef.current.setAttribute('x1', leg2Pos.hipX);
            leg2ThighRef.current.setAttribute('y1', leg2Pos.hipY);
            leg2ThighRef.current.setAttribute('x2', leg2Pos.kneeX);
            leg2ThighRef.current.setAttribute('y2', leg2Pos.kneeY);
          }
          if (leg2ShinRef.current) {
            leg2ShinRef.current.setAttribute('x1', leg2Pos.kneeX);
            leg2ShinRef.current.setAttribute('y1', leg2Pos.kneeY);
            leg2ShinRef.current.setAttribute('x2', leg2Pos.footX);
            leg2ShinRef.current.setAttribute('y2', leg2Pos.footY);
          }
          if (leg2FootRef.current) {
            leg2FootRef.current.setAttribute('cx', leg2Pos.footX);
            leg2FootRef.current.setAttribute('cy', leg2Pos.footY + 4);
          }

          // Animate walking man - moves much slower than cyclist
          if (walkerRef.current) {
            gsap.set(walkerRef.current, {
              left: `${20 + progress * 25}%`
            });
          }

          // Walking leg animation with inverse kinematics
          const walkCycle = Math.sin(progress * Math.PI * 6) * 25; // Slower oscillating walk angle
          const walkerHipX = 25;
          const walkerHipY = 50;
          const walkerThighLength = 18;
          const walkerShinLength = 17;

          // Leg 1 position
          const walkerLeg1Pos = calculateWalkingLegPositions(walkCycle, walkerHipX, walkerHipY, walkerThighLength, walkerShinLength);
          if (walkerLeg1ThighRef.current) {
            walkerLeg1ThighRef.current.setAttribute('x1', walkerLeg1Pos.hipX);
            walkerLeg1ThighRef.current.setAttribute('y1', walkerLeg1Pos.hipY);
            walkerLeg1ThighRef.current.setAttribute('x2', walkerLeg1Pos.kneeX);
            walkerLeg1ThighRef.current.setAttribute('y2', walkerLeg1Pos.kneeY);
          }
          if (walkerLeg1ShinRef.current) {
            walkerLeg1ShinRef.current.setAttribute('x1', walkerLeg1Pos.kneeX);
            walkerLeg1ShinRef.current.setAttribute('y1', walkerLeg1Pos.kneeY);
            walkerLeg1ShinRef.current.setAttribute('x2', walkerLeg1Pos.footX);
            walkerLeg1ShinRef.current.setAttribute('y2', walkerLeg1Pos.footY);
          }
          if (walkerLeg1FootRef.current) {
            walkerLeg1FootRef.current.setAttribute('cx', walkerLeg1Pos.footX);
            walkerLeg1FootRef.current.setAttribute('cy', walkerLeg1Pos.footY + 3);
          }

          // Leg 2 position (opposite swing)
          const walkerLeg2Pos = calculateWalkingLegPositions(-walkCycle, walkerHipX, walkerHipY, walkerThighLength, walkerShinLength);
          if (walkerLeg2ThighRef.current) {
            walkerLeg2ThighRef.current.setAttribute('x1', walkerLeg2Pos.hipX);
            walkerLeg2ThighRef.current.setAttribute('y1', walkerLeg2Pos.hipY);
            walkerLeg2ThighRef.current.setAttribute('x2', walkerLeg2Pos.kneeX);
            walkerLeg2ThighRef.current.setAttribute('y2', walkerLeg2Pos.kneeY);
          }
          if (walkerLeg2ShinRef.current) {
            walkerLeg2ShinRef.current.setAttribute('x1', walkerLeg2Pos.kneeX);
            walkerLeg2ShinRef.current.setAttribute('y1', walkerLeg2Pos.kneeY);
            walkerLeg2ShinRef.current.setAttribute('x2', walkerLeg2Pos.footX);
            walkerLeg2ShinRef.current.setAttribute('y2', walkerLeg2Pos.footY);
          }
          if (walkerLeg2FootRef.current) {
            walkerLeg2FootRef.current.setAttribute('cx', walkerLeg2Pos.footX);
            walkerLeg2FootRef.current.setAttribute('cy', walkerLeg2Pos.footY + 3);
          }

          // Walking arm animation - opposite to legs
          if (walkerArm1Ref.current) {
            gsap.set(walkerArm1Ref.current, {
              rotation: -walkCycle * 0.7,
              svgOrigin: "25 30"
            });
          }
          if (walkerArm2Ref.current) {
            gsap.set(walkerArm2Ref.current, {
              rotation: walkCycle * 0.7,
              svgOrigin: "25 30"
            });
          }
        },
        onEnter: () => {
          // Reset to start position when entering
          setCyclingProgress(0);
        },
        onLeaveBack: () => {
          // Reset when scrolling back up past the section
          setCyclingProgress(0);
          if (cyclistRef.current) {
            gsap.set(cyclistRef.current, { left: "5%" });
          }
          if (backWheelRef.current) {
            gsap.set(backWheelRef.current, { rotation: 0, svgOrigin: "45 200" });
          }
          if (frontWheelRef.current) {
            gsap.set(frontWheelRef.current, { rotation: 0, svgOrigin: "155 200" });
          }
          if (pedalsRef.current) {
            gsap.set(pedalsRef.current, { rotation: 0, svgOrigin: "85 200" });
          }
          // Reset legs to initial position (angle = 0)
          const hipX = 95, hipY = 145;
          const leg1InitPos = calculateLegPositions(0, hipX, hipY, 85, 200, 18, 35, 40);
          const leg2InitPos = calculateLegPositions(180, hipX, hipY, 85, 200, 18, 35, 40);

          if (leg1ThighRef.current) {
            leg1ThighRef.current.setAttribute('x1', leg1InitPos.hipX);
            leg1ThighRef.current.setAttribute('y1', leg1InitPos.hipY);
            leg1ThighRef.current.setAttribute('x2', leg1InitPos.kneeX);
            leg1ThighRef.current.setAttribute('y2', leg1InitPos.kneeY);
          }
          if (leg1ShinRef.current) {
            leg1ShinRef.current.setAttribute('x1', leg1InitPos.kneeX);
            leg1ShinRef.current.setAttribute('y1', leg1InitPos.kneeY);
            leg1ShinRef.current.setAttribute('x2', leg1InitPos.footX);
            leg1ShinRef.current.setAttribute('y2', leg1InitPos.footY);
          }
          if (leg1FootRef.current) {
            leg1FootRef.current.setAttribute('cx', leg1InitPos.footX);
            leg1FootRef.current.setAttribute('cy', leg1InitPos.footY + 4);
          }
          if (leg2ThighRef.current) {
            leg2ThighRef.current.setAttribute('x1', leg2InitPos.hipX);
            leg2ThighRef.current.setAttribute('y1', leg2InitPos.hipY);
            leg2ThighRef.current.setAttribute('x2', leg2InitPos.kneeX);
            leg2ThighRef.current.setAttribute('y2', leg2InitPos.kneeY);
          }
          if (leg2ShinRef.current) {
            leg2ShinRef.current.setAttribute('x1', leg2InitPos.kneeX);
            leg2ShinRef.current.setAttribute('y1', leg2InitPos.kneeY);
            leg2ShinRef.current.setAttribute('x2', leg2InitPos.footX);
            leg2ShinRef.current.setAttribute('y2', leg2InitPos.footY);
          }
          if (leg2FootRef.current) {
            leg2FootRef.current.setAttribute('cx', leg2InitPos.footX);
            leg2FootRef.current.setAttribute('cy', leg2InitPos.footY + 4);
          }
          // Reset walker
          if (walkerRef.current) {
            gsap.set(walkerRef.current, { left: "20%" });
          }
          // Reset walker legs to standing position
          const walkerInitPos = calculateWalkingLegPositions(0, 25, 50, 18, 17);
          if (walkerLeg1ThighRef.current) {
            walkerLeg1ThighRef.current.setAttribute('x1', walkerInitPos.hipX);
            walkerLeg1ThighRef.current.setAttribute('y1', walkerInitPos.hipY);
            walkerLeg1ThighRef.current.setAttribute('x2', walkerInitPos.kneeX);
            walkerLeg1ThighRef.current.setAttribute('y2', walkerInitPos.kneeY);
          }
          if (walkerLeg1ShinRef.current) {
            walkerLeg1ShinRef.current.setAttribute('x1', walkerInitPos.kneeX);
            walkerLeg1ShinRef.current.setAttribute('y1', walkerInitPos.kneeY);
            walkerLeg1ShinRef.current.setAttribute('x2', walkerInitPos.footX);
            walkerLeg1ShinRef.current.setAttribute('y2', walkerInitPos.footY);
          }
          if (walkerLeg1FootRef.current) {
            walkerLeg1FootRef.current.setAttribute('cx', walkerInitPos.footX);
            walkerLeg1FootRef.current.setAttribute('cy', walkerInitPos.footY + 3);
          }
          if (walkerLeg2ThighRef.current) {
            walkerLeg2ThighRef.current.setAttribute('x1', walkerInitPos.hipX);
            walkerLeg2ThighRef.current.setAttribute('y1', walkerInitPos.hipY);
            walkerLeg2ThighRef.current.setAttribute('x2', walkerInitPos.kneeX);
            walkerLeg2ThighRef.current.setAttribute('y2', walkerInitPos.kneeY);
          }
          if (walkerLeg2ShinRef.current) {
            walkerLeg2ShinRef.current.setAttribute('x1', walkerInitPos.kneeX);
            walkerLeg2ShinRef.current.setAttribute('y1', walkerInitPos.kneeY);
            walkerLeg2ShinRef.current.setAttribute('x2', walkerInitPos.footX);
            walkerLeg2ShinRef.current.setAttribute('y2', walkerInitPos.footY);
          }
          if (walkerLeg2FootRef.current) {
            walkerLeg2FootRef.current.setAttribute('cx', walkerInitPos.footX);
            walkerLeg2FootRef.current.setAttribute('cy', walkerInitPos.footY + 3);
          }
          if (walkerArm1Ref.current) {
            gsap.set(walkerArm1Ref.current, { rotation: 0, svgOrigin: "25 30" });
          }
          if (walkerArm2Ref.current) {
            gsap.set(walkerArm2Ref.current, { rotation: 0, svgOrigin: "25 30" });
          }
        }
      });

      return () => scrollTrigger.kill();
    }, 500); // Increased timeout to ensure section is rendered

    return () => clearTimeout(timer);
  }, []);

  // Update India map SVG when hovered state changes or active state changes in scrollable mode
  useEffect(() => {
    if (!indiaMapRef.current) return;

    const svgDoc = indiaMapRef.current.contentDocument;
    if (!svgDoc) return;

    // Small UTs that need extra visibility markers
    const smallUTs = [
      "Delhi", "Chandigarh", "Puducherry", "Goa",
      "Daman and Diu", "Dadra and Nagar Haveli",
      "Lakshadweep", "Andaman and Nicobar Islands"
    ];

    // Remove any existing markers first
    const existingMarkers = svgDoc.querySelectorAll(".ut-marker");
    existingMarkers.forEach(marker => marker.remove());

    // Determine which state to highlight based on view mode
    const highlightIndex = viewMode === "scrollable" ? activeStateIndex : hoveredStateIndex;

    const paths = svgDoc.querySelectorAll("path");
    paths.forEach((path) => {
      const stateName = path.getAttribute("name");
      const isHovered = highlightIndex !== null &&
        stateData[highlightIndex] &&
        stateData[highlightIndex].state === stateName;

      path.style.fill = isHovered ? "#5699af" : "#e0e0e0";
      path.style.stroke = isHovered ? "#2d6a7a" : "#999";
      path.style.strokeWidth = isHovered ? "1" : "0.3";
      path.style.opacity = isHovered ? "1" : "0.6";
      path.style.transition = "fill 0.2s, opacity 0.2s";

      // Add extra marker for small UTs when hovered
      if (isHovered && smallUTs.includes(stateName)) {
        const bbox = path.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        // Create outer pulsing circle
        const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        outerCircle.setAttribute("cx", centerX);
        outerCircle.setAttribute("cy", centerY);
        outerCircle.setAttribute("r", "12");
        outerCircle.setAttribute("fill", "none");
        outerCircle.setAttribute("stroke", "#5699af");
        outerCircle.setAttribute("stroke-width", "2");
        outerCircle.setAttribute("class", "ut-marker");
        outerCircle.style.animation = "pulse 1s infinite";

        // Create inner filled circle
        const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        innerCircle.setAttribute("cx", centerX);
        innerCircle.setAttribute("cy", centerY);
        innerCircle.setAttribute("r", "6");
        innerCircle.setAttribute("fill", "#5699af");
        innerCircle.setAttribute("class", "ut-marker");

        // Add animation style if not exists
        let style = svgDoc.querySelector("style.ut-style");
        if (!style) {
          style = document.createElementNS("http://www.w3.org/2000/svg", "style");
          style.setAttribute("class", "ut-style");
          style.textContent = `
            @keyframes pulse {
              0% { r: 12; opacity: 1; }
              50% { r: 18; opacity: 0.5; }
              100% { r: 12; opacity: 1; }
            }
          `;
          svgDoc.documentElement.appendChild(style);
        }

        svgDoc.documentElement.appendChild(outerCircle);
        svgDoc.documentElement.appendChild(innerCircle);
      }
    });
  }, [hoveredStateIndex, activeStateIndex, viewMode, stateData]);

  // Update combined population + AQI map when data loads
  useEffect(() => {
    if (!populationMapRef.current || populationData.length === 0 || stateData.length === 0) return;

    const svgDoc = populationMapRef.current.contentDocument;
    if (!svgDoc) return;

    const populations = populationData.map(d => d.population);
    const minPop = Math.min(...populations);
    const maxPop = Math.max(...populations);
    const popRange = maxPop - minPop;

    // Remove any existing circles
    const existingPopCircles = svgDoc.querySelectorAll(".pop-circle");
    existingPopCircles.forEach(c => c.remove());

    const paths = svgDoc.querySelectorAll("path");
    paths.forEach((path) => {
      const stateName = path.getAttribute("name");

      // Fill states with AQI category colors
      const stateAQIData = stateData.find(d => d.state === stateName);
      if (stateAQIData && stateAQIData.avgAQI) {
        const aqi = stateAQIData.avgAQI;

        let color;
        if (aqi <= 50) color = "#5699af";
        else if (aqi <= 100) color = "#87beb1";
        else if (aqi <= 200) color = "#dfbfc6";
        else if (aqi <= 300) color = "#de9eaf";
        else if (aqi <= 400) color = "#e07192";
        else color = "#c1616b";

        path.style.fill = color;
        path.style.fillOpacity = "0.7";
        path.style.stroke = "#fff";
        path.style.strokeWidth = "0.5";
      } else {
        path.style.fill = "#f0f0f0";
        path.style.stroke = "#ccc";
        path.style.strokeWidth = "0.3";
      }

      // Add population bubbles
      const statePopData = populationData.find(d =>
        d.state === stateName ||
        d.state.replace("&", "and") === stateName ||
        d.state.replace(" & ", " and ") === stateName ||
        stateName?.includes(d.state.split(" ")[0])
      );

      if (statePopData) {
        const popIntensity = (statePopData.population - minPop) / popRange;
        const radius = 5 + (popIntensity * 20);

        const bbox = path.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        const popCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        popCircle.setAttribute("cx", centerX);
        popCircle.setAttribute("cy", centerY);
        popCircle.setAttribute("r", radius);
        popCircle.setAttribute("fill", "#333");
        popCircle.setAttribute("fill-opacity", "0.6");
        popCircle.setAttribute("stroke", "#fff");
        popCircle.setAttribute("stroke-width", "1");
        popCircle.setAttribute("class", "pop-circle");

        svgDoc.documentElement.appendChild(popCircle);
      }
    });
  }, [populationData, stateData]);

  // Sorted state data based on sortOrder
  const sortedStateData = useMemo(() => {
    if (!stateData || stateData.length === 0) return [];

    const dataCopy = [...stateData];

    switch (sortOrder) {
      case "highToLow":
        return dataCopy.sort((a, b) => (b.avgAQI || 0) - (a.avgAQI || 0));
      case "lowToHigh":
        return dataCopy.sort((a, b) => (a.avgAQI || 0) - (b.avgAQI || 0));
      case "alphabetical":
      default:
        return dataCopy.sort((a, b) => a.state.localeCompare(b.state));
    }
  }, [stateData, sortOrder]);

  const getStatusColor = (status) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("good")) return "#5699af"; // Good - blue
    if (statusLower.includes("satisfactory")) return "#87beb1"; // Satisfactory - teal
    if (statusLower.includes("moderate")) return "#dfbfc6"; // Moderate - light pink
    if (statusLower.includes("poor") && !statusLower.includes("very"))
      return "#de9eaf"; // Poor - medium pink
    if (statusLower.includes("very poor")) return "#5699af"; // Very Poor - darker pink
    if (statusLower.includes("severe")) return "#c1616b"; // Severe - darkest pink/red
    return "#cccccc";
  };

  // Get AQI category and health impact based on AQI value
  const getAQICategoryInfo = (aqi) => {
    if (aqi <= 50) return {
      category: "Good",
      color: "#5699af",
      health: "Minimal impact on health. Air quality is considered satisfactory."
    };
    if (aqi <= 100) return {
      category: "Satisfactory",
      color: "#87beb1",
      health: "Minor breathing discomfort to sensitive people."
    };
    if (aqi <= 200) return {
      category: "Moderate",
      color: "#dfbfc6",
      health: "Breathing discomfort to people with lung, heart disease, children and older adults."
    };
    if (aqi <= 300) return {
      category: "Poor",
      color: "#de9eaf",
      health: "Breathing discomfort to most people on prolonged exposure."
    };
    if (aqi <= 400) return {
      category: "Very Poor",
      color: "#e07192",
      health: "Respiratory illness on prolonged exposure. Effect on healthy people too."
    };
    return {
      category: "Severe",
      color: "#c1616b",
      health: "Serious health impacts. Affects healthy people and seriously impacts those with existing diseases."
    };
  };

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2024 is a leap year

  const renderCircularVisualization = (stateInfo, disableTooltips = false) => {
    if (!stateInfo) return null;

    const centerX = 400;
    const centerY = 400;
    const radius = 250;
    const dashLength = 100;
    const dashWidth = 2;
    const totalDays = 366;
    const anglePerDay = (2 * Math.PI) / totalDays;
    const startAngleOffset = 3 * Math.PI / 2;

    const selectedArea = selectedAreas[stateInfo.state];
    const dateMap = new Map();
    const aqiValues = [];

    stateInfo.areaData.forEach((areaMonths, area) => {
      if (selectedArea && area !== selectedArea) return;

      areaMonths.forEach((days, monthKey) => {
        days.forEach((dayData, dayNum) => {
          const dateKey = `${monthKey}-${dayNum}`;
          const existing = dateMap.get(dateKey);
          if (!existing || dayData.aqiValue > existing.aqiValue) {
            dateMap.set(dateKey, {
              status: dayData.status,
              aqiValue: dayData.aqiValue,
              pollutants: dayData.pollutants
            });
          }
          if (dayData.aqiValue) {
            aqiValues.push(dayData.aqiValue);
          }
        });
      });
    });

    const avgAQI = aqiValues.length > 0
      ? aqiValues.reduce((sum, val) => sum + val, 0) / aqiValues.length
      : 0;

    const getAvgAQIColor = (avg) => {
      if (avg === 0 || !avg) return "#cccccc";
      if (avg <= 50) return "#5699af";
      if (avg <= 100) return "#87beb1";
      if (avg <= 200) return "#dfbfc6";
      if (avg <= 300) return "#de9eaf";
      if (avg <= 400) return "#5699af";
      return "#c1616b";
    };

    const centerColor = getAvgAQIColor(avgAQI);

    const allDays = [];
    let dayOfYear = 0;
    daysInMonth.forEach((daysInThisMonth, monthIdx) => {
      for (let day = 1; day <= daysInThisMonth; day++) {
        const dateKey = `${monthIdx + 1}-${day}`;
        const dayData = dateMap.get(dateKey);
        allDays.push({
          dayOfYear,
          month: monthIdx + 1,
          day,
          status: dayData?.status,
          aqiValue: dayData?.aqiValue || 0,
          pollutants: dayData?.pollutants || "",
        });
        dayOfYear++;
      }
    });

    return (
      <svg width="800" height="800">
        <defs>
          <radialGradient id={`centerGlow-${stateInfo.state.replace(/\s+/g, '-')}`}>
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor={centerColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          cx={centerX}
          cy={centerY}
          r={60}
          fill={`url(#centerGlow-${stateInfo.state.replace(/\s+/g, '-')})`}
        >
          {!disableTooltips && <title>{`${stateInfo.state} - Average AQI: ${avgAQI.toFixed(1)}`}</title>}
        </circle>

        {(() => {
          const minRadius = 80;
          const maxRadius = radius - dashLength / 2 - 50;
          const aqiThresholds = [
            { value: 20, color: "#5699af", label: "Good (0-50)" },
            { value: 100, color: "#87beb1", label: "Satisfactory (51-100)" },
            { value: 200, color: "#dfbfc6", label: "Moderate (101-200)" },
            { value: 300, color: "#de9eaf", label: "Poor (201-300)" },
            { value: 400, color: "#5699af", label: "Very Poor (301-400)" },
            { value: 500, color: "#c1616b", label: "Severe (401-500)" }
          ];

          return aqiThresholds.map((threshold) => {
            const thresholdRadius = minRadius + (threshold.value / 500) * (maxRadius - minRadius);
            return (
              <circle
                key={threshold.value}
                cx={centerX}
                cy={centerY}
                r={thresholdRadius}
                fill="none"
                stroke={threshold.color}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.4"
                style={{ cursor: disableTooltips ? "default" : "pointer" }}
                onMouseEnter={disableTooltips ? undefined : (e) => {
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    state: "",
                    date: threshold.label,
                    aqiValue: threshold.value,
                    status: `AQI ${threshold.value}`,
                    pollutants: "",
                    color: threshold.color,
                  });
                }}
                onMouseMove={disableTooltips ? undefined : (e) => {
                  if (tooltip) {
                    setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={disableTooltips ? undefined : () => setTooltip(null)}
              />
            );
          });
        })()}

        {allDays.map((dayInfo) => {
          const color = dayInfo.status ? getStatusColor(dayInfo.status) : "#f0f0f0";
          const angle = startAngleOffset + dayInfo.dayOfYear * anglePerDay;
          const innerX = centerX + (radius - dashLength / 2) * Math.cos(angle);
          const innerY = centerY + (radius - dashLength / 2) * Math.sin(angle);
          const outerX = centerX + (radius + dashLength / 2) * Math.cos(angle);
          const outerY = centerY + (radius + dashLength / 2) * Math.sin(angle);

          return (
            <line
              key={dayInfo.dayOfYear}
              x1={innerX}
              y1={innerY}
              x2={outerX}
              y2={outerY}
              stroke={color}
              strokeWidth={dashWidth}
              opacity={1}
              style={{ cursor: disableTooltips ? "default" : "pointer" }}
              onMouseEnter={disableTooltips ? undefined : (e) => {
                if (dayInfo.status) {
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    state: selectedArea || stateInfo.state,
                    date: `${monthNames[dayInfo.month - 1]} ${dayInfo.day}`,
                    aqiValue: dayInfo.aqiValue,
                    status: dayInfo.status,
                    pollutants: dayInfo.pollutants,
                    color: color,
                  });
                }
              }}
              onMouseMove={disableTooltips ? undefined : (e) => {
                if (tooltip) {
                  setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={disableTooltips ? undefined : () => setTooltip(null)}
            />
          );
        })}

        {(() => {
          const lineStartRadius = radius + dashLength / 2;
          const lineEndRadius = radius + dashLength / 2 + 15;
          const monthBoundaryLines = [];
          let daysSoFar = 0;

          daysInMonth.forEach((daysInThisMonth, monthIdx) => {
            const angle = startAngleOffset + daysSoFar * anglePerDay;
            const x1 = centerX + lineStartRadius * Math.cos(angle);
            const y1 = centerY + lineStartRadius * Math.sin(angle);
            const x2 = centerX + lineEndRadius * Math.cos(angle);
            const y2 = centerY + lineEndRadius * Math.sin(angle);

            monthBoundaryLines.push(
              <line
                key={`boundary-${monthIdx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#999"
                strokeWidth="1"
                opacity="0.5"
              />
            );
            daysSoFar += daysInThisMonth;
          });

          return monthBoundaryLines;
        })()}

        {(() => {
          const labelRadius = radius + dashLength / 2 + 20;
          const monthLabels = [];
          let daysSoFar = 0;

          daysInMonth.forEach((daysInThisMonth, monthIdx) => {
            const middleDay = daysSoFar + daysInThisMonth / 2;
            const angle = startAngleOffset + middleDay * anglePerDay;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            let rotationAngle = (angle * 180 / Math.PI) + 90;

            if (rotationAngle > 90 && rotationAngle < 270) {
              rotationAngle += 180;
            }

            monthLabels.push(
              <text
                key={monthIdx}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#999"
                fontSize="12"
                fontWeight="500"
                transform={`rotate(${rotationAngle}, ${x}, ${y})`}
              >
                {monthNames[monthIdx]}
              </text>
            );
            daysSoFar += daysInThisMonth;
          });

          return monthLabels;
        })()}

        {(() => {
          const dataPoints = allDays
            .filter(d => d.status)
            .map(d => {
              const angle = startAngleOffset + d.dayOfYear * anglePerDay;
              const minRadius = 80;
              const maxRadius = radius - dashLength / 2 - 10;
              const aqiRadius = minRadius + (d.aqiValue / 500) * (maxRadius - minRadius);

              return {
                x: centerX + aqiRadius * Math.cos(angle),
                y: centerY + aqiRadius * Math.sin(angle),
                dayOfYear: d.dayOfYear
              };
            });

          const segments = [];
          if (dataPoints.length > 0) {
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
          }

          return segments.map((segment, segIdx) => {
            if (segment.length === 1) {
              return (
                <circle
                  key={`point-${segIdx}`}
                  cx={segment[0].x}
                  cy={segment[0].y}
                  r={1}
                  fill="#6c757d"
                  opacity={0.6}
                />
              );
            }

            const pathData = segment.map((point, idx) => {
              return `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
            }).join(' ');

            return (
              <path
                key={`line-${segIdx}`}
                d={pathData}
                fill="none"
                stroke="#4b5563"
                strokeWidth="1.5"
                opacity={0.6}
              />
            );
          });
        })()}
      </svg>
    );
  };

  const renderStateCard = (stateInfo, index) => {
    const isActive = index === activeStateIndex;

    const getBarColor = (aqi) => {
      if (aqi <= 50) return "#5699af";
      if (aqi <= 100) return "#87beb1";
      if (aqi <= 200) return "#dfbfc6";
      if (aqi <= 300) return "#de9eaf";
      if (aqi <= 400) return "#5699af";
      return "#c1616b";
    };

    return (
      <div
        key={stateInfo.state}
        ref={(el) => (stateRefs.current[index] = el)}
        data-index={index}
        onClick={() => setActiveStateIndex(index)}
        style={{
          padding: "30px 20px",
          marginBottom: "400px",
          borderRadius: "8px",
          backgroundColor: "transparent",
          cursor: "pointer",
          transition: "all 0.3s ease",
          opacity: isActive ? 1 : 0.25,
        }}
      >
        <div
          style={{
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            fontSize: "24px",
            fontWeight: "700",
            color: isActive ? "#333" : "#666",
            marginBottom: "5px",
          }}
        >
          {stateInfo.state}
        </div>

        <div
          style={{
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            fontSize: "12px",
            color: "#999",
            marginTop: "22px",
            marginBottom: "10px",
            fontStyle: "italic",
          }}
        >
          Click a city bar to view its data
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          flexWrap: "wrap",
          gap: "12px",
          maxHeight: "320px",
          alignContent: "flex-start",
        }}>
          {stateInfo.areas.map((area) => {
            const areaMonths = stateInfo.areaData.get(area);
            let totalAQI = 0;
            let count = 0;
            if (areaMonths) {
              areaMonths.forEach((days) => {
                days.forEach((dayData) => {
                  if (dayData.aqiValue) {
                    totalAQI += dayData.aqiValue;
                    count++;
                  }
                });
              });
            }
            const avgAQI = count > 0 ? totalAQI / count : 0;
            const barWidth = Math.min((avgAQI / 500) * 100, 150);
            const isSelected = selectedAreas[stateInfo.state] === area;
            const hasSelection = selectedAreas[stateInfo.state] !== undefined;

            return (
              <div
                key={area}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAreas({
                    ...selectedAreas,
                    [stateInfo.state]: isSelected ? undefined : area,
                  });
                  setActiveStateIndex(index);
                }}
                style={{
                  cursor: "pointer",
                  opacity: hasSelection ? (isSelected ? 1 : 0.25) : 0.8,
                  width: "100px",
                  marginRight: "20px",
                }}
              >
                <div
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "12px",
                    color: isSelected ? "#333" : "#666",
                    fontWeight: isSelected ? "600" : "400",
                    marginBottom: "3px",
                  }}
                >
                  {area}
                </div>
                <div
                  style={{
                    height: "12px",
                    width: `${barWidth}px`,
                    backgroundColor: getBarColor(avgAQI),
                    borderRadius: "2px",
                    transition: "all 0.2s ease",
                  }}
                  title={`${area}: Avg AQI ${avgAQI.toFixed(0)}`}
                />
              </div>
            );
          })}
        </div>

        {selectedAreas[stateInfo.state] && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#060505ff",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAreas({
                ...selectedAreas,
                [stateInfo.state]: undefined,
              });
            }}
          >
            ← Show all cities
          </div>
        )}
      </div>
    );
  };

  // Helper function to render the "?" button with tooltip for circular visualizations
  const renderCircularHelpButton = (id) => (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
      onMouseEnter={() => setShowCircularHelp(id)}
      onMouseLeave={() => setShowCircularHelp(null)}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundColor: "#5699af",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
        }}
      >
        ?
      </div>
      {showCircularHelp === id && (
        <div
          style={{
            position: "absolute",
            top: "30px",
            left: "0",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "16px",
            width: "300px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            textAlign: "left",
          }}
        >
          <h4
            style={{
              margin: "0 0 10px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#333",
              textAlign: "left",
            }}
          >
            How to read this visualization
          </h4>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "12px",
              color: "#555",
              lineHeight: "1.6",
              textAlign: "left",
            }}
          >
            Each radial line represents a day of the year, starting from January at the top and moving clockwise through December. hover on the lines for more information.
          </p>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "12px",
              color: "#555",
              lineHeight: "1.6",
              textAlign: "left",
            }}
          >
            The color of each line indicates the AQI value for that day:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#5699af" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Good (0-50)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#87beb1" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Satisfactory (51-100)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#dfbfc6" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Moderate (101-200)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#de9eaf" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Poor (201-300)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#e07192" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Very Poor (301-400)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "8px", backgroundColor: "#c1616b" }} />
              <span style={{ fontSize: "11px", color: "#555" }}>Severe (401+)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" }}>
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <p
            style={{
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontSize: "18px",
              color: "#666",
            }}
          >
            Loading data...
          </p>
        </div>
      )}
      {error && <p style={{ color: "red", padding: "20px" }}>Error: {error}</p>}

      {/* Timeline/Scroll View */}
      {!loading && (
        <>
          {/* Full-page title section */}
          <div
            style={{
              height: "100vh",
              position: "relative",
            }}
          >
            {/* SVG background */}
            <img
              src="/AQIintro.svg"
              alt="AQI Introduction Visualization"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 0,
              }}
            />
            {/* Text content on top - left aligned */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: "60px 160px",
                textAlign: "left",
              }}
            >
              <h1
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "64px",
                  fontWeight: "900",
                  color: "#000",
                  margin: "0",
                }}
              >
                India Ki Hawa
              </h1>
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "36px",
                  fontWeight: "400",
                  color: "#000",
                  margin: "10px 0 15px 0",
                }}
              >
                The air we breathe
              </p>
              <div
                style={{
                  width: "400px",
                  height: "2px",
                  backgroundColor: "#000",
                  margin: "0 0 30px 0",
                }}
              />
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "24px",
                  fontWeight: "400",
                  fontStyle: "italic",
                  color: "#000",
                  margin: "0 0 40px 0",
                  maxWidth: "400px",
                  lineHeight: "1.5",
                }}
              >
                Visualizing Spatial, Temporal, and Systemic Dimensions of India's Air Pollution.
              </p>
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#000",
                  margin: "0",
                }}
              >
                Priyanka Karnam
              </p>
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#000",
                  margin: "5px 0 0 0",
                }}
              >
                Mar 04, 2026
              </p>
            </div>

            {/* Scroll indicator - positioned at bottom of first page */}
            <div
              style={{
                position: "absolute",
                bottom: "40px",
                left: "160px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                zIndex: 2,
              }}
              onClick={() => introRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              <span
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "18px",
                  fontStyle: "italic",
                  color: "#8e9aaf",
                  marginBottom: "8px",
                }}
              >
                Scroll
              </span>
              <svg
                width="36"
                height="36"
                viewBox="0 0 50 50"
                fill="none"
                style={{
                  animation: "bounce 2s infinite",
                }}
              >
                <circle
                  cx="25"
                  cy="25"
                  r="21"
                  stroke="#8e9aaf"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M17 22L25 30L33 22"
                  stroke="#8e9aaf"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M25 14L25 28"
                  stroke="#8e9aaf"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          {/* Introduction text section */}
          <div
            ref={introRef}
            style={{
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "#555",
              margin: "0 auto",
              maxWidth: "800px",
              lineHeight: "2.0",
              textAlign: "left",
              padding: "140px 40px",
            }}
          >
            <p>
            India is confronting a deepening air quality crisis. In 2024, the country ranked as the third most polluted nation globally, following Bangladesh and Pakistan, according to AQI.in. With an average AQI of 111, millions of people were exposed to unhealthy air for much of the year. Several Indian cities repeatedly appeared among the world's most polluted urban areas, underscoring the scale and persistence of the problem. New Delhi, the nation's capital, consistently recorded some of the highest pollution levels worldwide, placing it among the most polluted capital cities on the planet.  </p>
            <p style={{ marginTop: "10px" }}>
             This crisis is closely tied to India's rapid urbanization and energy choices. As the third-largest emitter of greenhouse gases globally, the country relies heavily on fossil fuels to power its growing cities, industries, and transportation networks. While greenhouse gases drive long-term climate change, many of the same activities coal-based power generation, vehicular traffic, and industrial production also release pollutants that directly degrade the air people breathe every day.
               </p>
            <p style={{ marginTop: "10px" }}>
             Home to one of the world's largest and densest populations, India faces unique pressures. Rising energy demand, expanding transportation systems, and accelerating urban growth have intensified emissions, while the increasing number of vehicles has made pollution control even more challenging. These pressures are compounded by slow transitions to clean energy, uneven infrastructure development, and weak enforcement of environmental regulations. This story examines how air pollution in India varies across space and time, and what these patterns reveal about public health, environmental inequality, and the systems that shape the air millions inhale daily.   </p>
          </div>

          {/* Delhi & Six Cities Scrollytelling Section */}
          <div
            ref={mapScrollRef}
            style={{
              display: "flex",
              minHeight: "200vh",
              padding: "0 40px",
              maxWidth: "1400px",
              margin: "0 auto",
              marginTop: "50px",
            }}
          >
            {/* Left column - Sticky map that transitions */}
            <div
              style={{
                flex: "6",
                position: "sticky",
                top: "10vh",
                height: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                marginLeft: "40px",
              }}
            >
              {/* Container for maps with relative positioning */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "700px",
                  height: "700px",
                }}
              >
              {/* Delhi map - India base map with Delhi highlighted */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  maxWidth: "700px",
                  height: "700px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: activeMapIndex === 0 ? 1 : 0,
                  visibility: activeMapIndex === 0 ? "visible" : "hidden",
                  transition: "opacity 0.4s ease, visibility 0.4s ease",
                  pointerEvents: activeMapIndex === 0 ? "auto" : "none",
                }}
              >
                {/* Base India map with Delhi highlighted */}
                <object
                  ref={delhiMapRef}
                  data="/india-states.svg"
                  type="image/svg+xml"
                  width="700"
                  height="700"
                  style={{ pointerEvents: "auto" }}
                  onLoad={() => {
                    if (delhiMapRef.current) {
                      const svgDoc = delhiMapRef.current.contentDocument;
                      if (svgDoc) {
                        const paths = svgDoc.querySelectorAll("path");
                        paths.forEach((path) => {
                          const stateName = path.getAttribute("name");
                          if (stateName === "Delhi") {
                            path.style.fill = "#3a9bb2";
                            path.style.stroke = "#2a7a8a";
                            path.style.strokeWidth = "1";
                            path.style.opacity = "1";
                            path.style.cursor = "pointer";
                            path.style.transition = "fill 0.2s ease";

                            // Add hover events for Delhi
                            path.addEventListener("mouseenter", (e) => {
                              path.style.fill = "#2d8a9a";
                              setDelhiHovered(true);
                              setDelhiTooltipPos({ x: e.clientX, y: e.clientY });
                            });
                            path.addEventListener("mousemove", (e) => {
                              setDelhiTooltipPos({ x: e.clientX, y: e.clientY });
                            });
                            path.addEventListener("mouseleave", () => {
                              path.style.fill = "#3a9bb2";
                              setDelhiHovered(false);
                            });
                          } else {
                            path.style.fill = "#d0d0d0";
                            path.style.stroke = "#fff";
                            path.style.strokeWidth = "0.5";
                            path.style.opacity = "0.7";
                          }
                        });
                      }
                    }
                  }}
                />

                {/* Delhi Tooltip */}
                {delhiHovered && (
                  <div
                    style={{
                      position: "fixed",
                      left: delhiTooltipPos.x + 15,
                      top: delhiTooltipPos.y - 10,
                      backgroundColor: "#fff",
                      border: "1px solid #d0d0d0",
                      borderRadius: "8px",
                      padding: "15px 20px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 1000,
                      pointerEvents: "none",
                      minWidth: "250px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "#3a9bb2",
                        marginBottom: "10px",
                      }}
                    >
                      Delhi
                    </div>
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "14px",
                        color: "#333",
                        marginBottom: "8px",
                      }}
                    >
                      <strong>2024 Average AQI:</strong> 227 (Poor)
                    </div>
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "13px",
                        color: "#555",
                        lineHeight: "1.6",
                      }}
                    >
                      <div style={{ marginBottom: "4px" }}>
                        #1 Most Polluted Capital City in the World (2024)
                      </div>
                      <div>
                        #2 Most Polluted City in the World (2024)
                      </div>
                    </div>
                  </div>
                )}

                {/* Instruction text */}
                <p
                  style={{
                    position: "absolute",
                    bottom: "-40px",
                    left: "35%",
                    transform: "translateX(-50%)",
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "11px",
                    color: "#888",
                    fontStyle: "italic",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  Hover for more information
                </p>
              </div>

              {/* Six Cities map - Same style as Delhi map */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  maxWidth: "700px",
                  height: "700px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: activeMapIndex === 1 ? 1 : 0,
                  visibility: activeMapIndex === 1 ? "visible" : "hidden",
                  transition: "opacity 0.4s ease, visibility 0.4s ease",
                  pointerEvents: activeMapIndex === 1 ? "auto" : "none",
                }}
              >
                {/* Base India map with same styling as Delhi map */}
                <object
                  ref={sixCitiesMapRef}
                  data="/india-states.svg"
                  type="image/svg+xml"
                  width="700"
                  height="700"
                  style={{ pointerEvents: "none" }}
                  onLoad={() => {
                    if (sixCitiesMapRef.current) {
                      const svgDoc = sixCitiesMapRef.current.contentDocument;
                      if (svgDoc) {
                        const paths = svgDoc.querySelectorAll("path");
                        paths.forEach((path) => {
                          path.style.fill = "#d0d0d0";
                          path.style.stroke = "#fff";
                          path.style.strokeWidth = "0.5";
                          path.style.opacity = "0.7";
                        });
                      }
                    }
                  }}
                />

                {/* City markers overlay */}
                <svg
                  width="700"
                  height="700"
                  viewBox="0 0 600 700"
                  style={{ position: "absolute", pointerEvents: "auto" }}
                >
                  {/* 6 Indian Cities from Top 10 Most Polluted Cities in the World */}
                  {/* Coordinates calculated using: x = ((lon-68)/30)*600, y = ((37-lat)/31)*700 */}

                  {/* Byrnihat, Assam (lat: 26.04, lon: 91.82) - Near Guwahati, Assam-Meghalaya border */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("Byrnihat"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="480" cy="285" r="24" fill="#3a9bb2" opacity={hoveredCity === "Byrnihat" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="480" cy="285" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="480" y="255" textAnchor="middle" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>Byrnihat</text>

                  {/* Delhi (lat: 28.61, lon: 77.21) */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("Delhi"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="184" cy="220" r="22" fill="#3a9bb2" opacity={hoveredCity === "Delhi" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="184" cy="220" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="154" y="208" textAnchor="end" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>Delhi</text>

                  {/* Mullanpur, Punjab (lat: 30.79, lon: 76.61) - Near Chandigarh */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("Mullanpur"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="172" cy="175" r="20" fill="#3a9bb2" opacity={hoveredCity === "Mullanpur" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="172" cy="175" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="148" y="163" textAnchor="end" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>Mullanpur</text>

                  {/* Faridabad, Haryana (lat: 28.4, lon: 77.3) - South of Delhi */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("Faridabad"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="186" cy="225" r="18" fill="#3a9bb2" opacity={hoveredCity === "Faridabad" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="186" cy="225" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="216" y="225" textAnchor="start" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>Faridabad</text>

                  {/* Loni, UP (lat: 28.75, lon: 77.28) - East of Delhi */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("Loni"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="186" cy="217" r="16" fill="#3a9bb2" opacity={hoveredCity === "Loni" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="186" cy="217" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="216" y="207" textAnchor="start" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>Loni</text>

                  {/* New Delhi (lat: 28.61, lon: 77.21) */}
                  <g
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => { setHoveredCity("New Delhi"); setCityTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setCityTooltipPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCity(null)}
                  >
                    <circle cx="184" cy="220" r="14" fill="#3a9bb2" opacity={hoveredCity === "New Delhi" ? 0.5 : 0.3} style={{ transition: "opacity 0.2s" }} />
                    <circle cx="184" cy="220" r="4" fill="#3a9bb2" opacity="1" />
                  </g>
                  <text x="154" y="230" textAnchor="end" fontSize="10" fontFamily="Avenir, sans-serif" fill="#333" style={{ pointerEvents: "none" }}>New Delhi</text>
                </svg>

                {/* Tooltip showing all 10 most polluted cities */}
                {hoveredCity && (
                  <div
                    style={{
                      position: "fixed",
                      left: cityTooltipPos.x + 15,
                      top: cityTooltipPos.y - 10,
                      backgroundColor: "#fff",
                      border: "1px solid #d0d0d0",
                      borderRadius: "8px",
                      padding: "15px 20px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 1000,
                      pointerEvents: "none",
                      minWidth: "220px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#3a9bb2",
                        marginBottom: "12px",
                        borderBottom: "1px solid #e0e0e0",
                        paddingBottom: "8px",
                      }}
                    >
                      Top 10 Most Polluted Cities (2024)
                    </div>
                    {[
                      { rank: 1, city: "Byrnihat", country: "India" },
                      { rank: 2, city: "Delhi", country: "India" },
                      { rank: 3, city: "Karaganda", country: "Kazakhstan" },
                      { rank: 4, city: "Mullanpur", country: "India" },
                      { rank: 5, city: "Lahore", country: "Pakistan" },
                      { rank: 6, city: "Faridabad", country: "India" },
                      { rank: 7, city: "Dera Ismail Khan", country: "Pakistan" },
                      { rank: 8, city: "N'Djamena", country: "Chad" },
                      { rank: 9, city: "Loni", country: "India" },
                      { rank: 10, city: "New Delhi", country: "India" },
                    ].map((item) => (
                      <div
                        key={item.rank}
                        style={{
                          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                          fontSize: "12px",
                          color: item.city === hoveredCity ? "#3a9bb2" : "#bbb",
                          fontWeight: item.city === hoveredCity ? "700" : "400",
                          padding: "4px 0",
                          backgroundColor: item.city === hoveredCity ? "#f0f8fa" : "transparent",
                          marginLeft: "-8px",
                          marginRight: "-8px",
                          paddingLeft: "8px",
                          paddingRight: "8px",
                          borderRadius: "4px",
                        }}
                      >
                        {item.rank}. {item.city}, {item.country}
                      </div>
                    ))}
                  </div>
                )}

                {/* Instruction text */}
                <p
                  style={{
                    position: "absolute",
                    bottom: "-40px",
                    left: "35%",
                    transform: "translateX(-50%)",
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "11px",
                    color: "#888",
                    fontStyle: "italic",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  Hover for more information
                </p>
              </div>
              </div>
            </div>

            {/* Right column - Scrollable text sections */}
            <div
              style={{
                flex: "4",
                display: "flex",
                flexDirection: "column",
                paddingLeft: "0px",
              }}
            >
              {/* Delhi text section */}
              <div
                ref={delhiTextRef}
                data-mapindex="0"
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activeMapIndex === 0 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                  paddingLeft: "20px",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "48px",
                      fontWeight: "700",
                      color: "#3a9bb2",
                      margin: "0 0 20px 0",
                      letterSpacing: "2px",
                      textAlign: "left",
                    }}
                  >
                    DELHI
                  </h2>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "16px",
                      fontWeight: "400",
                      color: "#333",
                      lineHeight: "2.0",
                      margin: "0",
                      textAlign: "left",
                    }}
                  >
                  had the poorest air quality, in 2024 among capital cities globally, with concentrations of particulate matter (PM2.5) nearly 10 times higher than the World Health Organization guidelines.
                  </p>
                  <a
                    href="https://www.iqair.com/newsroom/5-most-polluted-major-cities-in-world-2024"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      color: "#5699af",
                      textDecoration: "none",
                      marginTop: "10px",
                      display: "inline-block",
                    }}
                  >
                    Source: IQAir
                  </a>
                </div>
              </div>

              {/* Six Cities text section */}
              <div
                ref={sixCitiesTextRef}
                data-mapindex="1"
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activeMapIndex === 1 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                  paddingLeft: "20px",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "72px",
                      fontWeight: "700",
                      margin: "0 0 20px 0",
                      textAlign: "left",
                      lineHeight: "1.1",
                    }}
                  >
                    <span style={{ color: "#3a9bb2" }}>6</span>
                    <span style={{ color: "#444" }}> out of 10</span>
                  </h2>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "16px",
                      fontWeight: "400",
                      color: "#555",
                      lineHeight: "2.0",
                      margin: "0",
                      textAlign: "left",
                    }}
                  >
                    most polluted cities of 2024 in the world are in India.
                  </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      fontWeight: "400",
                      color: "#888",
                      lineHeight: "1.5",
                      margin: "20px 0 0 0",
                      textAlign: "left",
                    }}
                  >
                    Source: <a href="https://www.iqair.com/world-most-polluted-cities" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>IQAir - World Most Polluted Cities</a>
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* KPI Sections - 3 columns */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: "20px 40px",
              gap: "60px",
              maxWidth: "1400px",
              margin: "0 auto",
              marginTop: "120px",
            }}
          >
            {/* KPI 1 - 35% */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                position: "relative",
                minHeight: "280px",
              }}
            >
              {/* Cloud background */}
              <img
                src="/Cloud.svg"
                alt=""
                style={{
                  position: "absolute",
                  top: "0",
                  left: "40px",
                  width: "280px",
                  zIndex: 0,
                  opacity: 0.9,
                  pointerEvents: "none",
                }}
              />
              <h2
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "80px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0",
                  lineHeight: "1",
                  position: "relative",
                  zIndex: 1,
                  marginLeft: "140px",
                  marginTop: "60px",
                }}
              >
                35%
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  marginTop: "20px",
                  marginLeft: "140px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "4px",
                    backgroundColor: "#3a9bb2",
                    marginRight: "15px",
                    borderRadius: "2px",
                  }}
                />
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "14px",
                    fontWeight: "400",
                    fontStyle: "italic",
                    color: "#333",
                    lineHeight: "1.6",
                    margin: "0",
                    maxWidth: "220px",
                    textAlign: "left",
                  }}
                >
                  of Indian cities reported annual PM2.5 averages exceeding ten times the WHO guideline.
                </p>
              </div>
            </div>

            {/* KPI 2 - 5.2 years */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                position: "relative",
                minHeight: "280px",
              }}
            >
              {/* Cloud background */}
              <img
                src="/Cloud.svg"
                alt=""
                style={{
                  position: "absolute",
                  top: "0",
                  left: "40px",
                  width: "280px",
                  zIndex: 0,
                  opacity: 0.9,
                  pointerEvents: "none",
                }}
              />
              <h2
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "80px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0",
                  lineHeight: "1",
                  position: "relative",
                  zIndex: 1,
                  marginLeft: "140px",
                  marginTop: "60px",
                }}
              >
                5.2
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  marginTop: "20px",
                  marginLeft: "140px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "4px",
                    backgroundColor: "#3a9bb2",
                    marginRight: "15px",
                    borderRadius: "2px",
                  }}
                />
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "14px",
                    fontWeight: "400",
                    fontStyle: "italic",
                    color: "#333",
                    lineHeight: "1.6",
                    margin: "0",
                    maxWidth: "220px",
                    textAlign: "left",
                  }}
                >
                  years of life expectancy reduced in India due to air pollution.
                </p>
              </div>
            </div>

            {/* KPI 3 - 2 million */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                position: "relative",
                minHeight: "280px",
              }}
            >
              {/* Cloud background */}
              <img
                src="/Cloud.svg"
                alt=""
                style={{
                  position: "absolute",
                  top: "0",
                  left: "40px",
                  width: "280px",
                  zIndex: 0,
                  opacity: 0.9,
                  pointerEvents: "none",
                }}
              />
              <h2
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "80px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0",
                  lineHeight: "1",
                  position: "relative",
                  zIndex: 1,
                  marginLeft: "140px",
                  marginTop: "60px",
                }}
              >
                2M
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  marginTop: "20px",
                  marginLeft: "140px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "4px",
                    backgroundColor: "#3a9bb2",
                    marginRight: "15px",
                    borderRadius: "2px",
                  }}
                />
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "14px",
                    fontWeight: "400",
                    fontStyle: "italic",
                    color: "#333",
                    lineHeight: "1.6",
                    margin: "0",
                    maxWidth: "220px",
                    textAlign: "left",
                  }}
                >
                  deaths a year in India is accounted due to air pollution.
                </p>
              </div>
            </div>
          </div>

          {/* Post-KPI paragraph section */}
          <div
            style={{
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "#555",
              margin: "100px auto",
              maxWidth: "800px",
              lineHeight: "2.0",
              textAlign: "left",
              padding: "0 40px",
            }}
          >
            <p>
              In 2024, India's annual average PM2.5 concentration translated into a startling health burden: over the course of a year, the air an average individual breathed was equivalent to smoking 796 cigarettes. This exposure was not limited to isolated hotspots. Across the country, 32 days of "Severe" AQI levels were recorded at multiple locations, according to this analysis concentrated predominantly across the northern Indian peninsula, where pollution episodes were both frequent and prolonged.
            </p>
            <p style={{ marginTop: "20px" }}>
              Yet poor air quality is not a regional anomaly; it is a national condition. From dense urban centers to smaller towns, polluted air affects everyday life for nearly 1.4 billion people. What varies is not exposure, but intensity shaped by geography, seasonal cycles, and human activity. Breathing in India has become an unavoidable public health risk, embedded into the rhythms of daily life.
            </p>
          </div>

          {/* Image Section with Timeline */}
          <div
            style={{
              position: "relative",
              maxWidth: "1000px",
              margin: "100px auto",
              padding: "60px 40px",
            }}
          >
            {/* Central vertical line */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "60px",
                bottom: "60px",
                width: "2px",
                backgroundColor: "#5699af",
                transform: "translateX(-50%)",
              }}
            />

            {/* Image 1 - Left image, Right text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image1.jpeg.webp"
                    alt="Heavy smog at Barakhamba, New Delhi"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://image.cnbcfm.com/api/v1/image/107328321-1698985540067-gettyimages-1760458010-20231102_dli-skh-mn_pollution-016-a.jpeg?v=1698985624&w=1480&h=833&ffmt=webp&vtcrop=y"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: CNBC
                  </a>
                </div>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  Heavy smog seen engulfed amid rise in pollution levels at Barakhamba on Nov. 2, 2023 in New Delhi, India. Authorities in the Indian capital, have shut all primary schools for two days amid worsening levels of air pollution. As part of the third phase of its Graded Response Action Plan to combat effects of increased pollution, a central pollution control panel ordered an immediate ban on non-essential construction work in the city.
                      </p>
              </div>
            </div>

            {/* Image 2 - Right image, Left text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                  On November 8, 2017, Indian schoolchildren covered their faces as they walked to school through thick smog in New Delhi. Air pollution had reached hazardous levels, forcing authorities to temporarily shut down the education system until the following week. The decision came just a day after doctors declared a “public health emergency” in what was then described as the world’s most polluted city.
                     </p>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image2.jpg"
                    alt="Schoolchildren in smog, New Delhi"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://platform.vox.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/9734675/GettyImages_871511920IndiaDelhi.jpg?quality=90&strip=all&crop=0,0.64377682403433,100,98.712446351931&w=1440"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: Vox
                  </a>
                </div>
              </div>
            </div>

            {/* Image 3 - Left image, Right text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image3.png"
                    alt="Image 3"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://www.nbcnews.com/news/world/toxic-smog-covers-indian-capital-pollution-hits-record-levels-rcna180745"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: NBC News
                  </a>
                </div>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  Smoke rises from burning garbage as a boy searches for recyclable items at a landfill in New Delhi. The burning waste emits toxic pollutants such as dioxins, nitrogen oxides, and particulate matter, posing serious respiratory risks to nearby residents and workers, who often lack adequate protective equipment. These landfill fires significantly worsen local air quality, a problem intensified by high temperatures and inadequate waste management infrastructure.
                      </p>
              </div>
            </div>

            {/* Image 4 - Right image, Left text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                Burning rice residue (parali) in Sangrur, Punjab, occurs annually in Oct-Nov to quickly and cheaply clear fields for wheat, leaving only 10–15 days for preparation. This practice, covering millions of tons of stubble, causes severe air pollution (PM2.5, CO), health hazards across Northern India, and kills beneficial soil nutrients. 
                    </p>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image4.jpg"
                    alt="Image 4"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://upload.wikimedia.org/wikipedia/commons/9/90/NP_India_burning_48_(6315309342).jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: Wikimedia Commons
                  </a>
                </div>
              </div>
            </div>

            {/* Image 5 - Left image, Right text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image5.png"
                    alt="Image 5"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://static.dw.com/image/73190652_1004.webp"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: DW
                  </a>
                </div>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                Over the past three decades, Byrnihat has transformed from a small settlement into a major industrial hub. This town of roughly 50,000 residents hosts around 80 industries, many centered on iron and steel production. Its winding roads are crowded with long lines of trucks  some idling, others transporting materials to and from factories. Today, it carries the unwanted distinction of being ranked the world's most polluted city by a Swiss air quality monitoring agency.   </p>
              </div>
            </div>

            {/* Image 6 - Right image, Left text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "120px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                 Diwali is one of India's most widely celebrated festivals, yet it is also a time when air pollution levels rise sharply due to the widespread use of firecrackers. During these days, the air becomes visibly hazy and physically difficult to breathe. Despite increasing awareness about the environmental impact, large-scale adoption of a truly "green Diwali" remains limited. In 2024, Delhi alone recorded AQI levels as high as 550 during Diwali falling into the severe to hazardous category highlighting the urgent need for more sustainable ways to celebrate.
                     </p>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image6.jpg"
                    alt="Image 6"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://www.hindustantimes.com/ht-img/img/2025/10/21/550x309/Pollution-Crackers-10_1761042960459_1761042970119.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: Hindustan Times
                  </a>
                </div>
              </div>
            </div>

            {/* Image 7 - Left image, Right text */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, paddingRight: "40px", display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{ position: "relative", maxWidth: "450px", width: "100%" }}
                  onMouseEnter={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.querySelector('.source-link').style.opacity = 0}
                >
                  <img
                    src="/image7.jpg"
                    alt="Image 7"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                  <a
                    className="source-link"
                    href="https://qz.com/cdn-cgi/image/width=1920,quality=85,format=auto/https://assets.qz.com/media/24632b4a6f33149276458e12e4ec1d74.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      textDecoration: "none",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    Source: Quartz
                  </a>
                </div>
              </div>
              {/* Dot on timeline */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#5699af",
                  borderRadius: "50%",
                  flexShrink: 0,
                  zIndex: 10,
                }}
              />
              <div style={{ flex: 1, paddingLeft: "40px" }}>
                <p
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                 A rural aburo stove using biomass cakes, fuelwood and trash as cooking fuel. Surveys suggest over 100 million households in India use such stoves (चूल्हा) every day, 2–3 times a day. Clean burning fuels and electricity are unavailable in rural parts and small towns of India because of poor rural highways and energy infrastructure.
  </p>
              </div>
            </div>
          </div>

          {/* Transition text section */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "10vh",
              padding: "10px 40px",
              marginTop: "50px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "22px",
                fontWeight: "300",
                color: "#333",
                textAlign: "left",
                maxWidth: "720px",
                lineHeight: "2.0",
                margin: 0,
                marginTop: "-10px",
              }}
            >
              So, What strategies and interventions has India put in place to tackle air quality concerns?
            </p>
          </div>

          {/* Timeline section - scrollytelling container */}
          <div
            ref={timelineScrollRef}
            style={{
              height: "380vh", // Tall container for all timeline events
              position: "relative",
              marginTop: "100px",
            }}
          >
            {/* Sticky timeline container */}
            <div
              ref={timelineRef}
              style={{
                position: "sticky",
                top: "100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "40px 20px 80px 20px",
                minHeight: "auto",
                backgroundColor: "#fff",
                zIndex: 10,
              }}
            >
              {/* Serpentine pattern container */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {/* Serpentine SVG pattern */}
                <div
                  style={{
                    position: "relative",
                    width: "1000px",
                    height: "450px",
                  }}
                >
                {/* Full serpentine pattern with row-by-row reveal */}
                <svg
                  width="1020"
                  height="450"
                  viewBox="-20 0 1020 450"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 20,
                    overflow: "visible",
                  }}
                >
                  {(() => {
                    // Symmetric layout constants
                    const startX = 20;
                    const endX = 960;
                    const lineWidth = endX - startX; // 940px
                    const numDots = 10; // 10 dots per decade (e.g., 1980-1989)
                    const startPadding = 40; // space between start of line and first dot
                    const endPadding = 40; // space between last dot and end of line
                    const dotSpacing = (lineWidth - startPadding - endPadding) / (numDots - 1); // spacing between dots
                    const rowHeight = 120;
                    const curveOffset = 60; // how far curve extends beyond line (larger = more circular)
                    const dotRadius = 8; // circular dots

                    // Generate dot positions for left-to-right rows (start after startPadding, end before endPadding)
                    const dotPositionsLTR = [...Array(numDots)].map((_, i) => startX + startPadding + i * dotSpacing);
                    // Generate dot positions for right-to-left rows (start after startPadding from end, end before endPadding)
                    const dotPositionsRTL = [...Array(numDots)].map((_, i) => endX - startPadding - i * dotSpacing);

                    // Path length constants for animation
                    // The curve is a cubic bezier with height 120px and horizontal bulge 60px
                    // Actual length is approximately 155px (not a perfect semicircle)
                    const curveLength = 165;
                    const totalPathLength = (lineWidth * 5) + (curveLength * 4);

                    // Calculate path length to reach a specific year
                    const getPathLengthToYear = (year) => {
                      if (!year) return 0;

                      // Determine which row and index
                      let row, index;
                      if (year >= 1980 && year <= 1989) {
                        row = 1; index = year - 1980;
                      } else if (year >= 1990 && year <= 1999) {
                        row = 2; index = year - 1990;
                      } else if (year >= 2000 && year <= 2009) {
                        row = 3; index = year - 2000;
                      } else if (year >= 2010 && year <= 2019) {
                        row = 4; index = year - 2010;
                      } else if (year >= 2020 && year <= 2029) {
                        row = 5; index = year - 2020;
                      } else {
                        return 0;
                      }

                      let length = 0;

                      // Add full rows and curves before this row
                      if (row >= 2) length += lineWidth + curveLength; // Row 1 + Curve 1
                      if (row >= 3) length += lineWidth + curveLength; // Row 2 + Curve 2
                      if (row >= 4) length += lineWidth + curveLength; // Row 3 + Curve 3
                      if (row >= 5) length += lineWidth + curveLength; // Row 4 + Curve 4

                      // Add position within current row
                      // For both LTR and RTL rows, the distance from the row start to dot at index i
                      // is startPadding + index * dotSpacing (dots are positioned symmetrically)
                      const posInRow = startPadding + (index * dotSpacing);
                      length += posInRow;

                      return length;
                    };

                    // Helper to check if a year should be highlighted (all years up to current index)
                    const isYearHighlighted = (year) => {
                      if (highlightedYearIndex < 0) return false;
                      const yearIdx = highlightSequence.indexOf(year);
                      return yearIdx !== -1 && yearIdx <= highlightedYearIndex;
                    };
                    const getElementOpacity = (year) => {
                      if (highlightedYearIndex < 0) return 1;
                      return isYearHighlighted(year) ? 1 : 0.15;
                    };
                    const getLineOpacity = () => highlightedYearIndex >= 0 ? 0.15 : 1;

                    // Get the current (most recent) highlighted year for animation
                    const currentHighlightedYear = highlightedYearIndex >= 0 ? highlightSequence[highlightedYearIndex] : null;

                    // Calculate animated line length
                    const animatedPathLength = currentHighlightedYear ? getPathLengthToYear(currentHighlightedYear) : 0;

                    return (
                      <>
                        {/* Row 1: left to right */}
                        <line
                          x1={startX}
                          y1="10"
                          x2={endX}
                          y2="10"
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />
                        {dotPositionsLTR.map((cx, i) => {
                          const year = 1980 + i;
                          const isHighlighted = isYearHighlighted(year);
                          const hasEvent = timelineEvents[year];
                          return (
                            <g
                              key={`r1-${i}`}
                              style={{ cursor: isHighlighted && hasEvent ? "pointer" : "default" }}
                              onClick={() => isHighlighted && hasEvent && setClickedYear(clickedYear === year ? null : year)}
                            >
                              <circle
                                cx={cx}
                                cy="10"
                                r={isHighlighted ? dotRadius * 1.5 : dotRadius}
                                fill={isHighlighted ? "#5699af" : "#adb5bd"}
                                style={{ opacity: getElementOpacity(year) }}
                              />
                              <text
                                x={cx}
                                y="42"
                                textAnchor="middle"
                                fontSize="12"
                                fontFamily="Avenir, sans-serif"
                                fontWeight={isHighlighted ? "600" : "400"}
                                fill={isHighlighted ? "#5699af" : "#6c757d"}
                                style={{ opacity: getElementOpacity(year) }}
                              >
                                {year}
                              </text>
                            </g>
                          );
                        })}

                        {/* Curve 1: right side */}
                        <path
                          d={`M ${endX} 10 C ${endX + curveOffset} 10, ${endX + curveOffset} ${10 + rowHeight}, ${endX} ${10 + rowHeight}`}
                          fill="none"
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />

                        {/* Row 2: right to left */}
                        <line
                          x1={endX}
                          y1={rowHeight + 10}
                          x2={startX}
                          y2={rowHeight + 10}
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />
                        {dotPositionsRTL.map((cx, i) => {
                          const year = 1990 + i;
                          const isHighlighted = isYearHighlighted(year);
                          const hasEvent = timelineEvents[year];
                          return (
                            <g
                              key={`r2-${i}`}
                              style={{ cursor: isHighlighted && hasEvent ? "pointer" : "default" }}
                              onClick={() => isHighlighted && hasEvent && setClickedYear(clickedYear === year ? null : year)}
                            >
                              <circle
                                cx={cx}
                                cy={rowHeight + 10}
                                r={isHighlighted ? dotRadius * 1.5 : dotRadius}
                                fill={isHighlighted ? "#5699af" : "#adb5bd"}
                                style={{ opacity: getElementOpacity(year) }}
                              />
                              <text
                                x={cx}
                                y={rowHeight + 42}
                                textAnchor="middle"
                                fontSize="12"
                                fontFamily="Avenir, sans-serif"
                                fontWeight={isHighlighted ? "600" : "400"}
                                fill={isHighlighted ? "#5699af" : "#6c757d"}
                                style={{ opacity: getElementOpacity(year) }}
                              >
                                {year}
                              </text>
                            </g>
                          );
                        })}

                        {/* Curve 2: left side */}
                        <path
                          d={`M ${startX} ${rowHeight + 10} C ${startX - curveOffset} ${rowHeight + 10}, ${startX - curveOffset} ${rowHeight*2 + 10}, ${startX} ${rowHeight*2 + 10}`}
                          fill="none"
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />

                        {/* Row 3: left to right */}
                        <line
                          x1={startX}
                          y1={rowHeight*2 + 10}
                          x2={endX}
                          y2={rowHeight*2 + 10}
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />
                        {dotPositionsLTR.map((cx, i) => {
                          const year = 2000 + i;
                          const isHighlighted = isYearHighlighted(year);
                          const hasEvent = timelineEvents[year];
                          return (
                            <g
                              key={`r3-${i}`}
                              style={{ cursor: isHighlighted && hasEvent ? "pointer" : "default" }}
                              onClick={() => isHighlighted && hasEvent && setClickedYear(clickedYear === year ? null : year)}
                            >
                              <circle
                                cx={cx}
                                cy={rowHeight*2 + 10}
                                r={isHighlighted ? dotRadius * 1.5 : dotRadius}
                                fill={isHighlighted ? "#5699af" : "#adb5bd"}
                                style={{ opacity: getElementOpacity(year) }}
                              />
                              <text
                                x={cx}
                                y={rowHeight*2 + 42}
                                textAnchor="middle"
                                fontSize="12"
                                fontFamily="Avenir, sans-serif"
                                fontWeight={isHighlighted ? "600" : "400"}
                                fill={isHighlighted ? "#5699af" : "#6c757d"}
                                style={{ opacity: getElementOpacity(year) }}
                              >
                                {year}
                              </text>
                            </g>
                          );
                        })}

                        {/* Curve 3: right side */}
                        <path
                          d={`M ${endX} ${rowHeight*2 + 10} C ${endX + curveOffset} ${rowHeight*2 + 10}, ${endX + curveOffset} ${rowHeight*3 + 10}, ${endX} ${rowHeight*3 + 10}`}
                          fill="none"
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />

                        {/* Row 4: right to left */}
                        <line
                          x1={endX}
                          y1={rowHeight*3 + 10}
                          x2={startX}
                          y2={rowHeight*3 + 10}
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />
                        {dotPositionsRTL.map((cx, i) => {
                          const year = 2010 + i;
                          const isHighlighted = isYearHighlighted(year);
                          const hasEvent = timelineEvents[year];
                          return (
                            <g
                              key={`r4-${i}`}
                              style={{ cursor: isHighlighted && hasEvent ? "pointer" : "default" }}
                              onClick={() => isHighlighted && hasEvent && setClickedYear(clickedYear === year ? null : year)}
                            >
                              <circle
                                cx={cx}
                                cy={rowHeight*3 + 10}
                                r={isHighlighted ? dotRadius * 1.5 : dotRadius}
                                fill={isHighlighted ? "#5699af" : "#adb5bd"}
                                style={{ opacity: getElementOpacity(year) }}
                              />
                              <text
                                x={cx}
                                y={rowHeight*3 + 42}
                                textAnchor="middle"
                                fontSize="12"
                                fontFamily="Avenir, sans-serif"
                                fontWeight={isHighlighted ? "600" : "400"}
                                fill={isHighlighted ? "#5699af" : "#6c757d"}
                                style={{ opacity: getElementOpacity(year) }}
                              >
                                {year}
                              </text>
                            </g>
                          );
                        })}

                        {/* Curve 4: left side */}
                        <path
                          d={`M ${startX} ${rowHeight*3 + 10} C ${startX - curveOffset} ${rowHeight*3 + 10}, ${startX - curveOffset} ${rowHeight*4 + 10}, ${startX} ${rowHeight*4 + 10}`}
                          fill="none"
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />

                        {/* Row 5: left to right */}
                        <line
                          x1={startX}
                          y1={rowHeight*4 + 10}
                          x2={endX}
                          y2={rowHeight*4 + 10}
                          stroke="#adb5bd"
                          strokeWidth="2"
                          style={{ opacity: getLineOpacity() }}
                        />
                        {dotPositionsLTR.map((cx, i) => {
                          const year = 2020 + i;
                          const isHighlighted = isYearHighlighted(year);
                          const hasEvent = timelineEvents[year];
                          return (
                            <g
                              key={`r5-${i}`}
                              style={{ cursor: isHighlighted && hasEvent ? "pointer" : "default" }}
                              onClick={() => isHighlighted && hasEvent && setClickedYear(clickedYear === year ? null : year)}
                            >
                              <circle
                                cx={cx}
                                cy={rowHeight*4 + 10}
                                r={isHighlighted ? dotRadius * 1.5 : dotRadius}
                                fill={isHighlighted ? "#5699af" : "#adb5bd"}
                                style={{ opacity: getElementOpacity(year) }}
                              />
                              <text
                                x={cx}
                                y={rowHeight*4 + 42}
                                textAnchor="middle"
                                fontSize="12"
                                fontFamily="Avenir, sans-serif"
                                fontWeight={isHighlighted ? "600" : "400"}
                                fill={isHighlighted ? "#5699af" : "#6c757d"}
                                style={{ opacity: getElementOpacity(year) }}
                              >
                                {year}
                              </text>
                            </g>
                          );
                        })}

                        {/* Animated red line that traces from start to highlighted year */}
                        <path
                          d={`M ${startX} 10
                              L ${endX} 10
                              C ${endX + curveOffset} 10, ${endX + curveOffset} ${10 + rowHeight}, ${endX} ${10 + rowHeight}
                              L ${startX} ${10 + rowHeight}
                              C ${startX - curveOffset} ${10 + rowHeight}, ${startX - curveOffset} ${10 + rowHeight*2}, ${startX} ${10 + rowHeight*2}
                              L ${endX} ${10 + rowHeight*2}
                              C ${endX + curveOffset} ${10 + rowHeight*2}, ${endX + curveOffset} ${10 + rowHeight*3}, ${endX} ${10 + rowHeight*3}
                              L ${startX} ${10 + rowHeight*3}
                              C ${startX - curveOffset} ${10 + rowHeight*3}, ${startX - curveOffset} ${10 + rowHeight*4}, ${startX} ${10 + rowHeight*4}
                              L ${endX} ${10 + rowHeight*4}`}
                          fill="none"
                          stroke="#5699af"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={totalPathLength}
                          strokeDashoffset={currentHighlightedYear ? totalPathLength - animatedPathLength : totalPathLength}
                          style={{
                            transition: "stroke-dashoffset 1.2s ease-out",
                          }}

                        />
                      </>
                    );
                  })()}
                </svg>

                {/* Popup for current animated year OR hovered year */}
                {(() => {
                  // Determine which year to show popup for:
                  // - If a year was clicked, show that
                  // - Otherwise show the current animated year (unless in exploration phase)
                  const currentAnimatedYear = highlightedYearIndex >= 0 ? highlightSequence[highlightedYearIndex] : null;
                  const autoShowYear = isExplorationPhase ? null : currentAnimatedYear;
                  const yearToShow = clickedYear || autoShowYear;

                  if (!yearToShow || !timelineEvents[yearToShow]) return null;

                  // Calculate popup position based on year's row and index
                  const event = timelineEvents[yearToShow];
                  const startX = 20;
                  const endX = 960;
                  const startPadding = 40;
                  const dotSpacing = (endX - startX - startPadding * 2) / 9;
                  const rowHeight = 120;

                  // Calculate dot X position
                  const isLTR = event.row === 1 || event.row === 3 || event.row === 5;
                  const dotX = isLTR
                    ? startX + startPadding + event.index * dotSpacing
                    : endX - startPadding - event.index * dotSpacing;

                  // Calculate dot Y position
                  const dotY = (event.row - 1) * rowHeight + 10;

                  // Position popup - to the left for specific years (2009, 2014, 2016, 2019) to avoid blocking animation
                  const popupWidth = yearToShow === 2019 ? 220 : 280;
                  const showOnLeft = yearToShow === 2009 || yearToShow === 2014 || yearToShow === 2016 || yearToShow === 2019;
                  const popupLeft = showOnLeft ? dotX - popupWidth - 60 : dotX + 60;
                  const popupTop = dotY - 40;

                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: `${popupLeft}px`,
                        top: `${popupTop}px`,
                        width: `${popupWidth}px`,
                        backgroundColor: "#fff",
                        border: "2px solid #5699af",
                        borderRadius: "8px",
                        padding: "16px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        opacity: 1,
                        zIndex: 100,
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "#5699af",
                          marginBottom: "8px",
                        }}
                      >
                        {yearToShow}
                      </div>
                      <div
                        style={{
                          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "8px",
                        }}
                      >
                        {timelineEvents[yearToShow].title}
                      </div>
                      <div
                        style={{
                          fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                          fontSize: "12px",
                          fontWeight: "400",
                          color: "#555",
                          lineHeight: "2.0",
                        }}
                      >
                        {timelineEvents[yearToShow].description}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "-60px", marginBottom: "40px" }}>
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "11px",
                color: "#888",
                margin: 0,
              }}
            >
              Reference: <a href="https://urbanemissions.info/wp-content/uploads/images/2019-12-NCAP-India_AQ_Timeline.png" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af", textDecoration: "none" }}>Urban Emissions - India AQ Timeline</a>
            </p>
          </div>

          {/* Transition text after timeline */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "30vh",
              padding: "40px 40px",
              marginTop: "100px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "22px",
                fontWeight: "300",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
                marginTop: "-10px",
              }}
            >
              India's response to air pollution spans decades of policies, monitoring frameworks, and emergency interventions. On paper, the actions are many. On the ground, however, clean air remains out of reach for most.
            </p>
          </div>

          {/* India AQI Map - Standalone Section with Circular Overlays */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              position: "relative",
              minHeight: "200vh",
            }}
          >
            {/* Left: Sticky Map Visualization */}
            <div
              style={{
                width: "55%",
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "600px",
                  height: "684px",
                  overflow: "visible",
                }}
              >
              {/* Base India Map */}
              <object
                ref={standAloneAqiMapRef}
                data="/india-states.svg"
                type="image/svg+xml"
                width="600"
                height="684"
                style={{ pointerEvents: "none", position: "absolute", top: 0, left: 0 }}
                onLoad={() => {
                  if (standAloneAqiMapRef.current) {
                    const svgDoc = standAloneAqiMapRef.current.contentDocument;
                    if (svgDoc) {
                      const paths = svgDoc.querySelectorAll("path");

                      // State ID to name mapping
                      const stateIdToName = {
                        "ap": "Andhra Pradesh", "ar": "Arunachal Pradesh", "as": "Assam",
                        "br": "Bihar", "ch": "Chandigarh", "ct": "Chhattisgarh",
                        "dl": "Delhi", "ga": "Goa", "gj": "Gujarat",
                        "hr": "Haryana", "hp": "Himachal Pradesh", "jh": "Jharkhand",
                        "ka": "Karnataka", "kl": "Kerala", "mp": "Madhya Pradesh",
                        "mh": "Maharashtra", "mn": "Manipur", "ml": "Meghalaya",
                        "mz": "Mizoram", "nl": "Nagaland", "or": "Odisha",
                        "pb": "Punjab", "rj": "Rajasthan", "sk": "Sikkim",
                        "tn": "Tamil Nadu", "tg": "Telangana", "tr": "Tripura",
                        "up": "Uttar Pradesh", "ut": "Uttarakhand", "wb": "West Bengal"
                      };

                      // AQI color function
                      const getAQIColor = (avgAQI) => {
                        if (!avgAQI) return "#e8e8e8";
                        if (avgAQI <= 50) return "#5699af"; // Good
                        if (avgAQI <= 100) return "#87beb1"; // Satisfactory
                        if (avgAQI <= 200) return "#dfbfc6"; // Moderate
                        if (avgAQI <= 300) return "#de9eaf"; // Poor
                        if (avgAQI <= 400) return "#e07192"; // Very Poor
                        return "#c1616b"; // Severe
                      };

                      // Create a map of state names to avgAQI
                      const stateAQIMap = {};
                      stateData.forEach((state) => {
                        stateAQIMap[state.state] = state.avgAQI;
                      });

                      // SVG viewBox is 612x696, rendered at 600x684
                      const scaleX = 600 / 612;
                      const scaleY = 684 / 696;

                      const centroids = {};
                      paths.forEach((path) => {
                        const id = path.id;
                        const name = stateIdToName[id] || path.getAttribute("name");

                        // Fill all states with grey
                        path.style.fill = "#d0d0d0";
                        path.style.opacity = "0.7";
                        path.style.stroke = "#fff";
                        path.style.strokeWidth = "0.5";

                        // Compute centroids
                        if (name && stateIdToName[id]) {
                          const bbox = path.getBBox();
                          centroids[name] = {
                            x: (bbox.x + bbox.width / 2) * scaleX,
                            y: (bbox.y + bbox.height / 2) * scaleY
                          };
                        }
                      });
                      setMapCentroids(centroids);
                    }
                  }
                }}
              />

              {/* Circular Visualization Overlays - only render when centroids are computed */}
              {stateData.length > 0 && mapCentroids && stateData.map((stateInfo) => {
                const pos = mapCentroids[stateInfo.state];
                if (!pos) return null;

                // Visual size for each circle on the map
                const visualSize = 90;

                return (
                  <div
                    key={stateInfo.state}
                    style={{
                      position: "absolute",
                      left: pos.x - visualSize / 2,
                      top: pos.y - visualSize / 2,
                      width: visualSize,
                      height: visualSize,
                      pointerEvents: "auto",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      setHoveredAQIMapState(stateInfo);
                      setAqiMapTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      setAqiMapTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => {
                      setHoveredAQIMapState(null);
                    }}
                  >
                    <div style={{
                      transform: `scale(${visualSize / 800})`,
                      transformOrigin: "top left",
                      width: 800,
                      height: 800,
                      pointerEvents: "none",
                    }}>
                      {renderCircularVisualization(stateInfo, true)}
                    </div>
                  </div>
                );
              })}

              {/* AQI Map Tooltip */}
              {hoveredAQIMapState && (
                <div
                  style={{
                    position: "fixed",
                    left: aqiMapTooltipPos.x + 15,
                    top: aqiMapTooltipPos.y - 10,
                    backgroundColor: "rgba(255, 255, 255, 0.97)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    border: "1px solid #e0e0e0",
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    pointerEvents: "none",
                    zIndex: 1001,
                    minWidth: "140px",
                  }}
                >
                  <div style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                    marginBottom: "6px",
                  }}>
                    {hoveredAQIMapState.state}
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: "#666",
                  }}>
                    <span style={{ color: "#999" }}>Average AQI:</span>{" "}
                    <strong style={{ color: "#333" }}>{hoveredAQIMapState.avgAQI?.toFixed(0) || "N/A"}</strong>
                  </div>
                </div>
              )}

              {/* Instruction text */}
              <p
                style={{
                  position: "absolute",
                  bottom: "-25px",
                  left: "35%",
                  transform: "translateX(-50%)",
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "11px",
                  color: "#888",
                  fontStyle: "italic",
                  margin: 0,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                Hover for more information
              </p>
              </div>
            </div>

            {/* Right: Scrollable Cards Container */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* First Card - Mapping Air Quality Index */}
              <div
                style={{
                  minHeight: "100vh",
                  padding: "60px 40px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      margin: 0,
                      marginBottom: "15px",
                      lineHeight: "1.3",
                    }}
                  >
                    Mapping Air Quality Index (AQI) across India
                  </h2>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      color: "#555",
                      lineHeight: "1.8",
                      marginTop: "15px",
                      marginBottom: "15px",
                    }}
                  >
                    The map of India on the left illustrates Air Quality Index (AQI) conditions across 2024. Each circular calendar represents a state or union territory, with radial lines showing daily AQI values throughout the year. Colors indicate pollution severity, blue tones for better air quality and pink tones for poorer conditions.
                  </p>
                  <a
                    href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      color: "#5699af",
                      fontStyle: "italic",
                      marginBottom: 0,
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    Source: Kaggle - India Air Quality Index 2024 Dataset
                  </a>
                </div>
              </div>

              {/* Second Card - AQI Categories & Health Impact */}
              <div
                style={{
                  minHeight: "80vh",
                  padding: "60px 40px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h4
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      margin: 0,
                      marginBottom: "20px",
                    }}
                  >
                    AQI Categories & Health Impact
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#5699af", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Good (0–50):</strong> Minimal health impact.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#87beb1", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Satisfactory (51–100):</strong> May cause minor breathing discomfort for sensitive individuals.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#dfbfc6", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Moderate (101–200):</strong> Can lead to breathing discomfort for people with asthma or lung disease.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#de9eaf", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Poor (201–300):</strong> May cause breathing discomfort with prolonged exposure.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#e07192", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Very Poor (301–400):</strong> Prolonged exposure may result in respiratory illness.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", backgroundColor: "#c1616b", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
                      <p style={{ fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif", fontSize: "14px", color: "#555", lineHeight: "1.6", margin: 0 }}>
                        <strong style={{ color: "#333" }}>Severe (401–500):</strong> Can cause respiratory effects even in healthy individuals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Transition text before state circular visualizations */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "40vh",
              padding: "60px 20px",
              background: "#fff",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "22px",
                fontWeight: "300",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
                marginTop: "-10px",
              }}
            >
              Now, let's zoom in and explore how air pollution unfolds across the year in each state and its major cities. By looking more closely at these regional patterns, we can see how air quality shifts over time and which areas experience the most prolonged exposure to unhealthy conditions.
            </p>
          </div>

          {/* AQI by category and states - Grid visualization */}
          <div
            ref={gridSectionRef}
            style={{
              padding: "0 40px 40px 40px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Header section - sticky in scrollable mode */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginTop: "10px",
                marginBottom: "0px",
                ...(viewMode === "scrollable" ? {
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#fff",
                  zIndex: 100,
                  paddingTop: "20px",
                  paddingBottom: "20px",
                  marginTop: "0px",
                } : {}),
              }}
            >
              {/* Left - Title and Tabs */}
              <div>
                <h2
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "#333",
                    margin: "0 0 15px 0",
                  }}
                >
                  AQI Across states and Union Territories
                </h2>
                {/* Tabs */}
                <div style={{ display: "flex", gap: "30px" }}>
                  {/* Sort Tab */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      color: "#666",
                    }}>
                      Sort by:
                    </span>
                    <select
                      value={sortOrder}
                      onChange={(e) => handleSortChange(e.target.value)}
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "12px",
                        padding: "4px 8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="alphabetical">Alphabetical</option>
                      <option value="highToLow">Highest to Lowest AQI</option>
                      <option value="lowToHigh">Lowest to Highest AQI</option>
                    </select>
                  </div>
                  {/* View Tab */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      color: "#666",
                    }}>
                      View:
                    </span>
                    <button
                      onClick={() => {
                        handleViewModeChange("overview");
                        gridSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "12px",
                        padding: "4px 12px",
                        border: "1px solid #ddd",
                        borderRadius: "4px 0 0 4px",
                        backgroundColor: viewMode === "overview" ? "#5699af" : "#fff",
                        color: viewMode === "overview" ? "#fff" : "#333",
                        cursor: "pointer",
                      }}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => handleViewModeChange("scrollable")}
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "12px",
                        padding: "4px 12px",
                        border: "1px solid #ddd",
                        borderLeft: "none",
                        borderRadius: "0 4px 4px 0",
                        backgroundColor: viewMode === "scrollable" ? "#5699af" : "#fff",
                        color: viewMode === "scrollable" ? "#fff" : "#333",
                        cursor: "pointer",
                      }}
                    >
                      Scrollable
                    </button>
                  </div>
                </div>
              </div>

              {/* Right - India map with How to read section */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
                {/* How to read section */}
                <div style={{ maxWidth: "520px" }}>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#333",
                      margin: "0 0 10px 0",
                    }}
                  >
                    How to read?
                  </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "11px",
                      color: "#555",
                      lineHeight: "1.5",
                      margin: "0 0 6px 0",
                    }}
                  >
                    Each circular graphic represents a State or Union Territory of India. Within every circle, each line marks a single day of 2024, arranged clockwise across the year. The spikes within the circle show the intensity of air pollution—the longer the spike, the worse the AQI on that day.
                  </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "11px",
                      color: "#555",
                      lineHeight: "1.5",
                      margin: "0 0 6px 0",
                    }}
                  >
                    Colors indicate AQI levels: <span style={{ color: "#5699af", fontWeight: "600" }}>Good</span>, <span style={{ color: "#87beb1", fontWeight: "600" }}>Satisfactory</span>, <span style={{ color: "#dfbfc6", fontWeight: "600" }}>Moderate</span>, <span style={{ color: "#de9eaf", fontWeight: "600" }}>Poor</span>, <span style={{ color: "#e07192", fontWeight: "600" }}>Very Poor</span>, <span style={{ color: "#c1616b", fontWeight: "600" }}>Severe</span>, <span style={{ color: "#ccc", fontWeight: "600" }}>No Data</span>. Hover over any circle to view more detailed information, and click to explore a closer, in-depth view. The scrollable sections also guide you through expanded insights and deeper analysis. (<a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Source: Kaggle</a>)
                  </p>
                </div>

                {/* India map */}
                <div
                  ref={smallMapRef}
                  style={{
                    width: "140px",
                    height: "160px",
                    position: "relative",
                    flexShrink: 0,
                    opacity: mapMorphProgress > 0.5 ? 0 : 1,
                    transition: "opacity 0.3s ease",
                  }}
                >
                <object
                  ref={indiaMapRef}
                  data="/india-states.svg"
                  type="image/svg+xml"
                  width="140"
                  height="160"
                  style={{ pointerEvents: "none" }}
                  onLoad={() => {
                    // Initial styling when SVG loads
                    if (indiaMapRef.current) {
                      const svgDoc = indiaMapRef.current.contentDocument;
                      if (svgDoc) {
                        const paths = svgDoc.querySelectorAll("path");
                        paths.forEach((path) => {
                          path.style.fill = "#d0d0d0";
                          path.style.stroke = "#fff";
                          path.style.strokeWidth = "0.3";
                          path.style.opacity = "0.7";
                          path.style.transition = "fill 0.2s, opacity 0.2s";
                        });
                      }
                    }
                  }}
                />
                </div>
              </div>
            </div>

            {/* Grid of circular visualizations - Overview mode */}
            {viewMode === "overview" && (
            <div
              ref={circularGridRef}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                columnGap: "0px",
                rowGap: "25px",
                justifyItems: "center",
                width: "100%",
                position: "relative",
                marginTop: "15px",
                opacity: isViewTransitioning ? 0 : 1,
                transition: "opacity 0.25s ease",
              }}
            >
              {sortedStateData.map((stateInfo, index) => {
                // Find the original index in stateData for scrollable view
                const originalIndex = stateData.findIndex(s => s.state === stateInfo.state);
                return (
                  <div
                    key={stateInfo.state}
                    data-state-id={stateInfo.state}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "100%",
                      maxWidth: "120px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      setHoveredStateIndex(index);
                      setGridTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      setGridTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredStateIndex(null)}
                    onClick={() => {
                      setHoveredStateIndex(null);
                      handleViewModeChange("scrollable", originalIndex);
                    }}
                  >
                    <div
                      style={{
                        width: "120px",
                        height: "120px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ transform: "scale(0.22)", transformOrigin: "center center" }}>
                        {renderCircularVisualization(stateInfo, true)}
                      </div>
                    </div>
                    <p
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "9px",
                        color: "#333",
                        margin: "12px 0 0 0",
                        textAlign: "center",
                        maxWidth: "140px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {stateInfo.state}
                    </p>
                  </div>
                );
              })}

              {/* Custom tooltip for grid */}
              {hoveredStateIndex !== null && sortedStateData[hoveredStateIndex] && (() => {
                const stateInfo = sortedStateData[hoveredStateIndex];
                // Use pre-calculated avgAQI
                const avgAQI = stateInfo.avgAQI;
                const categoryInfo = avgAQI ? getAQICategoryInfo(avgAQI) : null;

                return (
                  <div
                    style={{
                      position: "fixed",
                      left: gridTooltipPos.x + 15,
                      top: gridTooltipPos.y + 15,
                      background: "white",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      zIndex: 1000,
                      maxWidth: "280px",
                      pointerEvents: "none",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#333",
                        margin: "0 0 8px 0",
                      }}
                    >
                      {stateInfo.state}
                    </p>
                    {avgAQI && categoryInfo && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span
                            style={{
                              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                              fontSize: "12px",
                              color: "#555",
                            }}
                          >
                            Average AQI:
                          </span>
                          <span
                            style={{
                              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                              fontSize: "14px",
                              fontWeight: "bold",
                              color: categoryInfo.color,
                            }}
                          >
                            {avgAQI}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span
                            style={{
                              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                              fontSize: "12px",
                              color: "#555",
                            }}
                          >
                            Category:
                          </span>
                          <span
                            style={{
                              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                              fontSize: "12px",
                              fontWeight: "bold",
                              color: "white",
                              background: categoryInfo.color,
                              padding: "2px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            {categoryInfo.category}
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                            fontSize: "11px",
                            color: "#666",
                            margin: 0,
                            lineHeight: "1.4",
                            borderTop: "1px solid #eee",
                            paddingTop: "8px",
                          }}
                        >
                          {categoryInfo.health}
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            )}

            {/* Main visualization section with sticky chart - Scrollable mode */}
            {viewMode === "scrollable" && (
            <div
              ref={mainVisualizationRef}
              style={{
                display: "flex",
                minHeight: "100vh",
                padding: "20px 20px 20px 0",
                opacity: isViewTransitioning ? 0 : 1,
                transition: "opacity 0.25s ease",
              }}
            >
            {/* Sticky visualization on the left */}
            <div
              style={{
                position: "sticky",
                top: "130px",
                height: "fit-content",
                flexShrink: 0,
                marginLeft: "-50px",
              }}
            >
              <div style={{ position: "relative" }}>
                {stateData.length > 0 && renderCircularVisualization(stateData[activeStateIndex])}
              </div>
            </div>

            {/* Scrollable state list on the right */}
            <div
              style={{
                flex: 1,
                marginLeft: "30px",
                paddingTop: "200px",
                paddingBottom: "150px",
                textAlign: "left",
              }}
            >
              {stateData.map((stateInfo, index) =>
                renderStateCard(stateInfo, index)
              )}
            </div>

            {/* Custom scroll indicator */}
            <div
              style={{
                position: "sticky",
                top: "calc(50vh - 100px)",
                height: "fit-content",
                marginLeft: "20px",
                marginRight: "10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Track */}
              <div
                style={{
                  width: "3px",
                  height: "400px",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "2px",
                  position: "relative",
                }}
              >
                {/* Thumb */}
                <div
                  style={{
                    position: "absolute",
                    width: "3px",
                    height: `${Math.max(30, 400 / stateData.length)}px`,
                    backgroundColor: "#5699af",
                    borderRadius: "2px",
                    top: `${(activeStateIndex / Math.max(1, stateData.length - 1)) * (400 - Math.max(30, 400 / stateData.length))}px`,
                    transition: "top 0.3s ease",
                  }}
                />
              </div>
            </div>
          </div>
          )}

          </div>


          {/* Transition Text */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: "60px 20px",
              marginTop: "80px",
              background: "#fff",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "22px",
                fontWeight: "300",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
                marginTop: "-10px",
              }}
            >
              
Now, let's look beyond AQI levels and explore the major causes driving air pollution across India.
            </p>
          </div>

          {/* AQI Correlation Scrollytelling Section */}
          <div
            style={{
              position: "relative",
              display: "flex",
              backgroundColor: "#fff",
            }}
          >
            {/* Left - Sticky India Map with Population/Rainfall dots */}
            <div
              style={{
                width: "55%",
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              {/* Tabs for Population, Climate, Wind, Geography */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
                {[
                  { name: "Population", index: 0, color: "#5699af" },
                  { name: "Climate", index: 1, color: "#5699af" },
                  { name: "Wind", index: 2, color: "#5699af" },
                  { name: "Geography", index: 3, color: "#5699af" },
                ].map((tab) => (
                  <button
                    key={tab.index}
                    onClick={() => setActiveScatterIndex(tab.index)}
                    style={{
                      padding: "8px 16px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "13px",
                      fontWeight: activeScatterIndex === tab.index ? "600" : "400",
                      color: activeScatterIndex === tab.index ? "#333" : "#888",
                      backgroundColor: activeScatterIndex === tab.index ? "#fff" : "transparent",
                      border: "none",
                      borderBottom: activeScatterIndex === tab.index ? `3px solid ${tab.color}` : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* Tooltip overlay on map - appears when hovering scatter or map dots */}
              {hoveredScatterPoint && activeScatterIndex < 2 && (
                <div
                  style={{
                    position: "absolute",
                    // Use direct pixel coordinates from SVG overlay
                    left: Math.min(hoveredScatterPoint.x + 15, 500),
                    top: hoveredScatterPoint.y - 50,
                    backgroundColor: "rgba(255, 255, 255, 0.97)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    pointerEvents: "none",
                    zIndex: 1000,
                    minWidth: "160px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      marginBottom: "8px",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "6px",
                    }}
                  >
                    {hoveredScatterPoint.state}
                  </div>
                  <div
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: "#999" }}>Average AQI:</span> {hoveredScatterPoint.aqi}
                  </div>
                  {activeScatterIndex === 0 && (
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "12px",
                        color: "#666",
                      }}
                    >
                      <span style={{ color: "#999" }}>Population:</span> {hoveredScatterPoint.population}M
                    </div>
                  )}
                  {activeScatterIndex === 1 && (
                    <div
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "12px",
                        color: "#666",
                      }}
                    >
                      <span style={{ color: "#999" }}>Rainfall:</span> {hoveredScatterPoint.rainfall}mm
                    </div>
                  )}
                </div>
              )}

              {/* Mapbox Map - shown for all tabs (Population, Climate, Wind, Geography) */}
              <div style={{
                position: "relative",
                width: 650,
                height: 626,
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}>
                <div
                  ref={windMapboxContainerRef}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
                {/* AQI spike circles overlay for Population/Climate tabs */}
                {activeScatterIndex < 2 && (
                  <svg
                    width="650"
                    height="626"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      pointerEvents: "auto",
                    }}
                  >
                    {stateData.map((state) => {
                      // Geographic coordinates (lon, lat) for each state centroid
                      const stateGeoCoords = {
                        "Andhra Pradesh": { lon: 79.74, lat: 15.91 },
                        "Arunachal Pradesh": { lon: 94.73, lat: 28.22 },
                        "Assam": { lon: 92.94, lat: 26.20 },
                        "Bihar": { lon: 85.31, lat: 25.10 },
                        "Chhattisgarh": { lon: 81.87, lat: 21.28 },
                        "Delhi": { lon: 77.10, lat: 28.70 },
                        "Goa": { lon: 74.12, lat: 15.30 },
                        "Gujarat": { lon: 71.19, lat: 22.26 },
                        "Haryana": { lon: 76.08, lat: 29.06 },
                        "Himachal Pradesh": { lon: 77.17, lat: 31.10 },
                        "Jharkhand": { lon: 85.28, lat: 23.61 },
                        "Karnataka": { lon: 75.71, lat: 15.32 },
                        "Kerala": { lon: 76.27, lat: 10.85 },
                        "Madhya Pradesh": { lon: 78.66, lat: 22.97 },
                        "Maharashtra": { lon: 75.71, lat: 19.75 },
                        "Manipur": { lon: 93.91, lat: 24.66 },
                        "Meghalaya": { lon: 91.37, lat: 25.47 },
                        "Mizoram": { lon: 92.94, lat: 23.16 },
                        "Nagaland": { lon: 94.56, lat: 26.16 },
                        "Odisha": { lon: 85.09, lat: 20.94 },
                        "Punjab": { lon: 75.34, lat: 31.15 },
                        "Rajasthan": { lon: 74.22, lat: 27.02 },
                        "Sikkim": { lon: 88.51, lat: 27.53 },
                        "Tamil Nadu": { lon: 78.66, lat: 11.13 },
                        "Telangana": { lon: 79.02, lat: 18.11 },
                        "Tripura": { lon: 91.99, lat: 23.94 },
                        "Uttar Pradesh": { lon: 80.95, lat: 26.85 },
                        "Uttarakhand": { lon: 79.07, lat: 30.07 },
                        "West Bengal": { lon: 87.86, lat: 22.99 },
                        "Chandigarh": { lon: 76.78, lat: 30.73 },
                      };

                      const geo = stateGeoCoords[state.state];
                      if (!geo) return null;

                      // Convert geographic coordinates to pixel positions
                      // Mapbox bounds: [68, 6] to [98, 37] with padding 20
                      const padding = 20;
                      const minLon = 68, maxLon = 98;
                      const minLat = 6, maxLat = 37;
                      const containerWidth = 650, containerHeight = 626;

                      const coord = {
                        x: padding + ((geo.lon - minLon) / (maxLon - minLon)) * (containerWidth - 2 * padding),
                        y: padding + ((maxLat - geo.lat) / (maxLat - minLat)) * (containerHeight - 2 * padding),
                      };
                      if (!coord) return null;

                      const popData = populationData.find(p =>
                        p.state === state.state ||
                        p.state.replace("&", "and") === state.state ||
                        p.state.replace(" & ", " and ") === state.state
                      );

                      const population = popData ? popData.population / 1000000 : 10;
                      const rainfall = popData?.rainfall || 1000;

                      const isHovered = hoveredScatterPoint?.state === state.state;

                      const aqiValues = [];
                      const dateMap = new Map();
                      const selectedArea = selectedAreas[state.state];

                      state.areaData.forEach((areaMonths, area) => {
                        if (selectedArea && area !== selectedArea) return;
                        areaMonths.forEach((days, monthKey) => {
                          days.forEach((dayData, dayNum) => {
                            const dateKey = `${monthKey}-${dayNum}`;
                            const existing = dateMap.get(dateKey);
                            if (!existing || dayData.aqiValue > existing.aqiValue) {
                              dateMap.set(dateKey, { aqiValue: dayData.aqiValue });
                            }
                            if (dayData.aqiValue) aqiValues.push(dayData.aqiValue);
                          });
                        });
                      });

                      const avgAQI = aqiValues.length > 0
                        ? aqiValues.reduce((sum, val) => sum + val, 0) / aqiValues.length
                        : 0;

                      const getAqiColor = (avg) => {
                        if (avg <= 50) return "#5699af";
                        if (avg <= 100) return "#87beb1";
                        if (avg <= 200) return "#dfbfc6";
                        if (avg <= 300) return "#de9eaf";
                        if (avg <= 400) return "#e07192";
                        return "#c1616b";
                      };
                      const aqiColor = getAqiColor(avgAQI);

                      // Semi-circle radius based on AQI
                      const minRadius = 8;
                      const maxRadius = 28;
                      const maxAQI = 400;
                      const normalizedAQI = Math.min(avgAQI / maxAQI, 1);
                      const aqiRadius = minRadius + normalizedAQI * (maxRadius - minRadius);

                      // Semi-circle radius based on Population or Rainfall
                      const maxPop = 250;
                      const maxRain = 3000;
                      const normalizedValue = activeScatterIndex === 1
                        ? Math.min(rainfall / maxRain, 1)
                        : Math.min(population / maxPop, 1);
                      const popRainRadius = minRadius + normalizedValue * (maxRadius - minRadius);

                      // Blue color intensity for population/rainfall
                      const intensity = normalizedValue;
                      const r = Math.round(179 - intensity * 153);
                      const g = Math.round(217 - intensity * 127);
                      const b = Math.round(230 - intensity * 108);
                      const popRainColor = `rgb(${r}, ${g}, ${b})`;

                      // Hover adjustment
                      const hoverAdd = isHovered ? 2 : 0;
                      const aqiR = aqiRadius + hoverAdd;
                      const popR = popRainRadius + hoverAdd;

                      // Left semi-circle path (AQI) - arc from top to bottom, curving left
                      const leftPath = `M ${coord.x} ${coord.y - aqiR} A ${aqiR} ${aqiR} 0 0 0 ${coord.x} ${coord.y + aqiR} Z`;

                      // Right semi-circle path (Population/Rainfall) - arc from top to bottom, curving right
                      const rightPath = `M ${coord.x} ${coord.y - popR} A ${popR} ${popR} 0 0 1 ${coord.x} ${coord.y + popR} Z`;

                      // Dim non-hovered circles when any circle is hovered
                      const isDimmed = hoveredScatterPoint && !isHovered;
                      const groupOpacity = isDimmed ? 0.3 : 1;

                      return (
                        <g
                          key={state.state}
                          style={{ cursor: "pointer", opacity: groupOpacity, transition: "opacity 0.2s ease" }}
                          onMouseEnter={() => {
                            setHoveredScatterPoint({
                              state: state.state,
                              aqi: Math.round(state.avgAQI),
                              population: Math.round(population),
                              rainfall: Math.round(rainfall),
                              region: popData?.region || "Unknown",
                              x: coord.x,
                              y: coord.y,
                            });
                          }}
                          onMouseLeave={() => setHoveredScatterPoint(null)}
                        >
                          {/* Left semi-circle - AQI */}
                          <path
                            d={leftPath}
                            fill={aqiColor}
                            fillOpacity={1}
                            stroke={aqiColor}
                            strokeWidth={isHovered ? 1.5 : 1}
                            strokeOpacity={1}
                          />
                          {/* Right semi-circle - Population/Rainfall */}
                          <path
                            d={rightPath}
                            fill={popRainColor}
                            fillOpacity={1}
                            stroke={popRainColor}
                            strokeWidth={isHovered ? 1.5 : 1}
                            strokeOpacity={1}
                          />
                        </g>
                      );
                    })}
                  </svg>
                )}
                {/* Legend for Population/Climate maps */}
                {activeScatterIndex < 2 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 15,
                      right: 15,
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      padding: "12px 15px",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      fontSize: "11px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      maxWidth: "220px",
                    }}
                  >
                    {/* Left Semi-circle - AQI Legend */}
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontWeight: "600", color: "#333", marginBottom: "6px" }}>
                        Left Half: Average AQI
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="90" height="32" style={{ overflow: "visible" }}>
                          {/* Small left semi-circle */}
                          <path d="M 8 10 A 6 6 0 0 0 8 22 Z" fill="#5699af" fillOpacity="1" stroke="#5699af" strokeWidth="1" />
                          {/* Medium left semi-circle */}
                          <path d="M 32 6 A 10 10 0 0 0 32 26 Z" fill="#87beb1" fillOpacity="1" stroke="#87beb1" strokeWidth="1" />
                          {/* Large left semi-circle */}
                          <path d="M 64 2 A 14 14 0 0 0 64 30 Z" fill="#de9eaf" fillOpacity="1" stroke="#de9eaf" strokeWidth="1" />
                        </svg>
                        <span style={{ color: "#666", fontSize: "10px" }}>Low → High</span>
                      </div>
                    </div>

                    {/* Right Semi-circle - Population or Rainfall Legend */}
                    <div>
                      <div style={{ fontWeight: "600", color: "#333", marginBottom: "6px" }}>
                        Right Half: {activeScatterIndex === 0 ? "Population" : "Rainfall"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="90" height="32" style={{ overflow: "visible" }}>
                          {/* Small right semi-circle */}
                          <path d="M 8 10 A 6 6 0 0 1 8 22 Z" fill="rgb(179, 217, 230)" fillOpacity="1" stroke="rgb(179, 217, 230)" strokeWidth="1" />
                          {/* Medium right semi-circle */}
                          <path d="M 32 6 A 10 10 0 0 1 32 26 Z" fill="rgb(102, 153, 176)" fillOpacity="1" stroke="rgb(102, 153, 176)" strokeWidth="1" />
                          {/* Large right semi-circle */}
                          <path d="M 64 2 A 14 14 0 0 1 64 30 Z" fill="rgb(26, 90, 122)" fillOpacity="1" stroke="rgb(26, 90, 122)" strokeWidth="1" />
                        </svg>
                        <span style={{ color: "#666", fontSize: "10px" }}>Low → High</span>
                      </div>
                    </div>

                    {/* Instruction text */}
                    <p
                      style={{
                        color: "#888",
                        fontStyle: "italic",
                        fontSize: "10px",
                        marginTop: "12px",
                        marginBottom: 0,
                        textAlign: "center",
                      }}
                    >
                      Hover for more information
                    </p>
                  </div>
                )}
              </div>

{/* Himalayas image removed - Geography section now uses Mapbox zoom */}
            </div>

            {/* Right - Scrollable Text */}
            <div style={{ flex: "0 0 45%" }}>
              {/* Population Text + Scatter Plot */}
              <div
                ref={(el) => (scatterTextRefs.current[0] = el)}
                style={{
                  minHeight: "100vh",
                  padding: "60px 40px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                    marginBottom: "30px",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      marginBottom: "20px",
                      margin: 0,
                    }}
                  >
                    Does Population Drive Pollution?
                  </h3>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginTop: "15px",
                      marginBottom: "15px",
                    }}
                  >
                    The map reveals a dense concentration of population across the North Indian River Plain spanning Uttar Pradesh, Bihar, and Delhi one of the most crowded regions in the world.   </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginBottom: "15px",
                    }}
                  >
                   At first glance, such density might explain the region’s severe air pollution, as growing populations intensify traffic, industry, construction, and energy demand. Yet the data tells a more nuanced story in the correlation scatter plot. While some highly populated northern states show elevated AQI levels, southern metropolitan states like Karnataka and Tamil Nadu, despite large populations and expanding infrastructure, maintain comparatively cleaner air.     </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginBottom: "20px",
                    }}
                  >
                   The contrast suggests that geography, industrial patterns, and climate conditions play a more decisive role than population density alone in shaping India’s air quality. 
     </p>

                  {/* Scatter Plot for Population - inside card */}
                  <svg width="380" height="280" viewBox="0 0 500 400" style={{ overflow: "visible", marginLeft: "-10px" }}>
                    {/* Axes */}
                    <line x1="60" y1="350" x2="480" y2="350" stroke="#ccc" strokeWidth="1" />
                    <line x1="60" y1="350" x2="60" y2="30" stroke="#ccc" strokeWidth="1" />

                    {/* X-axis label */}
                    <text x="270" y="390" textAnchor="middle" fontSize="12" fontFamily="Avenir, sans-serif" fill="#555">
                      Population (millions)
                    </text>

                    {/* Y-axis label */}
                    <text x="20" y="190" textAnchor="middle" fontSize="12" fontFamily="Avenir, sans-serif" fill="#555" transform="rotate(-90, 20, 190)">
                      Average AQI
                    </text>

                    {/* X-axis ticks */}
                    {[0, 50, 100, 150, 200, 250].map((val, i) => (
                      <g key={`x-pop-${i}`}>
                        <line x1={60 + (val / 250) * 420} y1="350" x2={60 + (val / 250) * 420} y2="355" stroke="#999" />
                        <text x={60 + (val / 250) * 420} y="370" textAnchor="middle" fontSize="10" fill="#666">{val}</text>
                      </g>
                    ))}

                    {/* Y-axis ticks */}
                    {[0, 50, 100, 150, 200, 250, 300].map((val, i) => (
                      <g key={`y-${i}`}>
                        <line x1="55" y1={350 - (val / 300) * 320} x2="60" y2={350 - (val / 300) * 320} stroke="#999" />
                        <text x="50" y={354 - (val / 300) * 320} textAnchor="end" fontSize="10" fill="#666">{val}</text>
                      </g>
                    ))}

                    {/* Reference line at AQI 100 */}
                    <line x1="60" y1={350 - (100 / 300) * 320} x2="480" y2={350 - (100 / 300) * 320} stroke="#87beb1" strokeWidth="1" strokeDasharray="4,4" />
                    <text x="485" y={354 - (100 / 300) * 320} fontSize="9" fill="#87beb1">Satisfactory</text>

                    {/* Data points */}
                    {stateData.map((state, i) => {
                      const popData = populationData.find(p =>
                        p.state === state.state ||
                        p.state.replace("&", "and") === state.state ||
                        p.state.replace(" & ", " and ") === state.state
                      );
                      if (!popData || !state.avgAQI) return null;

                      const pop = popData.population / 1000000;
                      const rainfall = popData.rainfall || 0;
                      const aqi = state.avgAQI;
                      const x = 60 + (pop / 250) * 420;
                      const y = 350 - (aqi / 300) * 320;

                      // State coordinates for tooltip positioning on map (viewBox 612x696)
                      const stateCoords = {
                        "Andhra Pradesh": { x: 270, y: 490 },
                        "Arunachal Pradesh": { x: 555, y: 215 },
                        "Assam": { x: 505, y: 265 },
                        "Bihar": { x: 385, y: 275 },
                        "Chhattisgarh": { x: 305, y: 380 },
                        "Delhi": { x: 195, y: 215 },
                        "Goa": { x: 125, y: 515 },
                        "Gujarat": { x: 95, y: 340 },
                        "Haryana": { x: 180, y: 195 },
                        "Himachal Pradesh": { x: 210, y: 145 },
                        "Jharkhand": { x: 380, y: 320 },
                        "Karnataka": { x: 175, y: 500 },
                        "Kerala": { x: 180, y: 580 },
                        "Madhya Pradesh": { x: 240, y: 310 },
                        "Maharashtra": { x: 170, y: 420 },
                        "Manipur": { x: 530, y: 290 },
                        "Meghalaya": { x: 475, y: 270 },
                        "Mizoram": { x: 510, y: 320 },
                        "Nagaland": { x: 535, y: 260 },
                        "Odisha": { x: 340, y: 390 },
                        "Punjab": { x: 175, y: 170 },
                        "Rajasthan": { x: 145, y: 280 },
                        "Sikkim": { x: 435, y: 230 },
                        "Tamil Nadu": { x: 215, y: 565 },
                        "Telangana": { x: 245, y: 425 },
                        "Tripura": { x: 495, y: 310 },
                        "Uttar Pradesh": { x: 285, y: 260 },
                        "Uttarakhand": { x: 245, y: 175 },
                        "West Bengal": { x: 410, y: 330 },
                        "Chandigarh": { x: 183, y: 163 },
                      };
                      const coord = stateCoords[state.state] || { x: 300, y: 400 };

                      const isHovered = hoveredScatterPoint?.state === state.state;
                      const isDimmed = hoveredScatterPoint && !isHovered;

                      return (
                        <circle
                          key={`pop-${i}`}
                          cx={x}
                          cy={y}
                          r={isHovered ? 7 : 5}
                          fill="#5699af"
                          fillOpacity={isDimmed ? 0.2 : 0.8}
                          stroke="none"
                          style={{ cursor: "pointer", transition: "r 0.15s ease, fill-opacity 0.2s ease" }}
                          onMouseEnter={() => {
                            setHoveredScatterPoint({
                              state: state.state,
                              aqi: Math.round(aqi),
                              population: Math.round(pop),
                              rainfall: Math.round(rainfall),
                              region: popData.region || "Unknown",
                              x: coord.x,
                              y: coord.y,
                            });
                          }}
                          onMouseLeave={() => setHoveredScatterPoint(null)}
                        />
                      );
                    })}
                  </svg>
                  <div style={{ marginTop: "15px" }}>
                    <a
                      href="https://aqli.epic.uchicago.edu/files/India%20FactSheet_2025_GlobalWV.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "11px",
                        color: "#5699af",
                        textDecoration: "none",
                        marginRight: "15px",
                      }}
                    >
                      Source: AQLI
                    </a>
                    <a
                      href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "11px",
                        color: "#5699af",
                        textDecoration: "none",
                      }}
                    >
                      Source: Kaggle
                    </a>
                  </div>
                </div>
              </div>

              {/* Rainfall Text + Scatter Plot */}
              <div
                ref={(el) => (scatterTextRefs.current[1] = el)}
                style={{
                  minHeight: "100vh",
                  padding: "60px 40px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                    marginBottom: "30px",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      margin: 0,
                    }}
                  >
                    Nature's Air Purifier: Rainfall
                  </h3>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginTop: "15px",
                      marginBottom: "15px",
                    }}
                  >
                    Air quality in India varies strongly with changes in temperature and rainfall. During the monsoon season (June to September), heavy rains act as a natural cleanser by capturing airborne particles and bringing them down to the ground. This frequent rainfall helps clear the atmosphere and results in some of the cleanest skies of the year. In contrast, winter months (November to February) bring colder temperatures, which increase the use of heating and cooking fires. These emissions add significant particulate matter to the air, worsening pollution levels.
                  </p>
                 

                  {/* Scatter Plot for Rainfall - inside card */}
                  <svg width="380" height="280" viewBox="0 0 500 400" style={{ overflow: "visible", marginLeft: "-10px" }}>
                    {/* Axes */}
                    <line x1="60" y1="350" x2="480" y2="350" stroke="#ccc" strokeWidth="1" />
                    <line x1="60" y1="350" x2="60" y2="30" stroke="#ccc" strokeWidth="1" />

                    {/* X-axis label */}
                    <text x="270" y="390" textAnchor="middle" fontSize="12" fontFamily="Avenir, sans-serif" fill="#555">
                      Annual Rainfall (mm)
                    </text>

                    {/* Y-axis label */}
                    <text x="20" y="190" textAnchor="middle" fontSize="12" fontFamily="Avenir, sans-serif" fill="#555" transform="rotate(-90, 20, 190)">
                      Average AQI
                    </text>

                    {/* X-axis ticks */}
                    {[0, 1000, 2000, 3000, 4000].map((val, i) => (
                      <g key={`x-rain-${i}`}>
                        <line x1={60 + (val / 4500) * 420} y1="350" x2={60 + (val / 4500) * 420} y2="355" stroke="#999" />
                        <text x={60 + (val / 4500) * 420} y="370" textAnchor="middle" fontSize="10" fill="#666">{val}</text>
                      </g>
                    ))}

                    {/* Y-axis ticks */}
                    {[0, 50, 100, 150, 200, 250, 300].map((val, i) => (
                      <g key={`y-${i}`}>
                        <line x1="55" y1={350 - (val / 300) * 320} x2="60" y2={350 - (val / 300) * 320} stroke="#999" />
                        <text x="50" y={354 - (val / 300) * 320} textAnchor="end" fontSize="10" fill="#666">{val}</text>
                      </g>
                    ))}

                    {/* Reference line at AQI 100 */}
                    <line x1="60" y1={350 - (100 / 300) * 320} x2="480" y2={350 - (100 / 300) * 320} stroke="#87beb1" strokeWidth="1" strokeDasharray="4,4" />
                    <text x="485" y={354 - (100 / 300) * 320} fontSize="9" fill="#87beb1">Satisfactory</text>

                    {/* Data points */}
                    {stateData.map((state, i) => {
                      const popData = populationData.find(p =>
                        p.state === state.state ||
                        p.state.replace("&", "and") === state.state ||
                        p.state.replace(" & ", " and ") === state.state
                      );
                      if (!popData || !state.avgAQI || !popData.rainfall) return null;

                      const rainfall = popData.rainfall;
                      const pop = popData.population / 1000000;
                      const aqi = state.avgAQI;
                      const x = 60 + (rainfall / 4500) * 420;
                      const y = 350 - (aqi / 300) * 320;

                      // State coordinates for tooltip positioning on map (viewBox 612x696)
                      const stateCoords = {
                        "Andhra Pradesh": { x: 270, y: 490 },
                        "Arunachal Pradesh": { x: 555, y: 215 },
                        "Assam": { x: 505, y: 265 },
                        "Bihar": { x: 385, y: 275 },
                        "Chhattisgarh": { x: 305, y: 380 },
                        "Delhi": { x: 195, y: 215 },
                        "Goa": { x: 125, y: 515 },
                        "Gujarat": { x: 95, y: 340 },
                        "Haryana": { x: 180, y: 195 },
                        "Himachal Pradesh": { x: 210, y: 145 },
                        "Jharkhand": { x: 380, y: 320 },
                        "Karnataka": { x: 175, y: 500 },
                        "Kerala": { x: 180, y: 580 },
                        "Madhya Pradesh": { x: 240, y: 310 },
                        "Maharashtra": { x: 170, y: 420 },
                        "Manipur": { x: 530, y: 290 },
                        "Meghalaya": { x: 475, y: 270 },
                        "Mizoram": { x: 510, y: 320 },
                        "Nagaland": { x: 535, y: 260 },
                        "Odisha": { x: 340, y: 390 },
                        "Punjab": { x: 175, y: 170 },
                        "Rajasthan": { x: 145, y: 280 },
                        "Sikkim": { x: 435, y: 230 },
                        "Tamil Nadu": { x: 215, y: 565 },
                        "Telangana": { x: 245, y: 425 },
                        "Tripura": { x: 495, y: 310 },
                        "Uttar Pradesh": { x: 285, y: 260 },
                        "Uttarakhand": { x: 245, y: 175 },
                        "West Bengal": { x: 410, y: 330 },
                        "Chandigarh": { x: 183, y: 163 },
                      };
                      const coord = stateCoords[state.state] || { x: 300, y: 400 };

                      const isHovered = hoveredScatterPoint?.state === state.state;
                      const isDimmed = hoveredScatterPoint && !isHovered;

                      return (
                        <circle
                          key={`rain-${i}`}
                          cx={x}
                          cy={y}
                          r={isHovered ? 7 : 5}
                          fill="#5699af"
                          fillOpacity={isDimmed ? 0.2 : 0.8}
                          stroke="none"
                          style={{ cursor: "pointer", transition: "r 0.15s ease, fill-opacity 0.2s ease" }}
                          onMouseEnter={() => {
                            setHoveredScatterPoint({
                              state: state.state,
                              aqi: Math.round(aqi),
                              population: Math.round(pop),
                              rainfall: Math.round(rainfall),
                              region: popData.region || "Unknown",
                              x: coord.x,
                              y: coord.y,
                            });
                          }}
                          onMouseLeave={() => setHoveredScatterPoint(null)}
                        />
                      );
                    })}
                  </svg>
                  <div style={{ marginTop: "15px" }}>
                    <a
                      href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "11px",
                        color: "#5699af",
                        textDecoration: "none",
                        marginRight: "15px",
                      }}
                    >
                      Source: Kaggle
                    </a>
                    <a
                      href="https://hydro.imd.gov.in/hydrometweb/(S(4jwlae45z2suuuqf1ruew345))/PRODUCTS/Publications/Rainfall%20Statistics%20of%20India%20-%202024/Rainfall%20Statistics%20of%20India%202024.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "11px",
                        color: "#5699af",
                        textDecoration: "none",
                      }}
                    >
                      Source: IMD
                    </a>
                  </div>
                </div>
              </div>

              {/* Wind Text */}
              <div
                ref={(el) => (scatterTextRefs.current[2] = el)}
                style={{
                  minHeight: "100vh",
                  padding: "60px 40px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      margin: 0,
                    }}
                  >
                    Wind and Air Quality
                  </h3>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginTop: "15px",
                      marginBottom: "15px",
                    }}
                  >
                    Wind plays a crucial role in dispersing pollutants. When winds are strong, polluted air is carried away and diluted, improving overall air quality.
                  </p>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginBottom: "15px",
                    }}
                  >
                    The animation shows wind patterns across India, revealing how air masses move across the subcontinent.
                  </p>
                  <a
                    href="https://www.kaggle.com/datasets/developerghost/climate-in-india-daily-weather-data-2000-2024/data"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "11px",
                      color: "#5699af",
                      textDecoration: "none",
                      display: "block",
                      marginTop: "10px",
                    }}
                  >
                    Source: Kaggle - Climate in India
                  </a>
                </div>
              </div>

              {/* Geography Text */}
              <div
                ref={(el) => (scatterTextRefs.current[3] = el)}
                style={{
                  minHeight: "100vh",
                  padding: "60px 40px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    padding: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    borderLeft: "4px solid #5699af",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "20px",
                      fontWeight: "500",
                      color: "#333",
                      margin: 0,
                    }}
                  >
                    The Himalayan Barrier
                  </h3>
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.8",
                      color: "#555",
                      marginTop: "15px",
                      marginBottom: 0,
                    }}
                  >
                    In northern India, the Indo-Gangetic Plain is geographically enclosed by the Himalayas. This mountain barrier limits airflow, especially during winter, trapping pollutants near the ground and preventing them from escaping. As a result, polluted air stagnates and accumulates over time, leading to severe pollution episodes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seasonal Pollution Section */}
          <div
            style={{
              padding: "80px 40px",
              background: "#fff",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            {/* Title */}
            <h2
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "28px",
                fontWeight: "700",
                color: "#333",
                textAlign: "left",
                marginBottom: "50px",
              }}
            >
              Seasonality of Air Pollution
            </h2>

            {/* Monthly AQI Chart */}
            <div style={{ marginBottom: "50px" }}>
              {/* Title aligned with section heading */}
              <h3
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "20px",
                  fontWeight: "500",
                  color: "#333",
                  margin: "0 0 8px 0",
                }}
              >
                Monthly Average AQI by City — 2024
              </h3>
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "14px",
                  fontWeight: "400",
                  color: "#888",
                  margin: "0 0 20px 0",
                }}
              >
                Each bar represents a city's monthly average AQI
              </p>
              <MonthlyAQICityChart />
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "12px",
                  fontWeight: "400",
                  color: "#888",
                  lineHeight: "1.5",
                  margin: "20px 0 0 0",
                  textAlign: "left",
                }}
              >
                Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
                <span style={{ display: "block", fontStyle: "italic", fontSize: "11px", marginTop: "5px" }}>Hover for more information</span>
              </p>
            </div>

            {/* Text */}
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "16px",
                color: "#555",
                lineHeight: "2.0",
                margin: 0,
                textAlign: "left",
                maxWidth: "900px",
              }}
            >
              Pollution levels also shift due to seasonal human activities. Summer typically has fewer fire-related emissions, but after the monsoon ends in September, crop burning begins as farmers clear fields for new planting. This practice releases large amounts of smoke and pollutants into the atmosphere, contributing to a sharp decline in air quality during the later months of the year. Forest fires during this period can further intensify pollution, creating hazardous conditions often observed from October through February. Additionally, colder winter temperatures increase the use of heating and cooking fires and trap pollutants closer to the ground, which helps explain the consistently higher pollution levels visible in the visualization during the winter season.
            </p>
          </div>

          {/* Understanding Air Pollutants Section */}
          <div
            style={{
              padding: "80px 40px",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "28px",
                fontWeight: "700",
                color: "#333",
                textAlign: "left",
                marginBottom: "50px",
              }}
            >
              Understanding Air Pollutants
            </h2>

            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "16px",
                color: "#555",
                lineHeight: "2.0",
                margin: 0,
                textAlign: "left",
                maxWidth: "900px",
              }}
            >
              Air pollutants are commonly classified as primary or secondary depending on how they enter the atmosphere and whether they undergo chemical transformation once released.
              <br /><br />
              Primary pollutants are those emitted directly from identifiable sources and remain in the same chemical form after entering the air. Examples include sulphur dioxide (SO₂), nitrogen dioxide (NO₂), and particulate matter, which are released straight into the atmosphere through activities such as combustion and industrial processes.
              <br /><br />
              In contrast, secondary pollutants are not emitted directly. Instead, they form in the atmosphere when two or more pollutants react chemically with one another.
              <br /><br />
              In general, urban air tends to be more polluted than rural air due to higher concentrations of traffic, industry, and human activity. Common urban pollutants include sulphur dioxide, nitrogen oxides, and suspended particulate matter. Cities are also increasingly threatened by other harmful air toxins such as carbon monoxide, fine particulate emissions, and ground-level ozone, all of which pose serious risks to public health. To better understand what makes urban air so harmful, the following section provides a brief overview of the major pollutants commonly found in city atmospheres.
            </p>
          </div>

          {/* Pollutants Radial Chart Section - Scrollytelling with Tabs */}
          <div
            style={{
              height: "560vh",
              position: "relative",
              display: "flex",
            }}
          >
            {/* Left - Sticky Map with Tabs and State Radial Charts */}
            <div
              style={{
                width: "55%",
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              {/* Pollutant Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {[
                  { name: "PM10", label: "PM10", color: "#c1616b" },
                  { name: "PM2.5", label: "PM2.5", color: "#e07192" },
                  { name: "O3", label: "O₃", color: "#de9eaf" },
                  { name: "CO", label: "CO", color: "#dfbfc6" },
                  { name: "SO2", label: "SO₂", color: "#87beb1" },
                  { name: "NO2", label: "NO₂", color: "#5699af" },
                ].map((pollutant, index) => (
                  <button
                    key={index}
                    onClick={() => setActivePollutantIndex(index)}
                    style={{
                      padding: "8px 16px",
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "13px",
                      fontWeight: activePollutantIndex === index ? "600" : "400",
                      color: activePollutantIndex === index ? "#333" : "#888",
                      backgroundColor: activePollutantIndex === index ? "#fff" : "transparent",
                      border: "none",
                      borderBottom: activePollutantIndex === index ? `3px solid ${pollutant.color}` : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {pollutant.label}
                  </button>
                ))}
              </div>

              <svg width="550" height="650" viewBox="0 0 600 700">
                {/* India map background (grey) */}
                <image
                  href="/india-states.svg"
                  x="0"
                  y="0"
                  width="600"
                  height="700"
                  style={{
                    opacity: 0.2,
                    filter: "saturate(0) brightness(2.5) contrast(0.8)",
                  }}
                />

                {/* Pollutant order for highlighting */}
                {(() => {
                  const pollutantOrder = ["PM10", "PM2.5", "O3", "CO", "SO2", "NO2"];
                  const activePollutantName = pollutantOrder[activePollutantIndex];

                  return statePollutantData.map((stateData) => {
                    // Convert lat/lon to SVG coordinates
                    const latMin = 6, latMax = 37;
                    const lonMin = 68, lonMax = 98;
                    const x = ((stateData.lon - lonMin) / (lonMax - lonMin)) * 600;
                    const y = ((latMax - stateData.lat) / (latMax - latMin)) * 700;

                    // Calculate chart size based on total readings (min 15, max 35)
                    const maxTotal = Math.max(...statePollutantData.map(s => s.total));
                    const sizeRatio = Math.sqrt(stateData.total / maxTotal);
                    const chartRadius = 12 + sizeRatio * 20;

                    // Create pie segments
                    let currentAngle = -Math.PI / 2; // Start from top
                    const segments = stateData.pollutants.slice(0, 6).map((pollutant) => {
                      const angleSize = (pollutant.count / stateData.total) * 2 * Math.PI;
                      const startAngle = currentAngle;
                      const endAngle = currentAngle + angleSize;
                      currentAngle = endAngle;

                      // Calculate segment radius based on pollutant count proportion
                      const segmentRadius = chartRadius * 0.5 + (pollutant.count / stateData.total) * chartRadius * 0.8;

                      // Calculate path
                      const x1 = Math.cos(startAngle) * segmentRadius;
                      const y1 = Math.sin(startAngle) * segmentRadius;
                      const x2 = Math.cos(endAngle) * segmentRadius;
                      const y2 = Math.sin(endAngle) * segmentRadius;
                      const largeArc = angleSize > Math.PI ? 1 : 0;

                      // Determine if this pollutant is active
                      const isActive = pollutant.name === activePollutantName;

                      return {
                        path: `M 0 0 L ${x1} ${y1} A ${segmentRadius} ${segmentRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
                        color: isActive ? pollutant.color : "#ddd",
                        name: pollutant.name,
                        isActive,
                      };
                    });

                    return (
                      <g
                        key={stateData.state}
                        transform={`translate(${x}, ${y})`}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          setHoveredRadialState(stateData);
                          const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                          setRadialTooltipPos({
                            x: rect.left + (x / 600) * rect.width,
                            y: rect.top + (y / 700) * rect.height,
                          });
                        }}
                        onMouseLeave={() => setHoveredRadialState(null)}
                      >
                        {/* Segments */}
                        {segments.map((seg, i) => (
                          <path
                            key={i}
                            d={seg.path}
                            fill={seg.color}
                            fillOpacity={seg.isActive ? 0.9 : 0.4}
                            stroke="#fff"
                            strokeWidth="0.5"
                            style={{ transition: "fill 0.3s ease, fill-opacity 0.3s ease" }}
                          />
                        ))}
                        {/* Center dot */}
                        <circle cx="0" cy="0" r="2" fill="#333" />
                      </g>
                    );
                  });
                })()}
              </svg>

              {/* Radial Chart Tooltip */}
              {hoveredRadialState && (
                <div
                  style={{
                    position: "fixed",
                    left: radialTooltipPos.x + 15,
                    top: radialTooltipPos.y - 10,
                    backgroundColor: "rgba(255, 255, 255, 0.98)",
                    padding: "15px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    zIndex: 1000,
                    pointerEvents: "none",
                    minWidth: "200px",
                  }}
                >
                  <h5
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      margin: "0 0 10px 0",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "8px",
                    }}
                  >
                    {hoveredRadialState.state}
                  </h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {hoveredRadialState.pollutants.slice(0, 6).map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              backgroundColor: p.color,
                              borderRadius: "2px",
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                              fontSize: "12px",
                              color: "#555",
                            }}
                          >
                            {p.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                            fontSize: "12px",
                            color: "#333",
                            fontWeight: "500",
                          }}
                        >
                          {Math.round((p.count / hoveredRadialState.total) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p
                style={{
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontSize: "11px",
                  color: "#888",
                  marginTop: "15px",
                  textAlign: "left",
                }}
              >
                Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af", textDecoration: "none" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
                <span style={{ display: "block", fontStyle: "italic", marginTop: "5px" }}>Hover for more information</span>
              </p>
            </div>

            {/* Right - Scrolling pollutant descriptions */}
            <div
              style={{
                width: "45%",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "50vh",
              }}
            >
              {[
                {
                  name: "PM10",
                  title: "PM10 - Coarse Particulate Matter",
                  color: "#c1616b",
                  description: "PM10 refers to particulate matter smaller than 10 micrometers, often coming from visible and heavier sources such as road dust, construction sites, and industrial activity. Because these particles are larger, they settle more quickly and are usually trapped in the nose or throat when inhaled. While PM10 still affects air quality and can cause irritation, it is generally less able to penetrate deep into the body compared to finer particles.",
                },
                {
                  name: "PM2.5",
                  title: "PM2.5 - Fine Particulate Matter",
                  color: "#e07192",
                  description: "PM2.5, on the other hand, includes particles smaller than 2.5 micrometers, nearly 30 times thinner than a human hair. These fine particles mainly come from fuel combustion, vehicle exhaust, crop burning, and industrial smoke. Because they are so light, they remain suspended in the air longer, spread easily across cities, and can travel deep into the lungs and even enter the bloodstream. This makes PM2.5 far more dangerous, strongly linked to asthma, heart disease, and respiratory infections. In Indian cities, PM2.5 is often the main driver of “poor” or “severe” AQI levels, especially in winter when low winds and temperature inversion trap pollution near the ground.",
                },
                {
                  name: "O3",
                  title: "O₃ - Ground-Level Ozone",
                  color: "#de9eaf",
                  description: "Ground-level ozone, a major component of smog, is highly harmful to plants. It damages leaves, suppresses growth, and can injure or even kill vegetation, reducing crop productivity. This pollutant forms when nitrogen oxides, carbon monoxide, and volatile organic compounds released from vehicles, industries, cooking stoves, and biomass burning react in sunlight. Despite its serious threat to agriculture, India currently lacks air quality standards specifically aimed at protecting crops from ground-level ozone exposure. A 2005 study examined the agricultural impacts of high ground-level ozone concentrations in India. It highlights that rising emissions have led to severe ozone pollution across some of India’s most densely populated regions. In Delhi, ozone and smog levels have reached intensities comparable to Beijing, one of the world’s most polluted cities.",
                },
                {
                  name: "CO",
                  title: "CO - Carbon Monoxide",
                  color: "#dfbfc6",
                  description: "Carbon monoxide (CO) is a toxic trace gas released mainly through the incomplete combustion of fossil fuels, and it poses a serious risk to human health. Studies show strong seasonal variation in CO levels across India, with the highest concentrations occurring in winter. This suggests that colder temperatures are closely linked to increased CO emissions. When comparing state capitals, cities such as Delhi, Patna, Mumbai, Bengaluru, Jaipur, Lucknow, Chennai, and Bhopal consistently rank among the highest CO emitters. These patterns can help policymakers identify priority regions for emission control and air quality improvement. Research also finds that temperature has a clear negative relationship with CO levels warmer conditions generally reduce CO concentrations. while factors like humidity and wind show only a moderate influence. Health risk assessments highlight Delhi as facing the greatest non-carcinogenic risk from CO exposure (29.8%), followed by Chandigarh (13.5%) and Patna (13.4%). Overall, these findings emphasize the need for targeted seasonal strategies to reduce CO pollution and protect public health in India’s major urban centers.",
                },
                {
                  name: "SO2",
                  title: "SO₂ - Sulphur Dioxide",
                  color: "#87beb1",
                  description: "Sulphur dioxide (SO₂) is released into the atmosphere from both natural and human-made sources. Naturally, it can originate from volcanic activity and the decay of organic matter in soils. However, most urban SO₂ emissions come from the combustion of fossil fuels, since coal and oil contain sulphur compounds. Major contributors include oil refineries, automobiles, thermal power plants, smelters, and industrial facilities. During the 1960s–1980s, SO₂ was considered one of India’s most critical air pollutants, largely driven by rapid industrialization and growing urban transport. NEERI studies show that SO₂ levels declined in many cities after 1980, partly because cleaner fuels like LPG replaced wood, coal, and kerosene for cooking. However, cities such as Lucknow, Delhi experienced rising SO₂ emissions due to continued industrial and urban expansion.",
                },
                {
                  name: "NO2",
                  title: "NO₂ - Nitrogen Dioxide",
                  color: "#5699af",
                  description: "Nitrogen oxides (NOx), mainly nitric oxide (NO) and nitrogen dioxide (NO₂), are major urban air pollutants. NO₂ is a reddish-brown corrosive gas primarily produced during fuel combustion, making automobile exhaust one of its largest sources. Significant emissions also come from industries where nitric acid is produced or used. Although NO₂ remains in the atmosphere only for a few days, it contributes to the formation of harmful compounds such as nitric acid and nitrates, and it also plays a key role in producing ground-level ozone. Since the 1990s, NO₂ levels have risen sharply in major Indian cities, with pollution peaks closely aligning with traffic rush hours. NEERI studies estimate that traffic contributes over half of total NO₂ emissions in cities like Mumbai. While annual averages may still fall within permissible limits in many areas, maximum concentrations in several towns and industrial regions have already exceeded safe standards, signaling a growing air quality concern.",
                },
              ].map((pollutant, index) => (
                <div
                  key={index}
                  ref={(el) => (pollutantRefs.current[index] = el)}
                  style={{
                    minHeight: "80vh",
                    padding: "60px 40px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "450px",
                      padding: "30px",
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "8px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                      borderLeft: `4px solid ${pollutant.color}`,
                    }}
                  >
                    <h4
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "20px",
                        fontWeight: "500",
                        color: "#333",
                        margin: 0,
                      }}
                    >
                      {pollutant.title}
                    </h4>
                    <p
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "15px",
                        color: "#555",
                        lineHeight: "1.8",
                        marginTop: "15px",
                        marginBottom: 0,
                      }}
                    >
                      {pollutant.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transition Text before Sources of Pollution */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "80px 20px",
              backgroundColor: "#fff",
            }}
          >
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "22px",
                fontWeight: "300",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
                borderLeft: "4px solid #5699af",
                paddingLeft: "30px",
              }}
            >
              These pollutants do not rise from a single origin, but from a web of diverse and intertwined sources that collectively shape the air around.
            </p>
          </div>

          {/* Sources of Pollution Section - Industrial Tower Visualization */}
          <div
            ref={sourcesScrollRef}
            style={{
              position: "relative",
              display: "flex",
              backgroundColor: "#fff",
            }}
          >
            {/* Left - Sticky Industrial Towers */}
            <div
              style={{
                width: "50%",
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", width: "100%", height: "80%" }}>
                {/* Background image - pollution towers */}
                <img
                  src="/pollutionbg.svg"
                  alt="Industrial towers"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "bottom center",
                  }}
                />

                {/* Smoke Cloud Overlay with Source Labels - Each source gets its own cloud */}
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 600 400"
                  preserveAspectRatio="xMidYMid meet"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    overflow: "visible",
                  }}
                >
                  {/* Individual clouds for each pollution source */}
                  {[
                    { x: 100, y: 90, label: "Vehicle Emissions" },
                    { x: 300, y: 80, label: "Road Dust" },
                    { x: 500, y: 70, label: "Industrial Emissions" },
                    { x: 180, y: 45, label: "Garbage Burning" },
                    { x: 400, y: 35, label: "Diesel Generators" },
                    { x: 100, y: 5, label: "Crop Burning" },
                    { x: 300, y: -5, label: "Construction" },
                    { x: 500, y: -15, label: "Coal Power Plants" },
                  ].map((cloud, index) => {
                    const isVisible = visibleSources > index;
                    const animationDelay = `${index * 0.5}s`;

                    return (
                      <g
                        key={index}
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible ? `translateY(0)` : `translateY(50px)`,
                          transition: "all 0.8s ease-out",
                        }}
                      >
                        {/* Cloud shape */}
                        <g
                          style={{
                            animation: isVisible ? `smokePulse 6s ease-in-out infinite ${animationDelay}` : "none",
                            transformOrigin: `${cloud.x}px ${cloud.y}px`
                          }}
                        >
                          <ellipse
                            cx={cloud.x - 24}
                            cy={cloud.y - 6}
                            rx="27"
                            ry="18"
                            fill="#d8d8d8"
                          />
                          <ellipse
                            cx={cloud.x + 30}
                            cy={cloud.y - 9}
                            rx="30"
                            ry="21"
                            fill="#d8d8d8"
                          />
                          <ellipse
                            cx={cloud.x}
                            cy={cloud.y}
                            rx="45"
                            ry="27"
                            fill="#d8d8d8"
                          />
                        </g>

                        {/* Source label */}
                        <text
                          x={cloud.x}
                          y={cloud.y + 3}
                          textAnchor="middle"
                          fill="#333"
                          fontFamily="Avenir, sans-serif"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {cloud.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Right - Scrolling Source Descriptions */}
            <div
              style={{
                width: "50%",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "80vh",
                paddingLeft: "100px",
              }}
            >
              {pollutionSources.map((source, index) => (
                <div
                  key={index}
                  ref={(el) => (sourceCardRefs.current[index] = el)}
                  style={{
                    minHeight: "80vh",
                    padding: "60px 40px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "450px",
                      padding: "30px",
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                      borderLeft: "4px solid #5699af",
                      opacity: visibleSources > index ? 1 : 0.3,
                      transform: visibleSources > index ? "translateX(0)" : "translateX(20px)",
                      transition: "all 0.5s ease-out",
                    }}
                  >
                    <h4
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "20px",
                        fontWeight: "500",
                        color: "#333",
                        margin: 0,
                      }}
                    >
                      {source.label}
                    </h4>
                    <p
                      style={{
                        fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                        fontSize: "15px",
                        color: "#555",
                        lineHeight: "1.8",
                        marginTop: "15px",
                        marginBottom: 0,
                      }}
                    >
                      {source.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Transition text after Sources of Pollution */}
      {(
        <div
          style={{
            minHeight: "30vh",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "120px 40px 40px 40px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "80px",
              backgroundColor: "#5699af",
              marginRight: "20px",
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontSize: "22px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontWeight: "300",
              lineHeight: "2.0",
              maxWidth: "800px",
              textAlign: "left",
              color: "#333",
              margin: 0,
              marginTop: "-10px",
            }}
          >
            As we've seen the sources and impacts of air pollution across India, the next step is to explore how the country can turn the tide. Improving India's air requires a closer look at the standards that govern emissions, the practical solutions that can be implemented, and the strategies that can guide long-term change.
          </p>
        </div>
      )}

      {/* India Air Quality Standards Section */}
      {(
        <div
          style={{
            padding: "20px 120px 80px 120px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              color: "#333",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                fontWeight: "700",
                marginBottom: "40px",
                textAlign: "left",
              }}
            >
              Why National Standards Differ from WHO Guidelines?
            </h2>

            {/* PM2.5 Comparison KPIs */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: "220px",
                marginBottom: "60px",
              }}
            >
              {/* WHO Standard KPI */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  position: "relative",
                  minHeight: "220px",
                }}
              >
                <img
                  src="/Cloud.svg"
                  alt=""
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "20px",
                    width: "240px",
                    zIndex: 0,
                    opacity: 0.9,
                    pointerEvents: "none",
                  }}
                />
                <h3
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "56px",
                    fontWeight: "700",
                    color: "#3a9bb2",
                    margin: "0",
                    lineHeight: "1",
                    position: "relative",
                    zIndex: 1,
                    marginLeft: "80px",
                    marginTop: "50px",
                  }}
                >
                  5 µg/m³
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    marginTop: "15px",
                    marginLeft: "80px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "4px",
                      backgroundColor: "#3a9bb2",
                      marginRight: "12px",
                      borderRadius: "2px",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "14px",
                      fontWeight: "400",
                      fontStyle: "italic",
                      color: "#333",
                      lineHeight: "1.5",
                      margin: "0",
                      maxWidth: "180px",
                      textAlign: "left",
                    }}
                  >
                    PM2.5 annual limit recommended by WHO guidelines.
                  </p>
                </div>
              </div>

              {/* National Standard KPI */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  position: "relative",
                  minHeight: "220px",
                }}
              >
                <img
                  src="/Cloud.svg"
                  alt=""
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "20px",
                    width: "240px",
                    zIndex: 0,
                    opacity: 0.9,
                    pointerEvents: "none",
                  }}
                />
                <h3
                  style={{
                    fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                    fontSize: "56px",
                    fontWeight: "700",
                    color: "#3a9bb2",
                    margin: "0",
                    lineHeight: "1",
                    position: "relative",
                    zIndex: 1,
                    marginLeft: "80px",
                    marginTop: "50px",
                  }}
                >
                  40 µg/m³
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    marginTop: "15px",
                    marginLeft: "80px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "4px",
                      backgroundColor: "#3a9bb2",
                      marginRight: "12px",
                      borderRadius: "2px",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                      fontSize: "14px",
                      fontWeight: "400",
                      fontStyle: "italic",
                      color: "#333",
                      lineHeight: "1.5",
                      margin: "0",
                      maxWidth: "180px",
                      textAlign: "left",
                    }}
                  >
                    PM2.5 annual limit set by India's national standard.
                  </p>
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                marginBottom: "32px",
                textAlign: "left",
              }}
            >
              India follows its own air quality standards rather than the stricter WHO guidelines, reflecting the country's unique environmental, geographic, and developmental realities. For instance, the WHO recommends an annual average of 5 µg/m³ for PM2.5, while India's standard is 40 µg/m³, eight times higher. Similarly, for PM10 and NO2, Indian limits are 4 times and 4 times the WHO recommendations, respectively. These differences arise because natural dust, high background particulate levels, and measurement challenges make global standards impractical in many regions. Ground-based monitoring through CAAQMS, rather than satellites, focuses primarily on urban centers, leaving rural areas under-monitored.
            </p>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                textAlign: "left",
              }}
            >
              At the same time, India balances public health with economic and developmental priorities. Immediate adoption of WHO standards would require halting thermal power, diesel transport, and construction measures that could hinder growth. To address pollution within these constraints, India has established a domestic framework: the National Ambient Air Quality Standards (NAAQS) and the National Clean Air Programme (NCAP). NCAP targets a 40% reduction in particulate matter by 2026 and focuses on vehicles, industries, road dust, construction, and biomass burning. Cities are ranked annually through Swachh Vayu Survekshan, which evaluates both pollution levels and mitigation efforts. While national standards guide policy realistically, aligning more closely with WHO recommendations could reduce air pollution across India and substantially improve life expectancy.
            </p>
          </div>
        </div>
      )}

      {/* Life Expectancy Gains Visualization */}
      {lifeExpData.length > 0 && (
        <div style={{ padding: "40px 120px", backgroundColor: "#fff" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            {/* Title aligned with text above */}
            <h3
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "20px",
                fontWeight: "500",
                color: "#333",
                margin: "0 0 8px 0",
              }}
            >
              Life Expectancy Gains from Reducing PM2.5 — by State/UT
            </h3>
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "14px",
                fontWeight: "400",
                color: "#888",
                margin: "0 0 20px 0",
              }}
            >
              Potential years of life gained if PM2.5 reduced to target levels
            </p>
          </div>
          {/* Chart centered */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <LifeExpectancyPlot data={lifeExpData} />
          </div>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <p
              style={{
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "12px",
                fontWeight: "400",
                color: "#888",
                lineHeight: "1.5",
                margin: "20px 0 0 0",
                textAlign: "left",
                background: "#fff",
              }}
            >
              Source: <a href="https://aqli.epic.uchicago.edu/files/India%20FactSheet_2025_GlobalWV.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>AQLI - India Fact Sheet 2025</a>
              <span style={{ display: "block", fontStyle: "italic", fontSize: "11px", marginTop: "5px" }}>Hover for more information</span>
            </p>
          </div>
        </div>
      )}

      {/* Institutional Reforms Section */}
      {(
        <div
          style={{
            paddingTop: "80px",
            paddingBottom: "80px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              padding: "0 120px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              color: "#333",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                fontWeight: "700",
                marginBottom: "40px",
                textAlign: "left",
              }}
            >
              Institutional Reforms Needed to Support the Fight for Better Air Quality in India
            </h2>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                textAlign: "left",
              }}
            >
              Effective air pollution management is not something that can be solved overnight. Real progress takes time—often years, even decades because cleaner air requires long-term commitment and consistent action. India can learn from strategies used in other regions, but solutions must be adapted to fit its own environmental and social realities. The path ahead will not be easy, yet the core truth is simple: meaningful improvement is only possible when emissions from every major source are reduced, and wherever possible, eliminated. Achieving clean air for all will require not just technical fixes, but deep institutional and policy changes to drive lasting impact.
            </p>
          </div>

          {/* KPI Grid - 2x2 Hover Boxes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "25px",
              padding: "0 40px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              maxWidth: "900px",
              margin: "60px auto 0 auto",
              overflow: "hidden",
            }}
          >
            {[
              {
                title: "Differentiating better air quality and net-zero emissions for climate change",
                text: "Air pollution and climate change both come mainly from fossil fuel burning, but they require different solutions. Climate policy focuses on long-term net-zero goals, while air quality management targets immediate pollutant limits. Cutting local emissions quickly improves health and air conditions, unlike climate benefits which are global and slower. Air pollution is more visible and regulated nationally, making accountability clearer. Some climate fixes, like biofuels, can worsen air pollution, so policies must balance both."
              },
              {
                title: "An aggressive push for more ambient pollution monitoring",
                text: "Effective air quality management begins with measurement. Monitoring reveals pollution levels, hotspots, and trends over time. India has long faced gaps due to the high cost of reference-grade equipment, but low-cost sensors, combined with satellite data and AI, can help expand coverage. Increasing monitoring density nationwide and ensuring open access to data are essential for stronger air quality policy and action."
              },
              {
                title: "Insisting on the cities to build an energy and emissions baseline for accountability",
                text: "Cities need a bottom-up approach to reduce emissions, starting with detailed local baselines built from on-the-ground data on industries, household energy use, and traffic. Without this foundation, it is difficult to measure progress or assess mitigation success. India's NCAP (2019) requires 131 non-attainment cities to develop such baselines. While satellites and AI can support analysis, they cannot replace local data collection, modelling, and sustained political commitment."
              },
              {
                title: "Unification of emission inventories at the national scale",
                text: "A standardized, high-resolution emissions inventory is essential for NCAP's success, helping cities design, track, and strengthen pollution control strategies while supporting future NCAP 2.0 efforts beyond urban areas. Currently, fragmented inventories built with different methods limit comparability and weaken national baselines. India needs a unified, multi-pollutant, high-resolution emissions inventory—developed through collaborative inter-comparison—to reflect local sources and guide stronger clean air science and policy."
              }
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#e0e0e0",
                  borderRadius: "16px",
                  padding: "35px 30px",
                  height: "180px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#5699af";
                  e.currentTarget.style.justifyContent = "flex-start";
                  e.currentTarget.querySelector('.box-title').style.display = "none";
                  e.currentTarget.querySelector('.hover-text').style.display = "block";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#e0e0e0";
                  e.currentTarget.style.justifyContent = "center";
                  e.currentTarget.querySelector('.box-title').style.display = "block";
                  e.currentTarget.querySelector('.hover-text').style.display = "none";
                }}
              >
                <h3
                  className="box-title"
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    color: "#5699af",
                    lineHeight: "1.5",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="hover-text"
                  style={{
                    fontSize: "13px",
                    fontWeight: "400",
                    lineHeight: "1.6",
                    color: "#fff",
                    textAlign: "left",
                    margin: 0,
                    display: "none",
                    overflow: "auto",
                    maxHeight: "100%",
                  }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "20px", fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif" }}>
            <a
              href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5392152"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "12px",
                color: "#5699af",
                textDecoration: "none",
              }}
            >
              Source: SSRN
            </a>
            <span style={{ display: "block", fontStyle: "italic", fontSize: "11px", color: "#888", marginTop: "5px" }}>Hover for more information</span>
          </div>
        </div>
      )}

      {/* Cycling Animation Section - GSAP Powered */}
      <div
        ref={cyclingRef}
        style={{
          height: "300vh",
          backgroundColor: "#fff",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            width: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: "80px",
          }}
        >
          {/* Title inside sticky container */}
          <h2
            style={{
              fontSize: "28px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontWeight: "700",
              maxWidth: "900px",
              width: "90%",
              textAlign: "left",
              color: "#333",
              marginBottom: "100px",
            }}
          >
            Infrastructural Changes That Would Help Achieve Better Air Quality
          </h2>

          {/* Scrolling text container */}
          <div
            style={{
              position: "relative",
              width: "80%",
              height: "280px",
              overflow: "hidden",
              marginBottom: "50px",
            }}
          >
            {/* First text - Better Cycling (visible 0-50%) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "25%",
                width: "50%",
                maxWidth: "550px",
                transform: `translateX(${100 - cyclingProgress * 300}%)`,
              }}
            >
              <h3
                style={{
                  fontSize: "20px",
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontWeight: "500",
                  color: "#333",
                  marginBottom: "15px",
                  textAlign: "left",
                }}
              >
                Better Cycling and Walking Infrastructure
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontWeight: "300",
                  lineHeight: "1.8",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                Improving infrastructure for cycling and walking on a daily basis can significantly reduce air pollution. It encourages people to rely less on fuel-powered vehicles, which in turn lowers emissions. Moreover, given the persistent traffic congestion in India, there is a strong likelihood that people would embrace these alternatives.
              </p>
            </div>

            {/* Second text - Better Electricity (visible 50-100%) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "25%",
                width: "50%",
                maxWidth: "550px",
                transform: `translateX(${100 - (cyclingProgress - 0.5) * 300}%)`,
              }}
            >
              <h3
                style={{
                  fontSize: "20px",
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontWeight: "500",
                  color: "#333",
                  marginBottom: "15px",
                  textAlign: "left",
                }}
              >
                Better Electricity Infrastructure
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                  fontWeight: "300",
                  lineHeight: "1.8",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                Enhancing electricity infrastructure can play a crucial role in reducing air pollution. Reliable and widespread electricity supply decreases the reliance on diesel generators, which are major sources of harmful emissions. It also reduces the need for traditional cooking fuels, such as wood, coal, or other biomass, which release smoke and particulate matter into the air. Transitioning to cleaner and greener sources of electricity, such as solar, wind, or hydropower, is essential not only for meeting energy needs but also for mitigating environmental pollution and protecting public health.
              </p>
            </div>
          </div>

          {/* Animation container */}
          <div
            style={{
              position: "relative",
              height: "300px",
              width: "90%",
              maxWidth: "1000px",
            }}
          >
            {/* Clouds at the top */}
            <svg
              width="80"
              height="40"
              viewBox="0 0 80 40"
              style={{
                position: "absolute",
                top: "20px",
                left: `${10 + cyclingProgress * 30}%`,
              }}
            >
              <ellipse cx="25" cy="28" r="18" ry="12" fill="#c5e0f0" />
              <ellipse cx="40" cy="22" r="22" ry="14" fill="#c5e0f0" />
              <ellipse cx="55" cy="28" r="16" ry="11" fill="#c5e0f0" />
            </svg>

            <svg
              width="70"
              height="35"
              viewBox="0 0 70 35"
              style={{
                position: "absolute",
                top: "40px",
                right: `${15 + cyclingProgress * 40}%`,
              }}
            >
              <ellipse cx="20" cy="22" r="16" ry="11" fill="#c5e0f0" />
              <ellipse cx="35" cy="18" r="20" ry="13" fill="#c5e0f0" />
              <ellipse cx="50" cy="23" r="15" ry="10" fill="#c5e0f0" />
            </svg>

            <svg
              width="50"
              height="30"
              viewBox="0 0 50 30"
              style={{
                position: "absolute",
                top: "10px",
                right: `${5 + cyclingProgress * 20}%`,
              }}
            >
              <ellipse cx="15" cy="18" r="14" ry="10" fill="#c5e0f0" />
              <ellipse cx="30" cy="15" r="16" ry="11" fill="#c5e0f0" />
            </svg>

            {/* Ground line */}
            <div
              style={{
                position: "absolute",
                bottom: "50px",
                left: 0,
                right: 0,
                height: "2px",
                backgroundColor: "#000",
              }}
            />

            {/* Tree and bushes in background - moves opposite to cyclist */}
            <svg
              width="180"
              height="200"
              viewBox="0 0 140 150"
              style={{
                position: "absolute",
                bottom: "50px",
                right: `${10 + cyclingProgress * 75}%`,
              }}
            >
              {/* Bush on left - mirrored from right */}
              <circle cx="45" cy="144" r="10" fill="#6ab06a" stroke="#4a904a" strokeWidth="2" />
              <circle cx="35" cy="140" r="12" fill="#7cb87c" stroke="#5a9a5a" strokeWidth="2" />
              <circle cx="28" cy="147" r="8" fill="#8bc88b" stroke="#6aaa6a" strokeWidth="2" />

              {/* Tree trunk */}
              <line x1="70" y1="150" x2="70" y2="80" stroke="#5a3a1a" strokeWidth="4" />
              {/* Tree foliage - filled circles */}
              <circle cx="55" cy="75" r="18" fill="#7cb87c" stroke="#5a9a5a" strokeWidth="2" />
              <circle cx="85" cy="75" r="18" fill="#7cb87c" stroke="#5a9a5a" strokeWidth="2" />
              <circle cx="70" cy="60" r="25" fill="#8bc88b" stroke="#6aaa6a" strokeWidth="2" />
              <circle cx="70" cy="40" r="20" fill="#9bd89b" stroke="#7aba7a" strokeWidth="2" />

              {/* Bush on right */}
              <circle cx="95" cy="144" r="10" fill="#6ab06a" stroke="#4a904a" strokeWidth="2" />
              <circle cx="105" cy="140" r="12" fill="#7cb87c" stroke="#5a9a5a" strokeWidth="2" />
              <circle cx="112" cy="147" r="8" fill="#8bc88b" stroke="#6aaa6a" strokeWidth="2" />
            </svg>

            {/* Wind Turbine - appears at 60% and moves with tree at same speed */}
            {cyclingProgress >= 0.6 && (
              <svg
                width="120"
                height="220"
                viewBox="0 0 80 160"
                style={{
                  position: "absolute",
                  bottom: "50px",
                  right: `${-5 + (cyclingProgress - 0.6) * 75}%`,
                }}
              >
                {/* Tower */}
                <polygon points="35,160 45,160 42,50 38,50" fill="#9aabb8" />
                <line x1="40" y1="160" x2="40" y2="50" stroke="#8a9aa8" strokeWidth="1" />

                {/* Blades - rotating group */}
                <g style={{
                  transformOrigin: "40px 45px",
                  transform: `rotate(${cyclingProgress * 1080}deg)`,
                }}>
                  {/* Blade 1 - pointing up */}
                  <polygon points="40,45 37,5 40,2 43,5" fill="#f0f5f8" stroke="#c0c8d0" strokeWidth="1" />
                  {/* Blade 2 - pointing lower right */}
                  <polygon points="40,45 72,65 75,62 72,58" fill="#e8eef2" stroke="#c0c8d0" strokeWidth="1" />
                  {/* Blade 3 - pointing lower left */}
                  <polygon points="40,45 8,65 5,62 8,58" fill="#e8eef2" stroke="#c0c8d0" strokeWidth="1" />
                </g>

                {/* Hub center */}
                <circle cx="40" cy="45" r="6" fill="#d0d8e0" stroke="#8a9aa8" strokeWidth="2" />
              </svg>
            )}

            {/* Ground Solar Panels - right of building */}
            {cyclingProgress >= 0.75 && (
              <svg
                width="70"
                height="50"
                viewBox="0 0 70 50"
                style={{
                  position: "absolute",
                  bottom: "50px",
                  right: `${-5 + (cyclingProgress - 0.75) * 75}%`,
                }}
              >
                {/* Solar panel row 1 */}
                <rect x="5" y="35" width="25" height="15" fill="#2a4a6a" stroke="#1a3a5a" strokeWidth="1" />
                {/* Panel grid */}
                <line x1="5" y1="39" x2="30" y2="39" stroke="#4a7aaa" strokeWidth="0.5" />
                <line x1="5" y1="43" x2="30" y2="43" stroke="#4a7aaa" strokeWidth="0.5" />
                <line x1="5" y1="47" x2="30" y2="47" stroke="#4a7aaa" strokeWidth="0.5" />

                {/* Solar panel row 2 */}
                <rect x="40" y="35" width="25" height="15" fill="#2a4a6a" stroke="#1a3a5a" strokeWidth="1" />
                {/* Panel grid */}
                <line x1="40" y1="39" x2="65" y2="39" stroke="#4a7aaa" strokeWidth="0.5" />
                <line x1="40" y1="43" x2="65" y2="43" stroke="#4a7aaa" strokeWidth="0.5" />
                <line x1="40" y1="47" x2="65" y2="47" stroke="#4a7aaa" strokeWidth="0.5" />
              </svg>
            )}

            {/* Building - appears at 70% */}
            {cyclingProgress >= 0.7 && (
              <svg
                width="140"
                height="170"
                viewBox="0 0 100 120"
                style={{
                  position: "absolute",
                  bottom: "50px",
                  right: `${-5 + (cyclingProgress - 0.7) * 75}%`,
                }}
              >
                {/* Building */}
                <rect x="20" y="30" width="60" height="90" fill="#d0d0d0" stroke="#909090" strokeWidth="2" />
                {/* Windows - row 1 */}
                <rect x="28" y="40" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="46" y="40" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="64" y="40" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                {/* Windows - row 2 */}
                <rect x="28" y="58" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="46" y="58" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="64" y="58" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                {/* Windows - row 3 */}
                <rect x="28" y="76" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="46" y="76" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                <rect x="64" y="76" width="8" height="10" fill="#a8a8a8" stroke="#707070" strokeWidth="1" />
                {/* Door */}
                <rect x="42" y="100" width="16" height="20" fill="#606060" stroke="#404040" strokeWidth="1" />

                {/* Electric pole */}
                <line x1="5" y1="120" x2="5" y2="25" stroke="#505050" strokeWidth="3" />
                <line x1="0" y1="30" x2="15" y2="30" stroke="#505050" strokeWidth="2" />
                {/* Power lines */}
                <path d="M 5 30 Q 12 28 20 30" fill="none" stroke="#333" strokeWidth="1" />
                {/* Electricity sparks */}
                <circle cx="20" cy="30" r="2" fill="#ffdd00" />
              </svg>
            )}

            {/* Cyclist SVG - Simple style */}
            <svg
              ref={cyclistRef}
              width="140"
              height="170"
              viewBox="0 0 200 250"
              style={{
                position: "absolute",
                bottom: "42px",
                left: "5%",
                transform: "translateX(-50%)",
              }}
            >
              {/* Back wheel - GSAP will rotate this */}
              <g ref={backWheelRef} style={{ transformOrigin: "45px 200px" }}>
                <circle cx="45" cy="200" r="38" fill="none" stroke="#6d6e71" strokeWidth="4" />
                {/* Spokes */}
                <line x1="45" y1="162" x2="45" y2="238" stroke="#6d6e71" strokeWidth="2" />
                <line x1="7" y1="200" x2="83" y2="200" stroke="#6d6e71" strokeWidth="2" />
                <line x1="18" y1="173" x2="72" y2="227" stroke="#6d6e71" strokeWidth="2" />
                <line x1="72" y1="173" x2="18" y2="227" stroke="#6d6e71" strokeWidth="2" />
                <circle cx="45" cy="200" r="6" fill="#fff" stroke="#6d6e71" strokeWidth="2" />
              </g>

              {/* Front wheel - GSAP will rotate this */}
              <g ref={frontWheelRef} style={{ transformOrigin: "155px 200px" }}>
                <circle cx="155" cy="200" r="38" fill="none" stroke="#6d6e71" strokeWidth="4" />
                {/* Spokes */}
                <line x1="155" y1="162" x2="155" y2="238" stroke="#6d6e71" strokeWidth="2" />
                <line x1="117" y1="200" x2="193" y2="200" stroke="#6d6e71" strokeWidth="2" />
                <line x1="128" y1="173" x2="182" y2="227" stroke="#6d6e71" strokeWidth="2" />
                <line x1="182" y1="173" x2="128" y2="227" stroke="#6d6e71" strokeWidth="2" />
                <circle cx="155" cy="200" r="6" fill="#fff" stroke="#6d6e71" strokeWidth="2" />
              </g>

              {/* Bike frame */}
              <line x1="45" y1="200" x2="95" y2="155" stroke="#6d6e71" strokeWidth="4" />
              <line x1="95" y1="155" x2="140" y2="160" stroke="#6d6e71" strokeWidth="4" />
              <line x1="95" y1="155" x2="85" y2="200" stroke="#6d6e71" strokeWidth="4" />
              <line x1="45" y1="200" x2="85" y2="200" stroke="#6d6e71" strokeWidth="4" />
              <line x1="140" y1="160" x2="155" y2="200" stroke="#6d6e71" strokeWidth="4" />

              {/* Fork */}
              <line x1="140" y1="160" x2="140" y2="145" stroke="#6d6e71" strokeWidth="3" />

              {/* Seat */}
              <ellipse cx="95" cy="148" rx="14" ry="5" fill="#6d6e71" />
              <line x1="95" y1="148" x2="95" y2="155" stroke="#6d6e71" strokeWidth="3" />

              {/* Handlebar */}
              <line x1="130" y1="140" x2="148" y2="145" stroke="#6d6e71" strokeWidth="4" />
              <line x1="140" y1="145" x2="140" y2="160" stroke="#6d6e71" strokeWidth="3" />

              {/* Chainring */}
              <circle cx="85" cy="200" r="12" fill="none" stroke="#6d6e71" strokeWidth="3" />

              {/* Pedals and cranks - GSAP will rotate this */}
              <g ref={pedalsRef} style={{ transformOrigin: "85px 200px" }}>
                <line x1="85" y1="200" x2="85" y2="218" stroke="#6d6e71" strokeWidth="3" />
                <rect x="77" y="216" width="16" height="5" rx="2" fill="#6d6e71" />
                <line x1="85" y1="200" x2="85" y2="182" stroke="#6d6e71" strokeWidth="3" />
                <rect x="77" y="177" width="16" height="5" rx="2" fill="#6d6e71" />
              </g>

              {/* Leg 1 - Thigh, Shin, Foot (animated with inverse kinematics) */}
              <line
                ref={leg1ThighRef}
                x1="95" y1="145"
                x2="95" y2="180"
                stroke="#6d6e71"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <line
                ref={leg1ShinRef}
                x1="95" y1="180"
                x2="85" y2="218"
                stroke="#6d6e71"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <ellipse
                ref={leg1FootRef}
                cx="85" cy="222"
                rx="10" ry="5"
                fill="#6d6e71"
              />

              {/* Leg 2 - Thigh, Shin, Foot (180° offset) */}
              <line
                ref={leg2ThighRef}
                x1="95" y1="145"
                x2="95" y2="180"
                stroke="#6d6e71"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <line
                ref={leg2ShinRef}
                x1="95" y1="180"
                x2="85" y2="182"
                stroke="#6d6e71"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <ellipse
                ref={leg2FootRef}
                cx="85" cy="186"
                rx="10" ry="5"
                fill="#6d6e71"
              />

              {/* Body/torso - leaning forward */}
              <line x1="95" y1="145" x2="115" y2="115" stroke="#6d6e71" strokeWidth="5" />

              {/* Head */}
              <circle cx="120" cy="100" r="12" fill="#fff" stroke="#6d6e71" strokeWidth="4" />

              {/* Eye */}
              <circle cx="125" cy="98" r="3" fill="#000" />

              {/* Arms - to handlebar */}
              <line x1="110" y1="120" x2="132" y2="140" stroke="#6d6e71" strokeWidth="5" />
            </svg>

            {/* Walking Man SVG */}
            <svg
              ref={walkerRef}
              width="50"
              height="90"
              viewBox="0 0 50 90"
              style={{
                position: "absolute",
                bottom: "50px",
                left: "20%",
                transform: "translateX(-50%)",
              }}
            >
              {/* Head */}
              <circle cx="25" cy="15" r="10" fill="#fff" stroke="#6d6e71" strokeWidth="3" />
              {/* Eye */}
              <circle cx="28" cy="13" r="2" fill="#000" />

              {/* Body */}
              <line x1="25" y1="25" x2="25" y2="50" stroke="#6d6e71" strokeWidth="4" />

              {/* Arm 1 */}
              <line
                ref={walkerArm1Ref}
                x1="25" y1="30"
                x2="15" y2="45"
                stroke="#6d6e71"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Arm 2 */}
              <line
                ref={walkerArm2Ref}
                x1="25" y1="30"
                x2="35" y2="45"
                stroke="#6d6e71"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Leg 1 - Thigh */}
              <line
                ref={walkerLeg1ThighRef}
                x1="25" y1="50"
                x2="25" y2="68"
                stroke="#6d6e71"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* Leg 1 - Shin */}
              <line
                ref={walkerLeg1ShinRef}
                x1="25" y1="68"
                x2="25" y2="85"
                stroke="#6d6e71"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Leg 1 - Foot */}
              <ellipse
                ref={walkerLeg1FootRef}
                cx="25" cy="88"
                rx="5" ry="3"
                fill="#6d6e71"
              />

              {/* Leg 2 - Thigh */}
              <line
                ref={walkerLeg2ThighRef}
                x1="25" y1="50"
                x2="25" y2="68"
                stroke="#6d6e71"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* Leg 2 - Shin */}
              <line
                ref={walkerLeg2ShinRef}
                x1="25" y1="68"
                x2="25" y2="85"
                stroke="#6d6e71"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Leg 2 - Foot */}
              <ellipse
                ref={walkerLeg2FootRef}
                cx="25" cy="88"
                rx="5" ry="3"
                fill="#6d6e71"
              />
            </svg>

          </div>

          {/* Scroll hint */}
          {cyclingProgress < 0.05 && (
            <div
              style={{
                marginTop: "20px",
                fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
                fontSize: "14px",
                color: "#999",
              }}
            >
              Scroll to ride
            </div>
          )}
        </div>
      </div>

      {/* Closing Text Section */}
      {(
        <div
          style={{
            padding: "80px 120px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              color: "#333",
            }}
          >
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                textAlign: "left",
                marginBottom: "24px",
              }}
            >
              Even if every measure were implemented perfectly, India will need time before the air truly begins to clear. One major step forward has been the Bharat Stage VI emission standards, introduced in 2020 for cars, scooters, trucks, and most vehicles, targeting tailpipe pollutants like nitrogen oxides and fine particulate matter. By skipping Stage V, India aligned its regulations with the European Union, making it one of the country's most ambitious efforts to fight air pollution.
            </p>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                textAlign: "left",
              }}
            >
              But change doesn't happen overnight. Not everyone will buy a new vehicle immediately, and even building better cycling and walking infrastructure takes time not just to construct, but for people to adapt and start using it regularly. Policies and infrastructure may be slow to show results, yet the sooner India begins, the sooner its people can breathe cleaner air.
            </p>
            <p
              style={{
                fontSize: "24px",
                fontWeight: "600",
                lineHeight: "2.0",
                textAlign: "center",
                color: "#5699af",
                marginTop: "120px",
              }}
            >
              In a country where billions live and breathe, clean air is not a luxury, it is a basic right and a shared responsibility.
            </p>
          </div>
        </div>
      )}

      {/* References Section */}
      {(
        <div
          style={{
            backgroundColor: "#1a365d",
            width: "100%",
            marginTop: "120px",
            padding: "80px 40px",
            boxSizing: "border-box",
          }}
        >
          <h2
            style={{
              fontSize: "28px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
              fontWeight: "700",
              color: "#fff",
              marginBottom: "40px",
              textAlign: "left",
            }}
          >
            References
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            }}
          >
            {[
              { url: "https://www.greenpeace.org/static/planet4-chile-stateless/2025/03/edf90b7a-2024_world_air_quality_report_vf.pdf", label: "World Air Quality Report 2024 - Greenpeace" },
              { url: "https://www.stateofglobalair.org/data/#/health/plot?country=IND&pollutant=pm25&measure=death&deathMetric=number&geography=country&region=country&subregions=&outcome=burden&regionToggle=0&globals=false&hideCountry=false", label: "State of Global Air - India Health Data" },
              { url: "https://www.cleanairfund.org/geography/india/", label: "Clean Air Fund - India" },
              { url: "https://climatetrace.org/news/country-spotlight-india", label: "Climate Trace - India Spotlight" },
              { url: "https://timesofindia.indiatimes.com/india/india-third-most-polluted-country-delhi-tops-list-of-most-toxic-cities-aqi-report/articleshow/118425564.cms", label: "Times of India - India Third Most Polluted Country" },
              { url: "https://breathesafeair.com/air-pollution-in-india/", label: "Breathe Safe Air - Air Pollution in India" },
              { url: "https://dialogue.earth/en/pollution/india-air-pollution-policy/", label: "Dialogue Earth - India Air Pollution Policy" },
              { url: "https://aqli.epic.uchicago.edu/files/India%20FactSheet_2025_GlobalWV.pdf", label: "AQLI - India Fact Sheet 2025" },
              { url: "https://visionias.in/blog/current-affairs/decoding-indias-air-quality-policy-why-national-standards-differ-from-who-guidelines", label: "Vision IAS - Decoding India's Air Quality Policy" },
              { url: "https://www.yourarticlelibrary.com/air-pollution/7-air-pollutants-commonly-found-in-urban-atmosphere-of-india/19768", label: "Air Pollutants in Urban India" },
              { url: "https://energyandcleanair.org/publication/secondary-particles-contribute-to-one-third-of-indias-pm2-5/", label: "CREA - Secondary Particles in India's PM2.5" },
              { url: "https://www.thinkglobalhealth.org/article/indias-pollution-problem", label: "Think Global Health - India's Pollution Problem" },
              { url: "https://e360.yale.edu/features/origins-of-north-indias-air-pollution", label: "Yale E360 - Origins of North India's Air Pollution" },
              { url: "https://www.iqair.com/us/newsroom/wind-weather-air-pollution", label: "IQAir - Wind, Weather & Air Pollution" },
              { url: "https://www.dw.com/en/india-how-a-small-town-topped-global-pollution-charts/a-73198598", label: "DW - Small Town Tops Global Pollution Charts" },
              { url: "https://urbanemissions.info", label: "Urban Emissions Info" },
              { url: "https://timesofindia.indiatimes.com/india/who-report-how-south-india-trumped-north-in-combating-pollution/articleshow/64023773.cms", label: "Times of India - South vs North India Pollution" },
              { url: "https://www.drishtiias.com/daily-updates/daily-news-analysis/world-air-quality-report-2024", label: "Drishti IAS - World Air Quality Report 2024" },
              { url: "https://www.sciencedirect.com/science/article/pii/S1352231014005275", label: "ScienceDirect - Air Pollution Research" },
              { url: "https://prana.cpcb.gov.in/#/home", label: "CPCB Prana Portal" },
              { url: "https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset", label: "Kaggle - India AQI 2024 Dataset" },
              { url: "https://www.aqi.in/us/world-most-polluted-countries", label: "AQI.in - Most Polluted Countries" },
              { url: "https://blogs.worldbank.org/en/endpovertyinsouthasia/india-air-quality-has-been-improving-despite-covid-19-lockdown", label: "World Bank - India Air Quality Improvement" },
              { url: "https://www.freepressjournal.in/mumbai/post-diwali-mumbais-air-quality-plummets-drastically-falls-into-the-poor-category", label: "Free Press Journal - Post-Diwali Mumbai AQI" },
              { url: "https://www.bbc.com/news/articles/ckg4d9kq2eno", label: "BBC News - India Air Pollution" },
              { url: "https://www.aqi.in/blog/us/2024-diwali-aqi-delhi-diwali-air-quality/", label: "AQI.in - 2024 Diwali Delhi Air Quality" },
              { url: "https://en.wikipedia.org/wiki/Air_pollution_in_India", label: "Wikipedia - Air Pollution in India" },
              { url: "https://urbanemissions.info/wp-content/uploads/docs/SIM-52-2024.pdf", label: "Urban Emissions - SIM Report 2024" },
            ].map((ref, index) => (
              <a
                key={index}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "12px",
                  color: "#90cdf4",
                  textDecoration: "none",
                  lineHeight: "2.0",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
                onMouseEnter={(e) => e.target.style.color = "#fff"}
                onMouseLeave={(e) => e.target.style.color = "#90cdf4"}
              >
                {ref.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Custom tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 8,
            top: tooltip.y + 8,
            backgroundColor: "rgba(255, 255, 255, 0.97)",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            border: "1px solid #e0e0e0",
            fontFamily: "Avenir, 'Avenir Next', Helvetica, Arial, sans-serif",
            pointerEvents: "none",
            zIndex: 1000,
            minWidth: "180px",
          }}
        >
          {tooltip.state && (
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
              {tooltip.state}
            </div>
          )}
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "4px",
            }}
          >
            <span style={{ color: "#999" }}>Date:</span> {tooltip.date}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "4px",
            }}
          >
            <span style={{ color: "#999" }}>AQI:</span> <strong style={{ color: "#333" }}>{tooltip.aqiValue}</strong>
          </div>
          {tooltip.status && (
            <div
              style={{
                fontSize: "12px",
                color: tooltip.color,
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              {tooltip.status}
            </div>
          )}
          {tooltip.pollutants && (
            <div
              style={{
                fontSize: "11px",
                color: "#999",
                marginTop: "4px",
                paddingTop: "4px",
                borderTop: "1px solid #eee",
              }}
            >
              Pollutants: {tooltip.pollutants}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
