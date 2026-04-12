import { forwardRef, useMemo } from "react";
import { inchesToPx, PAPER_PRESETS } from "../utils/utils";

const PaperCanvas = forwardRef(function PaperCanvas(
  {
    size = "letter",
    orientation = "portrait",
    dpi = 96,
    padding = 0,
    zoom = 1,
    autoFit = false,
    background = "white",
    style,
    className,
    children,
  },
  ref
) {
  const preset = PAPER_PRESETS[size] ?? PAPER_PRESETS.letter;

  const sheetW = (orientation === "portrait" ? preset.w : preset.h) * dpi;
  const sheetH = (orientation === "portrait" ? preset.h : preset.w) * dpi;

  const isUrl = typeof background === "string" && (background.startsWith("data:") || background.startsWith("http"));

  const sheetStyles = {
    position: "relative",
    width: `${sheetW}px`,
    height: `${sheetH}px`,
    backgroundColor: "#ffffff",
    backgroundImage: isUrl ? `url(${background})` : "none",
    backgroundSize: style?.backgroundSize || "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 20px -5px rgba(0, 0, 0, 0.15)",
    borderRadius: 4,
    overflow: "visible", // Ver el sangrado (bleed)
    border: "1px solid #94a3b8", // Borde sólido más visible 
    boxSizing: "border-box", // CRITICO: El borde ya no suma al tamaño
    padding,
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
    display: "block",
    ...style,
  };

  const wrapperStyles = {
    display: "block", // Changed from flex
    width: `${sheetW * zoom}px`,
    height: `${sheetH * zoom}px`,
    margin: "0 auto", // Center the whole thing
    position: "relative",
    overflow: "visible", // CRÍTICO: Permitir que el hijo (sheet) se salga de este contenedor
  };

  return (
    <div style={wrapperStyles} className={className}>
      <div style={sheetStyles} ref={ref} className="pdf-sheet-canvas">
        {children}
      </div>
    </div>
  );
});

export default PaperCanvas;
