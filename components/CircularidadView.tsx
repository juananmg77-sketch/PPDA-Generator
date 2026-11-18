// Plan de Circularidad (Ley 3/2022 Illes Balears) · HS GREEN. Biblioteca de planes guardados en la base (circ_planes) y un ejemplo de demostración que vive en el navegador (localStorage).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, Settings, Gauge, ListChecks, ClipboardCheck, Scale, FileCheck, LayoutDashboard, Plus, Trash2, CheckCircle2, AlertTriangle, Printer, Download, RotateCcw, Lock, Unlock, TrendingUp, TrendingDown, Minus, Loader2, X } from 'lucide-react';
import { AREAS, CATEGORIAS_HOTEL, INDICADORES, MEDIDAS, ORDEN_AREAS, REQUISITOS, tablaCamas } from '../circularidad/catalogo';
import type { Area, CategoriaHotel, EstadoReq } from '../circularidad/catalogo';
import { TRIMESTRES, camas, completitud, cumplimiento, evolucion, nombreArea, progresoAccion, progresoObjetivo, progresoPlan, progresoPorArea, resumenCumplimiento, valorIndicador, vacioSeg } from '../circularidad/plan';
import type { Objetivo, Plan } from '../circularidad/plan';
import { planDemo } from '../circularidad/demo';
import { construirInformeCirculardad } from '../circularidad/informe';
import { informeAHtml } from '../huella/informeHtml';
import type { Accion } from '../circularidad/plan';
import { FUNCIONES_PLAN, FUNCION_RESPONSABLE, migrarPlan, miembroVacio, planVacio, responsableDelPlan } from '../circularidad/plan';
import { circularidadService } from '../services/circularidadService';
import type { FilaPlan } from '../services/circularidadService';
import { huellaService } from '../services/huellaService';
import type { Organizacion } from '../services/huellaService';

type Pestana = 'resumen' | 'indicadores' | 'plan' | 'seguimiento' | 'cumplimiento' | 'informe';
const CLAVE = 'hsgreen-circularidad-demo-v1';
const HOY = new Date().toISOString().slice(0, 10);

