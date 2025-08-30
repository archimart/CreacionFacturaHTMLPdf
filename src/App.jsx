import { useEffect, useRef, useState } from "react";
import Toolbar from "./component/ToolBar";
import BackgroundTool from "./component/BackgroundTool";
import PaperCanvas from "./component/PaperCanvas";
import Inspector from "./component/Inspector";
import BoxesTool from "./component/BoxesTool";
import WorkLayer from "./component/WorkLayer";
import ExportTool from "./component/export/ExportTool";
import ImageTool from "./component/ImageTool";

// const SIDEBAR_WIDTH = 88; // barra izquierda fija
// const RIGHTPANEL_WIDTH = 240; // inspector derecho fijo
// const WORKAREA_MAX_WIDTH = 1120; // ancho máx del centro
const RIGHTPANEL_WIDTH = 240;
const WORKAREA_MAX_WIDTH = 1120;
const TOPBAR_HEIGHT = 64; // 👈 alto de la barra superior

export default function App() {
  // ======= Tamaño de hoja / orientación
  const [size] = useState("letter");
  const [orientation] = useState("portrait");

  // ======= Fondo de la hoja
  const [bgUrl, setBgUrl] = useState(null);
  const [bgFit, setBgFit] = useState("contain"); // contain | cover | "100% 100%"

  useEffect(
    () => () => {
      if (bgUrl) URL.revokeObjectURL(bgUrl);
    },
    [bgUrl]
  );

  const pickBg = (file) => {
    if (!file) return;
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(URL.createObjectURL(file));
  };
  const clearBg = () => {
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(null);
  };
  const background = bgUrl
    ? `url(${bgUrl}) center/${bgFit} no-repeat, white`
    : "white";

  // ======= Elementos (cuadros, texto, imagen)
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const addBox = () => {
    const id = crypto.randomUUID();
    setElements((arr) => [
      ...arr,
      {
        id,
        type: "box",
        x: 40,
        y: 40,
        w: 260,
        h: 80,
        text: "Cuadro",
        style: {
          borderColor: "#2563eb",
          borderWidth: 1,
          borderRadius: 10,
          background: "#ffffff",
        },
      },
    ]);
    setSelectedId(id);
  };

  const addText = () => {
    const id = crypto.randomUUID();
    setElements((arr) => [
      ...arr,
      {
        id,
        type: "text",
        x: 60,
        y: 150,
        w: 320,
        h: 40,
        text: "Doble clic y escribe…",
        style: {
          borderColor: "#94a3b8",
          borderWidth: 0,
          borderRadius: 0,
          background: "transparent",
          color: "#111",
          fontSize: 18,
          textAlign: "left",
          vAlign: "top", // 👈 aquí es donde va
        },
      },
    ]);
    setSelectedId(id);
  };

  const changeEl = (id, partial) => {
    setElements((arr) =>
      arr.map((el) =>
        el.id === id
          ? {
              ...el,
              ...partial,
              style: partial.style
                ? { ...(el.style || {}), ...partial.style }
                : el.style,
            }
          : el
      )
    );
  };

  const delById = (id) => {
    setElements((arr) => arr.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // const delSelected = () => {
  //   if (!selectedId) return;
  //   delById(selectedId);
  // };

  // const selectedEl = useMemo(
  //   () => elements.find((e) => e.id === selectedId),
  //   [elements, selectedId]
  // );

  // ======= Modo "colocar imagen" (buscar y luego click en la hoja)
  const [placingImage, setPlacingImage] = useState(null); // { src, naturalW, naturalH }

  const fileToImageMeta = (file) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () =>
        resolve({
          src: url,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
        });
      img.src = url;
    });

  const startPlaceImageFromFile = async (file) => {
    const meta = await fileToImageMeta(file);
    setPlacingImage(meta); // activa cursor "crosshair" en la hoja
  };

  const cancelPlaceImage = () => {
    if (placingImage?.src) URL.revokeObjectURL(placingImage.src);
    setPlacingImage(null);
  };

  // Coloca imagen en (x,y) relativo a la hoja; también soporta drop con file
  const placeImageAt = async (x, y, droppedFile) => {
    let meta = placingImage;
    if (droppedFile) {
      if (placingImage?.src) URL.revokeObjectURL(placingImage.src);
      meta = await fileToImageMeta(droppedFile);
    }
    if (!meta) return;

    // tamaño inicial ~300px ancho manteniendo aspecto
    const targetW = 300;
    const scale = meta.naturalW ? targetW / meta.naturalW : 1;
    const w = Math.max(80, Math.round(meta.naturalW * scale));
    const h = Math.max(60, Math.round(meta.naturalH * scale));

    const id = crypto.randomUUID();
    setElements((arr) => [
      ...arr,
      {
        id,
        type: "image",
        x: Math.max(0, x - w / 2),
        y: Math.max(0, y - h / 2),
        w,
        h,
        src: meta.src,
        style: {},
      },
    ]);
    setSelectedId(id);

    // salimos del modo colocar (si quieres modo continuo, comenta la línea siguiente)
    setPlacingImage(null);
  };

  // ======= Exportar PDF (referencia a la hoja)
  const sheetRef = useRef(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        paddingTop: TOPBAR_HEIGHT, // 👈 deja espacio para la topbar
        paddingRight: RIGHTPANEL_WIDTH,
        display: "flex",
      }}
      onMouseDown={() => {
        if (placingImage) cancelPlaceImage();
        setSelectedId(null);
      }}
    >
      {/* Barra SUPERIOR fija */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: RIGHTPANEL_WIDTH, // deja libre el inspector derecho
          height: TOPBAR_HEIGHT,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          zIndex: 10,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Toolbar>
          <BackgroundTool
            onPickFile={pickBg}
            onClear={clearBg}
            hasBackground={!!bgUrl}
            fit={bgFit}
            onChangeFit={setBgFit}
          />
          {/* separador opcional */}
          <div
            style={{
              width: 1,
              height: 28,
              background: "#e5e7eb",
              margin: "0 8px",
            }}
          />
          <BoxesTool onAddBox={addBox} onAddText={addText} />
          <ImageTool onPickForPlacement={startPlaceImageFromFile} />
          <div style={{ flex: 1 }} /> {/* empuja ExportTool a la derecha */}
          <ExportTool
            getTarget={() => sheetRef.current}
            size={size}
            orientation={orientation}
          />
        </Toolbar>
      </div>

      {/* Centro (controles + hoja centrada) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 24px",
          gap: 16,
        }}
      >
        {/* Controles generales */}
        <section
          style={{
            width: "100%",
            maxWidth: WORKAREA_MAX_WIDTH,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ... tus selects de tamaño y orientación ... */}
        </section>

        {/* Hoja */}
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: WORKAREA_MAX_WIDTH,
            display: "flex",
            justifyContent: "center",
            overflow: "auto",
          }}
        >
          <PaperCanvas
            ref={sheetRef}
            size={size}
            orientation={orientation}
            autoFit={true}
            padding={32}
            background={background}
          >
            <WorkLayer
              elements={elements}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onChange={changeEl}
              onDelete={delById}
              placing={!!placingImage}
              onPlaceAt={placeImageAt}
            />
          </PaperCanvas>
        </div>
      </div>

      {/* Inspector derecho fijo (igual que ya tienes) */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: RIGHTPANEL_WIDTH,
          borderLeft: "1px solid #e5e7eb",
          background: "#fff",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ... tu inspector ... */}
      </aside>
    </div>
  );
}
