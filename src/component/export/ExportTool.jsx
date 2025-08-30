import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import IconButton from "../IconButton";
import { PAPER_PRESETS } from "../../utils/utils";

export default function ExportTool({ getTarget, size, orientation }) {
  const handleExport = async () => {
    const node = getTarget?.();
    if (!node) return;

    // Renderizamos la hoja a canvas (2x para mejor nitidez)
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });

    const imgData = canvas.toDataURL("image/png");

    // Medidas del PDF en puntos (72 pt = 1 in)
    const preset = PAPER_PRESETS[size] ?? PAPER_PRESETS.letter;
    const wIn = orientation === "landscape" ? preset.h : preset.w;
    const hIn = orientation === "landscape" ? preset.w : preset.h;
    const pdfW = wIn * 72;
    const pdfH = hIn * 72;

    const pdf = new jsPDF({
      unit: "pt",
      orientation,
      format: [pdfW, pdfH],
      compress: true,
    });

    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`documento-${size}-${orientation}.pdf`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <IconButton label="Exportar a PDF" onClick={handleExport} size={42}>
        📄
      </IconButton>
    </div>
  );
}
