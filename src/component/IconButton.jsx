export default function IconButton({
  label, // texto del tooltip
  onClick,
  disabled = false,
  children, // icono (SVG/emoji)
  size = 40, // lado del botón (px)
}) {
  const btnStyle = {
    width: size,
    height: size,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: disabled ? "#f3f4f6" : "#ffffff",
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    position: "relative",
    transition: "transform 120ms ease, box-shadow 120ms ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };

  const iconStyle = {
    fontSize: Math.round(size * 0.55), // escala del emoji/SVG
    display: "grid",
    placeItems: "center",
    lineHeight: 1,
  };

  const tooltipStyle = {
    position: "absolute",
    left: "calc(100% + 8px)",
    top: "50%",
    transform: "translateY(-50%)",
    background: "#111827",
    color: "#fff",
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    opacity: 0,
    transition: "opacity 120ms ease",
  };

  const wrapperStyle = { position: "relative" };

  return (
    <div
      style={wrapperStyle}
      onMouseEnter={(e) => {
        const tip = e.currentTarget.querySelector(".tooltip");
        if (tip) tip.style.opacity = 1;
      }}
      onMouseLeave={(e) => {
        const tip = e.currentTarget.querySelector(".tooltip");
        if (tip) tip.style.opacity = 0;
      }}
    >
      <button
        type="button"
        aria-label={label}
        title={label} // fallback nativo
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={btnStyle}
        onMouseDown={(e) =>
          !disabled && (e.currentTarget.style.transform = "scale(0.96)")
        }
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <span style={iconStyle}>{children}</span>
      </button>

      {/* Tooltip custom */}
      <div className="tooltip" style={tooltipStyle}>
        {label}
      </div>
    </div>
  );
}
