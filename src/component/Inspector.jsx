import React, { useState } from "react";

/**
 * Inspector genérico por configuración.
 * props:
 *  - tabs: Array<{ key, title, icon?, render: (ctx) => ReactNode }>
 *  - context: objeto que se pasa a cada render(ctx)
 *  - initialKey?: string
 */
export default function Inspector({ tabs = [], context = {}, initialKey }) {
  const safeTabs = Array.isArray(tabs) ? tabs : [];

  const defaultKey =
    initialKey && safeTabs.find((t) => t.key === initialKey)
      ? initialKey
      : safeTabs?.[0]?.key ?? "tab-0";

  const [active, setActive] = useState(defaultKey);

  const current = safeTabs.find((t) => t.key === active);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        alignItems: "stretch",
      }}
    >
      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 16,
          borderBottom: "1px solid #eef0f2",
          paddingBottom: 6,
        }}
      >
        {safeTabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              style={{
                border: "none",
                background: "transparent",
                fontWeight: 700,
                color: selected ? "#0ea5e9" : "#0f172a",
                position: "relative",
                padding: "6px 0",
                cursor: "pointer",
              }}
            >
              {t.icon ? <span style={{ marginRight: 6 }}>{t.icon}</span> : null}
              {t.title}
              {selected && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -7,
                    height: 3,
                    background: "#0ea5e9",
                    borderRadius: 3,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
        {current?.render ? current.render(context) : null}
      </div>
    </div>
  );
}
