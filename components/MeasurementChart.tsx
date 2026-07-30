import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { BarChart2, TrendingDown, TrendingUp, Minus, Scale, Users, Building2, Euro, ChevronLeft, ChevronRight, PieChart, Leaf, CalendarDays } from 'lucide-react';
import { Area } from '../types';
import { FOOD_TAXONOMY } from './Forms';

const FOOD_FLAT = FOOD_TAXONOMY.flatMap(g => g.items);

interface PesajeRow {
  area_id?: string;
  areaId?: string;
  area_nombre?: string;
  fecha: string;
  kg: number;
  estancias?: number | null;
  comensales?: number | null;
  relativizar_por?: string | null;
  desglose_kg?: Record<string, number>;
}

interface Props {
  registros: PesajeRow[];
  areas: Area[];
  hotels?: any[];
  scope?: string;
  comparativaMonth?: string;
}

// Colores por zona
const ZONE_COLORS = [
  '#1a3d2b', '#0f9958', '#22c55e', '#86efac',
  '#0d47a1', '#1976d2', '#4fc3f7', '#7e57c2',
  '#e65100', '#f57c00', '#ffb300', '#8d6e63',
];

type MetricKey = 'kg' | 'kgEstancia' | 'kgComensal';
type CompMetric = 'kg' | 'kgEstancia' | 'kgComensal' | 'coste';

// Factor CO₂ equivalente por kg de alimento desperdiciado
// Fuente: WRAP (2023) "Food Surplus and Waste in the UK", FAO "Food Wastage Footprint" (2013),
// JRC European Commission. Valor estándar sector hostelería europeo: 2,5 kg CO₂eq/kg.
// Incluye producción agrícola, procesado y transporte. Excluye cambio de uso del suelo (valor conservador).
const CO2_FACTOR = 2.5;

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun→Dom

