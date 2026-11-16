import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { X } from 'lucide-react';
import { Area } from '../types';
import { FOOD_TAXONOMY } from './Forms';

const FOOD_FLAT = FOOD_TAXONOMY.flatMap(g => g.items);
const CO2_FACTOR = 2.5;
const BRAND  = '#1a3d2b';
const MUTED  = '#64748b';
const BORDER = '#e2e8f0';
const TEXT   = '#0f172a';
const ZONE_COLORS = [
  '#1a3d2b','#0f9958','#16a34a','#15803d',
  '#0369a1','#1d4ed8','#7c3aed','#be185d',
  '#c2410c','#b45309','#4d7c0f','#0e7490',
];
const DAYS_ES    = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DAYS_ORDER = [1,2,3,4,5,6,0];

// ── Types ────────────────────────────────────────────────────────────────────

interface PesajeRow {
  area_id?: string;
  areaId?: string;
  area_nombre?: string;
  fecha: string;
  kg: number;
  estancias?: number | null;
  comensales?: number | null;
  desglose_kg?: Record<string, number>;
}

interface Props {
  registros: PesajeRow[];
  areas: Area[];
  hotelNombre: string;
  month: string; // 'YYYY-MM' — mes de referencia (el más reciente)
  onClose: () => void;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(from: string, to: string): string[] {
  const r: string[] = [];
  let cur = from;
  while (cur <= to) { r.push(cur); cur = shiftMonth(cur, 1); }
  return r;
}

function mesLong(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const N = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${N[m-1]} ${y}`;
}

function mesShort(ym: string): string {
  const [,m] = ym.split('-').map(Number);
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m-1];
}

function fmt(n: number, dec = 1): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pctDelta(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

function getMonthGrid(ym: string): (string|null)[] {
  const [y, m] = ym.split('-').map(Number);
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const lastDay  = new Date(y, m, 0).getDate();
  const cells: (string|null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(`${ym}-${String(d).padStart(2,'0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── SVG chart generator (pure string — for PDF) ──────────────────────────────

function svgBars(
  items: { label: string; value: number; color?: string }[],
  w: number,
  h: number,
  showMean = false,
): string {
  if (!items.length) return `<svg width="${w}" height="${h}"></svg>`;
  const maxV = Math.max(...items.map(d => d.value), 0.01);
  const pL = 4, pR = 4, pT = 22, pB = 28;
  const cW = w - pL - pR;
  const cH = h - pT - pB;
  const slotW = cW / items.length;
  const bW = Math.min(slotW * 0.6, 48);

  const bars = items.map((item, i) => {
    const x  = pL + i * slotW + (slotW - bW) / 2;
    const bh = Math.max(cH * (item.value / maxV), item.value > 0 ? 2 : 0);
    const y  = pT + cH - bh;
    const c  = item.color || BRAND;
    const vl = item.value > 0 ? (item.value >= 100 ? item.value.toFixed(0) : item.value.toFixed(1)) : '';
    return [
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${c}"/>`,
      vl ? `<text x="${(x+bW/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="${c}" font-family="Arial,sans-serif">${vl}</text>` : '',
      `<text x="${(x+bW/2).toFixed(1)}" y="${(h-5).toFixed(1)}" text-anchor="middle" font-size="8" fill="${MUTED}" font-family="Arial,sans-serif">${item.label}</text>`,
    ].join('');
  }).join('');

  let refLine = '';
  if (showMean) {
    const mean = items.reduce((s,d) => s+d.value, 0) / items.length;
    const mY   = pT + cH - cH * (mean / maxV);
    refLine = `<line x1="${pL}" y1="${mY.toFixed(1)}" x2="${(w-pR).toFixed(1)}" y2="${mY.toFixed(1)}" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bars}${refLine}</svg>`;
}

// ── PDF HTML builder ─────────────────────────────────────────────────────────

interface ReportPayload {
  kgEvitable: number;
  kgMerma: number;
  pctEvitable: number | null;
  ratioEvitableCom: number | null;
  ratioTotalCom: number | null;
  hotelNombre: string;
  periodLabel: string;
  months: string[];
  zones: { id: string; nombre: string; color: string }[];
  totalKg: number;
  prevKg: number;
  co2: number;
  dias: number;
  avgKgCom: number | null;
  costeTotal: number | null;
  kgDelta: number | null;
  avgKgComDelta: number | null;
  topRatioValue: number | null;
  topRatioLabel: string;
  topRatioDelta: number | null;
  topRatioAccent: string;
  costeDelta: number | null;
  byMonth: { ym: string; label: string; totalKg: number }[];
  byZone: { id: string; nombre: string; kg: number; color: string; pct: number }[];
  weekly: { label: string; value: number }[];
  dowData: { day: string; kg: number }[];
  catTotals: [string, number][];
  heatmap?: { grid: (string|null)[]; dayKgMap: Record<string,number>; maxKg: number };
}

function buildPdfHtml(p: ReportPayload): string {
  // Delta helpers
  function deltaHtmlFor(delta: number | null | undefined, fallback: string): string {
    if (delta == null) return `<span style="font-size:9px;color:${MUTED}">${fallback}</span>`;
    const up = delta > 0;
    const color = up ? '#dc2626' : '#16a34a';
    return `<span style="font-size:9px;font-weight:700;color:${color}">${up ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% vs período anterior</span>`;
  }

  // SVG charts
  const weekSvg  = svgBars(p.weekly.map(w => ({ label: w.label, value: w.value })), 500, 170, true);
  const dowSvg   = svgBars(p.dowData.map(d => {
    const mx = Math.max(...p.dowData.map(x => x.kg));
    return { label: d.day, value: d.kg, color: d.kg === mx ? '#dc2626' : BRAND };
  }), 340, 170);
  const monthSvg = p.byMonth.length > 1
    ? svgBars(p.byMonth.map(m => ({ label: m.label, value: m.totalKg })), 500, 170)
    : '';

  // Heatmap HTML (only for single month)
  const heatHtml = p.heatmap ? (() => {
    const { grid, dayKgMap, maxKg } = p.heatmap!;
    const cells = grid.map((date) => {
      if (!date) return '<div></div>';
      const kg = dayKgMap[date] || 0;
      const intensity = maxKg > 0 ? kg / maxKg : 0;
      const bg = intensity === 0 ? '#f8fafc'
        : `rgba(26,61,43,${(0.12 + intensity * 0.88).toFixed(2)})`;
      const tc = intensity > 0.5 ? '#fff' : TEXT;
      const day = parseInt(date.slice(8));
      return `<div style="border-radius:4px;padding:4px 1px;text-align:center;background:${bg};border:1px solid ${intensity>0?'transparent':'#e2e8f0'}">
        <div style="font-size:8px;font-weight:700;color:${tc};line-height:1">${day}</div>
        ${kg > 0 ? `<div style="font-size:6px;color:${tc};opacity:0.85">${kg.toFixed(0)}kg</div>` : ''}
      </div>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px">
        ${'<div style="text-align:center;font-size:7px;font-weight:800;color:'+MUTED+';text-transform:uppercase">'.replace('>','>') + ['L','M','X','J','V','S','D'].join('</div><div style="text-align:center;font-size:7px;font-weight:800;color:'+MUTED+';text-transform:uppercase">') + '</div>'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells}</div>`;
  })() : '';

  // Zone rows
  const zoneRows = p.byZone.map((z, i) => `
    <tr>
      <td style="padding:8px 10px;font-size:11px;font-weight:700;color:${TEXT};width:150px;vertical-align:middle">
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${z.color};margin-right:6px;vertical-align:middle"></span>${z.nombre}
      </td>
      <td style="padding:8px 10px;vertical-align:middle">
        <div style="height:12px;background:#f1f5f9;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${z.pct.toFixed(1)}%;background:${z.color};border-radius:4px"></div>
        </div>
      </td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:800;color:${z.color};width:80px;white-space:nowrap">${fmt(z.kg)} kg</td>
      <td style="padding:8px 10px;text-align:right;font-size:10px;color:${MUTED};width:46px">${z.pct.toFixed(1)}%</td>
    </tr>`).join('');

  // Category chips
  const catChips = p.catTotals.map(([catId, kg]) => {
    const cat = FOOD_FLAT.find(c => c.id === catId);
    if (!cat) return '';
    const pct = p.totalKg > 0 ? (kg / p.totalKg * 100).toFixed(1) : '0';
    return `<div style="border:1.5px solid ${BORDER};border-radius:10px;padding:12px 14px;background:#f8fafc;min-width:130px;flex:1">
      <p style="font-size:10px;font-weight:700;color:${TEXT};margin:0 0 4px">${cat.label}</p>
      <p style="font-size:19px;font-weight:900;color:${cat.iconColor};margin:0;line-height:1">${fmt(kg)} kg</p>
      <p style="font-size:9px;color:${MUTED};margin:4px 0 0">${pct}% del total</p>
      <div style="height:3px;background:#e2e8f0;border-radius:2px;margin-top:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${cat.iconColor}"></div>
      </div>
    </div>`;
  }).join('');

  const deltaHtml = p.kgDelta !== null
    ? `<span style="font-size:17px;font-weight:900;color:${p.kgDelta<0?'#16a34a':'#dc2626'}">${p.kgDelta>0?'▲':'▼'} ${Math.abs(p.kgDelta).toFixed(1)}%</span>&nbsp;
       <span style="font-size:10px;color:${MUTED}">vs período anterior (${fmt(p.prevKg,0)} kg)</span>`
    : `<span style="font-size:10px;color:${MUTED}">Sin datos de período anterior</span>`;

  // Monthly table (multi-month)
  const monthTableRows = p.byMonth.map((m, i) =>
    `<tr ${i%2===0?`style="background:#fafafa"`:''}><td style="padding:5px 10px;font-weight:600">${mesLong(m.ym)}</td>
     <td style="padding:5px 10px;text-align:right;font-weight:800;color:${BRAND}">${fmt(m.totalKg)} kg</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Desperdicio — ${p.hotelNombre} — ${p.periodLabel}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:${TEXT};background:#fff;font-size:11px}
@page{size:A4;margin:10mm 12mm}
@media print{
  .no-print{display:none!important}
  .page-break{page-break-before:always}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.btn{position:fixed;top:14px;right:14px;background:${BRAND};color:#fff;border:none;border-radius:8px;
  padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
.header{background:${BRAND};color:#fff;padding:22px 26px;display:flex;justify-content:space-between;align-items:center}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 18px}
.kpi{border:1.5px solid ${BORDER};border-radius:10px;padding:13px 15px}
.kpi-label{font-size:8px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.kpi-value{font-size:21px;font-weight:900;line-height:1}
.kpi-unit{font-size:11px;font-weight:600;color:${MUTED};margin-left:2px}
.kpi-sub{font-size:9px;color:${MUTED};margin-top:4px;font-weight:600}
.sec{margin:0 18px 16px}
.sec-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${TEXT};
  margin-bottom:11px;padding-left:8px;border-left:3px solid ${BRAND}}
.box{border:1.5px solid ${BORDER};border-radius:12px;padding:16px 18px}
table{border-collapse:collapse;width:100%}
.footer{background:${BRAND};color:rgba(255,255,255,.55);padding:10px 18px;display:flex;
  justify-content:space-between;align-items:center;font-size:8px;margin-top:18px}
</style>
</head>
<body>
<button class="btn no-print" onclick="window.print()">⬇ Descargar PDF</button>

<!-- CABECERA -->
<div class="header">
  <div>
    <p style="font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:5px">Informe de Desperdicio Alimentario · PPDA</p>
    <h1 style="font-size:21px;font-weight:900;color:#fff;margin-bottom:3px">${p.hotelNombre}</h1>
    <p style="font-size:12px;color:rgba(255,255,255,.7);font-weight:500">${p.periodLabel} · ${p.dias} días registrados · ${p.zones.length} zona${p.zones.length!==1?'s':''}</p>
  </div>
  <div style="text-align:center;background:rgba(255,255,255,.1);border-radius:12px;padding:14px 22px">
    <p style="font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:5px">Total período</p>
    <p style="font-size:34px;font-weight:900;color:#fff;line-height:1">${fmt(p.totalKg, 0)}</p>
    <p style="font-size:11px;color:rgba(255,255,255,.65);font-weight:600">kg desperdiciados</p>
  </div>
</div>

<!-- KPIs -->
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">${p.topRatioLabel}</div>
    <div class="kpi-value" style="color:${p.topRatioAccent}">${p.topRatioValue ? fmt(p.topRatioValue,3) : '—'}<span class="kpi-unit">kg/com.</span></div>
    <div class="kpi-sub">${deltaHtmlFor(p.topRatioDelta, 'promedio del período')}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">CO₂ Equivalente</div>
    <div class="kpi-value" style="color:#d97706">${fmt(p.co2/1000,2)}<span class="kpi-unit">t CO₂eq</span></div>
    <div class="kpi-sub">${deltaHtmlFor(p.kgDelta, `×${CO2_FACTOR} kg CO₂/kg · WRAP 2023`)}</div>
  </div>
  ${p.costeTotal !== null ? `<div class="kpi">
    <div class="kpi-label">Coste estimado</div>
    <div class="kpi-value" style="color:#dc2626">${fmt(p.costeTotal,0)}<span class="kpi-unit">€</span></div>
    <div class="kpi-sub">${deltaHtmlFor(p.costeDelta, 'coste total período')}</div>
  </div>` : ''}
  <div class="kpi">
    <div class="kpi-label">Días con datos</div>
    <div class="kpi-value" style="color:${BRAND}">${p.dias}</div>
    <div class="kpi-sub">días registrados</div>
  </div>
</div>

<!-- VS ANTERIOR -->
<div class="sec">
  <div style="background:#f0fdf4;border-radius:10px;padding:11px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${MUTED}">Variación vs período anterior:</span>
    ${deltaHtml}
  </div>
</div>

${p.kgMerma > 0 ? `
<!-- MERMA VS EVITABLE -->
<div class="sec">
  <p class="sec-title">Merma técnica vs Desperdicio evitable</p>
  <div class="box">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="flex:1;min-width:120px;border:1.5px solid ${BORDER};border-radius:10px;padding:12px 15px">
        <div class="kpi-label">Desperdicio evitable</div>
        <div class="kpi-value" style="color:${BRAND}">${fmt(p.kgEvitable,1)}<span class="kpi-unit">kg</span></div>
        <div class="kpi-sub">${p.pctEvitable !== null ? p.pctEvitable.toFixed(1)+'% del total' : ''}</div>
      </div>
      <div style="flex:1;min-width:120px;border:1.5px solid ${BORDER};border-radius:10px;padding:12px 15px">
        <div class="kpi-label">Merma técnica</div>
        <div class="kpi-value" style="color:#d97706">${fmt(p.kgMerma,1)}<span class="kpi-unit">kg</span></div>
        <div class="kpi-sub">${p.pctEvitable !== null ? (100-p.pctEvitable).toFixed(1)+'% del total' : ''}</div>
      </div>
      ${p.ratioEvitableCom !== null ? `<div style="flex:1;min-width:120px;border:1.5px solid ${BORDER};border-radius:10px;padding:12px 15px">
        <div class="kpi-label">Ratio evitable/comensal</div>
        <div class="kpi-value" style="color:${BRAND}">${p.ratioEvitableCom.toFixed(3)}<span class="kpi-unit">kg/com.</span></div>
        <div class="kpi-sub">promedio diario evitable</div>
      </div>` : ''}
      ${p.ratioTotalCom !== null ? `<div style="flex:1;min-width:120px;border:1.5px solid ${BORDER};border-radius:10px;padding:12px 15px">
        <div class="kpi-label">Ratio total/comensal</div>
        <div class="kpi-value" style="color:#7c3aed">${p.ratioTotalCom.toFixed(3)}<span class="kpi-unit">kg/com.</span></div>
        <div class="kpi-sub">evitable + merma técnica</div>
      </div>` : ''}
    </div>
    <div style="height:20px;background:#f1f5f9;border-radius:6px;overflow:hidden;display:flex">
      <div style="height:100%;width:${p.pctEvitable?.toFixed(1)||0}%;background:${BRAND};border-radius:6px 0 0 6px;transition:width 0.3s"></div>
      <div style="height:100%;flex:1;background:#d97706;border-radius:0 6px 6px 0"></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:6px">
      <span style="font-size:8px;color:${BRAND};font-weight:700">■ Evitable ${p.pctEvitable?.toFixed(1)||0}%</span>
      <span style="font-size:8px;color:#d97706;font-weight:700">■ Merma técnica ${p.pctEvitable !== null ? (100-p.pctEvitable).toFixed(1) : 0}%</span>
    </div>
  </div>
</div>` : ''}

${p.byMonth.length > 1 ? `
<!-- EVOLUCIÓN MENSUAL -->
<div class="sec">
  <p class="sec-title">Evolución mensual de desperdicio</p>
  <div class="box" style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
    ${monthSvg}
    <table style="font-size:10px;min-width:160px">
      <tr style="background:#f8fafc"><th style="padding:5px 10px;text-align:left;border-bottom:1px solid ${BORDER}">Mes</th><th style="padding:5px 10px;text-align:right;border-bottom:1px solid ${BORDER}">Desperdicio</th></tr>
      ${monthTableRows}
      <tr style="border-top:2px solid ${BORDER}"><td style="padding:6px 10px;font-weight:700">Total</td><td style="padding:6px 10px;text-align:right;font-weight:900;color:${BRAND}">${fmt(p.totalKg)} kg</td></tr>
    </table>
  </div>
</div>` : ''}

<!-- EVOLUCIÓN SEMANAL -->
<div class="sec">
  <p class="sec-title">Evolución semanal</p>
  <div class="box">${weekSvg}</div>
</div>

${p.months.length === 1 && p.heatmap ? `
<div class="page-break"></div>
<div style="height:14px"></div>
<!-- HEATMAP + DÍA SEMANA -->
<div class="sec" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
  <div>
    <p class="sec-title">Calendario de intensidad — ${mesLong(p.months[0])}</p>
    <div class="box" style="padding:12px">${heatHtml}</div>
  </div>
  <div>
    <p class="sec-title">Promedio kg por día de semana</p>
    <div class="box">${dowSvg}</div>
  </div>
</div>` : `
<!-- DÍA SEMANA -->
<div class="sec">
  <p class="sec-title">Promedio kg por día de semana</p>
  <div class="box">${dowSvg}</div>
</div>`}

<!-- DESGLOSE POR ZONA -->
<div class="sec">
  <p class="sec-title">Desglose por zona de generación</p>
  <div class="box" style="padding:8px">
    <table>${zoneRows}</table>
  </div>
</div>

${p.catTotals.length > 0 ? `
<!-- CATEGORÍAS -->
<div class="sec">
  <p class="sec-title">Desglose por categoría de alimento</p>
  <div class="box">
    <div style="display:flex;flex-wrap:wrap;gap:10px">${catChips}</div>
  </div>
</div>` : ''}

<!-- FOOTER -->
<div class="footer">
  <div>
    <p style="font-weight:700;color:rgba(255,255,255,.8);font-size:9px">Plan de Prevención de Desperdicio Alimentario · HS Green Consulting</p>
    <p style="margin-top:2px">${p.periodLabel} · Generado el ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>
  </div>
  <div style="text-align:right">
    <p>Factor CO₂: ${CO2_FACTOR} kg CO₂eq/kg · WRAP (2023) / FAO (2013)</p>
    <p style="margin-top:2px">ppdagenerator.netlify.app</p>
  </div>
</div>
</body>
</html>`;
}

// ── Component ────────────────────────────────────────────────────────────────

export const MonthlyReport: React.FC<Props> = ({ registros, areas, hotelNombre, month, onClose }) => {
  const [period, setPeriod] = useState<'1m' | '3m' | '6m'>('1m');

  // Mes de referencia independiente — el usuario puede navegar sin cerrar el modal
  const todayYM = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [reportMonth, setReportMonth] = useState(month);

  const startMonth = useMemo(() => {
    if (period === '1m') return reportMonth;
    if (period === '3m') return shiftMonth(reportMonth, -2);
    return shiftMonth(reportMonth, -5);
  }, [reportMonth, period]);

  const months = useMemo(() => monthRange(startMonth, reportMonth), [startMonth, reportMonth]);

  // Previous period (same length)
  const prevStart = useMemo(() => shiftMonth(startMonth, -months.length), [startMonth, months.length]);
  const prevEnd   = useMemo(() => shiftMonth(reportMonth, -months.length), [reportMonth, months.length]);

  const periodRecs = useMemo(() =>
    registros.filter(r => r.fecha >= `${startMonth}-01` && r.fecha <= `${reportMonth}-31`),
    [registros, startMonth, reportMonth]
  );
  const prevRecs = useMemo(() =>
    registros.filter(r => r.fecha >= `${prevStart}-01` && r.fecha <= `${prevEnd}-31`),
    [registros, prevStart, prevEnd]
  );

  const totalKg  = periodRecs.reduce((s,r) => s+r.kg, 0);
  const prevKg   = prevRecs.reduce((s,r) => s+r.kg, 0);
  const co2      = totalKg * CO2_FACTOR;
  const dias     = new Set(periodRecs.map(r => r.fecha)).size;
  const kgDelta  = pctDelta(totalKg, prevKg);

  const comRecs  = periodRecs.filter(r => r.comensales && r.comensales > 0);
  const avgKgCom = comRecs.length > 0
    ? comRecs.reduce((s,r) => s + r.kg / r.comensales!, 0) / comRecs.length : null;

  const prevComRecs  = prevRecs.filter(r => r.comensales && r.comensales > 0);
  const prevAvgKgCom = prevComRecs.length > 0
    ? prevComRecs.reduce((s,r) => s + r.kg / r.comensales!, 0) / prevComRecs.length : null;
  const avgKgComDelta = avgKgCom !== null && prevAvgKgCom !== null ? pctDelta(avgKgCom, prevAvgKgCom) : null;

  const costeTotal = useMemo(() => {
    if (!areas.some(a => a.costePorKg != null && a.costePorKg > 0)) return null;
    return periodRecs.reduce((s,r) => {
      const a = areas.find(x => x.id === (r.area_id||r.areaId));
      return s + r.kg * (a?.costePorKg ?? 0);
    }, 0);
  }, [periodRecs, areas]);

  const prevCosteTotal = useMemo(() => {
    if (!areas.some(a => a.costePorKg != null && a.costePorKg > 0)) return null;
    return prevRecs.reduce((s,r) => {
      const a = areas.find(x => x.id === (r.area_id||r.areaId));
      return s + r.kg * (a?.costePorKg ?? 0);
    }, 0);
  }, [prevRecs, areas]);
  const costeDelta = costeTotal !== null && prevCosteTotal !== null ? pctDelta(costeTotal, prevCosteTotal) : null;

  // ── Merma vs Evitable ────────────────────────────────────────────────────
  const mermaAreaIds = useMemo(
    () => new Set(areas.filter(a => a.tipoServicio?.toLowerCase().includes('merma') || a.nombre?.toLowerCase() === 'merma').map(a => a.id)),
    [areas]
  );
  const evitableRecs = useMemo(
    () => periodRecs.filter(r => !mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')),
    [periodRecs, mermaAreaIds]
  );
  const mermaRecs = useMemo(
    () => periodRecs.filter(r => mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')),
    [periodRecs, mermaAreaIds]
  );
  const kgEvitable  = evitableRecs.reduce((s, r) => s + r.kg, 0);
  const kgMerma     = mermaRecs.reduce((s, r) => s + r.kg, 0);
  const kgConMerma  = kgEvitable + kgMerma;
  const pctEvitable = kgConMerma > 0 ? (kgEvitable / kgConMerma) * 100 : null;

  const mermaByDay = useMemo(() => {
    const m: Record<string, number> = {};
    mermaRecs.forEach(r => { m[r.fecha] = (m[r.fecha] || 0) + r.kg; });
    return m;
  }, [mermaRecs]);

  const ratioComData = useMemo(() => {
    const byDate: Record<string, { kgEv: number; com: number }> = {};
    evitableRecs.forEach(r => {
      if (!r.comensales || r.comensales <= 0) return;
      if (!byDate[r.fecha]) byDate[r.fecha] = { kgEv: 0, com: 0 };
      byDate[r.fecha].kgEv += r.kg;
      byDate[r.fecha].com   = Math.max(byDate[r.fecha].com, r.comensales);
    });
    return Object.entries(byDate).map(([fecha, v]) => ({ ...v, kgM: mermaByDay[fecha] || 0 }));
  }, [evitableRecs, mermaByDay]);

  const ratioEvitableCom = ratioComData.length > 0
    ? ratioComData.reduce((s, d) => s + d.kgEv / d.com, 0) / ratioComData.length : null;
  const ratioTotalCom = mermaAreaIds.size > 0 && ratioComData.length > 0
    ? ratioComData.reduce((s, d) => s + (d.kgEv + d.kgM) / d.com, 0) / ratioComData.length : null;

  // Previous period equivalents for top-card delta
  const prevMermaByDay = useMemo(() => {
    const m: Record<string, number> = {};
    prevRecs.filter(r => mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')).forEach(r => { m[r.fecha] = (m[r.fecha] || 0) + r.kg; });
    return m;
  }, [prevRecs, mermaAreaIds]);
  const prevRatioComData = useMemo(() => {
    const byDate: Record<string, { kgEv: number; com: number }> = {};
    prevRecs.filter(r => !mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')).forEach(r => {
      if (!r.comensales || r.comensales <= 0) return;
      if (!byDate[r.fecha]) byDate[r.fecha] = { kgEv: 0, com: 0 };
      byDate[r.fecha].kgEv += r.kg;
      byDate[r.fecha].com = Math.max(byDate[r.fecha].com, r.comensales);
    });
    return Object.entries(byDate).map(([fecha, v]) => ({ ...v, kgM: prevMermaByDay[fecha] || 0 }));
  }, [prevRecs, mermaAreaIds, prevMermaByDay]);
  const prevRatioEvitableCom = prevRatioComData.length > 0
    ? prevRatioComData.reduce((s, d) => s + d.kgEv / d.com, 0) / prevRatioComData.length : null;
  const prevRatioTotalCom = mermaAreaIds.size > 0 && prevRatioComData.length > 0
    ? prevRatioComData.reduce((s, d) => s + (d.kgEv + d.kgM) / d.com, 0) / prevRatioComData.length : null;

  // Top-card: best available ratio (total > evitable > per-record average)
  const topRatioValue  = ratioTotalCom ?? ratioEvitableCom ?? avgKgCom;
  const prevTopRatio   = ratioTotalCom !== null ? prevRatioTotalCom : ratioEvitableCom !== null ? prevRatioEvitableCom : prevAvgKgCom;
  const topRatioLabel  = ratioTotalCom !== null ? 'Ratio total/com.' : ratioEvitableCom !== null ? 'Ratio evitable/com.' : 'kg / Comensal';
  const topRatioAccent = ratioTotalCom !== null ? '#7c3aed' : BRAND;
  const topRatioDelta  = topRatioValue !== null && prevTopRatio !== null ? pctDelta(topRatioValue, prevTopRatio) : null;

  const zonaIds = useMemo(() =>
    [...new Set(periodRecs.map(r => r.area_id || r.areaId || '').filter(Boolean))],
    [periodRecs]
  );

  const zones = useMemo(() => zonaIds.map((id, i) => {
    const recs = periodRecs.filter(r => (r.area_id||r.areaId) === id);
    const nombre = recs[0]?.area_nombre || areas.find(a => a.id === id)?.nombre || id;
    return { id, nombre, color: ZONE_COLORS[i % ZONE_COLORS.length] };
  }), [zonaIds, periodRecs, areas]);

  const byZone = useMemo(() => zones.map(z => {
    const kg = periodRecs.filter(r => (r.area_id||r.areaId) === z.id).reduce((s,r) => s+r.kg, 0);
    return { ...z, kg, pct: totalKg > 0 ? (kg/totalKg)*100 : 0 };
  }).sort((a,b) => b.kg - a.kg), [zones, periodRecs, totalKg]);

  const byMonth = useMemo(() => months.map(ym => {
    const mR = periodRecs.filter(r => r.fecha.startsWith(ym));
    return { ym, label: mesShort(ym), totalKg: mR.reduce((s,r) => s+r.kg, 0) };
  }), [months, periodRecs]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string,{label:string;value:number}> = {};
    periodRecs.forEach(r => {
      const d   = new Date(r.fecha+'T12:00:00');
      const dow = (d.getDay()+6) % 7;
      const mon = new Date(d); mon.setDate(d.getDate()-dow);
      const key = mon.toISOString().slice(0,10);
      if (!weeks[key]) weeks[key] = { label:`${mon.getDate()}/${mon.getMonth()+1}`, value:0 };
      weeks[key].value += r.kg;
    });
    return Object.entries(weeks).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [periodRecs]);

  const weekAvg = weeklyData.length > 0
    ? weeklyData.reduce((s,w) => s+w.value, 0) / weeklyData.length : 0;

  const dowData = useMemo(() => {
    const acc: Record<number,{kg:number;n:number}> = {};
    DAYS_ORDER.forEach(d => { acc[d] = {kg:0,n:0}; });
    const dates = [...new Set(periodRecs.map(r => r.fecha))];
    dates.forEach(f => {
      const dow = new Date(f+'T12:00:00').getDay();
      const kr  = periodRecs.filter(r => r.fecha === f).reduce((s,r) => s+r.kg, 0);
      acc[dow].kg += kr; acc[dow].n += 1;
    });
    return DAYS_ORDER.map((d,i) => ({ day: DAYS_ES[i], kg: acc[d].n > 0 ? acc[d].kg/acc[d].n : 0 }));
  }, [periodRecs]);

  const catTotals = useMemo(() => {
    const acc: Record<string,number> = {};
    periodRecs.forEach(r => {
      Object.entries(r.desglose_kg || {}).forEach(([k,v]) => { acc[k] = (acc[k]||0)+v; });
    });
    return Object.entries(acc).sort(([,a],[,b]) => b-a).slice(0,8) as [string,number][];
  }, [periodRecs]);

  const heatmapData = useMemo(() => {
    if (months.length !== 1) return undefined;
    const ym = months[0];
    const grid = getMonthGrid(ym);
    const dayKgMap: Record<string,number> = {};
    periodRecs.forEach(r => { dayKgMap[r.fecha] = (dayKgMap[r.fecha]||0)+r.kg; });
    const maxKg = Math.max(...Object.values(dayKgMap), 0.01);
    return { grid, dayKgMap, maxKg };
  }, [months, periodRecs]);

  const periodLabel = useMemo(() =>
    months.length === 1 ? mesLong(months[0]) : `${mesLong(months[0])} — ${mesLong(months[months.length-1])}`,
    [months]
  );

  // Chart data (for Recharts preview)
  const byMonthChart = byMonth.map(m => ({
    mes: m.label,
    ...Object.fromEntries(zones.map(z => [z.nombre, Math.round(
      periodRecs.filter(r => r.fecha.startsWith(m.ym) && (r.area_id||r.areaId)===z.id).reduce((s,r)=>s+r.kg,0)*10)/10
    ])),
  }));

  function handleDownload() {
    const payload: ReportPayload = {
      hotelNombre, periodLabel, months, zones, totalKg, prevKg,
      co2, dias, avgKgCom, costeTotal, kgDelta, avgKgComDelta, costeDelta,
      topRatioValue, topRatioLabel, topRatioDelta, topRatioAccent,
      kgEvitable, kgMerma, pctEvitable, ratioEvitableCom, ratioTotalCom,
      byMonth, byZone, weekly: weeklyData, dowData, catTotals,
      heatmap: heatmapData,
    };
    const html = buildPdfHtml(payload);
    const win = window.open('', '_blank');
    if (!win) { alert('Activa las ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="paper" style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.6)', display:'flex', flexDirection:'column',
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: BRAND, color:'#fff', padding:'9px 18px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <span style={{ fontWeight:800, fontSize:13 }}>Informe</span>
          {/* Month navigator */}
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.12)', borderRadius:8, padding:'3px 6px' }}>
            <button
              onClick={() => setReportMonth(m => shiftMonth(m, -1))}
              style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:'2px 6px', fontSize:16, lineHeight:1 }}>‹</button>
            <span style={{ minWidth:90, textAlign:'center', fontWeight:700, fontSize:12, color:'#fff' }}>
              {mesLong(reportMonth)}
            </span>
            <button
              onClick={() => { if (reportMonth < todayYM) setReportMonth(m => shiftMonth(m, 1)); }}
              style={{ background:'none', border:'none', color: reportMonth >= todayYM ? 'rgba(255,255,255,0.3)' : '#fff', cursor: reportMonth >= todayYM ? 'default' : 'pointer', padding:'2px 6px', fontSize:16, lineHeight:1 }}>›</button>
          </div>
          {/* Period selector */}
          <div style={{ display:'flex', background:'rgba(255,255,255,0.12)', borderRadius:8, padding:3, gap:3 }}>
            {(['1m','3m','6m'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                background: period===p ? 'rgba(255,255,255,0.9)' : 'transparent',
                color: period===p ? BRAND : 'rgba(255,255,255,0.75)',
                border:'none', borderRadius:6, padding:'4px 12px', cursor:'pointer',
                fontWeight:700, fontSize:11, transition:'all 0.15s',
              }}>
                {p==='1m'?'1 mes':p==='3m'?'Trimestre':'Semestre'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={handleDownload} style={{
            background:'#16a34a', border:'none', color:'#fff',
            borderRadius:8, padding:'7px 16px', cursor:'pointer',
            fontWeight:700, fontSize:12, display:'flex', alignItems:'center', gap:6,
          }}>
            ↓ Generar PDF
          </button>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.1)', border:'none', color:'#fff',
            borderRadius:8, padding:'7px 10px', cursor:'pointer', fontSize:16,
          }}>
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex:1, overflowY:'auto', padding:'18px 0', background:'#f1f5f9' }}>
        <div style={{ maxWidth:820, margin:'0 auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* KPI strip */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { label:'Total período', value:`${fmt(totalKg,0)} kg`, accent:BRAND,
                sub: kgDelta!==null ? `${kgDelta>0?'▲':'▼'} ${Math.abs(kgDelta).toFixed(1)}% vs anterior` : undefined,
                subColor: kgDelta!==null ? (kgDelta<0?'#16a34a':'#dc2626') : MUTED },
              { label: topRatioLabel, value: topRatioValue ? `${fmt(topRatioValue,3)}` : '—', unit:'kg/com.', accent: topRatioAccent,
                sub: topRatioDelta !== null ? `${topRatioDelta > 0 ? '▲' : '▼'} ${Math.abs(topRatioDelta).toFixed(1)}% vs anterior` : undefined,
                subColor: topRatioDelta !== null ? (topRatioDelta < 0 ? '#16a34a' : '#dc2626') : MUTED },
              { label:'CO₂ equiv.', value:`${fmt(co2/1000,2)}`, unit:'t CO₂eq', accent:'#d97706',
                sub: kgDelta !== null ? `${kgDelta > 0 ? '▲' : '▼'} ${Math.abs(kgDelta).toFixed(1)}% vs anterior` : undefined,
                subColor: kgDelta !== null ? (kgDelta < 0 ? '#16a34a' : '#dc2626') : MUTED },
              ...(costeTotal!==null ? [{ label:'Coste est.', value:`${fmt(costeTotal,0)} €`, accent:'#dc2626',
                sub: costeDelta !== null ? `${costeDelta > 0 ? '▲' : '▼'} ${Math.abs(costeDelta).toFixed(1)}% vs anterior` : undefined,
                subColor: costeDelta !== null ? (costeDelta < 0 ? '#16a34a' : '#dc2626') : MUTED }] : []),
              { label:'Días datos', value:`${dias}`, accent:BRAND },
            ].map((k:any) => (
              <div key={k.label} style={{
                background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:12,
                padding:'13px 16px', flex:'1 1 110px', minWidth:110,
              }}>
                <p style={{ fontSize:8, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{k.label}</p>
                <p style={{ fontSize:17, fontWeight:900, color:k.accent, lineHeight:1 }}>
                  {k.value}{k.unit ? <span style={{ fontSize:10, color:MUTED, marginLeft:2 }}>{k.unit}</span> : null}
                </p>
                {k.sub && <p style={{ fontSize:9, fontWeight:700, color:k.subColor, marginTop:4 }}>{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Merma vs Evitable */}
          {kgMerma > 0 && (
            <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:16 }}>
              <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:12, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>Merma técnica vs Desperdicio evitable</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
                {[
                  { label:'Desperdicio evitable', value:`${fmt(kgEvitable,1)} kg`, sub: pctEvitable !== null ? `${pctEvitable.toFixed(1)}% del total` : '', accent:BRAND },
                  { label:'Merma técnica', value:`${fmt(kgMerma,1)} kg`, sub: pctEvitable !== null ? `${(100-pctEvitable).toFixed(1)}% del total` : '', accent:'#d97706' },
                  ...(ratioEvitableCom !== null ? [{ label:'Ratio evitable/com.', value:`${ratioEvitableCom.toFixed(3)} kg/com.`, sub:'promedio diario', accent:BRAND }] : []),
                  ...(ratioTotalCom !== null ? [{ label:'Ratio total/com.', value:`${ratioTotalCom.toFixed(3)} kg/com.`, sub:'evitable + merma', accent:'#7c3aed' }] : []),
                  ...(avgKgCom !== null ? [{ label:'Media kg/zona/com.', value:`${avgKgCom.toFixed(3)} kg/com.`, sub:'promedio por registro de zona', accent:'#64748b' }] : []),
                ].map(k => (
                  <div key={k.label} style={{ flex:'1 1 100px', minWidth:100, background:'#f8fafc', border:`1.5px solid ${BORDER}`, borderRadius:10, padding:'10px 13px' }}>
                    <p style={{ fontSize:8, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{k.label}</p>
                    <p style={{ fontSize:14, fontWeight:900, color:k.accent, lineHeight:1 }}>{k.value}</p>
                    {k.sub && <p style={{ fontSize:9, color:MUTED, marginTop:3 }}>{k.sub}</p>}
                  </div>
                ))}
              </div>
              <div style={{ height:14, background:'#f1f5f9', borderRadius:6, overflow:'hidden', display:'flex' }}>
                <div style={{ height:'100%', width:`${pctEvitable?.toFixed(1)||0}%`, background:BRAND, borderRadius:'6px 0 0 6px' }}/>
                <div style={{ height:'100%', flex:1, background:'#d97706', borderRadius:'0 6px 6px 0' }}/>
              </div>
              <div style={{ display:'flex', gap:12, marginTop:5 }}>
                <span style={{ fontSize:9, color:BRAND, fontWeight:700 }}>■ Evitable {pctEvitable?.toFixed(1)||0}%</span>
                <span style={{ fontSize:9, color:'#d97706', fontWeight:700 }}>■ Merma técnica {pctEvitable !== null ? (100-pctEvitable).toFixed(1) : 0}%</span>
              </div>
            </div>
          )}

          {/* Monthly evolution */}
          {byMonth.length > 1 && (
            <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:18 }}>
              <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:14, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>Evolución mensual</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={byMonthChart} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="mes" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ fontSize:10, borderRadius:8, border:`1px solid ${BORDER}` }}/>
                  {zones.map((z, i) => (
                    <Bar key={z.id} dataKey={z.nombre} stackId="a" fill={z.color}
                      radius={i===zones.length-1?[3,3,0,0]:[0,0,0,0]} maxBarSize={48}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly + DoW */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:18 }}>
              <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:14, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>Evolución semanal</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={weeklyData} margin={{ top:4, right:4, left:-28, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:9, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:8, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ fontSize:10, borderRadius:8, border:`1px solid ${BORDER}` }}/>
                  <ReferenceLine y={weekAvg} stroke="#d97706" strokeDasharray="4 3" strokeWidth={1.5}/>
                  <Bar dataKey="value" fill={BRAND} radius={[3,3,0,0]} maxBarSize={38}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:18 }}>
              <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:14, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>kg por día de semana</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dowData} margin={{ top:4, right:4, left:-28, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:8, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ fontSize:10, borderRadius:8, border:`1px solid ${BORDER}` }}/>
                  <Bar dataKey="kg" radius={[3,3,0,0]} maxBarSize={34}>
                    {dowData.map((d,i) => {
                      const mx = Math.max(...dowData.map(x => x.kg));
                      return <Cell key={i} fill={d.kg===mx?'#dc2626':BRAND}/>;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zone breakdown */}
          <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:18 }}>
            <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:14, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>Desglose por zona</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {byZone.map(z => (
                <div key={z.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:z.color, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:TEXT }}>{z.nombre}</span>
                      <span style={{ fontSize:12, fontWeight:800, color:z.color }}>{fmt(z.kg)} kg · {z.pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${z.pct}%`, background:z.color, borderRadius:4 }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          {catTotals.length > 0 && (
            <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:14, padding:18 }}>
              <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:TEXT, marginBottom:14, paddingLeft:8, borderLeft:`3px solid ${BRAND}` }}>Categorías de alimento</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {catTotals.map(([catId, kg]) => {
                  const cat = FOOD_FLAT.find(c => c.id === catId);
                  if (!cat) return null;
                  const { Icon } = cat;
                  const pct = totalKg > 0 ? (kg/totalKg)*100 : 0;
                  return (
                    <div key={catId} style={{ border:`1.5px solid ${BORDER}`, borderRadius:10, padding:'11px 13px', background:'#f8fafc', minWidth:130, flex:'1 1 130px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                        <Icon size={13} style={{ color:cat.iconColor }}/>
                        <span style={{ fontSize:10, fontWeight:700, color:TEXT }}>{cat.label}</span>
                      </div>
                      <p style={{ fontSize:17, fontWeight:900, color:cat.iconColor, lineHeight:1, margin:0 }}>{fmt(kg)} kg</p>
                      <p style={{ fontSize:9, color:MUTED, marginTop:3 }}>{pct.toFixed(1)}% del total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p style={{ textAlign:'center', fontSize:10, color:MUTED, paddingBottom:8 }}>
            Pulsa <strong>↓ Generar PDF</strong> para abrir una ventana limpia lista para imprimir o guardar como PDF.
          </p>

        </div>
      </div>
    </div>
  );
};
