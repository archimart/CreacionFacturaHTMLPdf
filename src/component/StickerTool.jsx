import { useRef } from "react";
import { Smile, Plus } from "lucide-react";

export default function StickerTool({ onAdd }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (re) => onAdd?.(re.target.result);
        reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button 
        onClick={() => inputRef.current?.click()} 
        className="premium-btn"
        style={{ 
            width: 54, height: 54, borderRadius: 18, background: "#fff", 
            display: "flex", alignItems: "center", justifyContent: "center", 
            color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", border: "none"
        }} 
        title="Añadir Sticker/Firma"
      >
        <Smile size={22}/>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
