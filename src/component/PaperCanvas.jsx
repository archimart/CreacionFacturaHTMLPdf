import { forwardRef, useMemo } from "react";
import { inchesToPx, PAPER_PRESETS } from "../utils/utils";

const PaperCanvas = forwardRef(function PaperCanvas(
  {
    size = "letter",
    orientation = "portrait",
    dpi = 96,
    padding = 32,
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

  const { baseW, baseH } = useMemo(() => {
    const wIn = orientation === "landscape" ? preset.h : preset.w;
    const hIn = orientation === "landscape" ? preset.w : preset.h;
    return {
      baseW: inchesToPx(wIn, dpi),
      baseH: inchesToPx(hIn, dpi),
    };
  }, [preset, orientation, dpi]);

  const sheetStyles = {
    width: `${baseW}px`,
    height: `${baseH}px`,
    background,
    boxShadow: "0 0 10px rgba(0,0,0,0.2)",
    borderRadius: 4,
    overflow: "hidden",
    padding,
    transformOrigin: "top left",
    ...(autoFit ? { maxWidth: "100%" } : { transform: `scale(${zoom})` }),
    ...style,
  };

  const wrapperStyles = {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    overflow: "auto",
  };

  return (
    <div style={wrapperStyles} className={className}>
      {/* ref aquí: captura exactamente la hoja */}
      <div style={sheetStyles} ref={ref}>
        {children}
      </div>
    </div>
  );
});

export default PaperCanvas;
