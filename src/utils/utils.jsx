export const PAPER_PRESETS = {
  letter: { w: 8.5, h: 11 },
  legal: { w: 8.5, h: 14 },
  oficio: { w: 8.5, h: 13 }, // Tamaño oficio estándar (Colombia/Región)
  oficioMX: { w: 8.5, h: 13.4 }, // Oficio México
  halfLetter: { w: 5.5, h: 8.5 },
  a4: { w: 8.27, h: 11.69 },
  a5: { w: 5.83, h: 8.27 },
};

export function inchesToPx(inches, dpi) {
  return Math.round(inches * dpi);
}

export const WORK_BG = "#f5f6f8";
