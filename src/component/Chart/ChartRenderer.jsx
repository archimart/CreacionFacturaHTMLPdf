"use client";

import React, { useMemo } from "react";

export default function ChartRenderer({ el, dataset = [], isExport = false }) {
  const s = el.style || {};
  const c = el.chart || {};
  
  // Data Mapping Logic
  let labels = c.labels || ["A", "B", "C"];
  let data = (c.datasets && c.datasets[0] && c.datasets[0].data) || [10, 20, 15];
  let color = (c.datasets && c.datasets[0] && c.datasets[0].color) || "#3b82f6";
  const type = c.type || "bar";
  const dataSource = c.dataSource || 'dynamic';

  // If connected to dataset and in dynamic mode
  if (dataSource === 'dynamic' && dataset && dataset.length > 0 && c.mapping) {
    const { labelField, dataField, collectionField, limit = 20 } = c.mapping;
    let sourceData = dataset;
    if (collectionField) {
        // Find collection in the primary record
        sourceData = dataset[0]?.[collectionField] || [];
    }

    if (labelField && dataField && sourceData.length > 0) {
      const slice = (Array.isArray(sourceData) ? sourceData : [sourceData]).slice(0, limit);
      labels = slice.map(item => String(item[labelField] || ""));
      data = slice.map(item => {
        const val = item[dataField];
        if (typeof val === 'number') return val;
        // Clean values like "$ 1.200,50" -> "1200.50"
        const cleaned = String(val || "").replace(/[^\d.-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      });
    }
  }
  
  const maxValue = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const palette = c.palette && c.palette.length > 0 ? c.palette : [color, '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const itemColors = c.itemColors || {};
  const getColor = (i) => itemColors[i] || palette[i % palette.length];

  const colorShade = (col, amt) => {
    try {
        let usePound = false;
        if (col[0] === "#") { col = col.slice(1); usePound = true; }
        let num = parseInt(col, 16);
        let r = Math.max(0, Math.min(255, (num >> 16) + amt));
        let b = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
        let g = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    } catch(e) { return col; }
  };

  const bgColor = c.bgColor || "#ffffff";
  const textColor = s.color || c.textColor || "#1e293b";
  const borderColor = c.borderColor || "#e2e8f0";
  const fontFamily = s.fontFamily || "Outfit, sans-serif";
  const fontWeight = s.fontWeight || "normal";
  const fontStyle = s.fontStyle || "normal";
  const textAlign = s.textAlign || "center";

  const titleFont = c.titleFont || fontFamily;
  const titleTextColor = c.titleColor || textColor;
  
  const containerRef = React.useRef(null);
  const [visualSize, setVisualSize] = React.useState({ w: el.w || 400, h: el.h || 300 });

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setVisualSize({ w: rect.width, h: rect.height });
      }
    };
    const obs = new ResizeObserver(updateSize);
    obs.observe(containerRef.current);
    updateSize();
    return () => obs.disconnect();
  }, []);

  const estimatedTitleArea = (c.titleSize || 16) + 30;
  const pxWidth = Math.max(1, visualSize.w - 40);
  const pxHeight = Math.max(1, visualSize.h - 50 - estimatedTitleArea);
  
  const svgScale = Math.min(pxWidth, pxHeight);
  const lSVGSize = svgScale > 0 ? ((c.labelSize || 10) / svgScale) * 100 : 3;

  const titleBold = c.titleBold !== undefined ? (c.titleBold ? '800' : '400') : '800';
  const lFont = c.labelFont || fontFamily;
  const lColor = c.labelColor || "#64748b";
  const lBold = c.labelBold ? '700' : '500';

  // HELPER: Format axis numbers
  const formatValue = (v) => {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toString();
  };

  const renderGrid = () => {
    const steps = [0, 25, 50, 75];
    return steps.map(s => (
        <g key={s}>
            <line x1="10" y1={85 - s * 0.7} x2="90" y2={85 - s * 0.7} stroke="#f1f5f9" strokeWidth="0.5" />
            <text x="8" y={85 - s * 0.7 + 1} fontSize={lSVGSize * 0.8} fill="#94a3b8" textAnchor="end" fontFamily={lFont}>
                {formatValue(Math.round((s/100) * maxValue))}
            </text>
        </g>
    ));
  };

  const renderBar = (is3d = false) => {
    const count = data.length || 1;
    const gap = 20 / count;
    const barWidth = (80 - gap * (count + 1)) / count;
    
    return data.map((val, i) => {
      const h = (val / maxValue) * 70;
      const x = 10 + gap + i * (barWidth + gap);
      const y = 85 - h;
      const barColor = getColor(i);
      const lx = x + barWidth/2;
      const rotate = c.rotateLabels || false;

      return (
        <g key={i}>
          {is3d && (
            <>
              <path d={`M ${x + barWidth} ${y} L ${x + barWidth + 2} ${y-2} L ${x + barWidth + 2} ${83} L ${x + barWidth} 85 Z`} fill={colorShade(barColor, -30)} />
              <path d={`M ${x} ${y} L ${x + 2} ${y-2} L ${x + barWidth + 2} ${y-2} L ${x + barWidth} ${y} Z`} fill={colorShade(barColor, 20)} />
            </>
          )}
          <rect 
            x={x} y={y} width={barWidth} height={85 - y} 
            fill={barColor} rx={type === 'bar' ? 2 : 0} 
            filter="url(#shadow)" 
          />
          <text 
            x={lx} y="93" 
            fontSize={lSVGSize} fontWeight={lBold} textAnchor={rotate ? "end" : "middle"} fill={lColor} 
            fontFamily={lFont} transform={rotate ? `rotate(-45 ${lx} 93)` : ""}
          >
            {labels[i]}
          </text>
        </g>
      );
    });
  };

  const renderLine = (mode = "line") => {
    if (data.length < 1) return null;
    const step = data.length > 1 ? 80 / (data.length - 1) : 0;
    const points = data.map((val, i) => `${10 + i * step},${85 - (val / maxValue) * 70}`).join(" ");
    
    let pathD = `M 10 ${85 - (data[0] / maxValue) * 70}`;
    if (mode === "stepline") {
        data.forEach((val, i) => {
            if (i === 0) return;
            const px = 10 + (i-1) * step;
            const py = 85 - (data[i-1] / maxValue) * 70;
            const nx = 10 + i * step;
            const ny = 85 - (val / maxValue) * 70;
            pathD += ` L ${nx} ${py} L ${nx} ${ny}`;
        });
    } else {
        pathD = `M ${points}`;
    }

    const curColor = getColor(0);
    return (
      <g>
        {mode === "area" && <path d={`${pathD} L 90 85 L 10 85 Z`} fill={curColor} fillOpacity="0.1" />}
        <path d={pathD} fill="none" stroke={curColor} strokeWidth="2" strokeLinecap="round" filter="url(#shadow)" />
        {data.map((val, i) => {
            const lx = 10 + i * step;
            const rotate = c.rotateLabels || false;
            return (
                <g key={i}>
                    <circle cx={lx} cy={85 - (val / maxValue) * 70} r="1.5" fill="white" stroke={curColor} strokeWidth="1" />
                    <text 
                        x={lx} y="93" fontSize={lSVGSize} fontWeight={lBold} textAnchor={rotate ? "end" : "middle"} fill={lColor} 
                        fontFamily={lFont} transform={rotate ? `rotate(-45 ${lx} 93)` : ""}
                    >{labels[i]}</text>
                </g>
            );
        })}
      </g>
    );
  };

  const renderPie = (isDonut = false) => {
    let currentAngle = 0;
    const centerX = 50, centerY = 45, radius = 35;
    return data.map((val, i) => {
        const angle = (val / total) * 360;
        const startA = currentAngle;
        const x1 = centerX + radius * Math.cos((Math.PI * (startA - 90)) / 180);
        const y1 = centerY + radius * Math.sin((Math.PI * (startA - 90)) / 180);
        currentAngle += angle;
        const x2 = centerX + radius * Math.cos((Math.PI * (currentAngle - 90)) / 180);
        const y2 = centerY + radius * Math.sin((Math.PI * (currentAngle - 90)) / 180);
        const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
        
        const labelAng = startA + angle / 2;
        const lx = centerX + (radius * 1.2) * Math.cos((Math.PI * (labelAng - 90)) / 180);
        const ly = centerY + (radius * 1.2) * Math.sin((Math.PI * (labelAng - 90)) / 180);

        return (
            <g key={i}>
                <path d={path} fill={getColor(i)} filter="url(#shadow)" stroke="white" strokeWidth="0.5" />
                <text x={lx} y={ly} fontSize={lSVGSize * 0.9} fill={lColor} fontWeight={lBold} textAnchor="middle" fontFamily={lFont}>{labels[i]}</text>
            </g>
        );
    });
  };

  return (
    <div ref={containerRef} style={{ 
        width: "100%", height: "100%", display: "flex", flexDirection: "column", 
        padding: "20px", background: bgColor, border: `1px solid ${borderColor}`, 
        borderRadius: s.borderRadius || 20, boxSizing: 'border-box', overflow: 'hidden', 
        fontFamily, fontWeight, fontStyle, boxShadow: "0 4px 15px rgba(0,0,0,0.05)" 
    }}>
      <div style={{ 
          fontSize: c.titleSize || 16, fontWeight: titleBold, color: titleTextColor, 
          marginBottom: 15, textAlign: c.titleAlign || textAlign, 
          textTransform: c.titleTransform || s.textTransform || 'none', 
          fontFamily: titleFont, textDecoration: c.titleDecoration || s.textDecoration || 'none' 
      }}>
         <span dangerouslySetInnerHTML={{ __html: el.label || "Resumen de Datos" }} />
      </div>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", flex: 1, overflow: 'visible', fontFamily }}>
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.4" /><feOffset dx="0.5" dy="0.5" /><feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        {/* Y Axis line */}
        <line x1="10" y1="15" x2="10" y2="85" stroke="#e2e8f0" strokeWidth="0.5" />
        {/* X Axis line */}
        <line x1="10" y1="85" x2="90" y2="85" stroke="#94a3b8" strokeWidth="1" />

        {['bar', 'bar3d', 'line', 'area', 'stepline'].includes(type) && renderGrid()}
        
        {type === "bar" && renderBar(false)}
        {type === "bar3d" && renderBar(true)}
        {type === "line" && renderLine("line")}
        {type === "area" && renderLine("area")}
        {type === "stepline" && renderLine("stepline")}
        {type === "pie" && renderPie(false)}
        {type === "donut" && <><g>{renderPie(true)}</g><circle cx="50" cy="45" r="22" fill={bgColor} /></>}
      </svg>
      
      {!isExport && dataSource === 'dynamic' && data.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
              ⚠️ SELECCIONA LOS CAMPOS EN EL PANEL
          </div>
      )}
    </div>
  );
}
