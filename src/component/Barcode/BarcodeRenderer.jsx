"use client";

import React, { useMemo } from "react";

const BARCODE_TYPES = [
    { id: 'qrcode', label: 'QR Code' },
    { id: 'code128', label: 'Code 128' },
    { id: 'ean13', label: 'EAN-13' },
    { id: 'code39', label: 'Code 39' },
    { id: 'pdf417', label: 'PDF417' },
    { id: 'datamatrix', label: 'Data Matrix' }
];

export default function BarcodeRenderer({ el, dataset = [], isExport = false }) {
    const s = el.style || {};
    const b = el.barcode || {};
    const value = el.text || "123456789";
    const type = b.type || 'qrcode';
    const color = s.color || "#000000";
    const bgColor = s.background === 'transparent' ? 'ffffff' : (s.background || "#ffffff").replace('#', '');
    
    // Interpolate dynamic values
    const interpolatedValue = useMemo(() => {
        if (!dataset || dataset.length === 0) return value;
        const sample = dataset[0];
        return value.replace(/\{\{(.*?)\}\}/g, (match, key) => {
            const k = key.trim();
            if (sample[k] !== undefined) return sample[k];
            const lowerK = k.toLowerCase();
            const foundKey = Object.keys(sample).find(ok => ok.toLowerCase() === lowerK);
            if (foundKey) return sample[foundKey];
            return match;
        });
    }, [value, dataset]);

    // Construct BWIP-JS API URL
    // Documentation: https://github.com/metafloor/bwip-js/wiki/Online-Barcode-API
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.append('bcid', type);
        params.append('text', interpolatedValue);
        params.append('scale', '3');
        
        // Colors (remove # if present)
        const pureBarColor = color.replace('#', '');
        const pureBgColor = bgColor.replace('#', '');
        
        if (pureBarColor) params.append('barcolor', pureBarColor);
        if (pureBgColor) params.append('backgroundcolor', pureBgColor);
        
        // includeText ONLY for 1D barcodes that support it
        const supportsText = ['code128', 'ean13', 'code39'].includes(type);
        if (supportsText && b.includeText) {
            params.append('includetext', '1');
        }

        return `https://bwipjs-api.metafloor.com/?${params.toString()}`;
    }, [type, interpolatedValue, color, bgColor, b.includeText]);

    return (
        <div style={{ 
            width: "100%", 
            height: "100%", 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center", 
            justifyContent: "center",
            background: s.background || "transparent",
            border: s.borderStyle && s.borderStyle !== 'none' ? `${s.borderWidth || 1}px ${s.borderStyle} ${s.borderColor || '#000'}` : 'none',
            borderRadius: s.borderRadius || 0,
            overflow: "hidden",
            boxSizing: 'border-box'
        }}>
            <img 
                src={apiUrl} 
                alt={type} 
                style={{ 
                    maxWidth: "100%", 
                    maxHeight: "100%", 
                    objectFit: "contain" 
                }} 
                onError={(e) => {
                    // Fallback if API fails or value is invalid for type (e.g. non-numeric for EAN13)
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML += `<div style="font-size: 8px; color: #ef4444; border: 1px dashed #ef4444; padding: 4px; text-align: center;">ERR: VALOR INVÁLIDO PARA ${type.toUpperCase()}</div>`;
                }}
            />
            {!isExport && (
                <div className="no-export" style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '7px', color: '#94a3b8', background: 'rgba(255,255,255,0.7)', padding: '1px 3px', borderRadius: 2 }}>
                    {type.toUpperCase()}
                </div>
            )}
        </div>
    );
}
