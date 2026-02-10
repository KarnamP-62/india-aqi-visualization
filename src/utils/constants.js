// Chart dimensions
export const CHART_DIMENSIONS = {
  width: 800,
  height: 600,
  margin: { top: 20, right: 30, bottom: 40, left: 50 }
};

// Color scales for AQI levels
export const AQI_COLORS = {
  good: "#00e400",
  moderate: "#ffff00",
  unhealthySensitive: "#ff7e00",
  unhealthy: "#ff0000",
  veryUnhealthy: "#8f3f97",
  hazardous: "#7e0023"
};

// AQI breakpoints
export const AQI_BREAKPOINTS = {
  good: [0, 50],
  moderate: [51, 100],
  unhealthySensitive: [101, 150],
  unhealthy: [151, 200],
  veryUnhealthy: [201, 300],
  hazardous: [301, 500]
};
