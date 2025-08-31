import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PAPER_PRESETS } from "../../utils/utils";

const BTN = {
  height: 36,
  width: 36,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

export default function ExportTool({ getTarget, size, orientation }) {
  const handleExport = async () => {
    const node = getTarget?.();
    if (!node) return;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });
    const imgData = canvas.toDataURL("image/png");

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
    <button
      type="button"
      onClick={handleExport}
      aria-label="Exportar a PDF"
      title="Exportar a PDF"
      style={BTN}
    >
      {/* Icono PDF (SVG propio) */}
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        {/* hoja */}
        <path
          d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
          fill="#fff"
          stroke="#94a3b8"
        />
        {/* doblez */}
        <path d="M13 2v5a2 2 0 0 0 2 2h5" fill="#e5e7eb" />
        {/* banda roja PDF */}
        <rect x="5.5" y="13" width="13" height="5.2" rx="1.2" fill="#ef4444" />
        <text
          x="12"
          y="17"
          textAnchor="middle"
          fontSize="4.6"
          fontFamily="Inter,system-ui,Segoe UI,Arial"
          fontWeight="700"
          fill="#fff"
        >
          PDF
        </text>
      </svg>
    </button>
  );
}
