"use client";

import { useState } from "react";
import WorkflowCanvas from "./component/workflow/WorkflowCanvas";
import "./App.css";

function App() {
  // --- MANTENEMOS LOS DATOS ACTUALES COMO ESTADO INICIAL ---
  const [currentInvoiceData, setCurrentInvoiceData] = useState({
      name: "Factura BANCO UNION",
      size: "letter",
      orientation: "portrait",
      pages: [
        { id: "p1", name: "Página 1", bgUrl: null, bgFit: "contain" }
      ],
      elements: [
        {
          id: "txt-title",
          type: "text",
          pageId: "p1",
          x: 400, y: 50, w: 300, h: 60,
          text: "<div style='text-align:right;'><span style='font-size:14px;color:#64748b;font-weight:bold;'>CERTIFICACIÓN TRIBUTARIA</span></div>",
          style: { fontSize: 18, fontWeight: "bold" }
        }
      ]
  });

  return (
    <div className="app-container">
        <WorkflowCanvas initialInvoiceData={currentInvoiceData} />
        
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=Outfit:wght@400;600;700;900&family=Roboto:wght@400;700&family=Playfair+Display:wght@400;700&family=Montserrat:wght@400;700&display=swap');
          .app-container { width: 100vw; height: 100vh; overflow: hidden; font-family: 'Outfit', sans-serif; }
          .hover-node-add:hover { opacity: 1 !important; transform: translateY(-2px); transition: all 0.2s; }
        `}} />
    </div>
  );
}

export default App;