const card = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm';
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500';
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50';
const btnP = `${btn} bg-brand-600 text-white hover:bg-brand-700`;
const btnS = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`;
const nf = (v: number | undefined, d = 0) => (v === undefined ? '—' : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pc = (x: number) => `${Math.round(x * 100)} %`;

function cargar(): Plan {
  try {
    const s = localStorage.getItem(CLAVE);
    if (s) {
      // Ejemplos guardados antes de existir el valor objetivo: se completa desde el ejemplo vigente.
      const p = JSON.parse(s) as Plan; const base = planDemo();
      return { ...p, objetivos: p.objetivos.map((o) => (o.metaValor === undefined ? { ...o, metaValor: base.objetivos.find((b) => b.id === o.id)?.metaValor } : o)) };
    }
  } catch { /* sin almacenamiento */ }
  return planDemo();
}

const Campo: React.FC<{ etiqueta: string; children: React.ReactNode; ancho?: boolean }> = ({ etiqueta, children, ancho }) => (
  <label className={`text-xs font-semibold text-slate-700 ${ancho ? 'md:col-span-2' : ''}`}>{etiqueta}<div className="mt-1">{children}</div></label>
);
const Barra: React.FC<{ valor: number; color?: string }> = ({ valor, color = '#00BF46' }) => (
  <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(valor * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full" style={{ width: `${Math.round(valor * 100)}%`, background: color }} /></div>
);
const Tendencia: React.FC<{ t: string }> = ({ t }) => t === 'mejora' ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold"><TrendingUp size={13} /> Mejora</span>
  : t === 'empeora' ? <span className="inline-flex items-center gap-1 text-red-700 text-xs font-semibold"><TrendingDown size={13} /> Empeora</span>
  : t === 'igual' ? <span className="inline-flex items-center gap-1 text-slate-600 text-xs font-semibold"><Minus size={13} /> Igual</span> : <span className="text-xs text-slate-400">—</span>;

const ESTADOS: Array<[EstadoReq, string, string]> = [['cumple', 'Cumple', 'bg-green-100 text-green-800'], ['parcial', 'Parcial', 'bg-amber-100 text-amber-800'], ['no', 'No cumple', 'bg-red-100 text-red-800'], ['na', 'No aplica', 'bg-slate-100 text-slate-600'], ['pendiente', 'Pendiente', 'bg-slate-100 text-slate-700']];

type Guardado = 'guardado' | 'guardando' | 'error';
const Editor: React.FC<{ plan0: Plan; demo: boolean; onSalir: () => void; currentUser: string; onGuardar?: (p: Plan) => Promise<void> }> = ({ plan0, demo, onSalir, currentUser, onGuardar }) => {
  const onBack = onSalir;
  const [plan, setPlan] = useState<Plan>(() => migrarPlan(plan0));
  const [guardado, setGuardado] = useState<Guardado>('guardado');
  const [errorGuardar, setErrorGuardar] = useState('');
  const sucio = useRef(false);
  const ultimo = useRef(plan0);
  const [tab, setTab] = useState<Pestana>('resumen');
  const aniosDatos = useMemo(() => Object.keys(plan.datos).map(Number).sort((a, b) => a - b), [plan.datos]);
  const [anio, setAnio] = useState<number>(() => aniosDatos[aniosDatos.length - 1] ?? new Date().getFullYear());
  const [modalMedida, setModalMedida] = useState(false);
  const [config, setConfig] = useState(false);
  const volcar = async (p: Plan) => {
    if (demo) { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* ignorar */ } sucio.current = false; return; }
    setGuardado('guardando');
    try { await onGuardar!(p); if (ultimo.current === p) { sucio.current = false; setGuardado('guardado'); setErrorGuardar(''); } }
    catch (e) { setGuardado('error'); setErrorGuardar(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => {
    ultimo.current = plan;
    if (!sucio.current) return;
    const t = setTimeout(() => { void volcar(plan); }, demo ? 0 : 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const cambiar = (f: (p: Plan) => Plan) => { sucio.current = true; setPlan((p) => f(p)); };
  const salir = async () => {
    if (!demo && sucio.current) { await volcar(ultimo.current); if (sucio.current && !confirm('No se ha podido guardar el último cambio. ¿Salir de todos modos?')) return; }
    onSalir();
  };

  const aniosOpc = useMemo(() => { const s = new Set<number>(aniosDatos); s.add(anio); for (let a = plan.ficha.vigenciaDesde; a <= plan.ficha.vigenciaHasta; a++) s.add(a); return [...s].sort((a, b) => a - b); }, [aniosDatos, anio, plan.ficha.vigenciaDesde, plan.ficha.vigenciaHasta]);
  const filasC = useMemo(() => cumplimiento(plan, HOY), [plan]);
  const rc = resumenCumplimiento(filasC);
  const cerradoAnio = !!plan.seguimiento[anio]?.cerrado;

  const nav: Array<{ k: Pestana; nombre: string; icono: React.ReactNode; badge?: number }> = [
    { k: 'resumen', nombre: 'Resumen', icono: <LayoutDashboard size={17} /> },
    { k: 'plan', nombre: 'Plan de acción', icono: <ListChecks size={17} /> },
    { k: 'seguimiento', nombre: 'Seguimiento', icono: <ClipboardCheck size={17} /> },
    { k: 'indicadores', nombre: 'Indicadores', icono: <Gauge size={17} /> },
    { k: 'cumplimiento', nombre: 'Cumplimiento legal', icono: <Scale size={17} />, badge: rc.alertas },
    { k: 'informe', nombre: 'Informe', icono: <FileCheck size={17} /> },
  ];
  const titulos: Record<Pestana, [string, string]> = {
    resumen: ['Resumen del plan', 'Estado del plan de circularidad, avance del plan de acción y cumplimiento legal.'],
    indicadores: ['Evaluación circular', 'Indicadores por área prioritaria; se recalculan cada año.'],
    plan: ['Plan de acción', 'Objetivos medibles y acciones con responsable, recursos y plazo (renovable cada 5 años).'],
    seguimiento: ['Seguimiento trimestral', 'Marque cada trimestre cumplido y adjunte la evidencia; cierre el año al terminar.'],
    cumplimiento: ['Cumplimiento legal', 'Requisitos obligatorios con su fecha de exigibilidad.'],
    informe: ['Informe del plan', 'Documento del plan de circularidad listo para entregar.'],
  };

  const selectorAnio = (
    <label className="text-xs font-semibold text-slate-700 inline-flex items-center gap-2">Año
      <select className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año de evaluación">{aniosOpc.map((a) => <option key={a} value={a}>{a}</option>)}</select>
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-900">
      <aside className="md:w-60 flex-shrink-0 flex flex-col md:border-r border-white/70" style={{ background: 'rgba(255,255,255,.66)', WebkitBackdropFilter: 'blur(14px) saturate(1.2)', backdropFilter: 'blur(14px) saturate(1.2)', color: '#00093D' }}>
        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          <button onClick={() => void salir()} className="p-1.5 rounded-lg hover:bg-white/70" title="Volver a la biblioteca" aria-label="Volver a la biblioteca de planes"><ArrowLeft size={17} /></button>
          <img src="/logo-hsgreen-recortado.png" alt="HS GREEN · Environment & Sustainability" className="h-10 w-auto object-contain" />
        </div>
        <p className="px-4 pb-3 text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(0,9,61,.6)' }}>Plan de circularidad</p>
        <nav className="flex md:flex-col gap-0.5 px-2 pb-3 overflow-x-auto md:overflow-visible" role="tablist" aria-label="Secciones">
          {nav.map((n) => (
            <button key={n.k} role="tab" aria-selected={tab === n.k} onClick={() => setTab(n.k)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === n.k ? 'text-white font-semibold' : 'hover:bg-white/60'}`}
              style={tab === n.k ? { background: '#0002C9' } : { color: '#00093D' }}>
              {n.icono} <span>{n.nombre}</span>
              {!!n.badge && <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: '#F9416D' }}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="hidden md:block mt-auto px-4 py-4 border-t" style={{ borderColor: 'rgba(0,9,61,.12)' }}>
          {demo && <button className="text-[11px] font-semibold underline mb-3 inline-flex items-center gap-1" style={{ color: 'rgba(0,9,61,.75)' }} onClick={() => { if (confirm('¿Restablecer el ejemplo? Se perderán los cambios de esta demostración.')) { sucio.current = true; setPlan(planDemo()); } }}><RotateCcw size={11} /> Restablecer ejemplo</button>}
          <img src="/logo-hs-group.png" alt="HS Consulting Group" className="h-9 w-auto object-contain" />
          <p className="text-[11px] mt-2 truncate" style={{ color: 'rgba(0,9,61,.65)' }}>{currentUser}</p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-5xl space-y-4">
          <div className={`${card} flex flex-wrap items-center gap-3 cursor-pointer`} aria-label="Establecimiento" onClick={() => setConfig(true)}>
            <div className="w-11 h-11 rounded-lg bg-green-100 text-green-800 flex items-center justify-center text-lg font-bold shrink-0">{(plan.ficha.establecimiento || '?').trim().charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Establecimiento</p>
              <p className="text-lg font-extrabold text-slate-900 truncate">{plan.ficha.establecimiento || 'Sin nombre'}</p>
              <p className="text-xs text-slate-600 truncate">{plan.ficha.empresa} · {CATEGORIAS_HOTEL[plan.ficha.categoria]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">Plan {plan.ficha.vigenciaDesde}-{plan.ficha.vigenciaHasta}</span>
              <button onClick={() => setConfig(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Configuración del establecimiento" aria-label="Abrir la configuración del establecimiento"><Settings size={17} /></button>
              {demo ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">Demostración</span>
                : <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${guardado === 'error' ? 'bg-red-100 text-red-800' : guardado === 'guardando' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}`} role="status">{guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? 'Sin guardar' : 'Guardado'}</span>}
            </div>
          </div>
          {errorGuardar && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{errorGuardar}</span></div>}
          {(!responsableDelPlan(plan.ficha).trim() || !plan.ficha.pernoctaciones) && (
            <button onClick={() => setConfig(true)} className="w-full text-left flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 text-sm"><AlertTriangle size={15} className="shrink-0" /><span className="flex-1">Faltan datos básicos del establecimiento ({[!responsableDelPlan(plan.ficha).trim() && 'responsable del plan', !plan.ficha.pernoctaciones && 'pernoctaciones'].filter(Boolean).join(' y ')}).</span><span className="font-bold underline">Completar</span></button>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]"><h1 className="text-xl font-extrabold text-slate-900">{titulos[tab][0]}</h1><p className="text-sm text-slate-600">{titulos[tab][1]}</p></div>
            {['seguimiento', 'informe'].includes(tab) && selectorAnio}
          </div>

          {tab === 'resumen' && aniosDatos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Año del resumen">
              {aniosDatos.map((a) => (
                <button key={a} role="tab" aria-selected={a === anio} onClick={() => setAnio(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${a === anio ? 'text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                  style={a === anio ? { background: '#0002C9' } : undefined}>{a}</button>
              ))}
            </div>
          )}
          {tab === 'resumen' && <Resumen plan={plan} anio={anio} filasC={filasC} irA={setTab} />}
          {tab === 'indicadores' && <IndicadoresPanel plan={plan} anio={anio} cambiar={cambiar} aniosOpc={aniosOpc} setAnio={setAnio} />}
          {tab === 'plan' && <PlanPanel plan={plan} anio={anio} cambiar={cambiar} onCatalogo={() => setModalMedida(true)} />}
          {tab === 'seguimiento' && <SeguimientoPanel plan={plan} anio={anio} cambiar={cambiar} cerrado={cerradoAnio} />}
          {tab === 'cumplimiento' && <CumplimientoPanel plan={plan} anio={anio} filasC={filasC} cambiar={cambiar} />}
          {tab === 'informe' && <InformePanel plan={plan} anio={anio} cambiar={cambiar} />}
        </div>
      </main>
      {config && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/60" role="dialog" aria-modal="true" aria-label="Configuración del establecimiento" onClick={(e) => { if (e.target === e.currentTarget) setConfig(false); }}>
          <div className="no-glass bg-slate-100 rounded-2xl shadow-2xl w-full max-w-4xl my-6 border border-slate-200">
            <div className="flex items-center gap-2 px-5 pt-4"><h2 className="text-lg font-extrabold text-slate-900 flex-1">Configuración del establecimiento</h2><button className={btnP} onClick={() => setConfig(false)}>Listo</button></div>
            <p className="px-5 pb-3 text-xs text-slate-600">Datos básicos del establecimiento, vigencia del plan y equipo responsable. Se guardan solos.</p>
            <div className="px-5 pb-5"><FichaPanel plan={plan} cambiar={cambiar} /></div>
          </div>
        </div>
      )}
      {modalMedida && <CatalogoMedidas onCerrar={() => setModalMedida(false)} onElegir={(m) => {
        cambiar((p) => { const n = p.objetivos.length + 1; const id = `o${Date.now()}`; const obj: Objetivo = { id, codigo: String(n), area: m.area, descripcion: m.objetivo, indicadorId: m.indicador, lineaBase: '', meta: '', plazo: String(p.ficha.vigenciaHasta), responsable: '', recursos: '', inversion: '', acciones: m.acciones.map((a, i) => ({ id: `${id}-${i}`, codigo: `${n}${String.fromCharCode(65 + i)}`, descripcion: a, responsable: '', plazo: String(anio) })) }; return { ...p, objetivos: [...p.objetivos, obj] }; });
        setModalMedida(false);
      }} />}
    </div>
  );
};

// ───────────────────────────── Resumen ─────────────────────────────
const Resumen: React.FC<{ plan: Plan; anio: number; filasC: ReturnType<typeof cumplimiento>; irA: (t: Pestana) => void }> = ({ plan, anio, filasC, irA }) => {
  const prog = progresoPlan(plan, anio);
  const porArea = progresoPorArea(plan, anio);
  const comp = completitud(plan, anio);
  const rc = resumenCumplimiento(filasC);
  const ev = evolucion(plan, Object.keys(plan.datos).map(Number).sort((a, b) => a - b).filter((a) => a <= anio));
  const clave = ['E1', 'AL1', 'A2', 'G2'].map((id) => ev.find((x) => x.id === id)!);
  const alertas = filasC.filter((f) => f.alerta);
  const kpis = ['E1', 'E3', 'A2', 'R2', 'AL1', 'G2'].map((id) => {
    const x = ev.find((e) => e.id === id)!; const v = x.valores[anio];
    const prev = Object.keys(x.valores).map(Number).filter((y) => y < anio && x.valores[y] !== undefined).sort((p, q) => q - p)[0];
    const pv = prev === undefined ? undefined : x.valores[prev];
    const ind = INDICADORES.find((i) => i.id === id)!;
    const delta = v !== undefined && pv !== undefined && pv !== 0 ? (v - pv) / Math.abs(pv) : undefined;
    const bien = delta === undefined || Math.abs(delta) < 0.0005 ? null : (delta > 0) === ind.masEsMejor;
    return { x, v, prev, delta, bien, area: AREAS[ind.area] };
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" aria-label={`Indicadores clave ${anio}`}>
        {kpis.map(({ x, v, prev, delta, bien, area }) => (
          <div key={x.id} className={`${card} !p-4`} style={{ borderTop: `3px solid ${area.color}` }}>
            <p className="text-[11px] font-semibold text-slate-500 leading-tight min-h-[28px]">{x.nombre}</p>
            <p className="text-2xl font-extrabold mt-1 tabular-nums" style={{ color: '#00093D' }}>{nf(v, x.decimales)}<span className="text-[11px] font-semibold text-slate-500 ml-1">{v === undefined ? '' : x.unidad}</span></p>
            <p className={`text-xs mt-1 font-semibold ${bien === null ? 'text-slate-500' : bien ? 'text-green-700' : 'text-red-700'}`}>
              {v === undefined ? 'Sin datos en ' + anio : delta === undefined ? (prev === undefined ? 'Primer año con datos' : 'Sin variación calculable') : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} % vs ${prev}`}
            </p>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className={card}><p className="text-xs font-semibold text-slate-500">Avance del plan de acción {anio}</p><p className="text-3xl font-extrabold mt-1" style={{ color: '#00093D' }}>{pc(prog)}</p><div className="mt-2"><Barra valor={prog} /></div></div>
        <div className={card}><p className="text-xs font-semibold text-slate-500">Requisitos obligatorios cumplidos</p><p className="text-3xl font-extrabold mt-1" style={{ color: rc.alertas ? '#CC0000' : '#006600' }}>{rc.cumplen}<span className="text-lg text-slate-400"> / {rc.exigibles}</span></p><p className="text-xs text-slate-600 mt-1">{rc.alertas ? `${rc.alertas} requieren atención` : 'Todo al día'}</p></div>
        <div className={card}><p className="text-xs font-semibold text-slate-500">Vigencia del plan</p><p className="text-3xl font-extrabold mt-1" style={{ color: '#00093D' }}>{plan.ficha.vigenciaDesde}–{plan.ficha.vigenciaHasta}</p><p className="text-xs text-slate-600 mt-1">Evaluación anual · renovación cada 5 años</p></div>
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Situación por área prioritaria</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {ORDEN_AREAS.map((a) => (
            <div key={a} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: AREAS[a].color }} /><p className="text-sm font-bold text-slate-800 flex-1">{AREAS[a].nombre}</p><span className="text-[11px] text-slate-500">{comp[a].con}/{comp[a].total} indicadores</span></div>
              <div className="mt-2"><Barra valor={porArea[a] ?? 0} color={AREAS[a].color} /></div>
              <p className="text-[11px] text-slate-600 mt-1">{porArea[a] === null ? 'Sin objetivos definidos' : `Avance de las acciones: ${pc(porArea[a]!)}`}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Indicadores clave</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-1.5">Indicador</th>{Object.keys(clave[0].valores).map((a) => <th key={a} className="text-right">{a}</th>)}<th className="text-right">Tendencia</th></tr></thead>
          <tbody>{clave.map((x) => (<tr key={x.id} className="border-b border-slate-100"><td className="py-1.5">{x.nombre} <span className="text-[11px] text-slate-500">({x.unidad})</span></td>{Object.keys(x.valores).map((a) => <td key={a} className="text-right tabular-nums">{nf(x.valores[Number(a)], x.decimales)}</td>)}<td className="text-right"><Tendencia t={x.tendencia} /></td></tr>))}</tbody></table>
        <button className="mt-2 text-xs font-bold text-brand-700 underline" onClick={() => irA('indicadores')}>Ver todos los indicadores →</button>
      </div>

      {alertas.length > 0 && (
        <div className={`${card} border-amber-200`}>
          <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> Requisitos que requieren atención</h2>
          <ul className="space-y-1.5">{alertas.map((f) => <li key={f.id} className="text-xs text-slate-800 flex gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" /><span><strong>{f.texto}</strong> <span className="text-slate-500">· exigible desde {new Date(f.desde).toLocaleDateString('es-ES')}</span>{f.nota && <span className="block text-slate-600">{f.nota}</span>}</span></li>)}</ul>
          <button className="mt-2 text-xs font-bold text-brand-700 underline" onClick={() => irA('cumplimiento')}>Ir a Cumplimiento legal →</button>
        </div>
      )}
    </div>
  );
};

// ───────────────────────────── Ficha ─────────────────────────────
const FichaPanel: React.FC<{ plan: Plan; cambiar: (f: (p: Plan) => Plan) => void }> = ({ plan, cambiar }) => {
  const f = plan.ficha;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => cambiar((p) => ({ ...p, ficha: { ...p.ficha, [k]: v } }));
  const n = (k: 'habitaciones' | 'capacidad' | 'pernoctaciones' | 'superficie') => <input type="number" min={0} className={input} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} />;
  return (
    <div className={card}>
      <div className="grid md:grid-cols-2 gap-3">
        <Campo etiqueta="Nombre del establecimiento *"><input className={input} value={f.establecimiento} onChange={(e) => set('establecimiento', e.target.value)} /></Campo>
        <Campo etiqueta="Empresa a la que pertenece *"><input className={input} value={f.empresa} onChange={(e) => set('empresa', e.target.value)} /></Campo>
        <Campo etiqueta="Dirección" ancho><input className={input} value={f.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
        <Campo etiqueta="Categoría"><select className={input} value={f.categoria} onChange={(e) => { const c = e.target.value as CategoriaHotel; set('categoria', c); set('categoriaTexto', CATEGORIAS_HOTEL[c]); }}>{(Object.keys(CATEGORIAS_HOTEL) as CategoriaHotel[]).map((c) => <option key={c} value={c}>{CATEGORIAS_HOTEL[c]}</option>)}</select></Campo>
        <Campo etiqueta="Periodo de apertura *"><input className={input} value={f.apertura} onChange={(e) => set('apertura', e.target.value)} /></Campo>
        <Campo etiqueta="Actividad y servicios que se ofrecen *" ancho><textarea rows={2} className={input} value={f.actividad} onChange={(e) => set('actividad', e.target.value)} /></Campo>
        <Campo etiqueta="Número de habitaciones">{n('habitaciones')}</Campo>
        <Campo etiqueta="Capacidad (plazas)">{n('capacidad')}</Campo>
        <Campo etiqueta="Pernoctaciones anuales (promedio)">{n('pernoctaciones')}</Campo>
        <Campo etiqueta="Área total del establecimiento (m²)">{n('superficie')}</Campo>
        <Campo etiqueta="Vigencia desde"><input type="number" className={input} value={f.vigenciaDesde} onChange={(e) => set('vigenciaDesde', Number(e.target.value))} /></Campo>
        <Campo etiqueta="Vigencia hasta (máximo 5 años)"><input type="number" className={input} value={f.vigenciaHasta} onChange={(e) => set('vigenciaHasta', Math.min(Number(e.target.value), f.vigenciaDesde + 4))} /></Campo>
        <Campo etiqueta="Fecha de publicación del informe"><input type="date" className={input} value={f.fechaPublicacion} onChange={(e) => set('fechaPublicacion', e.target.value)} /></Campo>
      </div>
      <Equipo plan={plan} cambiar={cambiar} />
      <p className="text-[11px] text-slate-500 mt-3">Los campos con * son obligatorios según la guía AETIB; el resto son opcionales. Las pernoctaciones se usan para calcular los indicadores por pernoctación.</p>
    </div>
  );
};

// ───────────────────────────── Indicadores ─────────────────────────────
/** Encabezado de un grupo por área prioritaria (misma agrupación en indicadores, plan de acción y seguimiento). */
const CabeceraArea: React.FC<{ area: Area; detalle?: string }> = ({ area, detalle }) => (
  <div className="flex items-center gap-2.5 pt-3 pb-0.5" role="heading" aria-level={2}>
    <span className="w-1.5 h-6 rounded-full" style={{ background: AREAS[area].color }} />
    <span className="text-sm font-extrabold uppercase tracking-wide" style={{ color: AREAS[area].color }}>{AREAS[area].nombre}</span>
    {detalle && <span className="text-[11px] font-semibold text-slate-500">{detalle}</span>}
    <span className="flex-1 border-t border-slate-200" />
  </div>
);
const celda = 'w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs text-slate-700 transition-all';
const Equipo: React.FC<{ plan: Plan; cambiar: (f: (p: Plan) => Plan) => void }> = ({ plan, cambiar }) => {
  const equipo = plan.ficha.equipo ?? [];
  const setEq = (f: (e: typeof equipo) => typeof equipo) => cambiar((p) => ({ ...p, ficha: { ...p.ficha, equipo: f(p.ficha.equipo ?? []) } }));
  const upd = (id: string, k: 'departamento' | 'nombre' | 'cargo' | 'email' | 'funcion', v: string) => setEq((e) => e.map((m) => (m.id === id ? { ...m, [k]: v } : m)));
  const hayResp = !!responsableDelPlan(plan.ficha).trim();
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-800 flex-1">Estructura organizativa y responsables *</h3>
        <button className={btnS} onClick={() => setEq((e) => [...e, miembroVacio()])}><Plus size={14} /> Añadir persona</button>
      </div>
      <p className="text-xs text-slate-600 mb-2">Indique quién es el responsable del plan y quién lleva cada línea de acción.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead className="text-[10px] font-bold uppercase text-slate-500 tracking-wide border-b border-slate-100"><tr><th className="p-1.5">Departamento</th><th className="p-1.5">Nombre</th><th className="p-1.5">Cargo</th><th className="p-1.5">Email</th><th className="p-1.5">Función en el plan</th><th className="w-8" /></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {equipo.map((m) => (
              <tr key={m.id}>
                <td className="p-1"><input className={celda} value={m.departamento} placeholder="Dpto." aria-label="Departamento" onChange={(e) => upd(m.id, 'departamento', e.target.value)} /></td>
                <td className="p-1"><input className={`${celda} font-semibold`} value={m.nombre} placeholder="Nombre" aria-label="Nombre" onChange={(e) => upd(m.id, 'nombre', e.target.value)} /></td>
                <td className="p-1"><input className={celda} value={m.cargo} placeholder="Cargo" aria-label="Cargo" onChange={(e) => upd(m.id, 'cargo', e.target.value)} /></td>
                <td className="p-1"><input className={celda} value={m.email} placeholder="Email" aria-label="Email" onChange={(e) => upd(m.id, 'email', e.target.value)} /></td>
                <td className="p-1"><select className={celda} value={m.funcion} aria-label="Función en el plan" onChange={(e) => upd(m.id, 'funcion', e.target.value)}>{FUNCIONES_PLAN.map((x) => <option key={x}>{x}</option>)}</select></td>
                <td className="p-1 text-center"><button className="text-slate-300 hover:text-red-500 p-1 rounded" aria-label="Quitar persona" onClick={() => setEq((e) => e.filter((x) => x.id !== m.id))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {equipo.length === 0 && <div className="text-center py-6 text-slate-500 italic text-sm border border-dashed border-slate-200 rounded-xl mt-2">Aún no hay personas. Añada al menos al responsable del plan.</div>}
      </div>
      {!hayResp && <p className="text-xs text-amber-700 font-semibold mt-2 flex items-center gap-1"><AlertTriangle size={13} /> Falta indicar quién tiene la función «{FUNCION_RESPONSABLE}» (dato obligatorio).</p>}
    </div>
  );
};

const IndicadoresPanel: React.FC<{ plan: Plan; anio: number; cambiar: (f: (p: Plan) => Plan) => void; aniosOpc: number[]; setAnio: (a: number) => void }> = ({ plan, anio, cambiar, setAnio }) => {
  const ant = anio - 1;
  const anios = [...new Set([...Object.keys(plan.datos).map(Number), anio])].sort((a, b) => a - b);
  const siguiente = anios[anios.length - 1] + 1;
  const dentroVigencia = siguiente <= plan.ficha.vigenciaHasta;
  const [vista, setVista] = useState<'datos' | 'evolucion'>('evolucion');
  const nuevoAnio = () => { cambiar((p) => ({ ...p, datos: { ...p.datos, [siguiente]: p.datos[siguiente] ?? {} } })); setAnio(siguiente); };
  const setDato = (campo: string, v: string) => cambiar((p) => ({ ...p, datos: { ...p.datos, [anio]: { ...(p.datos[anio] ?? {}), [campo]: v === '' ? undefined : Number(v) } } }));
  const comp = completitud(plan, anio);
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden bg-white text-sm font-semibold" role="tablist" aria-label="Vista de indicadores">
        {([['evolucion', 'Evolución anual'], ['datos', 'Introducción de datos']] as const).map(([k, n]) => (
          <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={`px-4 py-2 transition-colors ${vista === k ? 'text-white' : 'text-slate-700 hover:bg-slate-50'}`} style={vista === k ? { background: '#0002C9' } : undefined}>{n}</button>
        ))}
      </div>
      {vista === 'evolucion' ? <Evolucion plan={plan} anio={anios[anios.length - 1]} /> : <>
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Año de evaluación">
        {anios.map((a) => (
          <button key={a} role="tab" aria-selected={a === anio} onClick={() => setAnio(a)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${a === anio ? 'text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
            style={a === anio ? { background: '#0002C9' } : undefined}>{a}</button>
        ))}
        <button onClick={nuevoAnio} disabled={!dentroVigencia} title={dentroVigencia ? `Añadir ${siguiente} y entrar sus datos por área` : `El plan termina en ${plan.ficha.vigenciaHasta}: renueve el plan para seguir`}
          className="px-3 py-2 rounded-lg text-sm font-bold bg-green-50 text-green-800 border border-green-200 hover:bg-green-100 disabled:opacity-40 inline-flex items-center gap-1"><Plus size={15} /> {siguiente}</button>
      </div>
      <p className="text-xs text-slate-600">Introduzca los datos del año {anio}; el valor del indicador se calcula solo. El kg CO₂e por pernoctación procede del cálculo de Huella y los residuos de los pesajes del PPDA (conexión prevista; por ahora se introducen a mano).</p>
      {ORDEN_AREAS.map((a) => (
        <details key={a} className="bg-white rounded-2xl border border-slate-200 shadow-sm" open={a === 'energia'} style={{ borderLeft: `4px solid ${AREAS[a].color}` }}>
          <summary className="cursor-pointer px-5 py-3.5 flex items-center gap-3"><span className="w-3 h-3 rounded-full" style={{ background: AREAS[a].color }} /><span className="text-sm font-bold text-slate-800 flex-1">{AREAS[a].nombre}</span><span className="text-[11px] font-semibold text-slate-500">{comp[a].con}/{comp[a].total} con dato</span></summary>
          <div className="px-5 pb-4 space-y-3">
            {INDICADORES.filter((i) => i.area === a).map((i) => {
              const v = valorIndicador(plan, i.id, anio), va = valorIndicador(plan, i.id, ant);
              return (
                <div key={i.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline gap-x-3"><p className="text-sm font-semibold text-slate-800 flex-1 min-w-[220px]">{i.nombre}</p><p className="text-lg font-extrabold tabular-nums" style={{ color: '#00093D' }}>{nf(v, i.decimales)} <span className="text-xs font-semibold text-slate-500">{i.unidad}</span></p></div>
                  <p className="text-[11px] text-slate-500 mb-2">{i.formula}{va !== undefined && <> · {ant}: {nf(va, i.decimales)} {i.unidad}</>}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {i.campos.map((c) => (
                      <label key={c.id} className="text-[11px] font-semibold text-slate-600">{c.etiqueta} ({c.unidad})
                        <input type="number" className={`${input} mt-0.5`} value={plan.datos[anio]?.[c.id] ?? ''} onChange={(e) => setDato(c.id, e.target.value)} />
                        {c.ayuda && <span className="block text-[10px] font-normal text-slate-500">{c.ayuda}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {a === 'energia' && (
              <label className="text-[11px] font-semibold text-slate-600 block">Letra del certificado energético ({anio})
                <input className={`${input} mt-0.5 max-w-[100px]`} maxLength={1} value={plan.letraCertificado[anio] ?? ''} onChange={(e) => cambiar((p) => ({ ...p, letraCertificado: { ...p.letraCertificado, [anio]: e.target.value.toUpperCase() } }))} /></label>
            )}
            {a === 'gobernanza' && (
              <label className="text-xs font-semibold text-slate-700 block">Acciones realizadas con los clientes (una por línea)
                <textarea rows={4} className={`${input} mt-1`} value={plan.accionesClientes.join('\n')} onChange={(e) => cambiar((p) => ({ ...p, accionesClientes: e.target.value.split('\n').filter((x) => x.trim() !== '' || e.target.value.endsWith('\n')) }))} />
                <span className="text-[11px] font-normal text-slate-500">Comunicaciones con recomendaciones sobre ahorro de energía y agua, buffet, separación de residuos o cambio de toallas.</span></label>
            )}
          </div>
        </details>
      ))}
      </>}
    </div>
  );
};
/** Gráfico de evolución de un indicador: barras por año y, si hay objetivo con valor, línea de meta punteada y marcador en su año. */
const MiniEvolucion: React.FC<{ fila: ReturnType<typeof evolucion>[number]; anios: number[]; meta?: { valor: number; anio: number }; color: string }> = ({ fila, anios, meta, color }) => {
  const W = 300, H = 150, L = 8, R = 8, T = 22, B = 22;
  const slots = [...anios, ...(meta && !anios.includes(meta.anio) && meta.anio > anios[anios.length - 1] ? [meta.anio] : [])];
  const vals = anios.map((a) => fila.valores[a]).filter((v): v is number => v !== undefined);
  const max = Math.max(...vals, meta?.valor ?? 0, 1e-9) * 1.12;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - R) / Math.max(slots.length, 1);
  const fmtV = (v: number) => nf(v, fila.decimales);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Evolución de ${fila.nombre}`}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#CBD5E1" />
      {slots.map((a, i) => {
        const v = fila.valores[a]; const x = L + i * bw + bw * 0.18; const w = bw * 0.64;
        if (v === undefined) return <text key={a} x={L + i * bw + bw / 2} y={H - B - 6} textAnchor="middle" fontSize="9" fill="#94A3B8">{anios.includes(a) ? 'sin dato' : ''}</text>;
        return <g key={a}><rect x={x} y={y(v)} width={w} height={H - B - y(v)} rx="3" fill={a === anios[anios.length - 1] ? color : `${color}99`} /><text x={x + w / 2} y={y(v) - 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#00093D">{fmtV(v)}</text></g>;
      })}
      {meta && (() => {
        const idx = slots.indexOf(meta.anio); const yy = y(meta.valor);
        return <g><line x1={L} x2={W - R} y1={yy} y2={yy} stroke="#F9416D" strokeWidth="1.4" strokeDasharray="5 3" />
          {idx >= 0 && fila.valores[meta.anio] === undefined && <rect x={L + idx * bw + bw * 0.18} y={yy} width={bw * 0.64} height={H - B - yy} rx="3" fill="none" stroke="#F9416D" strokeDasharray="4 3" />}
          <text x={W - R} y={yy - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="#F9416D">Meta {meta.anio}: {fmtV(meta.valor)}</text></g>;
      })()}
      {slots.map((a, i) => <text key={`x${a}`} x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#475569">{a}</text>)}
    </svg>
  );
};

/** Línea pequeña de la evolución de un indicador (una fila de la tabla). */
const Spark: React.FC<{ valores: Array<number | undefined>; color: string; mejora: boolean | null }> = ({ valores, color, mejora }) => {
  const W = 86, H = 24, P = 3;
  const pts = valores.map((v, i) => (v === undefined ? null : { i, v })).filter((x): x is { i: number; v: number } => x !== null);
  if (pts.length < 2) return <span className="text-[10px] text-slate-400">—</span>;
  const mn = Math.min(...pts.map((p) => p.v)), mx = Math.max(...pts.map((p) => p.v)), rg = mx - mn || 1;
  const X = (i: number) => P + (i * (W - 2 * P)) / Math.max(valores.length - 1, 1), Y = (v: number) => H - P - ((v - mn) / rg) * (H - 2 * P);
  const ult = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <polyline points={pts.map((p) => `${X(p.i)},${Y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(ult.i)} cy={Y(ult.v)} r="2.8" fill={mejora === null ? color : mejora ? '#00A63E' : '#E5004C'} />
    </svg>
  );
};

const Evolucion: React.FC<{ plan: Plan; anio: number }> = ({ plan, anio }) => {
  const [abierto, setAbierto] = useState<string | null>(null);
  const anios = Object.keys(plan.datos).map(Number).sort((a, b) => a - b).filter((a) => a <= anio);
  const ev = evolucion(plan, anios);
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">Evolución anual de los indicadores</h2>
        <p className="text-[11px] text-slate-500 mb-2">Pulse un indicador para ver su gráfico grande, con la línea de meta si el plan de acción tiene un valor objetivo.</p>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-1.5">Indicador</th><th>Unidad</th>{anios.map((a) => <th key={a} className="text-right">{a}</th>)}<th className="pl-3">Evolución</th><th className="text-right">Tendencia</th></tr></thead>
          <tbody>{ORDEN_AREAS.flatMap((a) => [
            <tr key={`h${a}`}><td colSpan={anios.length + 4} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: AREAS[a].color }}>{AREAS[a].nombre}</td></tr>,
            ...ev.filter((x) => x.area === a).flatMap((x) => {
              const sirve = anios.some((y) => x.valores[y] !== undefined);
              const o = plan.objetivos.find((q) => q.indicadorId === x.id && q.metaValor !== undefined);
              const mejora = x.tendencia === 'mejora' ? true : x.tendencia === 'empeora' ? false : null;
              return [
                <tr key={x.id} className={`border-b border-slate-100 ${sirve ? 'cursor-pointer hover:bg-slate-50' : ''}`} onClick={() => sirve && setAbierto(abierto === x.id ? null : x.id)} aria-expanded={sirve ? abierto === x.id : undefined}>
                  <td className="py-1.5 pr-2">{sirve && <span className="text-slate-400 mr-1">{abierto === x.id ? '▾' : '▸'}</span>}{x.nombre}</td><td className="pr-2 text-slate-500">{x.unidad}</td>
                  {anios.map((y) => <td key={y} className="text-right tabular-nums">{nf(x.valores[y], x.decimales)}</td>)}
                  <td className="pl-3"><Spark valores={anios.map((y) => x.valores[y])} color={AREAS[a].color} mejora={mejora} /></td><td className="text-right"><Tendencia t={x.tendencia} /></td>
                </tr>,
                ...(abierto === x.id ? [<tr key={`g${x.id}`}><td colSpan={anios.length + 4} className="py-3"><div className="max-w-md mx-auto rounded-xl border border-slate-200 p-3 bg-white">
                  <p className="text-xs font-semibold text-slate-800 mb-1">{x.nombre} <span className="font-normal text-slate-500">({x.unidad})</span></p>
                  <MiniEvolucion fila={x} anios={anios} color={AREAS[a].color} meta={o ? { valor: o.metaValor!, anio: Number(o.plazo) || plan.ficha.vigenciaHasta } : undefined} />
                </div></td></tr>] : []),
              ];
            }),
          ])}</tbody>
        </table></div>
      </div>
    </div>
  );
};

// ───────────────────────────── Plan de acción ─────────────────────────────
const PlanPanel: React.FC<{ plan: Plan; anio: number; cambiar: (f: (p: Plan) => Plan) => void; onCatalogo: () => void }> = ({ plan, anio, cambiar, onCatalogo }) => {
  const setObj = (id: string, k: keyof Objetivo, v: string) => cambiar((p) => ({ ...p, objetivos: p.objetivos.map((o) => (o.id === id ? { ...o, [k]: v } : o)) }));
  const setAcc = (oid: string, aid: string, patch: Partial<Accion>) => cambiar((p) => ({ ...p, objetivos: p.objetivos.map((o) => (o.id === oid ? { ...o, acciones: o.acciones.map((a) => (a.id === aid ? { ...a, ...patch, ...(patch.fin !== undefined ? { plazo: patch.fin.slice(0, 4) } : {}) } : a)) } : o)) }));
  const addAcc = (o: Objetivo) => cambiar((p) => ({ ...p, objetivos: p.objetivos.map((x) => (x.id === o.id ? { ...x, acciones: [...x.acciones, { id: `${o.id}-${Date.now()}`, codigo: `${o.codigo}${String.fromCharCode(65 + o.acciones.length)}`, descripcion: '', responsable: '', plazo: String(anio), indicadores: o.indicadorId ? [o.indicadorId] : [], recursos: '', inversion: '', inicio: '', fin: '' }] } : x)) }));
  const delAcc = (oid: string, aid: string) => cambiar((p) => ({ ...p, objetivos: p.objetivos.map((o) => (o.id === oid ? { ...o, acciones: o.acciones.filter((a) => a.id !== aid) } : o)) }));
  const delObj = (o: Objetivo) => { if (confirm(`¿Eliminar el objetivo «${o.descripcion}» y sus acciones?`)) cambiar((p) => ({ ...p, objetivos: p.objetivos.filter((x) => x.id !== o.id) })); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><button className={btnP} onClick={onCatalogo}><Plus size={15} /> Añadir objetivo del catálogo</button></div>
      {plan.objetivos.length === 0 && <div className={`${card} text-sm text-slate-600`}>Aún no hay objetivos. Añada uno del catálogo de medidas sugeridas (energía, agua, residuos, alimentos y gobernanza).</div>}
      {ORDEN_AREAS.map((area) => ({ area, os: plan.objetivos.filter((o) => o.area === area) })).filter((g) => g.os.length).map(({ area, os }) => (
        <React.Fragment key={area}>
        <CabeceraArea area={area} detalle={`${os.length} ${os.length === 1 ? 'objetivo' : 'objetivos'} · ${os.reduce((n, o) => n + o.acciones.length, 0)} acciones`} />
        {os.map((o) => (
        <details key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ borderLeft: `4px solid ${AREAS[area].color}` }}>
          <summary className="cursor-pointer px-5 py-3.5 flex flex-wrap items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: AREAS[o.area].color }} />
            <span className="text-sm font-bold text-slate-800 flex-1 min-w-[220px]">{o.codigo}. {o.descripcion}</span>
            <span className="text-[11px] font-semibold text-slate-500">{nombreArea(o.area)} · {o.acciones.length} acciones · {pc(progresoObjetivo(plan, o, anio))} en {anio}</span>
          </summary>
          <div className="px-5 pb-5 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Campo etiqueta="Objetivo" ancho><input className={input} value={o.descripcion} onChange={(e) => setObj(o.id, 'descripcion', e.target.value)} /></Campo>
              <Campo etiqueta="Indicador asociado"><select className={input} value={o.indicadorId} onChange={(e) => setObj(o.id, 'indicadorId', e.target.value)}>{INDICADORES.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></Campo>
              <Campo etiqueta="Responsable"><input className={input} value={o.responsable} onChange={(e) => setObj(o.id, 'responsable', e.target.value)} /></Campo>
              <Campo etiqueta="Línea base"><input className={input} value={o.lineaBase} onChange={(e) => setObj(o.id, 'lineaBase', e.target.value)} placeholder="Valor de partida del indicador" /></Campo>
              <Campo etiqueta="Meta"><input className={input} value={o.meta} onChange={(e) => setObj(o.id, 'meta', e.target.value)} placeholder="p. ej. −5 % en 2028" /></Campo>
              <Campo etiqueta={`Valor que se quiere alcanzar (${INDICADORES.find((i) => i.id === o.indicadorId)?.unidad ?? 'unidad del indicador'})`}><input type="number" className={input} value={o.metaValor ?? ''} onChange={(e) => cambiar((p) => ({ ...p, objetivos: p.objetivos.map((x) => (x.id === o.id ? { ...x, metaValor: e.target.value === '' ? undefined : Number(e.target.value) } : x)) }))} placeholder="Para dibujar la línea de meta" /></Campo>
              <Campo etiqueta="Recursos necesarios"><input className={input} value={o.recursos} onChange={(e) => setObj(o.id, 'recursos', e.target.value)} /></Campo>
              <Campo etiqueta="Inversión"><input className={input} value={o.inversion} onChange={(e) => setObj(o.id, 'inversion', e.target.value)} /></Campo>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">Acciones</p>
              <div className="space-y-2.5">
                {o.acciones.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-1 text-xs font-bold text-slate-600">{a.codigo}</span>
                      <input className={`${input} col-span-7`} value={a.descripcion} onChange={(e) => setAcc(o.id, a.id, { descripcion: e.target.value })} aria-label="Acción" placeholder="Descripción de la acción" />
                      <input className={`${input} col-span-3`} value={a.responsable} placeholder="Responsable" onChange={(e) => setAcc(o.id, a.id, { responsable: e.target.value })} aria-label="Responsable de la acción" />
                      <button className="col-span-1 p-1.5 text-slate-500 hover:text-red-600" onClick={() => delAcc(o.id, a.id)} aria-label={`Eliminar la acción ${a.codigo}`}><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <label className="text-[11px] font-semibold text-slate-600">Inicio<input type="date" className={`${input} mt-0.5`} value={a.inicio ?? ''} onChange={(e) => setAcc(o.id, a.id, { inicio: e.target.value })} /></label>
                      <label className="text-[11px] font-semibold text-slate-600">Fin<input type="date" className={`${input} mt-0.5`} value={a.fin ?? ''} min={a.inicio || undefined} onChange={(e) => setAcc(o.id, a.id, { fin: e.target.value })} /></label>
                      <label className="text-[11px] font-semibold text-slate-600">Recursos<input className={`${input} mt-0.5`} value={a.recursos ?? ''} placeholder="Humanos, materiales…" onChange={(e) => setAcc(o.id, a.id, { recursos: e.target.value })} /></label>
                      <label className="text-[11px] font-semibold text-slate-600">Inversión<input className={`${input} mt-0.5`} value={a.inversion ?? ''} placeholder="p. ej. 12.000 €" onChange={(e) => setAcc(o.id, a.id, { inversion: e.target.value })} /></label>
                    </div>
                    <IndicadoresAccion seleccion={a.indicadores ?? []} onChange={(ids) => setAcc(o.id, a.id, { indicadores: ids })} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2"><button className={btnS} onClick={() => addAcc(o)}><Plus size={14} /> Añadir acción</button><button className={`${btnS} text-red-700`} onClick={() => delObj(o)}><Trash2 size={14} /> Eliminar objetivo</button></div>
            </div>
          </div>
        </details>
        ))}
        </React.Fragment>
      ))}
    </div>
  );
};

/** Indicadores relacionados con una acción: chips de los elegidos y lista, agrupada por área, para marcar o desmarcar. */
const IndicadoresAccion: React.FC<{ seleccion: string[]; onChange: (ids: string[]) => void }> = ({ seleccion, onChange }) => (
  <details className="text-xs">
    <summary className="cursor-pointer flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-slate-600">Indicadores relacionados</span>
      {seleccion.length === 0 && <span className="text-[11px] text-slate-400">ninguno · pulse para elegir</span>}
      {seleccion.map((id) => { const i = INDICADORES.find((x) => x.id === id); return i ? <span key={id} className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white" style={{ background: AREAS[i.area].color }}>{i.nombre}</span> : null; })}
    </summary>
    <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 bg-white rounded-lg border border-slate-200 p-2">
      {ORDEN_AREAS.flatMap((a) => INDICADORES.filter((i) => i.area === a).map((i) => (
        <label key={i.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" className="accent-green-600" checked={seleccion.includes(i.id)} onChange={(e) => onChange(e.target.checked ? [...seleccion, i.id] : seleccion.filter((x) => x !== i.id))} />
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: AREAS[a].color }} /><span>{i.nombre}</span></label>
      )))}
    </div>
  </details>
);

const CatalogoMedidas: React.FC<{ onCerrar: () => void; onElegir: (m: (typeof MEDIDAS)[number]) => void }> = ({ onCerrar, onElegir }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Catálogo de medidas">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
      <div className="flex items-center px-5 py-4 border-b border-slate-200"><h2 className="text-base font-bold flex-1">Catálogo de objetivos y medidas</h2><button onClick={onCerrar} className="p-1.5 text-slate-500 hover:text-slate-900" aria-label="Cerrar"><X size={18} /></button></div>
      <div className="overflow-auto p-4 space-y-2">
        {MEDIDAS.map((m) => (
          <div key={m.objetivo} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: AREAS[m.area].color }} /><p className="text-sm font-bold text-slate-800 flex-1">{m.objetivo}</p><button className={btnP} onClick={() => onElegir(m)}>Añadir</button></div>
            <p className="text-[11px] text-slate-500 mt-1">{nombreArea(m.area)} · {m.acciones.length} acciones sugeridas: {m.acciones.slice(0, 3).join(' · ')}…</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ───────────────────────────── Seguimiento ─────────────────────────────
const SeguimientoPanel: React.FC<{ plan: Plan; anio: number; cambiar: (f: (p: Plan) => Plan) => void; cerrado: boolean }> = ({ plan, anio, cambiar, cerrado }) => {
  const seg = plan.seguimiento[anio];
  const setSeg = (aid: string, f: (s: ReturnType<typeof vacioSeg>) => ReturnType<typeof vacioSeg>) => cambiar((p) => {
    const a = p.seguimiento[anio] ?? { cerrado: false, acciones: {} };
    return { ...p, seguimiento: { ...p.seguimiento, [anio]: { ...a, acciones: { ...a.acciones, [aid]: f(a.acciones[aid] ?? vacioSeg()) } } } };
  });
  const alternarCierre = () => {
    if (!cerrado && !confirm(`¿Cerrar el seguimiento de ${anio}? Quedará bloqueado hasta que se reabra.`)) return;
    cambiar((p) => ({ ...p, seguimiento: { ...p.seguimiento, [anio]: { ...(p.seguimiento[anio] ?? { acciones: {} }), cerrado: !cerrado } } }));
  };
  if (plan.objetivos.length === 0) return <div className={`${card} text-sm text-slate-600`}>Defina antes los objetivos en «Plan de acción».</div>;
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="flex-1 min-w-[220px]"><p className="text-xs font-semibold text-slate-500">Avance global {anio}</p><p className="text-2xl font-extrabold" style={{ color: '#00093D' }}>{pc(progresoPlan(plan, anio))}</p><div className="mt-1.5 max-w-xs"><Barra valor={progresoPlan(plan, anio)} /></div></div>
        {cerrado && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-800 inline-flex items-center gap-1"><Lock size={12} /> Año cerrado</span>}
        <button className={cerrado ? btnS : btnP} onClick={alternarCierre}>{cerrado ? <><Unlock size={14} /> Reabrir {anio}</> : <><Lock size={14} /> Cerrar seguimiento {anio}</>}</button>
      </div>
      {ORDEN_AREAS.map((area) => ({ area, os: plan.objetivos.filter((o) => o.area === area) })).filter((g) => g.os.length).map(({ area, os }) => (
        <React.Fragment key={area}>
        <CabeceraArea area={area} detalle={`Avance ${anio}: ${pc(os.reduce((x, o) => x + progresoObjetivo(plan, o, anio), 0) / os.length)}`} />
        {os.map((o) => (
        <details key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm" open style={{ borderLeft: `4px solid ${AREAS[area].color}` }}>
          <summary className="cursor-pointer px-5 py-3.5 flex flex-wrap items-center gap-3"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: AREAS[o.area].color }} /><span className="text-sm font-bold text-slate-800 flex-1 min-w-[200px]">{o.codigo}. {o.descripcion}</span><span className="w-32"><Barra valor={progresoObjetivo(plan, o, anio)} color={AREAS[o.area].color} /></span><span className="text-xs font-bold text-slate-700 w-10 text-right">{pc(progresoObjetivo(plan, o, anio))}</span></summary>
          <div className="px-5 pb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-1.5">Acción</th>{TRIMESTRES.map((t) => <th key={t} className="text-center w-14">{t.toUpperCase()}</th>)}<th className="pl-3">Evidencia / notas</th></tr></thead>
              <tbody>{o.acciones.map((a) => {
                const s = seg?.acciones[a.id] ?? vacioSeg();
                return (
                  <tr key={a.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2"><strong>{a.codigo}</strong> {a.descripcion}<span className="block text-[10px] text-slate-500">{a.responsable || 'Sin responsable'} · {pc(progresoAccion(s))}</span></td>
                    {TRIMESTRES.map((t) => <td key={t} className="text-center pt-2"><input type="checkbox" className="w-4 h-4 accent-green-600" checked={s[t].cumple} disabled={cerrado} aria-label={`${a.codigo} ${t.toUpperCase()} cumplido`} onChange={(e) => setSeg(a.id, (x) => ({ ...x, [t]: { ...x[t], cumple: e.target.checked } }))} /></td>)}
                    <td className="pl-3 py-1.5 min-w-[220px]">
                      <input className={`${input} text-xs`} placeholder="Evidencia (documento, factura, acta…)" disabled={cerrado} value={TRIMESTRES.map((t) => s[t].evidencia).find((x) => x) ?? ''} onChange={(e) => setSeg(a.id, (x) => { const t = [...TRIMESTRES].reverse().find((q) => x[q].cumple) ?? 't1'; return { ...x, [t]: { ...x[t], evidencia: e.target.value } }; })} />
                      <input className={`${input} text-xs mt-1`} placeholder="Notas" disabled={cerrado} value={s.notas} onChange={(e) => setSeg(a.id, (x) => ({ ...x, notas: e.target.value }))} />
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </details>
        ))}
        </React.Fragment>
      ))}
    </div>
  );
};

// ───────────────────────────── Cumplimiento ─────────────────────────────
const CumplimientoPanel: React.FC<{ plan: Plan; anio: number; filasC: ReturnType<typeof cumplimiento>; cambiar: (f: (p: Plan) => Plan) => void }> = ({ plan, anio, filasC, cambiar }) => {
  const set = (id: string, k: 'estado' | 'evidencia' | 'nota', v: string) => cambiar((p) => ({ ...p, requisitos: { ...p.requisitos, [id]: { estado: 'pendiente', evidencia: '', nota: '', ...(p.requisitos[id] ?? {}), [k]: v } } }));
  const cm = camas(plan, anio);
  const color = (e: EstadoReq) => ESTADOS.find((x) => x[0] === e)![2];
  const porArea = (['general', ...ORDEN_AREAS] as Array<Area | 'general'>).map((a) => ({ a, filas: filasC.filter((f) => f.area === a) })).filter((g) => g.filas.length);
  return (
    <div className="space-y-4">
      {porArea.map(({ a, filas }) => (
        <div key={a} className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-2">{nombreArea(a)}</h2>
          <div className="space-y-2">{filas.map((f) => (
            <div key={f.id} className={`rounded-xl border p-3 ${f.alerta ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[240px]"><p className="text-sm text-slate-800">{f.texto}</p><p className="text-[11px] text-slate-500">{f.norma} · {f.exigible ? 'exigible desde' : 'será exigible desde'} {new Date(f.desde).toLocaleDateString('es-ES')}</p></div>
                <select className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border-0 ${color(f.estado)}`} value={f.estado} onChange={(e) => set(f.id, 'estado', e.target.value)} aria-label={`Estado: ${f.texto}`}>{ESTADOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <input className={`${input} text-xs`} placeholder="Evidencia" value={f.evidencia} onChange={(e) => set(f.id, 'evidencia', e.target.value)} />
                <input className={`${input} text-xs`} placeholder="Nota / plan para cumplirlo" value={f.nota} onChange={(e) => set(f.id, 'nota', e.target.value)} />
              </div>
            </div>
          ))}</div>
        </div>
      ))}
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">Camas elevables ({CATEGORIAS_HOTEL[plan.ficha.categoria]})</h2>
        <p className="text-xs text-slate-600 mb-3">En {anio} se exige al menos el <strong>{cm.exigido} %</strong> de camas elevables. {cm.cumple === null ? 'Indique el porcentaje instalado.' : cm.cumple ? 'El establecimiento cumple.' : 'Por debajo de lo exigido.'}</p>
        <label className="text-xs font-semibold text-slate-700 inline-flex items-center gap-2">Instaladas en {anio} (%)
          <input type="number" min={0} max={100} className={`${input} w-24`} value={plan.camasElevablesInstaladas[anio] ?? ''} onChange={(e) => cambiar((p) => ({ ...p, camasElevablesInstaladas: { ...p.camasElevablesInstaladas, [anio]: e.target.value === '' ? undefined : Number(e.target.value) } }))} /></label>
        <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-1.5">Categoría</th>{[2023, 2024, 2025, 2026, 2027, 2028].map((a) => <th key={a} className={`text-right ${a === anio ? 'text-brand-700' : ''}`}>{a}</th>)}</tr></thead>
          <tbody>{tablaCamas().map((t) => <tr key={t.categoria} className={`border-b border-slate-100 ${t.categoria === plan.ficha.categoria ? 'font-bold bg-green-50' : ''}`}><td className="py-1.5">{t.nombre}</td>{t.porAnio.map((p, i) => <td key={i} className="text-right tabular-nums">{p === null ? '—' : `${p} %`}</td>)}</tr>)}</tbody></table></div>
        <p className="text-[10px] text-slate-500 mt-2">Porcentajes según el resumen de la guía; pendiente de contraste final con el texto legal.</p>
      </div>
      <p className="text-[11px] text-slate-500">{REQUISITOS.length} requisitos de la Ley 3/2022 y normativa asociada. Los OCA y requisitos legales sectoriales (legionella, APPCC, gases, etc.) se gestionan aparte.</p>
    </div>
  );
};

// ───────────────────────────── Informe ─────────────────────────────
const descargar = (blob: Blob, nombre: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
const imagenBytes = async (url: string) => { try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined; } catch { return undefined; } };

const InformePanel: React.FC<{ plan: Plan; anio: number; cambiar: (f: (p: Plan) => Plan) => void }> = ({ plan, anio, cambiar }) => {
  const marco = useRef<HTMLIFrameElement>(null);
  const [generando, setGenerando] = useState(false);
  const modelo = useMemo(() => construirInformeCirculardad(plan, { anioEvaluacion: anio, hoy: HOY }), [plan, anio]);
  const html = useMemo(() => informeAHtml(modelo, { baseUrl: window.location.origin }), [modelo]);
  const word = async () => {
    setGenerando(true);
    try {
      const [{ informeADocx }, { svgAPng }, { cargarMarca }] = await Promise.all([import('../huella/informeDocx'), import('../huella/svgPng'), import('../huella/marca')]);
      const marca = await cargarMarca();
      descargar(await informeADocx(modelo, marca, svgAPng), `${modelo.meta.codigo}_Plan_circularidad_${anio}_V${String(plan.version).padStart(2, '0')}.docx`);
    } finally { setGenerando(false); }
  };
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="flex-1 min-w-[220px]"><p className="text-sm font-bold text-slate-800">{modelo.meta.titulo} · {anio}</p><p className="text-xs text-slate-600">{modelo.meta.estado} · {modelo.meta.edicion}</p></div>
        <button className={btnS} onClick={() => marco.current?.contentWindow?.print()}><Printer size={15} /> Imprimir / guardar PDF</button>
        <button className={btnP} onClick={word} disabled={generando}>{generando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Descargar Word</button>
        <button className={btnS} onClick={() => cambiar((p) => ({ ...p, cerrado: !p.cerrado, version: p.cerrado ? p.version : p.version }))}>{plan.cerrado ? <><Unlock size={14} /> Volver a borrador</> : <><CheckCircle2 size={14} /> Marcar como aprobado</>}</button>
      </div>
      {modelo.pendientes.length > 0 && (
        <details className={`${card} border-amber-200`}><summary className="cursor-pointer text-sm font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> {modelo.pendientes.length} dato(s) por completar antes de entregarlo</summary>
          <ul className="mt-2 text-xs text-slate-700 list-disc pl-5 space-y-0.5">{modelo.pendientes.map((x, i) => <li key={i}>{x}</li>)}</ul></details>
      )}
      <iframe ref={marco} title="Vista previa del informe" srcDoc={html} className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: 720 }} />
    </div>
  );
};



// ---------- Biblioteca de planes ----------
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const CircularidadView: React.FC<{ onBack: () => void; currentUser: string }> = ({ onBack, currentUser }) => {
  const [abierto, setAbierto] = useState<{ id: string | null; plan: Plan } | null>(null);
  const [planes, setPlanes] = useState<FilaPlan[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [orgNueva, setOrgNueva] = useState('');
  const [creando, setCreando] = useState(false);

  const recargar = async () => {
    setCargando(true); setError('');
    try { const [p, o] = await Promise.all([circularidadService.listar(), huellaService.organizaciones()]); setPlanes(p); setOrgs(o); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  };
  useEffect(() => { void recargar(); }, []);

  const abrir = async (id: string) => {
    setError('');
    try { setAbierto({ id, plan: await circularidadService.abrir(id) }); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const crear = async () => {
    const org = orgs.find((o) => o.id === orgNueva); if (!org) return;
    setCreando(true); setError('');
    try {
      const centros = await huellaService.centros(org.id).catch(() => []);
      const uno = centros.length === 1 ? centros[0] : undefined;
      const plan = planVacio({ establecimiento: org.nombre, empresa: org.nombre, direccion: uno?.direccion ?? org.direccion ?? '', habitaciones: uno?.unidades_alojamiento ?? undefined });
      const fila = await circularidadService.crear(org.id, plan);
      setAbierto({ id: fila.id, plan: fila.plan });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCreando(false); }
  };
  const salir = () => { setAbierto(null); void recargar(); };

  if (abierto) return <Editor key={abierto.id ?? 'demo'} plan0={abierto.plan} demo={abierto.id === null} currentUser={currentUser} onSalir={salir} onGuardar={abierto.id ? (p) => circularidadService.guardar(abierto.id!, p) : undefined} />;

  const sinPlan = orgs.filter((o) => !planes.some((p) => p.organizacion_id === o.id));
  const nombreOrg = (id: string) => orgs.find((o) => o.id === id)?.nombre;
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white" aria-label="Volver al inicio"><ArrowLeft size={18} /></button>
          <img src="/logo-hsgreen-recortado.png" alt="HS GREEN" className="h-10 w-auto object-contain" />
          <h1 className="text-xl font-extrabold">Planes de circularidad</h1>
        </div>
        {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span></div>}
        <div className={card}>
          <h2 className="font-bold mb-3">Nuevo plan</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <select className={`${input} flex-1 min-w-[220px]`} value={orgNueva} onChange={(e) => setOrgNueva(e.target.value)} aria-label="Organización">
              <option value="">Elija la organización…</option>
              {sinPlan.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <button className={btnP} disabled={!orgNueva || creando} onClick={() => void crear()}>{creando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear plan</button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Se crea un plan por establecimiento, con la ficha rellenada con los datos de la organización. Las organizaciones son las de Huella de carbono.</p>
        </div>
        <div className={card}>
          <h2 className="font-bold mb-3">Planes guardados</h2>
          {cargando ? <p className="text-sm text-slate-600 inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
            : planes.length === 0 ? <p className="text-sm text-slate-600">Todavía no hay planes. Cree el primero arriba o abra el ejemplo.</p>
            : <ul className="divide-y divide-slate-100">{planes.map((p) => (
              <li key={p.id}><button className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-lg px-2" onClick={() => void abrir(p.id)}>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{p.nombre}</p><p className="text-xs text-slate-500 truncate">{nombreOrg(p.organizacion_id) ?? 'Organización'} · Plan {p.vigencia_desde}-{p.vigencia_hasta} · actualizado {fechaCorta(p.updated_at)}</p></div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 capitalize">{p.estado}</span>
              </button></li>))}</ul>}
        </div>
        <div className={`${card} flex flex-wrap items-center gap-3`}>
          <div className="flex-1 min-w-[220px]"><h2 className="font-bold">Ejemplo de demostración</h2><p className="text-xs text-slate-600">Establecimiento ficticio con datos de 2022 a 2024 para presentar el módulo. Se guarda solo en este navegador.</p></div>
          <button className={btnS} onClick={() => setAbierto({ id: null, plan: cargar() })}>Ver ejemplo</button>
        </div>
      </div>
    </div>
  );
};

export default CircularidadView;
