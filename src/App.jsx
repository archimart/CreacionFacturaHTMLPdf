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
          .app-container { width: 100vw; height: 100vh; overflow: hidden; font-family: 'Inter', sans-serif; }
          .hover-node-add:hover { opacity: 1 !important; transform: translateY(-2px); transition: all 0.2s; }
        `}} />
    </div>
  );
}

export default App;
