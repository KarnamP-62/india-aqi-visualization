import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import "./App.css";
import { CircularVizMap, LifeExpectancyPlot } from "./components/map/StateAQIMap";
import MonthlyAQICityChart from "./components/MonthlyAQICityChart";

export default function App() {
  const svgRef = useRef();
  const [stateData, setStateData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState({}); // { stateName: areaName }
  const [activeStateIndex, setActiveStateIndex] = useState(0);
  const stateRefs = useRef([]);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [colorizedCount, setColorizedCount] = useState(0); // 0, 1, 2, or 3
  const [highlightedYearIndex, setHighlightedYearIndex] = useState(-1); // index in highlight sequence (-1 = none)
  const [clickedYear, setClickedYear] = useState(null); // year clicked to show popup
  const [isExplorationPhase, setIsExplorationPhase] = useState(false); // true when past 2024, allowing free exploration
    const [activeMapIndex, setActiveMapIndex] = useState(0); // 0 = Delhi, 1 = Six Cities
  const [activeWeatherMapIndex, setActiveWeatherMapIndex] = useState(0); // 0 = Climate, 1 = Wind
  const [activePollutantIndex, setActivePollutantIndex] = useState(0); // 0-6 for 7 pollutants
  const [visibleSources, setVisibleSources] = useState(0); // 0-8 for sources of pollution
  const [hoveredSource, setHoveredSource] = useState(null); // index of hovered source
  const [sourceTooltipPos, setSourceTooltipPos] = useState({ x: 0, y: 0 }); // position for source tooltip
  const [lifeExpData, setLifeExpData] = useState([]); // life expectancy data for visualization
  const [showCircularHelp, setShowCircularHelp] = useState(null); // which help tooltip to show
  const introRef = useRef(null);
  const imagesSectionRef = useRef(null);
  const timelineRef = useRef(null);
  const timelineScrollRef = useRef(null); // container for scroll-based highlighting
  const mapScrollRef = useRef(null); // container for Delhi/Six Cities scrollytelling
  const delhiTextRef = useRef(null);
  const sixCitiesTextRef = useRef(null);
  const weatherText1Ref = useRef(null);
  const weatherText2Ref = useRef(null);
  const pollutantRefs = useRef([]);
  const sourcesScrollRef = useRef(null);

  // Sources of pollution data
  const pollutionSources = [
    { svg: "/vehicleemission.svg", label: "Vehicle Emissions", description: "Road transport is a major contributor to India’s air pollution, and vehicular emissions are expected to rise with economic growth. Fuel standards in India lag behind global norms, making it crucial to implement Bharat-5 (Euro-5 equivalent) or higher nationwide to curb emissions. Staggered implementation delays air quality improvements, especially as heavy-duty diesel vehicles on lower-grade fuel emit high PM levels. Shifting public transport and para-transit vehicles to CNG—successfully done in Delhi with buses, rickshaws, and taxis—offers a cleaner alternative, but India’s large population and high reliance on transport continue to drive fuel consumption and pollution." },
    { svg: "/roaddust.svg", label: "Road Dust", description: "Road dust is a major air pollution source in many Indian cities, made up of particles from tire and brake wear as well as materials from roads and pavements. Dust levels become even worse on unpaved streets. Street cleaning is often done manually, but poorer neighborhoods usually receive limited service, while wealthier or commercial areas are cleaned more regularly. Even then, much of the swept dust is left along the roadside and gets stirred back into the air once traffic resumes. Mechanized sweeping with vacuum trucks or water sprinkling can better prevent dust resuspension, often at costs comparable to labor-intensive manual methods. Since road dust contributes nearly 30–40% of PM10 pollution in many cities, controlling it is one of the quickest and most effective interventions." },
    { svg: "/industrialemission.svg", label: "Industrial Emissions", description: "Industrial activity is a major source of air pollution in India, responsible for an estimated 51% of emissions. Thermal power plants and other industrial units release sulfur dioxide, nitrogen oxides, and particulate matter (PM10 and PM2.5), which can cause respiratory and cardiovascular problems. Although flue gas desulfurization (FGD) systems are mandated for nearly 540 power plants, compliance has been poor, with only 8% of units meeting the deadline as of 2024. Byrnihat, an industrial town on the Assam-Meghalaya border, was ranked the world’s most polluted city in 2024, with PM2.5 levels far exceeding WHO guidelines. While industry is the main contributor, vehicle emissions and hill cutting also worsen air quality." },
    { svg: "/garbage.svg", label: "Garbage Burning", description: "India generates 35–45 million tons of municipal waste annually, expected to exceed 150 million tons by 2030. Collection efficiency varies (50–90%), and improving waste burning requires stronger, nationwide waste management systems, yet only a few cities have functioning landfills and organized collection. Open waste burning is especially severe in small and medium cities where collection and disposal facilities are limited or absentand releases harmful pollutants like NOx, SO2, VOCs, and dioxins, though exact emissions are uncertain." },
    { svg: "/deisel_generator.svg", label: "Diesel Generators", description: "In 2011, India’s peak electricity demand (~122 GW) exceeded supply (~110 GW), leaving rural areas without reliable access and urban areas facing frequent power cuts. To cope, diesel generator (DG) sets are widely used in homes, businesses, hospitals, and telecom towers, contributing significantly to air pollution—up to 10–15% of PM10 in major cities. Rural DG use for agriculture is also high. Solutions include expanding power generation, improving transmission, adopting renewables, and tightening DG emission standards." },
    { svg: "/cropburning.svg", label: "Crop Burning", description: "Crop residue burning is a major source of air pollution in India, particularly in the northern states of Punjab, Haryana, and Uttar Pradesh. India generates about 500 Mt of crop residue annually, of which 140 Mt is surplus, and 92 Mt is burned each year. Small-scale farmers often burn crop waste because it is inexpensive and convenient. This practice releases large amounts of CO2, CO, N2O, and NOx, causing severe air pollution, with air quality in northern India reaching nearly twice the Indian standard and ten times the WHO standard, especially in November and December. Despite government interventions like monitoring, penalties, and promotion of alternative uses, crop burning continues due to socioeconomic constraints, lack of awareness, and limited access to technology." },
    { svg: "/construction.svg", label: "Construction and Demolition Activity", description: "Construction activities—including cutting, excavation, demolition, mixing, and vehicle movement—release significant particulate matter, often combined with road dust in studies. In six cities, construction contributes up to 10% of annual emissions, highlighting the need for best practices in the industry." },
    { svg: "/coalpowerplant.svg", label: "Coal Power Plants", description: "In 2011–12, India had 111 coal-fired power plants (121 GW) whose emissions were linked to 80,000–115,000 premature deaths and over 20 million asthma cases annually from PM2.5 exposure. Indian coal has low sulfur but high ash content, contributing to coarse PM. Regulations lag behind other countries, with few standards for key pollutants. Stronger pollution controls—like flue gas desulfurization, stricter emission limits, and improved ash management—could cut PM2.5 by 30–40%. Fugitive dust from coal handling and low ash utilization in construction remain additional concerns." },
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
      description: "The National Air Quality Index (AQI) was launched in India in 2014 by the Ministry of Environment, Forest and Climate Change (MoEFCC) along with the Central Pollution Control Board (CPCB). Its main objective is to provide the public with clear, understandable, and real-time information about air quality and its impact on human health. It covers eight major pollutants, including PM2.5, PM10, NO₂, SO₂, CO, O₃, NH₃, and Pb. The AQI is divided into six categories—Good, Satisfactory, Moderate, Poor, Very Poor, and Severe—each linked to specific health advisories.",
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
      description: "In 2024, India continued to expand its air quality monitoring network to improve real-time air pollution data and policy response. Under the National Clean Air Programme (NCAP), the number of Continuous Ambient Air Quality Monitoring Stations (CAAQMS) increased, with new stations added across states such as Tamil Nadu and West Bengal, raising the total from 551 to 559 and expanding coverage to more cities.",
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

        // Convert to array format
        const processedData = Array.from(stateMap.entries())
          .map(([state, stateInfo]) => ({
            state,
            areas: Array.from(stateInfo.areas).sort(),
            areaData: stateInfo.areaData,
          }))
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
        rootMargin: "-40% 0px -40% 0px",
        threshold: 0,
      }
    );

    stateRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [stateData]);

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

  // Sources of pollution scroll handler
  useEffect(() => {

    const handleSourcesScroll = () => {
      if (!sourcesScrollRef.current) return;

      const rect = sourcesScrollRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate scroll progress within the section
      // Section starts when top enters viewport, ends when bottom leaves
      const sectionHeight = rect.height;
      const scrolledIntoSection = viewportHeight - rect.top;
      const scrollProgress = scrolledIntoSection / (sectionHeight - viewportHeight);

      // Map progress to number of visible sources (0-9, where 9 = all visible + hover mode)
      const numSources = 9;
      const newVisible = Math.min(numSources, Math.max(0, Math.floor(scrollProgress * (numSources + 1))));

      setVisibleSources(newVisible);
    };

    window.addEventListener("scroll", handleSourcesScroll);
    handleSourcesScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleSourcesScroll);
  }, []);

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

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2024 is a leap year

  const renderCircularVisualization = (stateInfo) => {
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
          <title>{`${stateInfo.state} - Average AQI: ${avgAQI.toFixed(1)}`}</title>
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
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
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
                onMouseMove={(e) => {
                  if (tooltip) {
                    setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
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
              opacity={0.7}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                if (dayInfo.status) {
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    state: stateInfo.state,
                    date: `${monthNames[dayInfo.month - 1]} ${dayInfo.day}`,
                    aqiValue: dayInfo.aqiValue,
                    status: dayInfo.status,
                    pollutants: dayInfo.pollutants,
                    color: color,
                  });
                }
              }}
              onMouseMove={(e) => {
                if (tooltip) {
                  setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
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
            fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
            fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
    <div style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>
      {loading && <p style={{ padding: "20px" }}>Loading data...</p>}
      {error && <p style={{ color: "red", padding: "20px" }}>Error: {error}</p>}

      {/* Timeline/Scroll View */}
      {!loading && (
        <>
          {/* Full-page title section */}
          <div
            style={{
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "72px",
                fontWeight: "400",
                color: "#000",
                margin: "0",
                letterSpacing: "1px",
              }}
            >
              India Ki Hawa
            </h1>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "36px",
                fontWeight: "400",
                color: "#000",
                margin: "20px 0 50px 0",
              }}
            >
              The air we breathe
            </p>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "400",
                color: "#000",
                margin: "0 0 80px 0",
                maxWidth: "600px",
                lineHeight: "2.0",
              }}
            >
              Visualizing Spatial, Temporal, and Systemic<br />
              Dimensions of India's Air Pollution
            </p>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "14px",
                fontWeight: "400",
                color: "#666",
                margin: "8px 0 0 0",
              }}
            >
              Feb 9, 2026
            </p>
          </div>

          {/* Introduction text section */}
          <div
            ref={introRef}
            style={{
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "#555",
              margin: "0 auto",
              maxWidth: "800px",
              lineHeight: "2.0",
              textAlign: "left",
              padding: "60px 40px",
            }}
          >
            <p>
              India is confronting a deepening air quality crisis. In 2024, the country ranked as the third most polluted nation globally, following Bangladesh and Pakistan, according to AQI.in. With an average AQI of 111, millions of people were exposed to unhealthy air for much of the year. Several Indian cities repeatedly appeared among the world's most polluted urban areas, underscoring the scale and persistence of the problem. New Delhi, the nation's capital, consistently recorded some of the highest pollution levels worldwide, placing it among the most polluted capital cities on the planet.
            </p>
            <p style={{ marginTop: "10px" }}>
              This crisis is closely tied to India's rapid urbanization and energy choices. As the third-largest emitter of greenhouse gases globally, the country relies heavily on fossil fuels to power its growing cities, industries, and transportation networks. While greenhouse gases drive long-term climate change, many of the same activities—coal-based power generation, vehicular traffic, and industrial production—also release pollutants that directly degrade the air people breathe every day.
            </p>
            <p style={{ marginTop: "10px" }}>
              Home to one of the world's largest and densest populations, India faces unique pressures. Rising energy demand, expanding transportation systems, and accelerating urban growth have intensified emissions, while the increasing number of vehicles has made pollution control even more challenging. These pressures are compounded by slow transitions to clean energy, uneven infrastructure development, and weak enforcement of environmental regulations. This story examines how air pollution in India varies across space and time, and what these patterns reveal about public health, environmental inequality, and the systems that shape the air millions inhale daily.
            </p>
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
              marginTop: "150px",
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
                marginLeft: "-40px",
              }}
            >
              {/* Delhi map */}
              <img
                src="/delhi_1.svg"
                alt="India map highlighting Delhi"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "800px",
                  height: "auto",
                  display: activeMapIndex === 0 ? "block" : "none",
                }}
              />
              {/* Six Cities map */}
              <img
                src="/six_cities.svg"
                alt="India map highlighting six most polluted cities"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "800px",
                  height: "auto",
                  display: activeMapIndex === 1 ? "block" : "none",
                }}
              />
            </div>

            {/* Right column - Scrollable text sections */}
            <div
              style={{
                flex: "4",
                display: "flex",
                flexDirection: "column",
                paddingLeft: "40px",
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
                }}
              >
                <h2
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "48px",
                    fontWeight: "700",
                    color: "#3a9bb2",
                    margin: "0 0 20px 0",
                    letterSpacing: "2px",
                    paddingLeft: 50,
                    textAlign: "left",
                  }}
                >
                  DELHI
                </h2>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "#333",
                    lineHeight: "2.0",
                    margin: "0",
                    paddingLeft: 50,
                    maxWidth: "400px",
                    textAlign: "left",
                  }}
                >
                has the poorest air quality among capital cities globally, with concentrations of particulate matter (PM2.5) nearly 10 times higher than the World Health Organization guidelines.
                </p>
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
                }}
              >
                <h2
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "72px",
                    fontWeight: "700",
                    margin: "0 0 20px 0",
                    paddingLeft: 50,
                    textAlign: "left",
                    lineHeight: "1.1",
                  }}
                >
                  <span style={{ color: "#3a9bb2" }}>6</span>
                  <span style={{ color: "#444" }}> out of 10</span>
                </h2>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: "0",
                    paddingLeft: 50,
                    maxWidth: "400px",
                    textAlign: "left",
                  }}
                >
                  most polluted cities of 2024 in the world are in India.
                </p>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "12px",
                    fontWeight: "400",
                    color: "#888",
                    lineHeight: "1.5",
                    margin: "20px 0 0 0",
                    paddingLeft: 50,
                    maxWidth: "400px",
                    textAlign: "left",
                  }}
                >
                  Source: <a href="https://www.iqair.com/world-most-polluted-cities" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>IQAir - World Most Polluted Cities</a>
                </p>
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
              padding: "100px 40px",
              gap: "60px",
              maxWidth: "1400px",
              margin: "0 auto",
              marginTop: "150px",
            }}
          >
            {/* KPI 1 - 35% */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "72px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0 0 20px 0",
                  lineHeight: "1",
                }}
              >
                35%
              </h2>
              <p
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#555",
                  lineHeight: "2.0",
                  margin: "0",
                  maxWidth: "300px",
                }}
              >
                of Indian cities reported annual PM2.5 averages exceeding ten times the WHO guideline.
              </p>
            </div>

            {/* KPI 2 - 5.2 years */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "72px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0 0 20px 0",
                  lineHeight: "1",
                }}
              >
                5.2
              </h2>
              <p
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#555",
                  lineHeight: "2.0",
                  margin: "0",
                  maxWidth: "300px",
                }}
              >
               years of life expectancy reduced in India due to air pollution.
              </p>
            </div>

            {/* KPI 3 - 2 million */}
            <div
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "72px",
                  fontWeight: "700",
                  color: "#3a9bb2",
                  margin: "0 0 20px 0",
                  lineHeight: "1",
                }}
              >
                2M
              </h2>
              <p
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#555",
                  lineHeight: "2.0",
                  margin: "0",
                  maxWidth: "300px",
                }}
              >
                deaths a year in India is accounted due to air pollution.
              </p>
            </div>
          </div>

          {/* Post-KPI paragraph section */}
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
              In 2024, India's annual average PM2.5 concentration translated into a startling health burden: over the course of a year, the air an average individual breathed was equivalent to smoking 796 cigarettes. This exposure was not limited to isolated hotspots. Across the country, 32 days of "Severe" AQI levels were recorded at multiple locations, according to this analysis—concentrated predominantly across the northern Indian peninsula, where pollution episodes were both frequent and prolonged.
            </p>
            <p style={{ marginTop: "20px" }}>
              Yet poor air quality is not a regional anomaly; it is a national condition. From dense urban centers to smaller towns, polluted air affects everyday life for nearly 1.4 billion people. What varies is not exposure, but intensity—shaped by geography, seasonal cycles, and human activity. Breathing in India has become an unavoidable public health risk, embedded into the rhythms of daily life.
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
                <img
                  src="/image1.jpeg.webp"
                  alt="Image 1"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                 Heavy smog seen engulfed amid rise in pollution levels at Barakhamba on Nov. 2, 2023 in New Delhi, India.
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                  Indian schoolchildren cover their faces as they walk to school amid heavy smog in New Delhi on November 8, 2017.
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
                <img
                  src="/image2.jpg"
                  alt="Image 2"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                <img
                  src="/image3.png"
                  alt="Image 3"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  Smoke billows from burning garbage as a boy salvages items from a landfill site in New Delhi
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                Burning of rice residues after harvest, to quickly prepare the land for wheat planting, around Sangrur, Punjab, India
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
                <img
                  src="/image4.jpg"
                  alt="Image 4"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                <img
                  src="/image5.png"
                  alt="Image 5"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                In the past three decades, Byrnihat has grown from a small town into an industrial hub   </p>
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    maxWidth: "400px",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                 Diwali is one of India's most widely celebrated festivals, yet it is also a time when air pollution levels rise sharply due to the widespread use of firecrackers. During these days, the air becomes visibly hazy and physically difficult to breathe. Despite increasing awareness about the environmental impact, large-scale adoption of a truly "green Diwali" remains limited. In 2024, Delhi alone recorded AQI levels as high as 550 during Diwali—falling into the severe to hazardous category—highlighting the urgent need for more sustainable ways to celebrate.
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
                <img
                  src="/image6.jpg"
                  alt="Image 6"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                <img
                  src="/image7.jpg"
                  alt="Image 7"
                  style={{
                    width: "100%",
                    maxWidth: "450px",
                    height: "auto",
                    display: "block",
                  }}
                />
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
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "500",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
              }}
            >
              So, What strategies and interventions has India put in place to tackle air quality concerns?
            </p>
          </div>

          {/* Timeline section - scrollytelling container */}
          <div
            ref={timelineScrollRef}
            style={{
              height: "450vh", // Tall container for all 7 timeline events + exploration phase
              position: "relative",
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
                          fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
                          fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
                          fontFamily: "Georgia, 'Times New Roman', Times, serif",
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

          {/* Transition text after timeline */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "30vh",
              padding: "40px 40px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "400",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
              }}
            >
              India's response to air pollution spans decades of policies, monitoring frameworks, and emergency interventions. On paper, the actions are many. On the ground, however, clean air remains out of reach for most.
            </p>
          </div>

          {/* India AQI Circular Visualization Map Section - Scrollytelling */}
          <div
            style={{
              display: "flex",
              minHeight: "200vh",
              padding: "0 40px",
              maxWidth: "1400px",
              margin: "0 auto",
            }}
          >
            {/* Left - Sticky Circular Viz Map (stays for both scroll sections) */}
            <div
              style={{
                flex: "1.2",
                position: "sticky",
                top: "0",
                height: "100vh",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                paddingRight: "40px",
                marginLeft: "-150px",
              }}
            >
              <div style={{ position: "relative" }}>
                <CircularVizMap />
                <div style={{ position: "absolute", top: "80px", left: "180px" }}>
                  {renderCircularHelpButton("indiaMap")}
                </div>
              </div>
            </div>

            {/* Right - Two Scrolling Text Sections */}
            <div
              style={{
                flex: "0.4",
                display: "flex",
                flexDirection: "column",
                paddingLeft: "30px",
              }}
            >
              {/* First scroll section - Title and Description */}
              <div
                style={{
                  height: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                }}
              >
                <h2
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 12px 0",
                    lineHeight: "2.0",
                    textAlign: "left",
                  }}
                >
                  AQI Category Distribution by State and Union Territory
                </h2>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: "0 0 10px 0",
                    maxWidth: "350px",
                    textAlign: "left",
                  }}
                >
                  The map of India on the left illustrates Air Quality Index (AQI) conditions across 2024. Each circular calendar represents a state or union territory, with radial lines showing daily AQI values throughout the year. Colors indicate pollution severity—blue tones for better air quality and pink tones for poorer conditions.
                </p>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "12px",
                    fontWeight: "400",
                    color: "#888",
                    lineHeight: "1.5",
                    margin: "20px 0 0 0",
                    maxWidth: "350px",
                    textAlign: "left",
                  }}
                >
                  Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
                </p>
              </div>

              {/* Second scroll section - AQI Categories & Health Impact */}
              <div
                style={{
                  height: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "450px",
                    textAlign: "left",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "24px",
                      fontWeight: "600",
                      color: "#333",
                      margin: "0 0 20px 0",
                      lineHeight: "2.0",
                      textAlign: "left",
                    }}
                  >
                    AQI Categories & Health Impact
                  </h3>

                  {/* Good */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#5699af", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Good (0–50): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>Minimal health impact.</span>
                    </div>
                  </div>

                  {/* Satisfactory */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#87beb1", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Satisfactory (51–100): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>May cause minor breathing discomfort for sensitive individuals.</span>
                    </div>
                  </div>

                  {/* Moderate */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#dfbfc6", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Moderate (101–200): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>Can lead to breathing discomfort for people with asthma or lung disease.</span>
                    </div>
                  </div>

                  {/* Poor */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#de9eaf", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Poor (201–300): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>May cause breathing discomfort with prolonged exposure.</span>
                    </div>
                  </div>

                  {/* Very Poor */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#5699af", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Very Poor (301–400): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>Prolonged exposure may result in respiratory illness.</span>
                    </div>
                  </div>

                  {/* Severe */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#c1616b", flexShrink: 0, marginTop: "6px" }} />
                    <div style={{ lineHeight: "2.0" }}>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", fontWeight: "600", color: "#333" }}>Severe (401–500): </span>
                      <span style={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontSize: "16px", color: "#555" }}>Can cause respiratory effects even in healthy individuals.</span>
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
              padding: "40px 40px",
              background: "#fff",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "400",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
              }}
            >
              Now, let's zoom in and explore how air pollution unfolds across the year in each state and its major cities. By looking more closely at these regional patterns, we can see how air quality shifts over time and which areas experience the most prolonged exposure to unhealthy conditions.
            </p>
          </div>

          {/* Main visualization section with sticky chart */}
          <div
            style={{
              display: "flex",
              minHeight: "100vh",
              padding: "20px 20px 20px 0",
            }}
          >
            {/* Sticky visualization on the left */}
            <div
              style={{
                position: "sticky",
                top: "50px",
                height: "fit-content",
                flexShrink: 0,
                marginLeft: "-50px",
              }}
            >
              <div style={{ position: "relative" }}>
                {stateData.length > 0 && renderCircularVisualization(stateData[activeStateIndex])}
                <div style={{ position: "absolute", top: "20px", left: "20px" }}>
                  {renderCircularHelpButton("stateViz")}
                </div>
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
              <p
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "12px",
                  fontWeight: "400",
                  color: "#888",
                  lineHeight: "1.5",
                  margin: "40px 0 0 0",
                  textAlign: "left",
                }}
              >
                Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
              </p>
            </div>
          </div>

          {/* Transition text after state circular visualizations */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "20vh",
              padding: "20px 40px",
              background: "#fff",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "80px",
                backgroundColor: "#5699af",
                marginRight: "20px",
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "400",
                color: "#333",
                textAlign: "left",
                maxWidth: "800px",
                lineHeight: "2.0",
                margin: 0,
              }}
            >
              Now, let's look beyond AQI levels and explore the major causes driving air pollution across India.
            </p>
          </div>

          {/* AQI vs Population Section */}
          <div
            style={{
              padding: "60px 40px",
              background: "#fff",
              maxWidth: "1200px",
              margin: "0 auto",
            }}
          >
            {/* Title */}
            <h2
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "600",
                color: "#333",
                textAlign: "center",
                marginBottom: "40px",
              }}
            >
              AQI vs population
            </h2>

            {/* Two maps side by side */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0px",
                marginBottom: "20px",
                alignItems: "flex-start",
              }}
            >
              {/* Left - AQI Circular Viz Map */}
              <div style={{ textAlign: "center", width: "500px", overflow: "hidden" }}>
                <div style={{
                  transform: "scale(0.55)",
                  transformOrigin: "top center",
                  width: "900px",
                  height: "520px",
                  marginLeft: "-200px",
                }}>
                  <CircularVizMap />
                </div>
              </div>

              {/* Right - Population Map */}
              <div style={{ textAlign: "center" }}>
                <img
                  src="/indiapop.svg"
                  alt="India Population Map"
                  style={{
                    width: "500px",
                    height: "auto",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "15px",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "radial-gradient(circle at center, #e0e0e0 0%, #c1616b 100%)",
                      opacity: 0.8,
                    }}
                  />
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "radial-gradient(circle at center, #e0e0e0 0%, #c1616b 100%)",
                      opacity: 0.8,
                    }}
                  />
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: "radial-gradient(circle at center, #e0e0e0 0%, #c1616b 100%)",
                      opacity: 0.8,
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "12px",
                      color: "#666",
                      margin: 0,
                      marginLeft: "5px",
                    }}
                  >
                    Size of bubble represents population
                  </p>
                </div>
              </div>
            </div>

            {/* Placeholder text */}
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "16px",
                color: "#555",
                lineHeight: "2.0",
                maxWidth: "900px",
                margin: "30px auto 0",
                textAlign: "left",
              }}
            >
             The map above highlights population density across India, revealing a striking concentration of people in the North Indian River Plain. This region—stretching across states such as Uttar Pradesh, Bihar, and parts of Delhi—houses nearly one billion people, making it one of the most densely populated areas in the world. With such large and rapidly growing urban centers, air pollution levels tend to rise sharply. Increased population often brings higher vehicle usage, intensified traffic congestion, industrial expansion, construction activity, and greater energy demand—all of which contribute significantly to worsening air quality.
