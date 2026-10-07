import React, { useState, useMemo } from 'react';
import { MeasurementConfig, KPIData, MetodologiaMedicion, Area, HotelData } from '../types';
import type { PesajeRow } from '../services/pesajesService';
import { Scale, FileBarChart, RefreshCw, Clock, User, Plus, Trash2, X,
         ChevronDown, ChevronUp, Cpu, CalendarRange, Eye, CheckSquare, Square,
         TrendingDown, TrendingUp, Minus, BarChart2, Building2,
         CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { MonthlyReport } from './MonthlyReport';
import { KPI_CATALOG, KPI_IA_EXTRA } from '../constants';
import { MeasurementChart } from './MeasurementChart';
import { FOOD_TAXONOMY } from './Forms';

const FOOD_MAP = Object.fromEntries(
  FOOD_TAXONOMY.flatMap(g => g.items.map(item => [item.id, item]))
);

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── ZoneRow — componente separado para poder usar useState por fila ────────────
interface ZoneRowProps {
  area: Area;
  hotel: string | null;
  thisMonthKg: number;
  prevMonthKg: number;
  totalDays: number;
  trend: number | null;
  relPor: string | undefined;
  avgKgEstancia: number | null;
  avgKgComensal: number | null;
  costeTotal: number | null;
  desgloseKgMes: Record<string, number>;
}

const ZoneRow: React.FC<ZoneRowProps> = ({
  area, hotel, thisMonthKg, totalDays, trend, relPor,
  avgKgEstancia, avgKgComensal, costeTotal, desgloseKgMes,
}) => {
  const [showDesglose, setShowDesglose] = useState(false);
  const hasDesglose = Object.keys(desgloseKgMes).length > 0;
  const fmtKg = (kg: number) => kg > 0 ? `${kg.toFixed(1)} kg` : '—';

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div className="px-6 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50 transition-colors">
        {/* Zona */}
        <div className="col-span-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${thisMonthKg > 0 ? 'bg-brand-500' : 'bg-slate-200'}`} />
            <span className="text-xs font-semibold text-slate-700 truncate">{area.nombre}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-4 flex-wrap">
            {hotel && <span className="text-[9px] text-slate-400">{hotel}</span>}
            <span className="text-[9px] text-slate-300">{totalDays} días</span>
            {hasDesglose && (
              <button type="button" onClick={() => setShowDesglose(v => !v)}
                className="text-[9px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5">
                {showDesglose ? 'ocultar' : 'ver desglose'}
                <ChevronDown size={9} className={`transition-transform ${showDesglose ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
        {/* Total mes */}
        <div className="col-span-2 text-right">
          <span className={`text-sm font-bold ${thisMonthKg > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
            {fmtKg(thisMonthKg)}
          </span>
        </div>
        {/* kg/estancia */}
        <div className="col-span-2 text-right">
          {avgKgEstancia !== null ? (
            <div>
              <span className="text-sm font-bold text-brand-600">{avgKgEstancia.toFixed(3)}</span>
              <span className="text-[9px] text-slate-400 block">kg/est.</span>
            </div>
          ) : <span className="text-[10px] text-slate-200">—</span>}
        </div>
        {/* kg/comensal */}
        <div className="col-span-2 text-right">
          {avgKgComensal !== null ? (
            <div>
              <span className="text-sm font-bold text-brand-600">{avgKgComensal.toFixed(3)}</span>
              <span className="text-[9px] text-slate-400 block">kg/com.</span>
            </div>
          ) : <span className="text-[10px] text-slate-200">—</span>}
        </div>
        {/* Coste mes */}
        <div className="col-span-2 text-right">
          {costeTotal != null ? (
            <div>
              <span className="text-sm font-bold text-slate-800">
                {costeTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </span>
              <span className="text-[9px] text-slate-400 block">{area.costePorKg} €/kg</span>
            </div>
          ) : <span className="text-[10px] text-slate-200">—</span>}
        </div>
        {/* Tendencia */}
        <div className="col-span-1 flex justify-end">
          {trend === null ? (
            <span className="text-[10px] text-slate-300">—</span>
          ) : (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              trend < -2 ? 'bg-green-50 text-green-700' : trend > 2 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {trend < -2 ? <TrendingDown size={10}/> : trend > 2 ? <TrendingUp size={10}/> : <Minus size={10}/>}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Desglose expandible */}
      {hasDesglose && showDesglose && (
        <div className="px-6 pb-3 bg-slate-50/60">
          <div className="flex flex-wrap gap-2 pt-2">
            {FOOD_TAXONOMY.flatMap(g => g.items)
              .filter(item => desgloseKgMes[item.id] > 0)
              .sort((a, b) => (desgloseKgMes[b.id] || 0) - (desgloseKgMes[a.id] || 0))
              .map(item => {
                const kgCat = desgloseKgMes[item.id];
                const pct = thisMonthKg > 0 ? (kgCat / thisMonthKg) * 100 : 0;
                const { Icon } = item;
                return (
                  <div key={item.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold ${item.color}`}>
                    <Icon size={11} style={{ color: item.iconColor }} />
                    <span>{item.label}</span>
                    <span className="font-black">{kgCat.toFixed(1)} kg</span>
                    <span className="opacity-60">({pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
          </div>
          {thisMonthKg > 0 && (
            <div className="mt-2.5 flex rounded-full overflow-hidden h-2 gap-px">
              {FOOD_TAXONOMY.flatMap(g => g.items)
                .filter(item => desgloseKgMes[item.id] > 0)
                .sort((a, b) => (desgloseKgMes[b.id] || 0) - (desgloseKgMes[a.id] || 0))
                .map(item => (
                  <div key={item.id}
                    title={`${item.label}: ${desgloseKgMes[item.id].toFixed(1)} kg`}
                    style={{
                      width: `${(desgloseKgMes[item.id] / thisMonthKg) * 100}%`,
                      backgroundColor: item.iconColor,
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MeasurementFormProps {
  config: MeasurementConfig;
  setConfig: (config: MeasurementConfig) => void;
  registros?: PesajeRow[];  // pesajes de Supabase
  areas?: Area[];
  hotels?: HotelData[];
  scope?: string;
}

const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 text-xs shadow-sm transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 focus:outline-none placeholder:text-slate-400 font-bold";
const labelClass = "text-[9px] uppercase tracking-[0.1em] font-black text-slate-500 ml-1";

const MODULOS_IA = ['Desayuno', 'Almuerzo', 'Cena', 'Cocina', 'Almacén', 'Room Service'];
const CATEGORIAS_PESAJE = ['Desperdicio Buffet', 'Mermas cocina', 'Restos de plato', 'Caducidades/almacén', 'Comedor personal'];

type MetodoTipo = 'bascula' | 'ia' | 'p1' | 'p3';

const METODOS: { tipo: MetodoTipo; label: string; sub: string; Icon: React.ElementType; color: string; iconBox: string; border: string; borderSel: string; bg: string }[] = [
  {
    tipo: 'bascula', label: 'Báscula manual', sub: 'Pesaje diario por categoría y servicio',
    Icon: Scale,
    color: 'text-sky-700', iconBox: 'bg-sky-100 text-sky-600',
    border: 'border-slate-200', borderSel: 'border-sky-400 ring-1 ring-sky-200', bg: 'bg-sky-50/40',
  },
  {
    tipo: 'ia', label: 'Sistema IA', sub: 'Winnow · Efiwaste · reconocimiento automático',
    Icon: Cpu,
    color: 'text-violet-700', iconBox: 'bg-violet-100 text-violet-600',
    border: 'border-slate-200', borderSel: 'border-violet-400 ring-1 ring-violet-200', bg: 'bg-violet-50/40',
  },
  {
    tipo: 'p1', label: 'Campañas de pesaje (P1)', sub: 'Auditoría intensiva estacional + ratio Kg/comensal',
    Icon: CalendarRange,
    color: 'text-amber-700', iconBox: 'bg-amber-100 text-amber-600',
    border: 'border-slate-200', borderSel: 'border-amber-400 ring-1 ring-amber-200', bg: 'bg-amber-50/40',
  },
  {
    tipo: 'p3', label: 'Estimación volumétrica (P3)', sub: 'Cubo calibrado + registro visual diario',
    Icon: Eye,
    color: 'text-teal-700', iconBox: 'bg-teal-100 text-teal-600',
    border: 'border-slate-200', borderSel: 'border-teal-400 ring-1 ring-teal-200', bg: 'bg-teal-50/40',
  },
];

export const MeasurementForm: React.FC<MeasurementFormProps> = ({
  config, setConfig, registros = [], areas = [], hotels = [], scope = 'individual'
}) => {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [customKpiName, setCustomKpiName] = useState('');
  const [collapsedKpis, setCollapsedKpis] = useState<Set<string>>(new Set());
  const [selectedKPIHotel, setSelectedKPIHotel] = useState('');
  const [collapsedHotels, setCollapsedHotels] = useState<Set<string>>(new Set());

  const toggleHotel = (name: string) =>
    setCollapsedHotels(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const todayYM = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [comparativaMonth, setComparativaMonth] = useState(todayYM);
  const [showReport, setShowReport] = useState(false);

  const comparativaLabel = useMemo(() => {
    const [y, m] = comparativaMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const mes = d.toLocaleDateString('es-ES', { month: 'long' });
    return comparativaMonth === todayYM ? `${mes} ${y}` : `${mes} ${y}`;
  }, [comparativaMonth, todayYM]);

  // ── Zonas con punto de pesaje (báscula, P1, P3) ──────────────────────────
  const pesajeZones = useMemo(() => {
    const result: { area: Area; hotel: string }[] = [];
    if (scope === 'corporate') {
      hotels.forEach(h => (h.areas || []).forEach(a => {
        if (a.tienePuntoPesaje && a.tipoSistemaPesaje && !a.tipoSistemaPesaje.includes('IA'))
          result.push({ area: a, hotel: h.nombreComercial });
      }));
    } else {
      areas.forEach(a => {
        if (a.tienePuntoPesaje && a.tipoSistemaPesaje && !a.tipoSistemaPesaje.includes('IA'))
          result.push({ area: a, hotel: '' });
      });
    }
    return result;
  }, [areas, hotels, scope]);

  // ── Agregados por zona ───────────────────────────────────────────────────
  const prevComparativaMonth = useMemo(() => shiftMonth(comparativaMonth, -1), [comparativaMonth]);

  const zoneStats = useMemo(() => pesajeZones.map(({ area, hotel }) => {
    const zoneRegs     = registros.filter(r => (r as any).area_id === area.id || (r as any).areaId === area.id);
    const thisRegs     = zoneRegs.filter(r => r.fecha.startsWith(comparativaMonth));
    const prevRegs     = zoneRegs.filter(r => r.fecha.startsWith(prevComparativaMonth));
    const thisMonthKg  = thisRegs.reduce((s, r) => s + r.kg, 0);
    const prevMonthKg  = prevRegs.reduce((s, r) => s + r.kg, 0);
    const totalDays    = new Set(thisRegs.map(r => r.fecha)).size;
    const trend        = prevMonthKg > 0 ? ((thisMonthKg - prevMonthKg) / prevMonthKg) * 100 : null;
    const relPor       = area.medicion?.relativizarPor;

    // Ratios relativizados — promedio del mes hasta la fecha
    const conEst = thisRegs.filter(r => (r as any).estancias > 0);
    const conCom = thisRegs.filter(r => (r as any).comensales > 0);
    const avgKgEstancia = conEst.length > 0
      ? conEst.reduce((s, r) => s + r.kg / (r as any).estancias, 0) / conEst.length
      : null;
    const avgKgComensal = conCom.length > 0
      ? conCom.reduce((s, r) => s + r.kg / (r as any).comensales, 0) / conCom.length
      : null;

    const costeTotal = area.costePorKg != null && thisMonthKg > 0
      ? thisMonthKg * area.costePorKg : null;

    // Desglose mensual por categoría de alimento (suma de todos los días del mes)
    const desgloseKgMes: Record<string, number> = {};
    thisRegs.forEach(r => {
      const d = (r as any).desglose_kg as Record<string, number> | undefined;
      if (d) {
        Object.entries(d).forEach(([catId, kg]) => {
          desgloseKgMes[catId] = (desgloseKgMes[catId] || 0) + kg;
        });
      }
    });

    return { area, hotel, thisMonthKg, prevMonthKg, totalDays, trend, relPor, avgKgEstancia, avgKgComensal, costeTotal, desgloseKgMes };
  }), [pesajeZones, registros, comparativaMonth, prevComparativaMonth]);

  const zonesByHotel = useMemo(() => {
    if (scope !== 'corporate') return [];
    const order: string[] = [];
    const map: Record<string, typeof zoneStats> = {};
    zoneStats.forEach(z => {
      const key = z.hotel || 'Sin Hotel';
      if (!map[key]) { order.push(key); map[key] = []; }
      map[key].push(z);
    });
    return order.map(k => ({ hotelName: k, zones: map[k] }));
  }, [zoneStats, scope]);

  const met: MetodologiaMedicion = config.metodologia ?? { tipo: 'bascula', responsable: '' };

  const setMet = (patch: Partial<MetodologiaMedicion>) =>
    setConfig({ ...config, metodologia: { ...met, ...patch } });

  const selectTipo = (tipo: MetodoTipo) => {
    // Reset type-specific fields when switching
    setConfig({
      ...config,
      metodologia: { tipo, responsable: met.responsable ?? '' },
    });
  };

  const toggleModuloIA = (m: string) => {
    const cur = met.modulosIA ?? [];
    setMet({ modulosIA: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] });
  };

  const toggleCategoriaPesaje = (c: string) => {
    const cur = met.categoriasPesaje ?? [];
    setMet({ categoriasPesaje: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] });
  };

  // KPIs
  const updateKPI = (id: string, field: 'frecuencia' | 'responsable' | 'lineaBase', value: string) =>
    setConfig({ ...config, kpis: config.kpis.map(k => k.id === id ? { ...k, [field]: value } : k) });

  const removeKPI = (id: string) =>
    setConfig({ ...config, kpis: config.kpis.filter(k => k.id !== id) });

  // ─── KPIs por hotel (corporativo) ──────────────────────────────────────
  const getHotelKPIs = (hotelName: string): KPIData[] =>
    config.kpisPorHotel?.[hotelName] ?? config.kpis;

  const setHotelKPIs = (hotelName: string, kpis: KPIData[]) =>
    setConfig({ ...config, kpisPorHotel: { ...config.kpisPorHotel, [hotelName]: kpis } });

  const updateHotelKPI = (hotelName: string, id: string, field: 'frecuencia' | 'responsable' | 'lineaBase', value: string) =>
    setHotelKPIs(hotelName, getHotelKPIs(hotelName).map(k => k.id === id ? { ...k, [field]: value } : k));

  const removeHotelKPI = (hotelName: string, id: string) =>
    setHotelKPIs(hotelName, getHotelKPIs(hotelName).filter(k => k.id !== id));

  const addKPIToHotel = (hotelName: string, item: { id: string; nombre: string; frecuencia: string; responsable: string }) => {
    const existing = getHotelKPIs(hotelName);
    if (existing.find(k => k.id === item.id)) return;
    setHotelKPIs(hotelName, [...existing, { id: item.id, nombre: item.nombre, selected: true, frecuencia: item.frecuencia, responsable: item.responsable, lineaBase: '' }]);
  };

  const addFromCatalog = (item: { id: string; nombre: string; frecuencia: string; responsable: string }) => {
    if (config.kpis.find(k => k.id === item.id)) return;
    const newKpi: KPIData = { id: item.id, nombre: item.nombre, selected: true, frecuencia: item.frecuencia, responsable: item.responsable, lineaBase: '' };
    setConfig({ ...config, kpis: [...config.kpis, newKpi] });
  };

  const addCustomKPI = () => {
    const nombre = customKpiName.trim();
    if (!nombre) return;
    const newKpi: KPIData = { id: `kpi_custom_${Date.now()}`, nombre, selected: true, frecuencia: '', responsable: '', lineaBase: '' };
    setConfig({ ...config, kpis: [...config.kpis, newKpi] });
    setCustomKpiName('');
  };

  const toggleCollapse = (id: string) =>
    setCollapsedKpis(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const updateReporting = (field: 'frecuencia' | 'responsable', value: string) =>
    setConfig({ ...config, reporting: { ...config.reporting, [field]: value } });

  const updateReview = (field: 'frecuencia' | 'responsable', value: string) =>
    setConfig({ ...config, annualReview: { ...config.annualReview, [field]: value } });

  const isIA = met.tipo === 'ia';
  const availableCatalog = KPI_CATALOG.filter(c => !config.kpis.find(k => k.id === c.id));
  const availableIAExtra = KPI_IA_EXTRA.filter(c => !config.kpis.find(k => k.id === c.id));
  const selectedMetodo = METODOS.find(m => m.tipo === met.tipo)!;

  const fmtKg = (kg: number) => kg > 0 ? `${kg.toFixed(1)} kg` : '—';

  return (
    <>
    <div className="space-y-6 animate-in fade-in">

      {/* ── Navegador de mes global ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3">
        <CalendarDays size={14} className="text-brand-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Mes analizado</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button type="button" onClick={() => setComparativaMonth(m => shiftMonth(m, -1))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[130px] text-center capitalize">
            {comparativaLabel}
          </span>
          <button type="button"
            onClick={() => { if (comparativaMonth < todayYM) setComparativaMonth(m => shiftMonth(m, 1)); }}
            disabled={comparativaMonth >= todayYM}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-default">
            <ChevronRight size={14} />
          </button>
        </div>
        <button type="button" onClick={() => setShowReport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[11px] font-bold hover:bg-brand-100 transition-colors flex-shrink-0">
          <FileText size={13} /> Informe PDF
        </button>
      </div>

      {/* ── SECCIÓN 0: RESULTADOS DE MEDICIÓN ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <BarChart2 size={16} className="text-brand-600" /> Resultados de Medición
          </h3>
          <span className="text-[10px] text-slate-400 font-medium capitalize">
            {comparativaLabel}
          </span>
        </div>

        {pesajeZones.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400">
            <Scale size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Sin puntos de pesaje configurados.</p>
            <p className="text-xs mt-1">Ve al paso de Zonas y configura los puntos de medición.</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400">
            <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Aún no hay registros de pesaje introducidos.</p>
            <p className="text-xs mt-1">Los resultados aparecerán aquí una vez el equipo introduzca los datos diarios.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Cabecera */}
            <div className="px-6 py-2 bg-slate-50 grid grid-cols-12 gap-2">
              <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Zona</span>
              <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Total mes</span>
              <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">kg/estancia</span>
              <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">kg/comensal</span>
              <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Coste mes</span>
              <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Tend.</span>
            </div>

            {scope === 'corporate' ? (
              <>
                {zonesByHotel.map(({ hotelName, zones }) => {
                  const isCollapsed = collapsedHotels.has(hotelName);
                  const hotelTotal = zones.reduce((s, z) => s + z.thisMonthKg, 0);
                  const hasCoste = zones.some(z => z.costeTotal != null);
                  const hotelCoste = hasCoste ? zones.reduce((s, z) => s + (z.costeTotal ?? 0), 0) : null;
                  return (
                    <div key={hotelName}>
                      <button type="button" onClick={() => toggleHotel(hotelName)}
                        className="w-full px-6 py-2.5 bg-brand-50/70 flex items-center gap-2 hover:bg-brand-50 transition-colors border-b border-brand-100">
                        {isCollapsed
                          ? <ChevronDown size={13} className="text-brand-500 flex-shrink-0" />
                          : <ChevronUp size={13} className="text-brand-500 flex-shrink-0" />}
                        <Building2 size={13} className="text-brand-600 flex-shrink-0" />
                        <span className="text-[11px] font-black text-brand-900 uppercase tracking-wide truncate">{hotelName}</span>
                        <div className="ml-auto flex items-center gap-5 flex-shrink-0">
                          <span className="text-xs font-black text-slate-700">{fmtKg(hotelTotal)}</span>
                          {hotelCoste != null && (
                            <span className="text-xs font-bold text-slate-500">
                              {hotelCoste.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">{zones.length} zona{zones.length !== 1 ? 's' : ''}</span>
                        </div>
                      </button>
                      {!isCollapsed && zones.map(z => <ZoneRow key={z.area.id} {...z} hotel={null} />)}
                    </div>
                  );
                })}
                {/* Total global */}
                {zoneStats.length > 0 && (
                  <div className="px-6 py-3 bg-slate-100 grid grid-cols-12 gap-3 items-center border-t-2 border-slate-300">
                    <div className="col-span-3"><span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Total global</span></div>
                    <div className="col-span-2 text-right"><span className="text-sm font-black text-slate-800">{fmtKg(zoneStats.reduce((s, z) => s + z.thisMonthKg, 0))}</span></div>
                    <div className="col-span-4" />
                    <div className="col-span-2 text-right">
                      {zoneStats.some(z => z.costeTotal != null) && (
                        <span className="text-sm font-black text-slate-800">
                          {zoneStats.reduce((s, z) => s + (z.costeTotal ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                        </span>
                      )}
                    </div>
                    <div className="col-span-1" />
                  </div>
                )}
              </>
            ) : (
              <>
                {zoneStats.map(z => (
                  <ZoneRow key={z.area.id} {...z} />
                ))}
                {zoneStats.length > 1 && (
                  <div className="px-6 py-3 bg-slate-50 grid grid-cols-12 gap-3 items-center border-t border-slate-200">
                    <div className="col-span-3"><span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Total plan</span></div>
                    <div className="col-span-2 text-right"><span className="text-sm font-black text-slate-800">{fmtKg(zoneStats.reduce((s,z) => s + z.thisMonthKg, 0))}</span></div>
                    <div className="col-span-4" />
                    <div className="col-span-2 text-right">
                      {zoneStats.some(z => z.costeTotal != null) && (
                        <span className="text-sm font-black text-slate-800">
                          {zoneStats.reduce((s,z) => s + (z.costeTotal ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                        </span>
                      )}
                    </div>
                    <div className="col-span-1" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 1: ANALYTICS ── */}
      <MeasurementChart
        registros={registros}
        areas={areas}
        hotels={hotels}
        scope={scope}
        comparativaMonth={comparativaMonth}
      />

      {/* ── SECCIÓN 2: KPIs por Hotel (corporativo) ── */}
      {scope === 'corporate' && hotels.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <Scale size={16} className="text-brand-600" /> Indicadores Clave (KPIs) por Hotel
          </h3>

          {/* Pestañas de hotel */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hotels.map(h => (
              <button
                key={h.nombreComercial}
                type="button"
                onClick={() => setSelectedKPIHotel(prev => prev === h.nombreComercial ? '' : h.nombreComercial)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedKPIHotel === h.nombreComercial
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {h.nombreComercial}
              </button>
            ))}
          </div>

          {selectedKPIHotel ? (() => {
            const hotelKPIs = getHotelKPIs(selectedKPIHotel);
            const catalogLeft = [...KPI_CATALOG, ...KPI_IA_EXTRA].filter(c => !hotelKPIs.find(k => k.id === c.id));
            return (
              <div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-black text-slate-500 text-[10px] uppercase tracking-wider">KPI</th>
                        <th className="text-left px-3 py-2 font-black text-slate-500 text-[10px] uppercase tracking-wider w-28">Frecuencia</th>
                        <th className="text-left px-3 py-2 font-black text-slate-500 text-[10px] uppercase tracking-wider w-36">Responsable</th>
                        <th className="text-left px-3 py-2 font-black text-slate-500 text-[10px] uppercase tracking-wider w-28">Línea Base</th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {hotelKPIs.map((kpi, i) => (
                        <tr key={kpi.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-3 py-2 font-bold text-slate-800 border-b border-slate-100">{kpi.nombre}</td>
                          <td className="px-2 py-1.5 border-b border-slate-100">
                            <input type="text" value={kpi.frecuencia}
                              onChange={e => updateHotelKPI(selectedKPIHotel, kpi.id, 'frecuencia', e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-brand-400 focus:outline-none bg-white"
                              placeholder="Mensual" />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-100">
                            <input type="text" value={kpi.responsable}
                              onChange={e => updateHotelKPI(selectedKPIHotel, kpi.id, 'responsable', e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-brand-400 focus:outline-none bg-white"
                              placeholder="Responsable" />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-100">
                            <input type="text" value={kpi.lineaBase || ''}
                              onChange={e => updateHotelKPI(selectedKPIHotel, kpi.id, 'lineaBase', e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-brand-400 focus:outline-none bg-white"
                              placeholder="Valor actual" />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-100 text-center">
                            <button type="button" onClick={() => removeHotelKPI(selectedKPIHotel, kpi.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {hotelKPIs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400 italic">
                            No hay KPIs. Añade desde el catálogo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {catalogLeft.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Añadir del catálogo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {catalogLeft.map(item => (
                        <button key={item.id} type="button" onClick={() => addKPIToHotel(selectedKPIHotel, item)}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 font-bold transition-all flex items-center gap-1">
                          <Plus size={10} /> {item.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <p className="text-center text-xs text-slate-400 py-4 italic">Selecciona un hotel para editar sus KPIs</p>
          )}
        </div>
      )}

      {/* ── SECCIÓN 2 (oculta): KPIs legacy — mantenemos datos pero no mostramos UI ── */}
      {false && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Scale size={16} className="text-brand-600" /> Indicadores Clave (KPIs)
          </h3>
          <span className="text-[10px] font-bold text-slate-400">{config.kpis.length} activo{config.kpis.length !== 1 ? 's' : ''}</span>
        </div>

        {/* KPI activos */}
        <div className="space-y-3 mb-4">
          {config.kpis.map(kpi => {
            const isCollapsed = collapsedKpis.has(kpi.id);
            return (
              <div key={kpi.id} className="rounded-xl border border-brand-200 bg-brand-50/20 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-slate-800">{kpi.nombre}</span>
                  </div>
                  <button type="button" onClick={() => toggleCollapse(kpi.id)} className="text-slate-400 hover:text-slate-600 p-1">
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  <button type="button" onClick={() => removeKPI(kpi.id)} className="text-slate-300 hover:text-red-400 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className={labelClass}>Frecuencia</span>
                      <div className="relative">
                        <Clock size={12} className="absolute top-[calc(0.375rem+4px)] left-2.5 text-slate-400" />
                        <input type="text" value={kpi.frecuencia} onChange={e => updateKPI(kpi.id, 'frecuencia', e.target.value)}
                          className={`${inputClass} pl-8`} placeholder="Ej: Mensual" />
                      </div>
                    </label>
                    <label className="block">
                      <span className={labelClass}>Responsable</span>
                      <div className="relative">
                        <User size={12} className="absolute top-[calc(0.375rem+4px)] left-2.5 text-slate-400" />
                        <input type="text" value={kpi.responsable} onChange={e => updateKPI(kpi.id, 'responsable', e.target.value)}
                          className={`${inputClass} pl-8`} placeholder="Ej: Jefe de Cocina" />
                      </div>
                    </label>
                    <label className="block">
                      <span className={labelClass}>Línea Base</span>
                      <input type="text" value={kpi.lineaBase || ''} onChange={e => updateKPI(kpi.id, 'lineaBase', e.target.value)}
                        className={inputClass} placeholder="Valor actual" />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {config.kpis.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6 italic">No hay KPIs activos. Añade al menos uno.</p>
          )}
        </div>

        {/* Panel añadir */}
        {showAddPanel ? (
          <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">Añadir KPI</span>
              <button type="button" onClick={() => { setShowAddPanel(false); setCustomKpiName(''); }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </div>

            {availableCatalog.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Del catálogo</p>
                <div className="flex flex-wrap gap-2">
                  {availableCatalog.map(item => (
                    <button key={item.id} type="button" onClick={() => addFromCatalog(item)}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-all flex items-center gap-1.5">
                      <Plus size={10} /> {item.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs exclusivos IA */}
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Cpu size={10} /> Exclusivos Sistema IA
              </p>
              <div className="flex flex-wrap gap-2">
                {KPI_IA_EXTRA.map(item => {
                  const alreadyAdded = !!config.kpis.find(k => k.id === item.id);
                  const locked = !isIA;
                  return (
                    <button key={item.id} type="button"
                      disabled={locked || alreadyAdded}
                      onClick={() => !locked && !alreadyAdded && addFromCatalog(item)}
                      title={locked ? 'Requiere Sistema IA seleccionado' : alreadyAdded ? 'Ya añadido' : ''}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                        locked ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' :
                        alreadyAdded ? 'border-violet-200 bg-violet-50 text-violet-400 cursor-default' :
                        'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400 hover:bg-violet-100'
                      }`}>
                      <Cpu size={10} /> {item.nombre}
                      {locked && <span className="text-[8px] bg-slate-200 text-slate-400 px-1 rounded font-black">Requiere IA</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI personalizado */}
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">KPI personalizado</p>
              <div className="flex gap-2">
                <input type="text" value={customKpiName} onChange={e => setCustomKpiName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomKPI()}
                  placeholder="Nombre del indicador..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-brand-500 focus:outline-none placeholder:text-slate-400" />
                <button type="button" onClick={addCustomKPI} disabled={!customKpiName.trim()}
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 disabled:opacity-40 transition-colors">
                  Añadir
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAddPanel(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all">
            <Plus size={13} /> Nuevo KPI
          </button>
        )}
      </div>}

      {/* ── REPORTING + REVISIÓN ANUAL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileBarChart size={16} className="text-brand-600" /> Reporting a Dirección
          </h3>
          <div className="space-y-4 flex-1">
            <p className="text-xs text-slate-500 font-medium">Definición de informes internos para la toma de decisiones basada en datos.</p>
            <label className="block">
              <span className={labelClass}>Frecuencia del Informe</span>
              <input type="text" value={config.reporting.frecuencia} onChange={e => updateReporting('frecuencia', e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Responsable Elaboración</span>
              <input type="text" value={config.reporting.responsable} onChange={e => updateReporting('responsable', e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
            <RefreshCw size={16} className="text-brand-600" /> Revisión Anual del Plan
          </h3>
          <div className="space-y-4 flex-1">
            <p className="text-xs text-slate-500 leading-relaxed">
              Establecer frecuencia de revisión del plan, estrategia y seguimiento de objetivos.
            </p>
            <label className="block">
              <span className={labelClass}>Frecuencia Revisión</span>
              <input type="text" value={config.annualReview.frecuencia} onChange={e => updateReview('frecuencia', e.target.value)} className={inputClass} disabled />
            </label>
            <label className="block">
              <span className={labelClass}>Responsable Aprobación</span>
              <input type="text" value={config.annualReview.responsable} onChange={e => updateReview('responsable', e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>
      </div>

    </div>

    {showReport && (
      <MonthlyReport
        registros={registros}
        areas={areas}
        hotelNombre={hotels[0]?.nombreComercial || ''}
        month={comparativaMonth}
        onClose={() => setShowReport(false)}
      />
    )}
    </>
  );
};
