# AQI Visualization Project Notes

## Backup Information

**Initial Backup Date**: 2026-01-02
**Latest Update**: 2026-01-02

A backup folder was created containing a copy of the entire AQI folder contents. This backup preserves the state of the project including:
- Source code
- Data files (AQI.csv)
- Dependencies
- Configuration files

Location: `backup/` folder

**Note**: Backup should be updated to reflect recent visualization changes.

## Project Overview

This project is an Air Quality Index (AQI) visualization tool built with React, Vite, and D3.js.

### Key Features
- Circular calendar visualization showing AQI data for 2024
- 12 concentric rings representing each month (January outermost, December innermost)
- Color-coded rectangular arc segments based on air quality status
- Line graphs overlaid on each month showing AQI value trends
- Dotted reference lines at AQI 100 (moderate threshold) for each month
- Interactive tooltips with detailed information
- Angular layout: starts at 210° (7 o'clock), spans 330° clockwise, ends at 180° (9 o'clock)

### Technology Stack
- React 19.2.0
- D3.js 7.9.0
- Vite (rolldown-vite 7.2.5)
- ESLint for code quality
- Font: Georgia (with Times New Roman, Times fallbacks)

### Color Scheme
- Good: #5699af (blue)
- Satisfactory: #87beb1 (teal)
- Moderate: #dfbfc6 (light pink)
- Poor: #de9eaf (medium pink)
- Very Poor: #e07192 (darker pink)
- Severe: #c1616b (darkest pink/red)

### Visualization Details

#### Layout Parameters
- **SVG Canvas**: 800px × 800px
- **Center Point**: (400, 400)
- **Inner Radius**: 90px (December ring)
- **Ring Width**: 7px (reduced for more spacing)
- **Ring Gap**: ~15.27px (calculated as 168/11)
- **Total Segments**: 31 per ring (days)
- **Start Angle**: 210° (7π/6 radians)
- **Span**: 330° clockwise
- **Fill Opacity**: 0.5

#### Month Ring Order
- **Outermost**: January
- **Innermost**: December

#### Data Visualization
- Each state has its own circular calendar
- Line graphs show raw AQI values (no smoothing)
- Line graph height: 2× ring width for enhanced fluctuation visibility
- Dotted reference line at AQI 100 (moderate threshold)
- Gaps in data result in line breaks
- Single isolated data points are rendered as short dashes
- State names positioned on the left, visualization on the right
- Rectangular arc fills represent air quality status

## Recent Changes (2026-01-02)

1. **Angular Positioning**: Changed start position to 210° and span to 330° clockwise (ending at 180°)
2. **Ring Order Reversed**: January is now the outermost ring, December is the innermost
3. **Inner Radius Increased**: Changed from 30px to 60px to 90px for better visibility of innermost ring
4. **Ring Gap Adjusted**: Modified to ~15.27px to maintain outer circle radius
5. **Dotted Reference Line**: Added at AQI 100 for each month as moderate threshold indicator
6. **Line Graph Enhancement**: Increased height from 0.8× to 2× ring width for more visible fluctuations
7. **Ring Width Reduced**: Decreased from 11px to 7px to create more space between months
8. **Fill Opacity**: Set to 0.5 for better transparency
9. **Color Update**: Satisfactory color changed from #F5EE9A to #BFE97B
10. **Circle Experiment**: Tested circle fills with AQI-based sizing, then reverted to rectangular arcs