However, population alone does not fully explain India's air pollution patterns. Major metropolitan cities in the south, such as Bangalore and Chennai, also have large populations and expanding infrastructure, yet they generally do not experience pollution as severe as cities in the northern plains. This contrast is influenced by a combination of factors not only population density.    </p>
          </div>

          {/* Climate Section - Static */}
          <div
            ref={weatherText1Ref}
            style={{
              display: "flex",
              minHeight: "100vh",
              padding: "60px 40px",
              background: "#fff",
              maxWidth: "1200px",
              margin: "0 auto",
              alignItems: "center",
            }}
          >
            {/* Left - Climate Map */}
            <div style={{ flex: 2 }}>
              <img
                src="/indiaclimate.svg"
                alt="India Climate Map"
                style={{
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                }}
              />
            </div>

            {/* Right - Climate Text */}
            <div style={{ flex: 1, paddingLeft: "40px" }}>
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#333",
                  textAlign: "left",
                  marginBottom: "20px",
                  marginTop: 0,
                }}
              >
                How weather affects air pollution
              </h2>
              <p
                style={{
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  fontSize: "16px",
                  color: "#555",
                  lineHeight: "2.0",
                  margin: 0,
                  textAlign: "left",
                }}
              >
                Air quality in India varies strongly with changes in temperature and rainfall. During the monsoon season (June to September), heavy rains act as a natural cleanser by capturing airborne particles and bringing them down to the ground. This frequent rainfall helps clear the atmosphere and results in some of the cleanest skies of the year. In contrast, winter months (November to February) bring colder temperatures, which increase the use of heating and cooking fires. These emissions add significant particulate matter to the air, worsening pollution levels.
              </p>
            </div>
          </div>

          {/* Wind Section - Sticky Video with Scrollable Text */}
          <div
            ref={weatherText2Ref}
            style={{
              position: "relative",
              width: "100vw",
              marginLeft: "calc(-50vw + 50%)",
            }}
          >
            {/* Sticky Video Background */}
            <div
              style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                width: "100%",
                overflow: "hidden",
              }}
            >
              <video
                src="/windspeed.mov"
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>

            {/* Scrollable Text Sections - Overlaid on video */}
            <div
              style={{
                position: "relative",
                marginTop: "-100vh",
                pointerEvents: "none",
              }}
            >
              {/* First Scroll Section */}
              <div
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 80px",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    maxWidth: "400px",
                    background: "rgba(255, 255, 255, 0.4)",
                    padding: "40px",
                    borderRadius: "16px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "24px",
                      fontWeight: "600",
                      color: "#333",
                      textAlign: "left",
                      marginBottom: "20px",
                      marginTop: 0,
                    }}
                  >
                    Wind and Air Quality
                  </h2>
                  <p
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "16px",
                      color: "#555",
                      lineHeight: "2.0",
                      margin: 0,
                      textAlign: "left",
                    }}
                  >
                    Wind plays a crucial role in dispersing pollutants. When winds are strong, polluted air is carried away and diluted, improving overall air quality. The animation shows wind patterns across India, revealing how air masses move across the subcontinent.
                  </p>
                </div>
              </div>

              {/* Second Scroll Section - Himalayan Barrier */}
              <div
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 80px",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    maxWidth: "400px",
                    background: "rgba(255, 255, 255, 0.4)",
                    padding: "40px",
                    borderRadius: "16px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "24px",
                      fontWeight: "600",
                      color: "#333",
                      textAlign: "left",
                      marginBottom: "20px",
                      marginTop: 0,
                    }}
                  >
                    The Himalayan Barrier
                  </h2>
                  <p
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      fontSize: "16px",
                      color: "#555",
                      lineHeight: "2.0",
                      margin: 0,
                      textAlign: "left",
                    }}
                  >
                    In northern India, the Indo-Gangetic Plain is geographically enclosed by the Himalayas. This mountain barrier limits airflow, especially during winter, trapping pollutants near the ground and preventing them from escaping. As a result, polluted air stagnates and accumulates over time, leading to severe pollution episodes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Source for Climate/Wind Data */}
          <div
            style={{
              padding: "20px 40px",
              background: "#fff",
              maxWidth: "1200px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "12px",
                fontWeight: "400",
                color: "#888",
                lineHeight: "1.5",
                margin: 0,
              }}
            >
              Source: <a href="https://www.kaggle.com/datasets/developerghost/climate-in-india-daily-weather-data-2000-2024" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - Climate in India Daily Weather Data 2000-2024</a>
            </p>
          </div>

          {/* Seasonal Pollution Section */}
          <div
            style={{
              padding: "80px 40px",
              background: "#fff",
              maxWidth: "1200px",
              margin: "0 auto",
            }}
          >
            {/* Title */}
            <h2
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "600",
                color: "#333",
                textAlign: "center",
                marginBottom: "50px",
              }}
            >
              Seasonality of Air Pollution
            </h2>

            {/* Monthly AQI Chart */}
            <div style={{ marginBottom: "50px" }}>
              <MonthlyAQICityChart />
            </div>

            {/* Text */}
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "16px",
                color: "#555",
                lineHeight: "2.0",
                margin: 0,
                textAlign: "left",
                maxWidth: "900px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Pollution levels also shift due to seasonal human activities. Summer typically has fewer fire-related emissions, but after the monsoon ends in September, crop burning begins as farmers clear fields for new planting. This practice releases large amounts of smoke and pollutants into the atmosphere, contributing to a sharp decline in air quality during the later months of the year. Forest fires during this period can further intensify pollution, creating hazardous conditions often observed from October through February. Additionally, colder winter temperatures increase the use of heating and cooking fires and trap pollutants closer to the ground, which helps explain the consistently higher pollution levels visible in the visualization during the winter season.
            </p>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "12px",
                fontWeight: "400",
                color: "#888",
                lineHeight: "1.5",
                margin: "30px auto 0 auto",
                textAlign: "center",
                maxWidth: "900px",
              }}
            >
              Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
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
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "24px",
                fontWeight: "600",
                color: "#333",
                textAlign: "center",
                marginBottom: "50px",
              }}
            >
              Understanding Air Pollutants
            </h2>

            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                fontSize: "16px",
                color: "#555",
                lineHeight: "2.0",
                margin: 0,
                textAlign: "left",
                maxWidth: "900px",
                marginLeft: "auto",
                marginRight: "auto",
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

          {/* Pollutants Scrollytelling Section */}
          <div
            style={{
              display: "flex",
              minHeight: "700vh",
              padding: "0 40px",
              maxWidth: "1400px",
              margin: "0 auto",
              marginTop: "100px",
            }}
          >
            {/* Left column - Sticky map area */}
            <div
              style={{
                flex: "6",
                position: "sticky",
                top: "10vh",
                height: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* PM10 */}
              <img
                src="/Pollution_pm10.svg"
                alt="PM10 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 0 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* PM2.5 */}
              <img
                src="/Pollution_pm25.svg"
                alt="PM2.5 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 1 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* NO2 */}
              <img
                src="/Pollution_No2.svg"
                alt="NO2 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 2 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* SO2 */}
              <img
                src="/Pollution_So2.svg"
                alt="SO2 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 3 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* CO */}
              <img
                src="/Pollution_CO.svg"
                alt="CO pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 4 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* O3 */}
              <img
                src="/Pollution_o3.svg"
                alt="O3 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 5 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
              {/* NH3 */}
              <img
                src="/Pollution_NH3.svg"
                alt="NH3 pollution map"
                style={{
                  position: "absolute",
                  width: "100%",
                  maxWidth: "700px",
                  height: "auto",
                  opacity: activePollutantIndex === 6 ? 1 : 0,
                  transition: "opacity 0.4s ease-out",
                }}
              />
            </div>

            {/* Right column - Scrollable text sections */}
            <div
              style={{
                flex: "4",
                display: "flex",
                flexDirection: "column",
                paddingLeft: "40px",
                textAlign: "left",
              }}
            >
              {/* PM10 text section */}
              <div
                ref={(el) => (pollutantRefs.current[0] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 0 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  PM10
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                 
PM10 refers to particulate matter smaller than 10 micrometers, often coming from visible and heavier sources such as road dust, construction sites, and industrial activity. Because these particles are larger, they settle more quickly and are usually trapped in the nose or throat when inhaled. While PM10 still affects air quality and can cause irritation, it is generally less able to penetrate deep into the body compared to finer particles.    </p>
              </div>

              {/* PM2.5 text section */}
              <div
                ref={(el) => (pollutantRefs.current[1] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 1 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  PM2.5
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                PM2.5, on the other hand, includes particles smaller than 2.5 micrometers—nearly 30 times thinner than a human hair. These fine particles mainly come from fuel combustion, vehicle exhaust, crop burning, and industrial smoke. Because they are so light, they remain suspended in the air longer, spread easily across cities, and can travel deep into the lungs and even enter the bloodstream. This makes PM2.5 far more dangerous, strongly linked to asthma, heart disease, and respiratory infections. In Indian cities, PM2.5 is often the main driver of “poor” or “severe” AQI levels, especially in winter when low winds and temperature inversion trap pollution near the ground.      </p>
              </div>

              {/* NO2 text section */}
              <div
                ref={(el) => (pollutantRefs.current[2] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 2 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  NO₂ (Nitrogen Dioxide)
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                 Nitrogen oxides (NOx), mainly nitric oxide (NO) and nitrogen dioxide (NO₂), are major urban air pollutants. NO₂ is a reddish-brown corrosive gas primarily produced during fuel combustion, making automobile exhaust one of its largest sources. Significant emissions also come from industries where nitric acid is produced or used.
Although NO₂ remains in the atmosphere only for a few days, it contributes to the formation of harmful compounds such as nitric acid and nitrates, and it also plays a key role in producing ground-level ozone. Since the 1990s, NO₂ levels have risen sharply in major Indian cities, with pollution peaks closely aligning with traffic rush hours. NEERI studies estimate that traffic contributes over half of total NO₂ emissions in cities like Mumbai. While annual averages may still fall within permissible limits in many areas, maximum concentrations in several towns and industrial regions have already exceeded safe standards, signaling a growing air quality concern.  </p>
              </div>

              {/* SO2 text section */}
              <div
                ref={(el) => (pollutantRefs.current[3] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 3 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  SO₂ (Sulphur Dioxide)
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                  Sulphur dioxide (SO₂) is released into the atmosphere from both natural and human-made sources. Naturally, it can originate from volcanic activity and the decay of organic matter in soils. However, most urban SO₂ emissions come from the combustion of fossil fuels, since coal and oil contain sulphur compounds. Major contributors include oil refineries, automobiles, thermal power plants, smelters, and industrial facilities.
During the 1960s–1980s, SO₂ was considered one of India’s most critical air pollutants, largely driven by rapid industrialization and growing urban transport. NEERI studies show that SO₂ levels declined in many cities after 1980, partly because cleaner fuels like LPG replaced wood, coal, and kerosene for cooking. However, cities such as Lucknow, Delhi experienced rising SO₂ emissions due to continued industrial and urban expansion.  </p>
              </div>

              {/* CO text section */}
              <div
                ref={(el) => (pollutantRefs.current[4] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 4 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  CO (Carbon Monoxide)
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                  Carbon monoxide (CO) is a toxic trace gas released mainly through the incomplete combustion of fossil fuels, and it poses a serious risk to human health. Studies show strong seasonal variation in CO levels across India, with the highest concentrations occurring in winter. This suggests that colder temperatures are closely linked to increased CO emissions.
When comparing state capitals, cities such as Delhi, Patna, Mumbai, Bengaluru, Jaipur, Lucknow, Chennai, and Bhopal consistently rank among the highest CO emitters. These patterns can help policymakers identify priority regions for emission control and air quality improvement.
Research also finds that temperature has a clear negative relationship with CO levels—warmer conditions generally reduce CO concentrations—while factors like humidity and wind show only a moderate influence. Health risk assessments highlight Delhi as facing the greatest non-carcinogenic risk from CO exposure (29.8%), followed by Chandigarh (13.5%) and Patna (13.4%). Overall, these findings emphasize the need for targeted seasonal strategies to reduce CO pollution and protect public health in India’s major urban centers. </p>
              </div>

              {/* O3 text section */}
              <div
                ref={(el) => (pollutantRefs.current[5] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 5 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  O₃ (Ground-Level Ozone)
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                  
Ground-level ozone, a major component of smog, is highly harmful to plants. It damages leaves, suppresses growth, and can injure or even kill vegetation, reducing crop productivity. This pollutant forms when nitrogen oxides, carbon monoxide, and volatile organic compounds released from vehicles, industries, cooking stoves, and biomass burning react in sunlight. Despite its serious threat to agriculture, India currently lacks air quality standards specifically aimed at protecting crops from ground-level ozone exposure.
A 2005 study examined the agricultural impacts of high ground-level ozone concentrations in India. It highlights that rising emissions have led to severe ozone pollution across some of India’s most densely populated regions. In Delhi, ozone and smog levels have reached intensities comparable to Beijing, one of the world’s most polluted cities. </p>
              </div>

              {/* NH3 text section */}
              <div
                ref={(el) => (pollutantRefs.current[6] = el)}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "20vh",
                  paddingBottom: "20vh",
                  opacity: activePollutantIndex === 6 ? 1 : 0.3,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                <h3
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 20px 0",
                  }}
                >
                  NH₃ (Ammonia)
                </h3>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "16px",
                    color: "#555",
                    lineHeight: "2.0",
                    margin: 0,
                  }}
                >
                  Atmospheric ammonia (NH₃) is an alkaline gas and an important part of the nitrogen cycle, but at high concentrations it becomes a serious pollutant. It contributes to haze in the air, soil acidification, and eutrophication of water bodies. NH₃ also reacts with sulfur and nitrogen oxides (SOx and NOx) to form aerosols, which harm human health and influence climate.
In India, the Indo-Gangetic Plains have emerged as a global hotspot for ammonia emissions due to intensive agriculture and fertiliser industries. Satellite studies show record-high NH₃ levels in this region, strongly linked to fertiliser use, especially during the kharif season (June–September). Researchers highlight that regulating fertiliser application through precision farming and improved soil management could help reduce emissions. Experts also note that ammonia pollution is closely tied to urea use and stubble burning, making sustainable agricultural practices essential for controlling this growing air quality challenge.   </p>
                <p
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    fontSize: "12px",
                    fontWeight: "400",
                    color: "#888",
                    lineHeight: "1.5",
                    margin: "30px 0 0 0",
                    textAlign: "left",
                  }}
                >
                  Source: <a href="https://www.kaggle.com/datasets/bhadramohit/india-air-quality-index2024-dataset" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>Kaggle - India Air Quality Index 2024 Dataset</a>
                </p>
              </div>
            </div>
          </div>

          {/* Sources of Pollution Section - Scroll-triggered Bento Grid */}
          <div
            ref={sourcesScrollRef}
            style={{
              height: "500vh",
              position: "relative",
            }}
          >
            {/* Sticky container */}
            <div
              style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                padding: "40px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gridTemplateRows: "1fr 1fr 1fr",
                  gap: "20px",
                  height: "100%",
                }}
              >
                {/* Box positions: 0=top-left, 1=top-center, 2=top-right, 3=mid-left, 4=center(text), 5=mid-right, 6=bot-left, 7=bot-center, 8=bot-right */}
                {/* Order of appearance: 0,1,2,5,8,7,6,3 (clockwise from top-left, skipping center) */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((boxIndex) => {
                  // Map box positions to appearance order
                  const appearanceOrder = [0, 1, 2, 7, -1, 3, 6, 5, 4]; // -1 for center (no image)
                  const sourceIndex = appearanceOrder[boxIndex];
                  const isCenter = boxIndex === 4;
                  const isVisible = sourceIndex !== -1 && sourceIndex < visibleSources;
                  const source = sourceIndex >= 0 && sourceIndex < pollutionSources.length ? pollutionSources[sourceIndex] : null;

                  if (isCenter) {
                    return (
                      <div
                        key={boxIndex}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "20px",
                        }}
                      >
                        <h2
                          style={{
                            fontFamily: "Georgia, 'Times New Roman', Times, serif",
                            fontSize: "24px",
                            fontWeight: "600",
                            color: "#333",
                            textAlign: "center",
                            marginBottom: "20px",
                          }}
                        >
                          Sources of Air Pollution
                        </h2>
                        <p
                          style={{
                            fontFamily: "Georgia, 'Times New Roman', Times, serif",
                            fontSize: "16px",
                            color: "#666",
                            textAlign: "center",
                            lineHeight: "2.0",
                            transition: "all 0.3s ease-out",
                            minHeight: "24px",
                          }}
                        >
                          {hoveredSource !== null && visibleSources >= 9
                            ? pollutionSources[hoveredSource].label
                            : visibleSources >= 9
                            ? "Hover on images for more info"
                            : visibleSources > 0 && visibleSources <= 8
                            ? pollutionSources[visibleSources - 1].label
                            : "Scroll to explore"}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={boxIndex}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fafafa",
                        overflow: "hidden",
                        position: "relative",
                        cursor: isVisible ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => {
                        if (isVisible) {
                          setHoveredSource(sourceIndex);
                          setSourceTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (isVisible) {
                          setSourceTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseLeave={() => setHoveredSource(null)}
                    >
                      {source && (
                        <img
                          src={source.svg}
                          alt={source.label}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: isVisible ? "translateY(0)" : "translateY(100%)",
                            opacity: isVisible ? 1 : 0,
                            transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Source tooltip */}
              {hoveredSource !== null && (() => {
                const tooltipWidth = 400;
                const tooltipHeight = 250; // approximate max height
                const padding = 15;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Calculate optimal position
                let left = sourceTooltipPos.x + padding;
                let top = sourceTooltipPos.y + padding;

                // If tooltip would overflow right, show on left of cursor
                if (left + tooltipWidth > viewportWidth - padding) {
                  left = sourceTooltipPos.x - tooltipWidth - padding;
                }

                // If tooltip would overflow bottom, show above cursor
                if (top + tooltipHeight > viewportHeight - padding) {
                  top = sourceTooltipPos.y - tooltipHeight - padding;
                }

                // Ensure tooltip doesn't go off-screen on left or top
                left = Math.max(padding, left);
                top = Math.max(padding, top);

                return (
                  <div
                    style={{
                      position: "fixed",
                      left: left,
                      top: top,
                      backgroundColor: "rgba(0, 0, 0, 0.85)",
                      color: "#fff",
                      padding: "12px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontFamily: "Georgia, 'Times New Roman', Times, serif",
                      maxWidth: "400px",
                      maxHeight: "240px",
                      overflowY: "auto",
                      lineHeight: "2.0",
                      textAlign: "left",
                      pointerEvents: "none",
                      zIndex: 1001,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "6px" }}>
                      {pollutionSources[hoveredSource].label}
                    </strong>
                    <span style={{ color: "#ccc" }}>
                      {pollutionSources[hoveredSource].description}
                    </span>
                  </div>
                );
              })()}
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
            padding: "40px 40px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "80px",
              backgroundColor: "#5699af",
              marginRight: "20px",
              marginTop: "8px",
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontSize: "24px",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontWeight: "300",
              lineHeight: "2.0",
              maxWidth: "900px",
              textAlign: "left",
              color: "#333",
              margin: 0,
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
            padding: "80px 120px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              color: "#333",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "400",
                marginBottom: "40px",
                textAlign: "left",
              }}
            >
              Why National Standards Differ from WHO Guidelines?
            </h2>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                marginBottom: "32px",
                textAlign: "left",
              }}
            >
              India follows its own air quality standards rather than the stricter WHO guidelines, reflecting the country's unique environmental, geographic, and developmental realities. For instance, the WHO recommends an annual average of 5 µg/m³ for PM2.5, while India's standard is 40 µg/m³—eight times higher. Similarly, for PM10 and NO2, Indian limits are 4 times and 4 times the WHO recommendations, respectively. These differences arise because natural dust, high background particulate levels, and measurement challenges make global standards impractical in many regions. Ground-based monitoring through CAAQMS, rather than satellites, focuses primarily on urban centers, leaving rural areas under-monitored.
            </p>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                textAlign: "left",
              }}
            >
              At the same time, India balances public health with economic and developmental priorities. Immediate adoption of WHO standards would require halting thermal power, diesel transport, and construction—measures that could hinder growth. To address pollution within these constraints, India has established a domestic framework: the National Ambient Air Quality Standards (NAAQS) and the National Clean Air Programme (NCAP). NCAP targets a 40% reduction in particulate matter by 2026 and focuses on vehicles, industries, road dust, construction, and biomass burning. Cities are ranked annually through Swachh Vayu Survekshan, which evaluates both pollution levels and mitigation efforts. While national standards guide policy realistically, aligning more closely with WHO recommendations could reduce air pollution across India and substantially improve life expectancy.
            </p>
          </div>
        </div>
      )}

      {/* Life Expectancy Gains Visualization */}
      {lifeExpData.length > 0 && (
        <div>
          <LifeExpectancyPlot data={lifeExpData} />
          <p
            style={{
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontSize: "12px",
              fontWeight: "400",
              color: "#888",
              lineHeight: "1.5",
              margin: "20px 0 0 0",
              textAlign: "center",
              background: "#fff",
              paddingBottom: "20px",
            }}
          >
            Source: <a href="https://aqli.epic.uchicago.edu/files/India%20FactSheet_2025_GlobalWV.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "#5699af" }}>AQLI - India Fact Sheet 2025</a>
          </p>
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
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              color: "#333",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "400",
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
              Effective air pollution management is not something that can be solved overnight. Real progress takes time—often years, even decades—because cleaner air requires long-term commitment and consistent action. India can learn from strategies used in other regions, but solutions must be adapted to fit its own environmental and social realities. The path ahead will not be easy, yet the core truth is simple: meaningful improvement is only possible when emissions from every major source are reduced, and wherever possible, eliminated. Achieving clean air for all will require not just technical fixes, but deep institutional and policy changes to drive lasting impact.
            </p>
          </div>

          {/* KPI Grid - Full Width */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "60px",
              marginTop: "60px",
              padding: "0 40px",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
            }}
          >
            {/* KPI 1 */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#5B7DB8",
                  lineHeight: "2.0",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                Differentiating better air quality and net-zero emissions for climate change
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: "300",
                  lineHeight: "2.0",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                Air pollution and climate change both come mainly from fossil fuel burning, but they require different solutions. Climate policy focuses on long-term net-zero goals, while air quality management targets immediate pollutant limits. Cutting local emissions quickly improves health and air conditions, unlike climate benefits which are global and slower. Air pollution is more visible and regulated nationally, making accountability clearer. Some climate fixes, like biofuels, can worsen air pollution, so policies must balance both.
              </p>
            </div>

            {/* KPI 2 */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#5B7DB8",
                  lineHeight: "2.0",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                An aggressive push for more ambient pollution monitoring
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: "300",
                  lineHeight: "2.0",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                Effective air quality management begins with measurement. Monitoring reveals pollution levels, hotspots, and trends over time. India has long faced gaps due to the high cost of reference-grade equipment, but low-cost sensors, combined with satellite data and AI, can help expand coverage. Increasing monitoring density nationwide and ensuring open access to data are essential for stronger air quality policy and action.</p>
            </div>

            {/* KPI 3 */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#5B7DB8",
                  lineHeight: "2.0",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                Insisting on the cities to build an energy and emissions baseline for accountability
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: "300",
                  lineHeight: "2.0",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                Cities need a bottom-up approach to reduce emissions, starting with detailed local baselines built from on-the-ground data on industries, household energy use, and traffic. Without this foundation, it is difficult to measure progress or assess mitigation success. India’s NCAP (2019) requires 131 non-attainment cities to develop such baselines. While satellites and AI can support analysis, they cannot replace local data collection, modelling, and sustained political commitment.    </p>
            </div>

            {/* KPI 4 */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#5B7DB8",
                  lineHeight: "2.0",
                  marginBottom: "16px",
                  textAlign: "left",
                }}
              >
                Unification of emission inventories at the national scale
              </h3>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: "300",
                  lineHeight: "2.0",
                  color: "#555",
                  textAlign: "left",
                }}
              >
                A standardized, high-resolution emissions inventory is essential for NCAP’s success, helping cities design, track, and strengthen pollution control strategies while supporting future NCAP 2.0 efforts beyond urban areas. Currently, fragmented inventories built with different methods limit comparability and weaken national baselines. India needs a unified, multi-pollutant, high-resolution emissions inventory—developed through collaborative inter-comparison—to reflect local sources and guide stronger clean air science and policy.    </p>
            </div>
          </div>
        </div>
      )}

      {/* Infrastructural Changes Title */}
      {(
        <div
          style={{
            padding: "80px 120px",
            backgroundColor: "#fff",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontWeight: "400",
              maxWidth: "900px",
              margin: "0 auto",
              textAlign: "left",
              color: "#333",
            }}
          >
            Infrastructural Changes That Would Help Achieve Better Air Quality
          </h2>
        </div>
      )}

      {/* Infrastructure Sections - Two Columns */}
      {(
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            padding: "60px 120px",
            backgroundColor: "#fff",
            gap: "80px",
          }}
        >
          {/* Column 1 */}
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
            }}
          >
            <img
              src="/infa1.svg"
              alt="Infrastructure 1"
              style={{ width: "100%", height: "auto", marginBottom: "30px" }}
            />
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "500",
                color: "#333",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              Better Cycling and Walking Infrastructure
            </h3>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                color: "#555",
                textAlign: "left",
              }}
            >
              Improving infrastructure for cycling and walking on a daily basis can significantly reduce air pollution. It encourages people to rely less on fuel-powered vehicles, which in turn lowers emissions. Moreover, given the persistent traffic congestion in India, there is a strong likelihood that people would embrace these alternatives.
            </p>
          </div>

          {/* Column 2 */}
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
            }}
          >
            <img
              src="/infa-2.svg"
              alt="Infrastructure 2"
              style={{ width: "100%", height: "auto", marginBottom: "30px" }}
            />
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "500",
                color: "#333",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              Better Electricity Infrastructure
            </h3>
            <p
              style={{
                fontSize: "16px",
                fontWeight: "300",
                lineHeight: "2.0",
                color: "#555",
                textAlign: "left",
              }}
            >
              Enhancing electricity infrastructure can play a crucial role in reducing air pollution. Reliable and widespread electricity supply decreases the reliance on diesel generators, which are major sources of harmful emissions. It also reduces the need for traditional cooking fuels, such as wood, coal, or other biomass, which release smoke and particulate matter into the air. Transitioning to cleaner and greener sources of electricity, such as solar, wind, or hydropower, is essential not only for meeting energy needs but also for mitigating environmental pollution and protecting public health.
            </p>
          </div>
        </div>
      )}

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
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
              But change doesn't happen overnight. Not everyone will buy a new vehicle immediately, and even building better cycling and walking infrastructure takes time—not just to construct, but for people to adapt and start using it regularly. Policies and infrastructure may be slow to show results, yet the sooner India begins, the sooner its people can breathe cleaner air.
            </p>
            <p
              style={{
                fontSize: "24px",
                fontWeight: "600",
                lineHeight: "2.0",
                textAlign: "center",
                color: "#5B7DB8",
                marginTop: "120px",
              }}
            >
              In a country where billions live and breathe, clean air is not a luxury—it is a basic right and a shared responsibility.
            </p>
          </div>
        </div>
      )}

      {/* References Section */}
      {(
        <div
          style={{
            backgroundColor: "#1a365d",
            width: "100vw",
            marginLeft: "calc(-50vw + 50%)",
            marginTop: "120px",
            padding: "80px 40px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              fontWeight: "500",
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
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
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
            backgroundColor: tooltip.color,
            color: "#000",
            padding: "5px 5px",
            borderRadius: "2px",
            fontSize: "12px",
            fontWeight: "300",
            pointerEvents: "none",
            zIndex: 1000,
            lineHeight: "2.0",
          }}
        >
          {tooltip.state && (
            <div style={{ fontWeight: "700", marginBottom: "6px" }}>
              {tooltip.state}
            </div>
          )}
          <div>
            {tooltip.date} {tooltip.state && "•"} AQI: {tooltip.aqiValue} {tooltip.state && `• ${tooltip.status}`}
          </div>
          {tooltip.pollutants && (
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>
              Pollutants: {tooltip.pollutants}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