function isoMonth(fecha: string) { return fecha.slice(0, 7); }
function labelMes(ym: string) {
  const [y, m] = ym.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${meses[parseInt(m)-1]} ${y.slice(2)}`;
}

function isMermaArea(a: Area): boolean {
  return a.tipoServicio?.toLowerCase().includes('merma') || a.nombre?.toLowerCase() === 'merma';
}

function getZonas(registros: PesajeRow[], areas: Area[]): { id: string; nombre: string }[] {
  const ids = [...new Set(registros.map(r => r.area_id || r.areaId || '').filter(Boolean))];
  return ids.map(id => {
    const area = areas.find(a => a.id === id);
    return { id, nombre: area?.nombre || id };
  });
}

type PeriodKey = '3m' | '6m' | '1y' | 'prev';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '3m',   label: '3 meses'    },
  { key: '6m',   label: 'Semestre'   },
  { key: '1y',   label: 'Año actual' },
  { key: 'prev', label: 'Año ant.'   },
];

function localYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthsForPeriod(period: PeriodKey): string[] {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth(); // 0-11

  if (period === '3m') {
    return Array.from({ length: 3 }, (_, i) => localYM(new Date(y, m - (2 - i), 1)));
  }
  if (period === '6m') {
    return Array.from({ length: 6 }, (_, i) => localYM(new Date(y, m - (5 - i), 1)));
  }
  if (period === '1y') {
    return Array.from({ length: 12 }, (_, i) => localYM(new Date(y, i, 1)));
  }
  // Año anterior completo
  return Array.from({ length: 12 }, (_, i) => localYM(new Date(y - 1, i, 1)));
}

// Tooltip personalizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">
            {typeof p.value === 'number' ? p.value.toFixed(p.value > 1 ? 1 : 3) : p.value}
            {p.unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
};

export const MeasurementChart: React.FC<Props> = ({ registros, areas, hotels = [], scope = 'individual', comparativaMonth: comparativaMonthProp }) => {
  const [metric,          setMetric]          = useState<MetricKey>('kg');
  const [period,          setPeriod]          = useState<PeriodKey>('3m');
  const [activeZone,      setActiveZone]      = useState<string | null>(null);
  const [compMetric,      setCompMetric]      = useState<CompMetric>('kg');
  const [tendenciaMetric, setTendenciaMetric] = useState<CompMetric>('kg');

  const todayYM = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const comparativaMonth = comparativaMonthProp ?? todayYM;

  const prevYM = useMemo(() => {
    const [y, m] = comparativaMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [comparativaMonth]);

  const months = useMemo(() => getMonthsForPeriod(period), [period]);
  const zonas  = useMemo(() => getZonas(registros, areas), [registros, areas]);

  const comparativaLabel = useMemo(() => {
    const [y, m] = comparativaMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const mes = d.toLocaleDateString('es-ES', { month: 'long' });
    return comparativaMonth === todayYM ? mes : `${mes} ${y}`;
  }, [comparativaMonth, todayYM]);

  // Métrica selector para gráficos de detalle (heatmap, dow, semanal)
  const [detailMetric, setDetailMetric] = useState<'kg' | 'kgComensal'>('kg');

  // ── KPIs globales (mes seleccionado en comparativa) ───────────────────────
  const thisMRecs = registros.filter(r => r.fecha.startsWith(comparativaMonth));
  const prevMRecs = registros.filter(r => r.fecha.startsWith(prevYM));
  const totalKgMes  = thisMRecs.reduce((s, r) => s + r.kg, 0);
  const totalKgPrev = prevMRecs.reduce((s, r) => s + r.kg, 0);
  const tendencia   = totalKgPrev > 0 ? ((totalKgMes - totalKgPrev) / totalKgPrev) * 100 : null;

  // Coste total del mes
  const totalCosteMes = useMemo(() => {
    const zonesConCoste = areas.filter(a => a.costePorKg != null && a.costePorKg > 0);
    if (zonesConCoste.length === 0) return null;
    return thisMRecs.reduce((s, r) => {
      const areaId = (r as any).area_id || (r as any).areaId;
      const area = areas.find(a => a.id === areaId);
      return s + r.kg * (area?.costePorKg ?? 0);
    }, 0);
  }, [thisMRecs, areas]);

  const recConEst = thisMRecs.filter(r => r.estancias && r.estancias > 0);
  const recConCom = thisMRecs.filter(r => r.comensales && r.comensales > 0);
  const avgEstancia = recConEst.length > 0
    ? recConEst.reduce((s, r) => s + r.kg / r.estancias!, 0) / recConEst.length : null;
  const avgComensal = recConCom.length > 0
    ? recConCom.reduce((s, r) => s + r.kg / r.comensales!, 0) / recConCom.length : null;

  // ── CO₂ equivalente ──────────────────────────────────────────────────────
  const co2Mes     = totalKgMes * CO2_FACTOR;
  const co2Prev    = totalKgPrev * CO2_FACTOR;

  // ── Merma vs Desperdicio evitable ────────────────────────────────────────
  const mermaAreaIds = useMemo(
    () => new Set(areas.filter(isMermaArea).map(a => a.id)),
    [areas]
  );
  const hasMerma = mermaAreaIds.size > 0;

  const evitableRecs = useMemo(
    () => thisMRecs.filter(r => !mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')),
    [thisMRecs, mermaAreaIds]
  );
  const mermaRecs = useMemo(
    () => thisMRecs.filter(r => mermaAreaIds.has((r.area_id ?? r.areaId) ?? '')),
    [thisMRecs, mermaAreaIds]
  );

  const kgEvitable   = evitableRecs.reduce((s, r) => s + r.kg, 0);
  const kgMerma      = mermaRecs.reduce((s, r) => s + r.kg, 0);
  const kgConMerma   = kgEvitable + kgMerma;
  const pctEvitable  = kgConMerma > 0 ? (kgEvitable / kgConMerma) * 100 : null;

  // Ratios por comensal: comensales del día = max entre zonas evitables
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
  const ratioTotalCom = hasMerma && ratioComData.length > 0
    ? ratioComData.reduce((s, d) => s + (d.kgEv + d.kgM) / d.com, 0) / ratioComData.length : null;

  // ── Heatmap: kg por día del mes seleccionado ─────────────────────────────
  const heatmapData = useMemo(() => {
    const year  = parseInt(comparativaMonth.slice(0, 4));
    const month = parseInt(comparativaMonth.slice(5, 7));
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Dom
    const byDate: Record<string, number> = {};
    const byDateCom: Record<string, { kg: number; com: number }> = {};
    thisMRecs.forEach(r => {
      byDate[r.fecha] = (byDate[r.fecha] || 0) + r.kg;
      if (!byDateCom[r.fecha]) byDateCom[r.fecha] = { kg: 0, com: 0 };
      byDateCom[r.fecha].kg  += r.kg;
      byDateCom[r.fecha].com += r.comensales || 0;
    });
    const getValue = (iso: string) => {
      if (detailMetric === 'kgComensal') {
        const d = byDateCom[iso];
        return d && d.com > 0 ? d.kg / d.com : 0;
      }
      return byDate[iso] || 0;
    };
    const allVals = Object.keys(byDate).map(getValue);
    const maxKg = Math.max(...allVals, 1);
    const cells = [];
    // Padding inicial (0=Dom → offset para que empiece en Lun)
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < offset; i++) cells.push({ day: null, kg: 0, iso: '' });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const val = getValue(iso);
      cells.push({ day: d, kg: byDate[iso] || 0, val, iso, intensity: maxKg > 0 ? val / maxKg : 0 });
    }
    return { cells, maxKg };
  }, [thisMRecs, comparativaMonth, detailMetric]);

  // ── Día de semana stats ───────────────────────────────────────────────────
  const dowData = useMemo(() => {
    const acc: Record<number, { kg: number; comensales: number; days: number }> = {};
    for (let i = 0; i < 7; i++) acc[i] = { kg: 0, comensales: 0, days: 0 };
    thisMRecs.forEach(r => {
      const dow = new Date(r.fecha + 'T12:00:00').getDay();
      acc[dow].kg += r.kg;
      acc[dow].comensales += r.comensales || 0;
    });
    const dates = [...new Set(thisMRecs.map(r => r.fecha))];
    dates.forEach(d => { acc[new Date(d + 'T12:00:00').getDay()].days += 1; });
    return DAYS_ORDER.map(dow => {
      const avgKg  = acc[dow].days > 0 ? Math.round(acc[dow].kg / acc[dow].days * 10) / 10 : 0;
      const kgCom  = acc[dow].comensales > 0 ? Math.round(acc[dow].kg / acc[dow].comensales * 1000) / 1000 : null;
      return {
        day:   DAYS_ES[dow],
        value: detailMetric === 'kgComensal' ? (kgCom ?? 0) : avgKg,
        kg:    avgKg,
        kgCom,
        total: Math.round(acc[dow].kg * 10) / 10,
      };
    });
  }, [thisMRecs, detailMetric]);

  // ── Evolución semanal ────────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const byDate: Record<string, { kg: number; com: number }> = {};
    thisMRecs.forEach(r => {
      if (!byDate[r.fecha]) byDate[r.fecha] = { kg: 0, com: 0 };
      byDate[r.fecha].kg  += r.kg;
      byDate[r.fecha].com += r.comensales || 0;
    });
    const dates = Object.keys(byDate).sort();
    if (dates.length === 0) return [];
    const weeks: Record<string, { label: string; kg: number; com: number }> = {};
    dates.forEach(d => {
      const dt  = new Date(d + 'T12:00:00');
      const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
      const mon = new Date(dt); mon.setDate(dt.getDate() - dow);
      const key = mon.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = { label: `${mon.getDate()}/${mon.getMonth()+1}`, kg: 0, com: 0 };
      weeks[key].kg  += byDate[d].kg;
      weeks[key].com += byDate[d].com;
    });
    return Object.values(weeks).map(w => ({
      label: w.label,
      value: detailMetric === 'kgComensal' && w.com > 0
        ? Math.round(w.kg / w.com * 1000) / 1000
        : Math.round(w.kg * 10) / 10,
      kg:    Math.round(w.kg * 10) / 10,
    }));
  }, [thisMRecs, detailMetric]);

  const weeklyAvg = weeklyData.length > 0
    ? weeklyData.reduce((s, w) => s + w.value, 0) / weeklyData.length : 0;

  // ── Datos para gráfico evolución mensual ──────────────────────────────────
  const chartData = useMemo(() => months.map(ym => {
    const row: any = { mes: labelMes(ym) };
    zonas.forEach(z => {
      const recs = registros.filter(r => (r.area_id || r.areaId) === z.id && r.fecha.startsWith(ym));
      if (metric === 'kg') {
        row[z.nombre] = Math.round(recs.reduce((s, r) => s + r.kg, 0) * 10) / 10;
      } else if (metric === 'kgEstancia') {
        const con = recs.filter(r => r.estancias && r.estancias > 0);
        row[z.nombre] = con.length > 0
          ? Math.round(con.reduce((s, r) => s + r.kg / r.estancias!, 0) / con.length * 1000) / 1000
          : null;
      } else {
        const con = recs.filter(r => r.comensales && r.comensales > 0);
        row[z.nombre] = con.length > 0
          ? Math.round(con.reduce((s, r) => s + r.kg / r.comensales!, 0) / con.length * 1000) / 1000
          : null;
      }
    });
    return row;
  }), [months, zonas, registros, metric]);

  // ── Datos comparativa — mes seleccionado ──────────────────────────────────
  const compMRecs = useMemo(() =>
    registros.filter(r => r.fecha.startsWith(comparativaMonth)),
  [registros, comparativaMonth]);

  const zoneComparativa = useMemo(() => zonas.map((z, i) => {
    const recs = compMRecs.filter(r => (r.area_id || r.areaId) === z.id);
    const kg   = recs.reduce((s, r) => s + r.kg, 0);
    const con  = recs.filter(r => r.estancias && r.estancias > 0);
    const conC = recs.filter(r => r.comensales && r.comensales > 0);
    const area = areas.find(a => a.id === z.id);
    const coste = area?.costePorKg != null && kg > 0 ? Math.round(kg * area.costePorKg) : null;
    return {
      nombre:      z.nombre,
      kg:          Math.round(kg * 10) / 10,
      kgEstancia:  con.length > 0 ? Math.round(con.reduce((s,r) => s + r.kg/r.estancias!, 0)/con.length*1000)/1000 : null,
      kgComensal:  conC.length > 0 ? Math.round(conC.reduce((s,r) => s + r.kg/r.comensales!, 0)/conC.length*1000)/1000 : null,
      coste,
      color:       ZONE_COLORS[i % ZONE_COLORS.length],
    };
  }).filter(z => z.kg > 0).sort((a, b) => b.kg - a.kg), [zonas, compMRecs, areas]);

  const hasCoste = areas.some(a => a.costePorKg != null && a.costePorKg > 0);

  const getCompValue = (z: typeof zoneComparativa[0]): number | null => {
    if (compMetric === 'kg')          return z.kg;
    if (compMetric === 'kgEstancia')  return z.kgEstancia;
    if (compMetric === 'kgComensal')  return z.kgComensal;
    if (compMetric === 'coste')       return z.coste;
    return null;
  };

  const maxCompValue = Math.max(
    ...zoneComparativa.map(z => getCompValue(z) ?? 0), 1
  );

  const compMetricLabel = (v: number | null): string => {
    if (v == null) return '—';
    if (compMetric === 'kg')         return `${v.toFixed(1)} kg`;
    if (compMetric === 'kgEstancia') return `${v.toFixed(3)} kg/est.`;
    if (compMetric === 'kgComensal') return `${v.toFixed(3)} kg/com.`;
    if (compMetric === 'coste')      return `${v.toLocaleString('es-ES')} €`;
    return String(v);
  };

  const COMP_OPTIONS: { key: CompMetric; label: string }[] = [
    { key: 'kg',         label: 'kg'        },
    { key: 'kgEstancia', label: 'kg/est.'   },
    { key: 'kgComensal', label: 'kg/com.'   },
    ...(hasCoste ? [{ key: 'coste' as CompMetric, label: 'Coste €' }] : []),
  ];

  if (registros.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-12 text-center text-slate-400">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-25" />
        <p className="text-sm font-medium">Sin datos de pesaje registrados.</p>
        <p className="text-xs mt-1">Los gráficos aparecerán aquí una vez el equipo introduzca los registros diarios.</p>
      </div>
    );
  }

  const metricLabel = metric === 'kg' ? 'kg totales' : metric === 'kgEstancia' ? 'kg/estancia' : 'kg/comensal';
  const metricUnit  = metric === 'kg' ? ' kg' : '';

  const content = (
    <div className="space-y-5">

      {/* ── KPI chips ── */}
      <div className={`grid gap-3 ${totalCosteMes != null ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-5'}`}>
        {/* Total mes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total mes</p>
          <p className="text-2xl font-black" style={{ color: '#1a3d2b' }}>{totalKgMes.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">kg</span></p>
          <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{comparativaLabel}</p>
        </div>
        {/* Tendencia */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">vs mes anterior</p>
          {tendencia === null ? (
            <p className="text-lg font-bold text-slate-300">Sin datos</p>
          ) : (
            <div className={`flex items-center gap-1 text-xl font-black ${tendencia < 0 ? 'text-green-600' : tendencia > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {tendencia < -1 ? <TrendingDown size={18}/> : tendencia > 1 ? <TrendingUp size={18}/> : <Minus size={18}/>}
              {Math.abs(tendencia).toFixed(1)}%
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">{totalKgPrev.toFixed(1)} kg mes anterior</p>
        </div>
        {/* kg/estancia */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Building2 size={9}/> kg/estancia</p>
          <p className="text-2xl font-black text-brand-600">{avgEstancia !== null ? avgEstancia.toFixed(3) : '—'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">promedio del mes</p>
        </div>
        {/* kg/comensal */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Users size={9}/> kg/comensal</p>
          <p className="text-2xl font-black text-brand-600">{avgComensal !== null ? avgComensal.toFixed(3) : '—'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">promedio del mes</p>
        </div>
        {/* CO₂ equivalente */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Leaf size={9} className="text-emerald-500"/> CO₂ equiv.
          </p>
          <p className="text-2xl font-black text-emerald-600">{co2Mes.toFixed(0)}<span className="text-sm font-normal text-slate-400 ml-1">kg</span></p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            ×{CO2_FACTOR} kg CO₂eq/kg
            {co2Prev > 0 && (
              <span className={`ml-1 font-semibold ${co2Mes < co2Prev ? 'text-emerald-500' : 'text-red-400'}`}>
                ({co2Mes < co2Prev ? '↓' : '↑'}{Math.abs(((co2Mes - co2Prev) / co2Prev) * 100).toFixed(0)}%)
              </span>
            )}
          </p>
        </div>
        {/* Coste total mes */}
        {totalCosteMes != null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Euro size={9}/> Coste mes</p>
            <p className="text-2xl font-black text-slate-800">{totalCosteMes.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</p>
            <p className="text-[10px] text-slate-400 mt-0.5">coste total desperdicio</p>
          </div>
        )}
      </div>

      {/* ── Merma vs Desperdicio evitable ── */}
      {hasMerma && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Leaf size={12} className="text-amber-500" />
            Merma vs desperdicio evitable · <span className="capitalize font-medium">{comparativaLabel}</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Desperdicio evitable</p>
              <p className="text-xl font-black text-emerald-700">{kgEvitable.toFixed(1)}<span className="text-xs font-normal text-slate-400 ml-1">kg</span></p>
              {pctEvitable !== null && <p className="text-[10px] text-slate-400 mt-0.5">{pctEvitable.toFixed(1)}% del total</p>}
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Merma técnica</p>
              <p className="text-xl font-black text-amber-600">{kgMerma.toFixed(1)}<span className="text-xs font-normal text-slate-400 ml-1">kg</span></p>
              {pctEvitable !== null && <p className="text-[10px] text-slate-400 mt-0.5">{(100 - pctEvitable).toFixed(1)}% del total</p>}
            </div>
            {ratioEvitableCom !== null && (
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Ratio evitable/com.</p>
                <p className="text-xl font-black text-emerald-700">{ratioEvitableCom.toFixed(3)}<span className="text-xs font-normal text-slate-400 ml-1">kg/com</span></p>
                <p className="text-[10px] text-slate-400 mt-0.5">base legal PPDA</p>
              </div>
            )}
            {ratioTotalCom !== null && (
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Ratio total/com.</p>
                <p className="text-xl font-black" style={{ color: '#1a3d2b' }}>{ratioTotalCom.toFixed(3)}<span className="text-xs font-normal text-slate-400 ml-1">kg/com</span></p>
                <p className="text-[10px] text-slate-400 mt-0.5">incl. merma técnica</p>
              </div>
            )}
          </div>
          {pctEvitable !== null && kgConMerma > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                <span>Evitable {pctEvitable.toFixed(1)}%</span>
                <span>Merma {(100 - pctEvitable).toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-amber-200 overflow-hidden flex">
                <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                  style={{ width: `${pctEvitable}%` }} />
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 text-center">
                Total (evitable + merma): <strong className="text-slate-600">{kgConMerma.toFixed(1)} kg</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Gráfico evolución 6 meses ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={15} className="text-brand-600" /> Evolución por zona
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector período */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {PERIOD_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setPeriod(key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    period === key ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {/* Toggle métrica */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {([['kg','kg'],['kgEstancia','kg/est.'],['kgComensal','kg/com.']] as [MetricKey,string][]).map(([k,l]) => (
                <button key={k} onClick={() => setMetric(k)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    metric === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {zonas.map((z, i) => (
              <Bar key={z.id} dataKey={z.nombre} fill={ZONE_COLORS[i % ZONE_COLORS.length]}
                radius={[3,3,0,0]} maxBarSize={28}
                opacity={activeZone && activeZone !== z.id ? 0.3 : 1} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Comparativa zonas por mes ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {/* Cabecera con selector de métrica y mes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Scale size={15} className="text-brand-600" /> Comparativa zonas
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector métrica */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {COMP_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setCompMetric(key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    compMetric === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {zoneComparativa.length === 0 ? (
          <p className="text-sm text-slate-300 text-center py-6">Sin datos para este mes.</p>
        ) : (
          <div className="space-y-4">
            {zoneComparativa.map(z => {
              const val   = getCompValue(z);
              const pct   = val != null ? (val / maxCompValue) * 100 : 0;
              const inside = pct >= 55;
              const label  = val != null ? compMetricLabel(val) : null;

              return (
                <div key={z.nombre}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                    <span className="text-xs font-semibold text-slate-600">{z.nombre}</span>
                  </div>
                  <div className="relative h-8 bg-slate-50 rounded-lg overflow-visible">
                    <div className="absolute inset-0 rounded-lg bg-slate-50" />
                    {pct > 0 && (
                      <div className="absolute top-0 left-0 h-full rounded-lg transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: z.color }} />
                    )}
                    {label && (
                      <div className="absolute top-0 h-full flex items-center"
                        style={{ left: `${Math.max(pct, 0)}%`, transform: inside ? 'translateX(-100%)' : 'translateX(4px)' }}>
                        <span className={`px-2.5 whitespace-nowrap text-[10px] font-bold ${
                          inside
                            ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]'
                            : 'text-slate-700'
                        }`}>
                          {label}
                        </span>
                      </div>
                    )}
                    {pct === 0 && (
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[10px] text-slate-300">Sin datos</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Línea de tendencia por zona (últimas 8 semanas) ── */}
      {zonas.length > 0 && (() => {
        const weeks: { label: string; from: string; to: string }[] = Array.from({length:8},(_,i)=>{
          const from = new Date(); from.setDate(from.getDate() - (7*(7-i)) - from.getDay() + 1);
          const to   = new Date(from); to.setDate(from.getDate() + 6);
          return {
            label: `S${i+1}`,
            from:  from.toISOString().split('T')[0],
            to:    to.toISOString().split('T')[0],
          };
        });

        const lineData = weeks.map(w => {
          const row: any = { semana: w.label };
          zonas.forEach(z => {
            const recs = registros.filter(r =>
              (r.area_id||r.areaId) === z.id && r.fecha >= w.from && r.fecha <= w.to
            );
            if (tendenciaMetric === 'kg') {
              const v = recs.reduce((s,r)=>s+r.kg,0);
              row[z.nombre] = v > 0 ? Math.round(v*10)/10 : null;
            } else if (tendenciaMetric === 'kgEstancia') {
              const con = recs.filter(r => (r as any).estancias > 0);
              row[z.nombre] = con.length > 0
                ? Math.round(con.reduce((s,r)=>s+r.kg/(r as any).estancias,0)/con.length*1000)/1000 : null;
            } else if (tendenciaMetric === 'kgComensal') {
              const con = recs.filter(r => (r as any).comensales > 0);
              row[z.nombre] = con.length > 0
                ? Math.round(con.reduce((s,r)=>s+r.kg/(r as any).comensales,0)/con.length*1000)/1000 : null;
            } else if (tendenciaMetric === 'coste') {
              const area = areas.find(a => a.id === z.id);
              const kg = recs.reduce((s,r)=>s+r.kg,0);
              row[z.nombre] = area?.costePorKg && kg > 0
                ? Math.round(kg * area.costePorKg) : null;
            }
          });
          return row;
        });

        const hasData = lineData.some(r => zonas.some(z => r[z.nombre] !== null));
        if (!hasData) return null;

        const tendUnit = tendenciaMetric === 'kg' ? ' kg'
          : tendenciaMetric === 'kgEstancia' ? ' kg/est.'
          : tendenciaMetric === 'kgComensal' ? ' kg/com.'
          : ' €';

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingDown size={15} className="text-brand-600" /> Tendencia semanal — últimas 8 semanas
              </h3>
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {COMP_OPTIONS.map(({ key, label }) => (
                  <button key={key} onClick={() => setTendenciaMetric(key)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      tendenciaMetric === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}${tendUnit}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {zonas.map((z, i) => (
                  <Line key={z.id} type="monotone" dataKey={z.nombre}
                    stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* ── Selector mes + métrica compartido para heatmap / dow / semanal ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Análisis detallado</span>
        {/* Toggle métrica */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {([['kg','kg totales'],['kgComensal','kg/comensal']] as ['kg'|'kgComensal', string][]).map(([k,l]) => (
            <button key={k} onClick={() => setDetailMetric(k)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                detailMetric === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Heatmap calendario + Día de semana (fila) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Heatmap calendario */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <CalendarDays size={15} className="text-brand-600" />
            Intensidad diaria — <span className="capitalize">{comparativaLabel}</span>
          </h3>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['L','M','X','J','V','S','D'].map(d => (
              <div key={d} className="text-center text-[9px] font-bold text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {heatmapData.cells.map((cell, i) => (
              <div key={i}
                title={cell.day
                  ? detailMetric === 'kgComensal'
                    ? `${cell.iso}: ${(cell as any).val?.toFixed(3) ?? '—'} kg/com`
                    : `${cell.iso}: ${cell.kg.toFixed(1)} kg`
                  : ''}
                className="aspect-square rounded-sm"
                style={{
                  background: cell.day == null ? 'transparent'
                    : (cell as any).val === 0 ? '#f1f5f9'
                    : `rgba(15,153,88,${0.15 + (cell.intensity || 0) * 0.85})`,
                }}>
                {cell.day && (
                  <span className="flex items-center justify-center h-full text-[8px] font-semibold"
                    style={{ color: (cell.intensity || 0) > 0.5 ? 'white' : '#475569' }}>
                    {cell.day}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] text-slate-400">0</span>
            <div className="flex gap-px flex-1">
              {[0.1,0.25,0.4,0.55,0.7,0.85,1].map(v => (
                <div key={v} className="flex-1 h-2 rounded-sm" style={{ background: `rgba(15,153,88,${0.15 + v * 0.85})` }}/>
              ))}
            </div>
            <span className="text-[9px] text-slate-400">
              {detailMetric === 'kgComensal'
                ? `${heatmapData.maxKg.toFixed(3)} kg/com`
                : `${heatmapData.maxKg.toFixed(1)} kg`}
            </span>
          </div>
        </div>

        {/* Barras por día de semana */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            <BarChart2 size={15} className="text-brand-600" />
            {detailMetric === 'kgComensal' ? 'kg/comensal' : 'kg promedio'} por día de semana
          </h3>
          <p className="text-[10px] text-slate-400 mb-4">
            {detailMetric === 'kgComensal'
              ? 'Ratio kg/comensal acumulado por día de semana'
              : 'Media de kg registrados en cada día de la semana'}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [
                  detailMetric === 'kgComensal' ? `${v.toFixed(3)} kg/com` : `${v.toFixed(1)} kg`,
                  detailMetric === 'kgComensal' ? 'kg/comensal' : 'Promedio/día'
                ]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="value" radius={[3,3,0,0]}>
                {dowData.map((entry, i) => {
                  const max = Math.max(...dowData.map(d => d.value));
                  return <Cell key={i} fill={entry.value === max ? '#0f9958' : '#86efac'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {dowData.length > 0 && (() => {
            const peak = dowData.reduce((a, b) => a.value > b.value ? a : b);
            return (
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Día pico: <span className="font-bold text-slate-700">{peak.day}</span>{' '}
                {detailMetric === 'kgComensal'
                  ? `${peak.value.toFixed(3)} kg/comensal`
                  : `${peak.value.toFixed(1)} kg/día de media`}
              </p>
            );
          })()}
        </div>
      </div>

      {/* ── Evolución semanal ── */}
      {weeklyData.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            <TrendingDown size={15} className="text-brand-600" /> Evolución semanal
          </h3>
          <p className="text-[10px] text-slate-400 mb-4">
            {detailMetric === 'kgComensal' ? 'kg/comensal' : 'Kg totales'} por semana ·
            Línea = media del mes ({detailMetric === 'kgComensal' ? weeklyAvg.toFixed(3) : weeklyAvg.toFixed(1)})
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [
                  detailMetric === 'kgComensal' ? `${v.toFixed(3)} kg/com` : `${v.toFixed(1)} kg`,
                  detailMetric === 'kgComensal' ? 'kg/comensal' : 'Kg semana'
                ]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {weeklyData.map((entry, i) => {
                  const diff = entry.value - weeklyAvg;
                  return <Cell key={i} fill={diff > weeklyAvg * 0.1 ? '#f97316' : diff < -weeklyAvg * 0.1 ? '#0f9958' : '#6366f1'} />;
                })}
              </Bar>
              <ReferenceLine y={weeklyAvg} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4"
                label={{ value: 'media', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block"/>Por debajo de la media
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-3 h-1.5 rounded-full bg-indigo-500 inline-block"/>En la media (±10%)
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-3 h-1.5 rounded-full bg-orange-500 inline-block"/>Por encima de la media
            </div>
          </div>
        </div>
      )}

      {/* ── Desglose por tipología de alimentos ── */}
      {(() => {
        const desgloseTotal: Record<string, number> = {};
        const desgloseByZone: Record<string, Record<string, number>> = {};

        thisMRecs.forEach(r => {
          const d = r.desglose_kg;
          if (!d) return;
          const zId = r.area_id || r.areaId || '';
          if (!desgloseByZone[zId]) desgloseByZone[zId] = {};
          Object.entries(d).forEach(([catId, kg]) => {
            desgloseTotal[catId] = (desgloseTotal[catId] || 0) + kg;
            desgloseByZone[zId][catId] = (desgloseByZone[zId][catId] || 0) + kg;
          });
        });

        const hasDesglose = Object.keys(desgloseTotal).length > 0;
        if (!hasDesglose) return null;

        const totalKgDesglose = Object.values(desgloseTotal).reduce((s, v) => s + v, 0);

        const stackedData = zonas.map((z, i) => {
          const row: Record<string, any> = { zona: z.nombre };
          FOOD_FLAT.forEach(item => { row[item.id] = desgloseByZone[z.id]?.[item.id] || 0; });
          return row;
        }).filter(row => FOOD_FLAT.some(item => row[item.id] > 0));

        const activeCats = FOOD_FLAT.filter(item => desgloseTotal[item.id] > 0)
          .sort((a, b) => desgloseTotal[b.id] - desgloseTotal[a.id]);

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <PieChart size={15} className="text-brand-600" />
              <span className="text-sm font-bold text-slate-700">Desglose por tipología de alimentos</span>
              <span className="ml-auto text-xs text-slate-400">{comparativaLabel}</span>
            </div>

            <div className="p-5 space-y-5">
              {/* Chips de totales */}
              <div className="flex flex-wrap gap-2">
                {activeCats.map(item => {
                  const kg = desgloseTotal[item.id];
                  const pct = totalKgDesglose > 0 ? (kg / totalKgDesglose) * 100 : 0;
                  const { Icon } = item;
                  return (
                    <div key={item.id}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold ${item.color}`}>
                      <Icon size={14} style={{ color: item.iconColor }} />
                      <span>{item.label}</span>
                      <span className="font-black ml-1">{kg.toFixed(1)} kg</span>
                      <span className="text-[10px] opacity-60">({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>


              {/* Barras apiladas por zona */}
              {stackedData.length > 1 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Desglose por zona</p>
                  <ResponsiveContainer width="100%" height={stackedData.length * 52 + 20}>
                    <BarChart data={stackedData} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="zona" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip formatter={(value: number, name: string) => {
                        const cat = FOOD_FLAT.find(f => f.id === name);
                        return [`${value.toFixed(1)} kg`, cat?.label || name];
                      }} />
                      {activeCats.map(item => (
                        <Bar key={item.id} dataKey={item.id} stackId="a" fill={item.iconColor} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );

  return content;
};
