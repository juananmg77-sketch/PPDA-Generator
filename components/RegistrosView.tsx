import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, Area } from '../types';
import { pesajesService, ocupacionService, PesajeRow, OcupacionRow } from '../services/pesajesService';
import { FOOD_TAXONOMY } from './Forms';
import {
  ArrowLeft, Scale, Check, ChevronLeft, ChevronRight,
  Save, RefreshCw, CheckCircle2, ChevronDown
} from 'lucide-react';

interface Props {
  planId: string;
  hotelNombre: string;
  planData: AppState;
  currentUser: string;
  onBack: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return {
    dow:  d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3),
    num:  d.getDate(),
    full: d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

const DOW_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Genera la cuadrícula del mes (con nulos para celdas vacías de inicio/fin)
function getMonthGrid(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 0=lun
  const totalDays = lastDay.getDate();
  const cells: (string | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  // Rellenar hasta múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoMonth(iso: string) { return iso.slice(0, 7); }

function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${y}`;
}

// ── Zonas con pesaje (báscula, P1, P3, IA) ───────────────────────────────────

function getZonasConPesaje(planData: AppState, hotelNombre: string): Area[] {
  if (planData.scope === 'corporate') {
    const hotel = (planData.hotels || []).find(h => h.nombreComercial === hotelNombre);
    return (hotel?.areas || []).filter(a => a.tienePuntoPesaje);
  }
  return (planData.areas || []).filter(a => a.tienePuntoPesaje);
}

// ── Bottom sheet de entrada ──────────────────────────────────────────────────

const ATAJOS = [5, 10, 15, 20, 25, 30];

// Construye un mapa plano id→CatDef a partir de la taxonomía
const FOOD_MAP = Object.fromEntries(
  FOOD_TAXONOMY.flatMap(g => g.items.map(item => [item.id, item]))
);

interface SheetProps {
  area: Area;
  existing: PesajeRow | null;
  ocupacion: OcupacionRow | null;
  onConfirm: (kg: number, estancias: number | null, comensales: number | null, desglose: Record<string, number> | undefined) => void;
  onClose: () => void;
  saving: boolean;
}

const EntrySheet: React.FC<SheetProps> = ({ area, existing, ocupacion, onConfirm, onClose, saving }) => {
  const isP1        = area.tipoSistemaPesaje?.includes('P1') ?? false;
  const usesDesglose = !isP1 && (area.categoriasAlimentos?.length ?? 0) > 0;

  // Ratio kg/comensal de la campaña (auto-calculado si hay datos de campaña)
  const campanaRatio = (() => {
    if (!isP1) return null;
    const med = area.medicion || {};
    const kgDia = parseFloat((med.kgDiaCampana || '').replace(',', '.'));
    const durMap: Record<string, number> = { '3-5 días': 4, '1 semana': 7, '2 semanas': 14 };
    const dias = durMap[med.duracionCampana || ''] ?? NaN;
    const comTotal = parseFloat((med.comensalesCampana || '').replace(/\./g, '').replace(',', '.'));
    if (!isNaN(kgDia) && !isNaN(dias) && comTotal > 0) return kgDia * dias / comTotal;
    return null;
  })();

  // Estado para modo desglose: Record<catId, string> para inputs
  const initDesglose = (): Record<string, string> => {
    const existingD = existing?.desglose_kg || {};
    const cats = area.categoriasAlimentos || [];
    return Object.fromEntries(cats.map(id => [id, existingD[id]?.toString() || '']));
  };

  const [desglose, setDesglose]     = useState<Record<string, string>>(initDesglose);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Modo simple (sin desglose)
  const [kg, setKg] = useState(() => {
    if (isP1 || usesDesglose) return '';
    return existing?.kg?.toString() || '';
  });

  const [estancias, setEstancias] = useState(
    (existing?.estancias ?? ocupacion?.estancias ?? '')?.toString() || ''
  );
  const [comensales, setComensales] = useState(
    (existing?.comensales ?? '')?.toString() || ''
  );

  const rel    = area.medicion?.relativizarPor;
  const estNum = parseInt(estancias) || 0;
  const comNum = parseInt(comensales) || 0;

  // En P1: kg se calcula automáticamente si hay ratio, sino se edita manualmente
  const [kgManual, setKgManual] = useState(() => existing?.kg?.toString() || '');
  const kgP1 = campanaRatio && comNum > 0 ? comNum * campanaRatio : parseFloat(kgManual) || 0;

  // Total kg
  const totalKg = isP1
    ? kgP1
    : usesDesglose
      ? Object.values(desglose).reduce((s, v) => s + (parseFloat(v) || 0), 0)
      : parseFloat(kg) || 0;

  const ratioEst = estNum > 0 && totalKg > 0 ? (totalKg / estNum).toFixed(3) : null;
  const ratioCom = comNum > 0 && totalKg > 0 ? (totalKg / comNum).toFixed(3) : null;

  const canConfirm = isP1 ? comNum > 0 : (existing != null || totalKg > 0);

  const handleConfirm = () => {
    const desgloseNums = usesDesglose
      ? Object.fromEntries(
          Object.entries(desglose)
            .map(([k, v]) => [k, parseFloat(v) || 0])
            .filter(([, v]) => (v as number) > 0)
        )
      : undefined;
    // P1: siempre guarda comensales; kg = calculado o manual
    const comFinal = comensales.trim() !== '' ? comNum : null;
    const estFinal = estancias.trim() !== '' ? estNum : null;
    const finalComensales = isP1 ? comNum : (rel === 'comensal' || rel === 'ambos') ? comFinal : null;
    onConfirm(
      totalKg,
      (rel === 'estancia' || rel === 'ambos') ? estFinal : null,
      finalComensales,
      desgloseNums as Record<string, number> | undefined,
    );
  };

  // Agrupa las categorías activas por grupo padre
  const activeGroups = useMemo(() => {
    if (!usesDesglose) return [];
    return FOOD_TAXONOMY
      .map(group => ({
        ...group,
        items: group.items.filter(item => (area.categoriasAlimentos || []).includes(item.id)),
      }))
      .filter(g => g.items.length > 0);
  }, [area.categoriasAlimentos]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl z-10 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: '#1a3d2b' }}>
          <div>
            <p className="text-white font-bold text-base leading-none">{area.nombre}</p>
            {area.tipoServicio && (
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {area.tipoServicio}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.6)' }} className="p-1.5 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* ── Barra de total fija (solo con desglose) ── */}
        {usesDesglose && (
          <div className={`px-5 py-3 flex items-center justify-between flex-shrink-0 transition-colors ${totalKg > 0 ? 'bg-brand-50 border-b border-brand-100' : 'bg-slate-50 border-b border-slate-100'}`}>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total registrado</span>
            <span className={`text-2xl font-black tabular-nums ${totalKg > 0 ? 'text-brand-700' : 'text-slate-300'}`}>
              {totalKg.toFixed(1)} <span className="text-sm font-semibold">kg</span>
            </span>
          </div>
        )}

        {/* Cuerpo scroll */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {isP1 ? (
            /* ── MODO P1: CAMPAÑA DE PESAJE ── */
            <div className="space-y-5">
              {/* Badge método */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-700 text-xs font-bold">Campaña de pesaje (P1)</span>
                {campanaRatio
                  ? <span className="text-amber-500 text-[10px]">ratio: {campanaRatio.toFixed(3)} kg/comensal</span>
                  : <span className="text-amber-400 text-[10px] italic">ratio pendiente de configurar</span>
                }
              </div>

              {/* Comensales — campo principal */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Comensales del día <span className="text-red-400">*</span>
                </label>
                <input
                  type="number" inputMode="numeric" min="0"
                  value={comensales} onChange={e => setComensales(e.target.value)}
                  placeholder="Ej: 320" autoFocus
                  className="w-full text-center text-3xl font-black py-4 px-4 border-2 rounded-2xl focus:outline-none transition-all"
                  style={{ borderColor: comNum > 0 ? '#d97706' : '#e2e8f0', color: comNum > 0 ? '#92400e' : '#94a3b8' }}
                />
              </div>

              {/* Kg: auto-calculado o manual */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Kg estimados {campanaRatio ? '(calculado automáticamente)' : '(introducir manualmente)'}
                </label>
                {campanaRatio ? (
                  <div className={`text-center py-3 rounded-2xl border-2 transition-all ${comNum > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                    <span className={`text-3xl font-black tabular-nums ${comNum > 0 ? 'text-amber-800' : 'text-slate-300'}`}>
                      {comNum > 0 ? kgP1.toFixed(1) : '—'}
                    </span>
                    {comNum > 0 && <span className="text-base font-semibold text-amber-600 ml-1">kg</span>}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="number" inputMode="decimal" min="0" step="0.1"
                      value={kgManual} onChange={e => setKgManual(e.target.value)}
                      placeholder="0.0"
                      className="w-full text-center text-2xl font-bold py-3 px-4 border-2 rounded-xl focus:outline-none transition-all"
                      style={{ borderColor: kgP1 > 0 ? '#d97706' : '#e2e8f0', color: kgP1 > 0 ? '#92400e' : '#94a3b8' }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">kg</span>
                  </div>
                )}
              </div>

              {/* Ratio del día si hay kg */}
              {comNum > 0 && kgP1 > 0 && (
                <p className="text-center text-xs font-semibold text-amber-700 bg-amber-50 py-1.5 rounded-lg">
                  {(kgP1 / comNum).toFixed(3)} kg/comensal hoy
                </p>
              )}
            </div>
          ) : usesDesglose ? (
            /* ── MODO DESGLOSE POR CATEGORÍAS ── */
            <>
              {activeGroups.map(group => (
                <div key={group.label}>
                  {/* Cabecera de grupo */}
                  <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border mb-3 ${group.color}`}>
                    {group.label}
                  </div>

                  {/* Grid de cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map(item => {
                      const val   = desglose[item.id] || '';
                      const num   = parseFloat(val) || 0;
                      const active = activeCard === item.id;
                      const hasVal = num > 0;
                      const { Icon } = item;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveCard(active ? null : item.id)}
                          className={`relative flex flex-col items-center rounded-2xl border-2 pt-4 pb-3 px-3 transition-all text-center ${
                            hasVal
                              ? item.color + ' shadow-sm'
                              : active
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Icono */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${hasVal ? 'bg-white/60' : 'bg-slate-100'}`}>
                            <Icon size={26} style={{ color: hasVal ? item.iconColor : '#94a3b8' }} />
                          </div>

                          {/* Nombre */}
                          <p className={`text-xs font-bold leading-tight mb-2 ${hasVal ? '' : 'text-slate-500'}`}>
                            {item.label}
                          </p>

                          {/* Input o valor */}
                          {active ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={val}
                              autoFocus
                              onClick={e => e.stopPropagation()}
                              onChange={e => setDesglose(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={() => setActiveCard(null)}
                              placeholder="0.0"
                              className="w-full text-center text-lg font-black py-1.5 px-2 border-2 rounded-xl focus:outline-none bg-white"
                              style={{ borderColor: item.iconColor, color: item.iconColor }}
                            />
                          ) : (
                            <div className={`text-xl font-black tabular-nums ${hasVal ? '' : 'text-slate-300'}`}>
                              {hasVal ? `${num.toFixed(1)}` : '—'}
                              {hasVal && <span className="text-xs font-semibold ml-0.5">kg</span>}
                            </div>
                          )}

                          {/* Check si tiene valor */}
                          {hasVal && !active && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/80 flex items-center justify-center">
                              <Check size={11} style={{ color: item.iconColor }} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* ── MODO SIMPLE (sin desglose) ── */
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Kg de desperdicio
              </label>
              <div className="flex gap-2 mb-3 flex-wrap">
                {ATAJOS.map(v => (
                  <button key={v} type="button"
                    onClick={() => setKg(v.toString())}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                      kg === v.toString()
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number" inputMode="decimal" min="0" step="0.1"
                  value={kg} onChange={e => setKg(e.target.value)}
                  placeholder="0.0" autoFocus
                  className="w-full text-center text-2xl font-bold py-3 px-4 border-2 rounded-xl focus:outline-none transition-all"
                  style={{ borderColor: totalKg > 0 ? '#1a3d2b' : '#e2e8f0', color: totalKg > 0 ? '#1a3d2b' : '#94a3b8' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">kg</span>
              </div>
            </div>
          )}

          {/* Estancias */}
          {(rel === 'estancia' || rel === 'ambos') && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Habitaciones ocupadas{' '}
                <span className="text-slate-300 normal-case font-normal">(hotel · mismo para todas las zonas)</span>
              </label>
              <input type="number" inputMode="numeric" min="0"
                value={estancias} onChange={e => setEstancias(e.target.value)}
                placeholder="Ej: 180"
                className="w-full text-center text-xl font-bold py-2.5 px-4 border-2 rounded-xl focus:outline-none transition-all border-slate-200 focus:border-brand-400"
              />
              {ratioEst && <p className="text-center text-xs text-brand-600 font-semibold mt-1.5">= {ratioEst} kg/estancia</p>}
            </div>
          )}

          {/* Comensales (solo en modo báscula/P3, no en P1 donde ya está arriba) */}
          {!isP1 && (rel === 'comensal' || rel === 'ambos') && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Comensales servidos
              </label>
              <input type="number" inputMode="numeric" min="0"
                value={comensales} onChange={e => setComensales(e.target.value)}
                placeholder="Ej: 320"
                className="w-full text-center text-xl font-bold py-2.5 px-4 border-2 rounded-xl focus:outline-none transition-all border-slate-200 focus:border-brand-400"
              />
              {ratioCom && <p className="text-center text-xs text-brand-600 font-semibold mt-1.5">= {ratioCom} kg/comensal</p>}
            </div>
          )}
        </div>

        {/* ── Pie fijo con botón confirmar ── */}
        <div className="flex-shrink-0 px-5 pb-6 pt-3 border-t border-slate-100 bg-white">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: canConfirm ? '#1a3d2b' : '#e2e8f0', color: canConfirm ? '#fff' : '#94a3b8' }}
          >
            {saving
              ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</>
              : <><Check size={18} /> {isP1 ? `Confirmar ${comNum} com. · ${kgP1.toFixed(1)} kg` : usesDesglose ? `Confirmar ${totalKg.toFixed(1)} kg` : 'Confirmar'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Vista principal ───────────────────────────────────────────────────────────

export const RegistrosView: React.FC<Props> = ({
  planId, hotelNombre, planData, currentUser, onBack
}) => {
  const [selectedDate,  setSelectedDate]  = useState(isoToday());
  const [currentMonth,  setCurrentMonth]  = useState(isoToday().slice(0, 7));
  const [pesajes,   setPesajes]   = useState<PesajeRow[]>([]);
  const [ocupacion, setOcupacion] = useState<OcupacionRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [activeZone, setActiveZone] = useState<Area | null>(null);

  const monthGrid  = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const todayYM    = isoToday().slice(0, 7);
  const canGoNext  = currentMonth < todayYM;
  const zonas      = useMemo(() => getZonasConPesaje(planData, hotelNombre), [planData, hotelNombre]);
  const today      = isoToday();
  const dayInfo    = fmtDay(selectedDate);

// Carga inicial
  useEffect(() => {
    load();
  }, [planId]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        pesajesService.fetchByPlan(planId),
        ocupacionService.fetchByPlan(planId),
      ]);
      setPesajes(p);
      setOcupacion(o);
      // Si hoy no tiene registros pero hay datos anteriores, navegar al último día con datos
      const todayStr = isoToday();
      const hasTodayRecords = p.some((r: PesajeRow) => r.fecha === todayStr);
      if (!hasTodayRecords && p.length > 0) {
        const lastDate = p[0].fecha; // fetchByPlan ordena DESC, el primero es el más reciente
        setSelectedDate(lastDate);
        setCurrentMonth(lastDate.slice(0, 7));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Obtener pesaje de una zona en la fecha seleccionada
  const getPesaje = useCallback((areaId: string) =>
    pesajes.find(p => p.area_id === areaId && p.fecha === selectedDate) || null,
  [pesajes, selectedDate]);

  // Ocupación del hotel en la fecha seleccionada
  const getOcupacion = useCallback(() =>
    ocupacion.find(o => o.hotel_nombre === hotelNombre && o.fecha === selectedDate) || null,
  [ocupacion, hotelNombre, selectedDate]);

  // Total kg del día
  const totalHoy = useMemo(() =>
    pesajes.filter(p => p.fecha === selectedDate).reduce((s, p) => s + p.kg, 0),
  [pesajes, selectedDate]);

  // Coste total del día
  const costeTotalHoy = useMemo(() => {
    const recs = pesajes.filter(p => p.fecha === selectedDate);
    const total = recs.reduce((s, p) => {
      const area = zonas.find(a => a.id === p.area_id);
      return s + p.kg * (area?.costePorKg ?? 0);
    }, 0);
    return zonas.some(a => a.costePorKg != null) ? total : null;
  }, [pesajes, selectedDate, zonas]);

  // Guardar un registro
  const handleConfirm = async (kg: number, estancias: number | null, comensales: number | null, desglose?: Record<string, number>) => {
    if (!activeZone) return;
    setSaving(true);
    try {
      const row: PesajeRow = {
        plan_id:        planId,
        area_id:        activeZone.id,
        area_nombre:    activeZone.nombre,
        hotel_nombre:   hotelNombre || undefined,
        fecha:          selectedDate,
        kg,
        relativizar_por: activeZone.medicion?.relativizarPor || null,
        estancias,
        comensales,
        registrado_por: currentUser,
        desglose_kg:    desglose && Object.keys(desglose).length > 0 ? desglose : undefined,
      };
      const saved = await pesajesService.upsert(row);

      // Actualizar estado local
      setPesajes(prev => {
        const idx = prev.findIndex(p => p.area_id === activeZone.id && p.fecha === selectedDate);
        return idx >= 0 ? prev.map((p, i) => i === idx ? saved : p) : [...prev, saved];
      });

      // Si hay estancias, guardar también en ocupacion_diaria
      if (estancias) {
        const oRow: OcupacionRow = {
          plan_id:        planId,
          hotel_nombre:   hotelNombre || '',
          fecha:          selectedDate,
          estancias,
          comensales:     comensales || undefined,
          registrado_por: currentUser,
        };
        const oSaved = await ocupacionService.upsert(oRow);
        setOcupacion(prev => {
          const idx = prev.findIndex(o => o.hotel_nombre === hotelNombre && o.fecha === selectedDate);
          return idx >= 0 ? prev.map((o, i) => i === idx ? oSaved : o) : [...prev, oSaved];
        });
      }

      setActiveZone(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans overflow-x-hidden" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: '#1a3d2b' }} className="shadow-md flex-shrink-0 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate leading-none">{hotelNombre}</h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Registros de pesaje
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-medium">
              <CheckCircle2 size={12} /> Guardado
            </div>
          )}
        </div>
      </header>

      {/* ── Calendario mensual ── */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="max-w-lg mx-auto px-3 pt-2 pb-3">
          {/* Navegación mes */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={() => setCurrentMonth(m => addMonth(m, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 capitalize">
              {fmtMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth(m => addMonth(m, 1))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-20 disabled:cursor-default">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-1">
            {DOW_HEADERS.map(h => (
              <div key={h} className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-wider py-1">
                {h}
              </div>
            ))}
          </div>

          {/* Cuadrícula del mes */}
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid.map((d, idx) => {
              if (!d) return <div key={`e-${idx}`} />;
              const isToday  = d === today;
              const isSel    = d === selectedDate;
              const isFuture = d > today;
              const hasDat   = pesajes.some(p => p.fecha === d);
              return (
                <button key={d}
                  onClick={() => !isFuture && setSelectedDate(d)}
                  disabled={isFuture}
                  className="flex flex-col items-center justify-center py-1.5 rounded-lg transition-all relative"
                  style={{
                    backgroundColor: isSel ? '#1a3d2b' : isToday ? '#f0fdf4' : 'transparent',
                    border: isToday && !isSel ? '1.5px solid #1a3d2b' : '1.5px solid transparent',
                    opacity: isFuture ? 0.2 : 1,
                  }}>
                  {isToday && !isSel && (
                    <span className="text-[7px] font-black text-emerald-700 uppercase leading-none">HOY</span>
                  )}
                  <span className={`text-xs font-bold leading-none ${
                    isSel ? 'text-white' : isToday ? 'text-emerald-800' : 'text-slate-600'
                  }`}>
                    {new Date(d + 'T12:00:00').getDate()}
                  </span>
                  <div className={`w-1 h-1 rounded-full mt-0.5 ${
                    hasDat ? (isSel ? 'bg-white/80' : 'bg-brand-500') : 'bg-transparent'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Resumen del día ── */}
      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-400">{dayInfo.full}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {zonas.filter(z => getPesaje(z.id)).length}/{zonas.length} zonas registradas
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold" style={{ color: totalHoy > 0 ? '#1a3d2b' : '#cbd5e1' }}>
              {totalHoy > 0 ? `${totalHoy.toFixed(1)} kg` : '—'}
            </p>
            {costeTotalHoy != null && costeTotalHoy > 0 && (
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                {costeTotalHoy.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tarjetas de zona ── */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-3 pb-8">

        {zonas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Scale size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin zonas con báscula configuradas.</p>
          </div>
        ) : (
          zonas.map(area => {
            const pesaje    = getPesaje(area.id);
            const ocupDia   = getOcupacion();
            const registered = !!pesaje && pesaje.kg > 0;
            const rel        = area.medicion?.relativizarPor;

            return (
              <div key={area.id}
                className="rounded-2xl overflow-hidden transition-all shadow-sm"
                style={{
                  border: registered ? '2px solid #86efac' : '2px solid #e2e8f0',
                  backgroundColor: registered ? '#f0fdf4' : '#ffffff',
                }}>

                {/* Franja de color superior */}
                <div className="h-1.5 w-full" style={{ backgroundColor: registered ? '#22c55e' : '#e2e8f0' }} />

                {/* Top: nombre + estado */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: registered ? '#dcfce7' : '#f1f5f9' }}>
                      <Scale size={20} style={{ color: registered ? '#16a34a' : '#94a3b8' }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-base truncate">{area.nombre}</h3>
                      {area.tipoServicio && (
                        <p className="text-xs text-slate-400 truncate">{area.tipoServicio}</p>
                      )}
                    </div>
                  </div>
                  {rel && (
                    <span className="text-[9px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2"
                      style={{ backgroundColor: registered ? '#dcfce7' : '#f1f5f9', color: registered ? '#16a34a' : '#94a3b8' }}>
                      /{rel === 'ambos' ? 'est+com' : rel === 'estancia' ? 'estancia' : 'comensal'}
                    </span>
                  )}
                </div>

                {/* Centro: datos o estado vacío */}
                {registered ? (
                  <div className="px-5 pb-4">
                    {/* KG grande + coste */}
                    <div className="flex items-baseline gap-1.5 mb-3">
                      <span className="text-4xl font-black" style={{ color: '#1a3d2b' }}>
                        {pesaje!.kg.toFixed(1)}
                      </span>
                      <span className="text-lg font-semibold text-slate-400">kg</span>
                      {area.costePorKg != null && (
                        <span className="ml-3 text-base font-bold text-slate-700">
                          {(pesaje!.kg * area.costePorKg).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                        </span>
                      )}
                    </div>
                    {/* Mini-desglose por categorías (si tiene datos) */}
                    {pesaje!.desglose_kg && Object.keys(pesaje!.desglose_kg).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(pesaje!.desglose_kg)
                          .sort(([, a], [, b]) => b - a)
                          .map(([catId, catKg]) => {
                            const cat = FOOD_MAP[catId];
                            if (!cat) return null;
                            const { Icon } = cat;
                            return (
                              <div key={catId}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${cat.color}`}>
                                <Icon size={11} style={{ color: cat.iconColor }} />
                                {cat.label}: {catKg.toFixed(1)} kg
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Denominadores y ratios */}
                    <div className="flex flex-wrap gap-3">
                      {pesaje!.estancias && pesaje!.estancias > 0 && (
                        <div className="bg-white rounded-lg px-3 py-2 border border-green-100">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Estancias</p>
                          <p className="text-base font-bold text-slate-700">{pesaje!.estancias}</p>
                          <p className="text-[10px] font-semibold text-emerald-600">
                            {(pesaje!.kg / pesaje!.estancias).toFixed(3)} kg/est.
                          </p>
                        </div>
                      )}
                      {pesaje!.comensales && pesaje!.comensales > 0 && (
                        <div className="bg-white rounded-lg px-3 py-2 border border-green-100">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Comensales</p>
                          <p className="text-base font-bold text-slate-700">{pesaje!.comensales}</p>
                          <p className="text-[10px] font-semibold text-emerald-600">
                            {(pesaje!.kg / pesaje!.comensales).toFixed(3)} kg/com.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <p className="text-sm text-slate-400 font-medium">Pendiente de registrar</p>
                  </div>
                )}

                {/* Botón de acción */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setActiveZone(area)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    style={registered
                      ? { backgroundColor: '#ffffff', color: '#16a34a', border: '1.5px solid #86efac' }
                      : { backgroundColor: '#1a3d2b', color: '#ffffff' }}
                  >
                    {registered
                      ? <><Scale size={15} /> Modificar</>
                      : <><Scale size={15} /> + Registrar</>}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Bottom sheet de entrada ── */}
      {activeZone && (
        <EntrySheet
          area={activeZone}
          existing={getPesaje(activeZone.id)}
          ocupacion={getOcupacion()}
          onConfirm={handleConfirm}
          onClose={() => setActiveZone(null)}
          saving={saving}
        />
      )}

      {/* ── Toast de confirmación ── */}
      {saved && !activeZone && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold pointer-events-none"
          style={{ backgroundColor: '#1a3d2b', boxShadow: '0 8px 32px rgba(26,61,43,0.35)' }}>
          <CheckCircle2 size={16} />
          Datos guardados
        </div>
      )}
    </div>
  );
};
