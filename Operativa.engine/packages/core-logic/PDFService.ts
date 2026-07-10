import { jsPDF } from "jspdf";

export class PDFGeneratorService {
  /**
   * Toma una lista de imágenes (base64) y las convierte en un PDF profesional
   * siguiendo las especificaciones de tamaño y orientación.
   */
  static async createDocument(images: string[], options: { width: number, height: number, orientation: 'portrait' | 'landscape' }) {
    console.log("%c[@engine/core-logic] Iniciando generación de PDF profesional...", "color: #3b82f6; font-weight: bold;");
    
    const { width, height, orientation } = options;
    const pdf = new jsPDF({ 
      unit: "pt", 
      orientation: orientation, 
      format: [width, height], 
      compress: true 
    });

    for (let i = 0; i < images.length; i++) {
      if (i > 0) pdf.addPage();
      // Añadimos la imagen capturada por el shell
      pdf.addImage(images[i], "JPEG", 0, 0, width, height, undefined, 'FAST');
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    console.log("%c[@engine/core-logic] PDF generado y abierto en nueva pestaña.", "color: #10b981; font-weight: bold;");
    return true;
  }
}
