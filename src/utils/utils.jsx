export const PAPER_PRESETS = {
  letter: { w: 8.5, h: 11 },
  legal: { w: 8.5, h: 14 },
  halfLetter: { w: 5.5, h: 8.5 },
  a4: { w: 8.27, h: 11.69 },
  a5: { w: 5.83, h: 8.27 },
};

export function inchesToPx(inches, dpi) {
  return Math.round(inches * dpi);
}

export const WORK_BG = "#f5f6f8";
