export default function ToolBar({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row", // 👈 horizontal
        alignItems: "center",
        gap: 12,
        height: "100%",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}
