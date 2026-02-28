import { useState, useEffect, useRef } from "react";

function CyclingAnimation() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate progress from 0 to 1 as the section scrolls through viewport
      const sectionHeight = rect.height;
      const scrolled = -rect.top;
      const totalScrollable = sectionHeight - viewportHeight;
      const progress = Math.max(0, Math.min(1, scrolled / totalScrollable));

      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate wheel rotation based on scroll (multiple rotations)
  const wheelRotation = scrollProgress * 1440; // 4 full rotations

  // Calculate horizontal position (from 5% to 85% of container width)
  const horizontalPosition = 5 + scrollProgress * 80;

  // Pedal rotation synced with wheels
  const pedalRotation = scrollProgress * 1440;

  return (
    <div
      ref={containerRef}
      style={{
        height: "400vh",
        backgroundColor: "#fff",
        position: "relative",
      }}
    >
      {/* Sticky viewport for the animation */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          width: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "24px",
            fontWeight: "500",
            textAlign: "center",
            color: "#333",
            marginBottom: "16px",
          }}
        >
          Better Cycling and Walking Infrastructure
        </h2>
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "16px",
            fontWeight: "300",
            textAlign: "center",
            color: "#555",
            maxWidth: "700px",
            margin: "0 auto 40px auto",
            lineHeight: "1.8",
          }}
        >
          Improving infrastructure for cycling and walking can significantly reduce air pollution by encouraging people to rely less on fuel-powered vehicles, lowering emissions and easing traffic congestion.
        </p>

        {/* Animation container */}
        <div
          style={{
            position: "relative",
            height: "300px",
            width: "100%",
          }}
        >
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

          {/* Cyclist SVG */}
          <svg
            width="150"
            height="200"
            viewBox="0 0 150 200"
            style={{
              position: "absolute",
              bottom: "52px",
              left: `${horizontalPosition}%`,
              transform: "translateX(-50%)",
              transition: "left 0.05s linear",
            }}
          >
            {/* Back wheel */}
            <g transform={`rotate(${wheelRotation}, 30, 160)`}>
              <circle
                cx="30"
                cy="160"
                r="28"
                fill="none"
                stroke="#000"
                strokeWidth="3"
              />
              {/* Spokes */}
              <line x1="30" y1="132" x2="30" y2="188" stroke="#000" strokeWidth="1" />
              <line x1="2" y1="160" x2="58" y2="160" stroke="#000" strokeWidth="1" />
              <line x1="10" y1="140" x2="50" y2="180" stroke="#000" strokeWidth="1" />
              <line x1="50" y1="140" x2="10" y2="180" stroke="#000" strokeWidth="1" />
              {/* Hub */}
              <circle cx="30" cy="160" r="5" fill="#000" />
            </g>

            {/* Front wheel */}
            <g transform={`rotate(${wheelRotation}, 120, 160)`}>
              <circle
                cx="120"
                cy="160"
                r="28"
                fill="none"
                stroke="#000"
                strokeWidth="3"
              />
              {/* Spokes */}
              <line x1="120" y1="132" x2="120" y2="188" stroke="#000" strokeWidth="1" />
              <line x1="92" y1="160" x2="148" y2="160" stroke="#000" strokeWidth="1" />
              <line x1="100" y1="140" x2="140" y2="180" stroke="#000" strokeWidth="1" />
              <line x1="140" y1="140" x2="100" y2="180" stroke="#000" strokeWidth="1" />
              {/* Hub */}
              <circle cx="120" cy="160" r="5" fill="#000" />
            </g>

            {/* Bike frame */}
            {/* Down tube */}
            <line x1="30" y1="160" x2="75" y2="120" stroke="#000" strokeWidth="3" />
            {/* Top tube */}
            <line x1="75" y1="120" x2="110" y2="125" stroke="#000" strokeWidth="3" />
            {/* Seat tube */}
            <line x1="75" y1="120" x2="65" y2="160" stroke="#000" strokeWidth="3" />
            {/* Chain stay */}
            <line x1="30" y1="160" x2="65" y2="160" stroke="#000" strokeWidth="3" />
            {/* Seat stay */}
            <line x1="30" y1="160" x2="75" y2="120" stroke="#000" strokeWidth="2" />
            {/* Fork */}
            <line x1="110" y1="125" x2="120" y2="160" stroke="#000" strokeWidth="3" />

            {/* Seat */}
            <ellipse cx="75" cy="115" rx="12" ry="4" fill="#000" />
            {/* Seat post */}
            <line x1="75" y1="115" x2="75" y2="120" stroke="#000" strokeWidth="2" />

            {/* Handlebar */}
            <line x1="105" y1="115" x2="115" y2="115" stroke="#000" strokeWidth="3" />
            <line x1="110" y1="125" x2="110" y2="115" stroke="#000" strokeWidth="2" />

            {/* Pedals and cranks */}
            <g transform={`rotate(${pedalRotation}, 65, 160)`}>
              {/* Crank arm 1 */}
              <line x1="65" y1="160" x2="65" y2="175" stroke="#000" strokeWidth="3" />
              {/* Pedal 1 */}
              <rect x="58" y="173" width="14" height="4" fill="#000" />
              {/* Crank arm 2 */}
              <line x1="65" y1="160" x2="65" y2="145" stroke="#000" strokeWidth="3" />
              {/* Pedal 2 */}
              <rect x="58" y="141" width="14" height="4" fill="#000" />
            </g>
            {/* Chainring */}
            <circle cx="65" cy="160" r="10" fill="none" stroke="#000" strokeWidth="2" />

            {/* Rider */}
            {/* Body/torso - leaning forward */}
            <line x1="75" y1="110" x2="95" y2="85" stroke="#000" strokeWidth="3" />

            {/* Head */}
            <circle cx="100" cy="75" r="12" fill="none" stroke="#000" strokeWidth="3" />
            {/* Eye */}
            <circle cx="105" cy="73" r="2" fill="#000" />

            {/* Arms */}
            <line x1="90" y1="90" x2="110" y2="115" stroke="#000" strokeWidth="3" />

            {/* Back leg (following pedal) */}
            <g transform={`rotate(${pedalRotation}, 65, 160)`}>
              {/* Thigh */}
              <line x1="75" y1="110" x2="70" y2="140" stroke="#000" strokeWidth="3" />
              {/* Shin */}
              <line x1="70" y1="140" x2="65" y2="175" stroke="#000" strokeWidth="3" />
            </g>

            {/* Front leg (opposite pedal position) */}
            <g transform={`rotate(${pedalRotation + 180}, 65, 160)`}>
              {/* Thigh */}
              <line x1="75" y1="110" x2="70" y2="140" stroke="#000" strokeWidth="3" />
              {/* Shin */}
              <line x1="70" y1="140" x2="65" y2="175" stroke="#000" strokeWidth="3" />
            </g>
          </svg>

          {/* Progress indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "Georgia, serif",
              fontSize: "14px",
              color: "#666",
            }}
          >
            {Math.round(scrollProgress * 100)}% complete
          </div>
        </div>

        {/* Scroll hint */}
        {scrollProgress < 0.1 && (
          <div
            style={{
              textAlign: "center",
              marginTop: "40px",
              fontFamily: "Georgia, serif",
              fontSize: "14px",
              color: "#999",
              animation: "bounce 2s infinite",
            }}
          >
            Scroll down to start cycling
          </div>
        )}
      </div>

      {/* CSS for bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </div>
  );
}

export default CyclingAnimation;
