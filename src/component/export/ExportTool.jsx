import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PAPER_PRESETS } from "../../utils/utils";

const EXPORT_BTN_STYLE = {
  height: 40,
  padding: "0 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
};

const BATCH_BTN_STYLE = {
    ...EXPORT_BTN_STYLE,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
};

export default function ExportTool({ getTarget, size, orientation, projectName, onToast, dataset = [], documentData = null }) {
  
  const openInTab = (pdfInstance) => {
    try {
        const blob = pdfInstance.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (e) {
        onToast?.("Error al abrir PDF: " + e.message, "error");
    }
  };

  const handleExport = async (e, singleRecord = null) => {
    window.scrollTo(0, 0); 
    const btn = e.currentTarget;
    const oldContent = btn.innerHTML;
    btn.innerHTML = `V6.0 (HD)...`; 
    btn.disabled = true;

    try {
        const preset = PAPER_PRESETS[size] || PAPER_PRESETS.letter;
        const wIn = orientation === "landscape" ? preset.h : preset.w;
        const hIn = orientation === "landscape" ? preset.w : preset.h;
        const pdfW = wIn * 72, pdfH = hIn * 72;

        const pdf = new jsPDF({ unit: "pt", orientation: orientation || "portrait", format: [pdfW, pdfH], compress: true });

        const stage = document.getElementById('export-stage');
        let nodes = stage ? Array.from(stage.querySelectorAll('.pdf-sheet-canvas')) : [];
        if (!nodes.length) nodes = Array.from(document.querySelectorAll('.pdf-sheet-canvas:not(#export-stage *)'));
        if (!nodes.length && getTarget) { const s = getTarget(); if (s) nodes = [s]; }

        if (!nodes.length) throw new Error("No hay lienzo activo");

        for (let i = 0; i < nodes.length; i++) {
            if (i > 0) pdf.addPage();
            
            // Wait for metrics to stabilize
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 600));

            const canvas = await html2canvas(nodes[i], {
              scale: 2.5, 
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              logging: false,
              onclone: (clonedDoc) => {
                  const sheet = clonedDoc.querySelector('.pdf-sheet-canvas');
                  if (sheet) { 
                      // NUCLEAR FIX: Kill all parent transforms that confuse html2canvas metrics
                      let p = sheet.parentElement;
                      while(p && p.tagName !== 'BODY') {
                          p.style.transform = 'none';
                          p.style.zoom = '1';
                          p = p.parentElement;
                      }

                      sheet.style.transform = 'none'; 
                      sheet.style.left = '0';
                      sheet.style.top = '0';
                      sheet.style.position = 'relative'; // Stabilize flow
                      sheet.style.width = `${wIn * 96}px`;
                      sheet.style.height = `${hIn * 96}px`;
                      sheet.style.boxShadow = 'none';

                      // Stabilize text areas
                      clonedDoc.querySelectorAll('.content-editable-area').forEach(el => {
                          el.setAttribute('contenteditable', 'false');
                          el.style.fontFamily = "'Inter', Arial, sans-serif";
                          el.style.letterSpacing = 'normal';
                          el.style.wordSpacing = 'normal';
                          el.style.fontFeatureSettings = '"kern" 0';
                      });

                      // REMOVE EDITOR UI
                      clonedDoc.querySelectorAll('.no-export').forEach(el => el.remove());
                      clonedDoc.querySelectorAll('[style*="outline"]').forEach(el => el.style.outline = 'none');
                  }
              }
            });

            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
        }

        openInTab(pdf);
    } catch (err) {
        onToast?.("Fallo V6.0: " + err.message, "error");
    } finally {
        btn.disabled = false; btn.innerHTML = oldContent;
    }
  };

  const handleBatch = async (e) => {
      window.scrollTo(0, 0); 
      const btn = e.currentTarget;
      const oldContent = btn.innerHTML;
      btn.innerHTML = `Lote V6.0...`;
      btn.disabled = true;

      try {
          const preset = PAPER_PRESETS[size] || PAPER_PRESETS.letter;
          const wIn = orientation === "landscape" ? preset.h : preset.w;
          const hIn = orientation === "landscape" ? preset.w : preset.h;
          const pdfW = wIn * 72, pdfH = hIn * 72;
          const pdf = new jsPDF({ unit: "pt", orientation: orientation || "portrait", format: [pdfW, pdfH], compress: true });

          for (let idx = 0; idx < dataset.length; idx++) {
              btn.innerHTML = `Lote (${idx + 1}/${dataset.length})`;
              if (idx > 0) pdf.addPage();
              const target = getTarget?.();
              if (target) {
                  await document.fonts.ready; await new Promise(r => setTimeout(r, 400));
                  const canvas = await html2canvas(target, { 
                      scale: 2.5, useCORS: true, allowTaint: true, backgroundColor: "#ffffff",
                      onclone: (clonedDoc) => {
                          const sheet = clonedDoc.querySelector('.pdf-sheet-canvas');
                          if (sheet) { 
                              let p = sheet.parentElement;
                              while(p && p.tagName !== 'BODY') { p.style.transform = 'none'; p = p.parentElement; }
                              sheet.style.transform = 'none'; 
                              sheet.style.width = `${wIn * 96}px`;
                              sheet.style.height = `${hIn * 96}px`;
                              clonedDoc.querySelectorAll('.content-editable-area').forEach(el => {
                                  el.setAttribute('contenteditable', 'false');
                                  el.style.fontFamily = "'Inter', Arial, sans-serif";
                              });
                              
                              // REMOVE EDITOR UI
                              clonedDoc.querySelectorAll('.no-export').forEach(el => el.remove());
                              clonedDoc.querySelectorAll('[style*="outline"]').forEach(el => el.style.outline = 'none');
                          }
                      }
                  });
                  const imgData = canvas.toDataURL("image/jpeg", 0.95);
                  pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
              }
          }
          openInTab(pdf);
      } catch (err) {
          onToast?.("Error Lote: " + err.message, "error");
      } finally {
          btn.disabled = false; btn.innerHTML = oldContent;
      }
  };

  return (
    <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={handleExport} style={EXPORT_BTN_STYLE}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Exportar Actual
        </button>
        {dataset?.length > 0 && (
            <button type="button" onClick={handleBatch} style={BATCH_BTN_STYLE}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                Generar Masivo ({dataset.length})
            </button>
        )}
    </div>
  );
}
