import { useEffect, useRef, useState } from "react";

export default function DraggableBox({
  element,
  selected,
  disabled = false,
  onSelect,
  onChange,
  onDelete,
}) {
  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null); // 👈 resize ON
  const [isEditing, setIsEditing] = useState(false);
  const textRef = useRef(null);

  const vAlign = element.style?.vAlign ?? "top";

  // === mover + redimensionar ===
  useEffect(() => {
    const onMove = (e) => {
      if (disabled) return;

      if (drag) {
        onChange({
          x: Math.max(0, drag.startX + (e.clientX - drag.clientStartX)),
          y: Math.max(0, drag.startY + (e.clientY - drag.clientStartY)),
        });
      }

      if (resize) {
        const dx = e.clientX - resize.clientStartX;
        const dy = e.clientY - resize.clientStartY;

        let w = resize.startW;
        let h = resize.startH;
        let x = resize.startX;
        let y = resize.startY;

        if (resize.dir.includes("e")) w = Math.max(20, resize.startW + dx);
        if (resize.dir.includes("s")) h = Math.max(20, resize.startH + dy);
        if (resize.dir.includes("w")) {
          const nw = Math.max(20, resize.startW - dx);
          x = resize.startX + (resize.startW - nw);
          w = nw;
        }
        if (resize.dir.includes("n")) {
          const nh = Math.max(20, resize.startH - dy);
          y = resize.startY + (resize.startH - nh);
          h = nh;
        }
        onChange({ x, y, w, h });
      }
    };

    const onUp = () => {
      setDrag(null);
      setResize(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, resize, disabled, onChange]);

  // borrar (solo si NO escribes)
  useEffect(() => {
    if (!(selected && !isEditing)) return;
    const onKey = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") onDelete?.(element.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, isEditing, element.id, onDelete]);

  // sincroniza texto al montar / cuando NO editas
  useEffect(() => {
    if (!textRef.current || isEditing) return;
    const val = element.text || "";
    if (textRef.current.textContent !== val) {
      textRef.current.textContent = val;
    }
  }, [element.text, isEditing]);

  const startDrag = (e) => {
    if (disabled) return;
    e.stopPropagation();
    onSelect?.();
    setDrag({
      startX: element.x,
      startY: element.y,
      clientStartX: e.clientX,
      clientStartY: e.clientY,
    });
  };

  const startResize = (e, dir) => {
    if (disabled) return;
    e.stopPropagation();
    onSelect?.();
    setResize({
      dir,
      clientStartX: e.clientX,
      clientStartY: e.clientY,
      startW: element.w,
      startH: element.h,
      startX: element.x,
      startY: element.y,
    });
  };

  const baseStyle = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    background:
      element.type === "image"
        ? "transparent"
        : element.style?.background ?? "transparent",
    border:
      element.type !== "image"
        ? `${element.style?.borderWidth ?? 1}px solid ${
            element.style?.borderColor ?? "#333"
          }`
        : "none",
    borderRadius: element.style?.borderRadius ?? 6,
    boxSizing: "border-box",
    padding: element.type === "text" ? 8 : 0,
    userSelect: selected ? "text" : "none",
    outline: selected ? "2px dashed #3b82f6" : "none",
    overflow: "hidden",
    cursor: disabled ? "not-allowed" : drag ? "grabbing" : "move",
    display: "flex",
    alignItems:
      element.type === "text"
        ? { top: "flex-start", middle: "center", bottom: "flex-end" }[vAlign] ||
          "flex-start"
        : "center",
    justifyContent: "flex-start",
    direction: "ltr",
    unicodeBidi: "isolate",
  };

  const textStyle = {
    width: "100%",
    height: "100%",
    color: element.style?.color ?? "#111",
    fontSize: element.style?.fontSize ?? 16,
    fontWeight: element.style?.fontWeight ?? 400,
    textAlign: element.style?.textAlign ?? "left",
    lineHeight: 1.2,
    outline: "none",
    cursor: "text",
    direction: "ltr",
    unicodeBidi: "plaintext",
    writingMode: "horizontal-tb",
    whiteSpace: "pre-wrap",
  };

  return (
    <div style={baseStyle} onMouseDown={startDrag} dir="ltr">
      {element.type === "text" ? (
        <div
          ref={textRef}
          contentEditable
          suppressContentEditableWarning
          dir="ltr"
          spellCheck={false}
          style={textStyle}
          onMouseDown={(e) => e.stopPropagation()} // no iniciar drag al escribir
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          onInput={(e) => onChange({ text: e.currentTarget.textContent || "" })}
        />
      ) : element.type === "image" ? (
        <img
          src={element.src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none", // drag/resize lo capta el contenedor
          }}
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        // ⬇️ Recuadro (box) con texto simple
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems:
              { top: "flex-start", middle: "center", bottom: "flex-end" }[
                vAlign
              ] || "flex-start",
            justifyContent: "center",
            color: element.style?.color ?? "#111",
            fontSize: element.style?.fontSize ?? 16,
            padding: 6,
          }}
        >
          {element.text || "Cuadro"}
        </div>
      )}

      {/* botón eliminar (opcional) */}
      {selected && !disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(element.id);
          }}
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 20,
            height: 20,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
          title="Eliminar"
        >
          ×
        </button>
      )}

      {/* handles de resize */}
      {selected &&
        !disabled &&
        ["nw", "ne", "sw", "se"].map((dir) => (
          <div
            key={dir}
            onMouseDown={(e) => startResize(e, dir)}
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              background: "#3b82f6",
              borderRadius: "50%",
              cursor: `${dir}-resize`,
              ...(dir === "nw" ? { top: -5, left: -5 } : {}),
              ...(dir === "ne" ? { top: -5, right: -5 } : {}),
              ...(dir === "sw" ? { bottom: -5, left: -5 } : {}),
              ...(dir === "se" ? { bottom: -5, right: -5 } : {}),
            }}
          />
        ))}
    </div>
  );
}
