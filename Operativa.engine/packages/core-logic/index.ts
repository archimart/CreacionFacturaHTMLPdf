import { jsPDF } from "jspdf";

export enum MessageType {
  COMMAND = "COMMAND",
  EVENT = "EVENT",
  QUERY = "QUERY",
  RESULT = "RESULT"
}

export interface EngineMessage {
  id: string;
  type: MessageType;
  source: string;
  payload: any;
  timestamp: number;
}

export class CoreEngine {
  private static instance: CoreEngine;
  private workers: Map<string, Worker> = new Map();

  private constructor() {}

  static getInstance(): CoreEngine {
    if (!CoreEngine.instance) {
      console.log("%c[@engine/core-logic] Orquestador Inicializado", "color: #3b82f6; font-weight: bold; background: #1e293b; padding: 2px 5px; border-radius: 4px;");
      CoreEngine.instance = new CoreEngine();
    }
    return CoreEngine.instance;
  }

  /**
   * Genera un PDF de prueba para demostrar que el core funciona
   */
  async generateTestPDF(data: any) {
    console.log("%c[@engine/core-logic] Generando PDF...", "color: #10b981;");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Operativa.engine - Reporte de Flujo", 20, 20);
    doc.setFontSize(12);
    doc.text(`ID de Ejecución: ${data.id}`, 20, 40);
    doc.text(`Timestamp: ${new Date().toLocaleString()}`, 20, 50);
    doc.text("Estado del Monorepo: Activo y Sincronizado", 20, 60);
    
    // Simular un proceso de construcción de 1 segundo
    return new Promise((resolve) => {
      setTimeout(() => {
        doc.save(`operativa-engine-${data.id}.pdf`);
        resolve(true);
      }, 1000);
    });
  }

  /**
   * Envía un comando a la lógica del core
   */
  async dispatch(message: EngineMessage) {
    console.log(`%c[@engine/core-logic] Recibiendo ${message.type} de [${message.source}]`, "color: #10b981;", message.payload);
    
    if (message.payload.action === "RUN_WORKFLOW") {
       await this.generateTestPDF({ id: message.id });
       return { success: true, message: "PDF Generado con éxito" };
    }
    return { success: false };
  }
}

import { PDFGeneratorService } from "./PDFService";
import { DataStreamer, DataChunk, StreamSubscriber } from "./DataStreamer";

export { PDFGeneratorService, DataStreamer };
export type { DataChunk, StreamSubscriber };


