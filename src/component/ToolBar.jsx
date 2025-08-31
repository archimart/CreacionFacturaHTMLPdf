import React from "react";
import { WORK_BG } from "../utils/utils"; // "#f5f6f8"

export const TOOLBAR_HEIGHT = 56;

export default function Toolbar({
  left,
  right,
  children,
  maxWorkWidth = 1120,
}) {
  const content = children ?? (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        {left}
      </div>
      {right && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {right}
        </div>
      )}
    </>
  );

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: WORK_BG, // gris solo en la columna izquierda
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: maxWorkWidth,
          margin: "0 auto",
          padding: "8px 12px", // 8 arriba/abajo -> con controles de 36px = 56px
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Cápsula blanca con los controles */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fff",
            borderRadius: 12,
            padding: "8px 10px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
