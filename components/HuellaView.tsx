import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Copy, ArrowLeft, Building2, FileText, ListChecks, BarChart3, Upload, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2, Eye, Pencil, Lock, Unlock, LayoutDashboard, Settings, ChevronRight, FileCheck, Download, Printer, Search, Database, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NOMBRES_MES, agruparPorTipoYContador, mesesTocados, repartirPorMes } from '../huella/mensual';
import { OPERACIONES, agruparPorKg, incluirPorDefecto } from '../huella/extintores';
import type { DocumentoExt, OperacionExt } from '../huella/extintores';
import { FUENTES_EXCLUIBLES, FUENTE_EXTINTORES, FUENTE_OTRA, calcularExtintores, justificacionExtintores, porcentajeExcluido } from '../huella/exclusiones';
import { evaluarCierre, huecosMensuales } from '../huella/cierre';
import { redactarCorreoPendientes } from '../huella/correo';
import { CNAE_HOTEL, centroDesdeHotel, coordenada, organizacionDesdeHotel } from '../huella/hotelesSuite';
import type { HotelSuite } from '../huella/hotelesSuite';
import { construirInforme } from '../huella/informe';
import { desgloseGases } from '../huella/gases';
import type { DatosInforme } from '../huella/informe';
import { informeAHtml } from '../huella/informeHtml';
import { emisionesMensuales } from '../huella/graficos';
import { huellaService, FilaBiblioteca, Verificacion, Actividad, Centro, CierreDatos, Documento, Exclusion, Inventario, InventarioCentro, NoConformidad, Organizacion } from '../services/huellaService';
import { cargarConjunto, diferencias, gasesOficiales, VERSIONES, ConjuntoElegido } from '../huella/catalogo';
import { conPcaManual } from '../huella/factores';
import { calcularInventario, calcularLinea, ratio } from '../huella/motor';
import { aplicarGas, modoAutomatico, resolverGas } from '../huella/gas';
import { conMezclas, normalizarGas } from '../huella/mezclas';
import { aplicarEnvases, esEnvase, fuenteGlp, KG_BOMBONA_BUTANO } from '../huella/glp';
import type { ModoGas } from '../huella/gas';
import { asignarContador, proponerActividad, validarExtraccion, variacionAnual, ExtraccionFactura, TipoFactura } from '../huella/extraccion';
import type { Categoria, ConjuntoFactores, LineaActividad, OrigenElectricidad, ResultadoLinea } from '../huella/tipos';

type Pestana = 'resumen' | 'centros' | 'facturas' | 'consumos' | 'resultados' | 'cierre' | 'ajustes';
export type RolHuella = 'consultor' | 'cliente';

const t = (kg: number) => (kg / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number, d = 0) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
const TIPOS: Record<TipoFactura, string> = {
  electricidad: 'Electricidad', gas_natural: 'Gas natural', gasoleo: 'Gasóleo', glp: 'Butano / propano (GLP)',
  combustible_vehiculo: 'Combustible de vehículos', refrigerante: 'Recarga de refrigerante', otro: 'Otro',
};
const CATEGORIAS: Record<Categoria, string> = {
  combustion_fija: 'Combustión fija', combustion_movil: 'Combustión móvil', fugitiva: 'Emisiones fugitivas', electricidad: 'Electricidad',
};
const ORIGEN: Record<OrigenElectricidad, string> = {
  red: 'Red (sin garantía)', autoconsumo: 'Autoconsumo', gdo_renovable_balear: 'GdO renovable de Baleares', gdo_otra: 'GdO renovable (otra)',
};
const card = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm';
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50';
const btnP = `${btn} bg-brand-600 text-white hover:bg-brand-700`;
const btnS = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`;

/** Claves de factor disponibles según la categoría de la actividad. */
function opcionesFuente(f: ConjuntoFactores | null, cat: Categoria): string[] {
  if (!f) return [];
  if (cat === 'fugitiva') return Object.keys(f.pcaRefrigerantes).sort();
  if (cat === 'electricidad') return [];
  const todas = Object.keys(f.combustibles).filter((k) => k !== 'Otro (ud)');
  return todas.filter((k) => (cat === 'combustion_movil' ? k.includes('|') : !k.includes('|'))).sort();
}

function fuentePorDefecto(e: ExtraccionFactura, f: ConjuntoFactores | null): string {
  if (e.tipo === 'gas_natural') return 'Gas natural (kWhPCS)*';
  if (e.tipo === 'refrigerante') { const g = normalizarGas(e.producto); return g && f?.pcaRefrigerantes[g] !== undefined ? g : ''; }
  if (e.tipo === 'glp') { const k = fuenteGlp(e.producto, e.unidad); if (k && f?.combustibles[k]) return k; }
  if (e.tipo === 'electricidad' || !e.producto) return '';
  const sa = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const p = sa(e.producto);
  const cat: Categoria = e.tipo === 'combustible_vehiculo' ? 'combustion_movil' : 'combustion_fija';
  const claves = opcionesFuente(f, cat);
  return claves.find((k) => sa(k).startsWith(p)) ?? claves.find((k) => sa(k).includes(p)) ?? '';
}

const Segmentos: React.FC<{ valor: string; opciones: Array<[string, string]>; onCambio: (v: string) => void; etiqueta: string }> = ({ valor, opciones, onCambio, etiqueta }) => (
  <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden bg-white text-sm font-semibold" role="group" aria-label={etiqueta}>
    {opciones.map(([k, t]) => (
      <button key={k} aria-pressed={valor === k} onClick={() => onCambio(k)} className={`px-4 py-2 transition-colors ${valor === k ? 'text-white' : 'text-slate-700 hover:bg-slate-50'}`} style={valor === k ? { background: '#0002C9' } : undefined}>{t}</button>
    ))}
  </div>
);

export const HuellaView: React.FC<{ onBack: () => void; currentUser: string; rol?: RolHuella }> = ({ onBack, currentUser, rol = 'consultor' }) => {
  const esConsultor = rol === 'consultor';
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState('');
  const [invs, setInvs] = useState<Inventario[]>([]);
  const [invId, setInvId] = useState('');
  const [tab, setTab] = useState<Pestana>('resumen');
  const [vista, setVista] = useState<'biblioteca' | 'calculo'>('biblioteca');
  const [pasoCierre, setPasoCierre] = useState<'cierre' | 'informe'>('cierre');
  const [biblio, setBiblio] = useState<FilaBiblioteca[] | null>(null);
  const [nuevoCalculo, setNuevoCalculo] = useState(false);
  const [invInicial, setInvInicial] = useState('');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [invCentros, setInvCentros] = useState<InventarioCentro[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [elegido, setElegido] = useState<ConjuntoElegido | null>(null);
  // Se añaden al conjunto las mezclas de refrigerantes que la calculadora no trae (p. ej. R-448A), con su nota
  const factores = useMemo(() => (elegido ? conMezclas(elegido.conjunto) : null), [elegido]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalOrg, setModalOrg] = useState<'nueva' | 'editar' | null>(null);
  const [centroEditar, setCentroEditar] = useState<Centro | null>(null);

  const org = orgs.find((o) => o.id === orgId) ?? biblio?.find((f) => f.organizacion.id === orgId)?.organizacion;
  const inv = invs.find((i) => i.id === invId);
  const abierto = inv?.estado === 'borrador';
  const falla = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const cargarBiblioteca = useCallback(() => { huellaService.biblioteca().then(setBiblio).catch(falla); huellaService.organizaciones().then(setOrgs).catch(falla); }, []); // eslint-disable-line
  useEffect(() => { cargarBiblioteca(); }, [cargarBiblioteca]);
  const abrir = (oId: string, iId: string) => { setInvInicial(iId); setOrgId(oId); if (oId === orgId) setInvId(iId); setTab('resumen'); setVista('calculo'); };
  useEffect(() => { if (inv) setPasoCierre(inv.estado === 'borrador' ? 'cierre' : 'informe'); }, [inv?.id, inv?.estado]); // eslint-disable-line
  const volverABiblioteca = () => { setVista('biblioteca'); cargarBiblioteca(); };
  useEffect(() => {
    setInvs([]); setInvId(''); setCentros([]);
    if (!orgId) return;
    huellaService.inventarios(orgId).then((i) => { setInvs(i); setInvId(i.find((x) => x.id === invInicial)?.id ?? i[0]?.id ?? ''); }).catch(falla);
    huellaService.centros(orgId).then(setCentros).catch(falla);
  }, [orgId]);

  const recargarInv = useCallback(async () => {
    if (!invId) { setDocs([]); setActividad([]); setInvCentros([]); return; }
    try {
      const [d, a, c] = await Promise.all([huellaService.documentos(invId), huellaService.actividad(invId), huellaService.inventarioCentros(invId)]);
      setDocs(d); setActividad(a); setInvCentros(c);
    } catch (e) { falla(e); }
  }, [invId]);
  useEffect(() => { recargarInv(); }, [recargarInv]);

  // Factores del año del inventario: los fijados en el inventario o, si no hay, la edición más reciente que cubra el año.
  // Se cargan bajo demanda para no pesar en el resto de la app.
  useEffect(() => {
    setElegido(null);
    if (!inv) return;
    const fijada = inv.conjunto_factores?.version?.replace('calculadora-', '');
    cargarConjunto(inv.anio, fijada).then((c) => {
      // Si hay un conjunto ya fijado (con sus ajustes), manda ese: es el que debe reproducirse.
      setElegido(inv.conjunto_factores ? { ...c, conjunto: inv.conjunto_factores } : c);
    }).catch((e) => falla(e));
  }, [inv?.id, inv?.anio, inv?.conjunto_factores]);

  const elegirVersion = async (v: string) => {
    if (!inv) return;
    try {
      const c = await cargarConjunto(inv.anio, v);
      const actualizado = await huellaService.guardarFactores(inv.id, c.conjunto);
      setInvs((l) => l.map((i) => (i.id === inv.id ? { ...i, conjunto_factores: actualizado.conjunto_factores ?? c.conjunto } : i)));
    } catch (e) { falla(e); }
  };

  /** PCA de un gas que la calculadora no trae («Otros») o sustituido con justificación: se fija en los factores del cálculo y sale en el informe. */
  const ajustarPca = async (gas: string, pca: number, justificacion: string) => {
    if (!inv || !elegido) return;
    try {
      const nuevo = conPcaManual(elegido.conjunto, gas, pca, justificacion);
      const act = await huellaService.guardarFactores(inv.id, nuevo);
      setInvs((l) => l.map((i) => (i.id === inv.id ? { ...i, conjunto_factores: act.conjunto_factores ?? nuevo } : i)));
    } catch (e) { falla(e); }
  };

  const guardarOrg = async (v: Partial<Organizacion> & { nombre: string }, hoteles: HotelSuite[] = []) => {
    try {
      if (modalOrg === 'editar' && org) { const o = await huellaService.actualizarOrganizacion(org.id, v); setOrgs((l) => l.map((x) => (x.id === o.id ? o : x))); return; }
      const o = await huellaService.crearOrganizacion(v);
      // Cada hotel elegido en HS Suite se crea como centro de trabajo con todos sus datos
      const fallos: string[] = [];
      for (const h of hoteles) {
        try { await huellaService.crearCentro({ organizacion_id: o.id, ...centroDesdeHotel(h), suite_actualizado: new Date().toISOString() }); } catch (e) { fallos.push(`${h.nombre_hotel}: ${e instanceof Error ? e.message : e}`); }
      }
      setOrgs((l) => [...l, o]); setOrgId(o.id);
      if (hoteles.length) setTab('centros');
      if (fallos.length) falla(`La organización se creó, pero no se pudieron añadir ${fallos.length} centro(s):\n${fallos.join('\n')}`);
    } catch (e) { falla(e); throw e; }
  };
  const guardarCentro = async (v: Partial<Centro>) => {
    if (!centroEditar) return;
    try { const c = await huellaService.actualizarCentro(centroEditar.id, v); setCentros((l) => l.map((x) => (x.id === c.id ? c : x))); } catch (e) { falla(e); throw e; }
  };
  const nuevoInv = async () => {
    const a = Number(prompt('Año del inventario (p. ej. 2024):'));
    if (!orgId || !Number.isInteger(a) || a < 2007 || a > 2100) return;
    try { const i = await huellaService.crearInventario(orgId, a); setInvs([i, ...invs]); setInvId(i.id); } catch (e) { falla(e); }
  };

  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const pendientes = docs.filter((d) => d.estado === 'leido').length;
  const cerradoInv = !!inv && inv.estado !== 'borrador';
  const nav: Array<{ k: Pestana; nombre: string; icono: React.ReactNode; solo?: 'consultor'; badge?: number; oculto?: boolean }> = [
    { k: 'resumen', nombre: 'Resumen', icono: <LayoutDashboard size={17} /> },
    { k: 'centros', nombre: 'Centros', icono: <Building2 size={17} />, solo: 'consultor' },
    { k: 'facturas', nombre: esConsultor ? 'Facturas' : 'Mis facturas', icono: <FileText size={17} />, badge: esConsultor ? pendientes : 0 },
    { k: 'consumos', nombre: 'Consumos', icono: <ListChecks size={17} /> },
    { k: 'resultados', nombre: 'Resultados', icono: <BarChart3 size={17} /> },
    { k: 'cierre', nombre: esConsultor ? 'Cierre e informe' : 'Informe', icono: esConsultor ? <Lock size={17} /> : <FileCheck size={17} />, oculto: !esConsultor && !cerradoInv },
  ];
  const visibles = nav.filter((n) => (!n.solo || esConsultor) && !n.oculto);
  const titulos: Record<Pestana, [string, string]> = {
    resumen: [esConsultor ? 'Resumen del cálculo' : 'Su huella de carbono', esConsultor ? 'Dónde estás y qué falta para cerrar.' : 'Suba sus facturas y consulte sus resultados.'],
    centros: ['Centros de trabajo', 'Datos de cada centro, su periodo operativo y estancias.'],
    facturas: [esConsultor ? 'Facturas' : 'Mis facturas', 'Suba un bloque completo; se leen solas y usted las revisa.'],
    consumos: ['Consumos', 'Evolución mensual y consumos confirmados de las facturas.'],
    resultados: ['Resultados', 'Huella del cálculo según el Registro balear.'],
    cierre: esConsultor ? [pasoCierre === 'informe' ? 'Informe' : 'Cierre del cálculo', pasoCierre === 'informe' ? 'ISO 14064-1 · listo para entregar al verificador.' : 'Comprobaciones, variaciones y cierre con registro.'] : ['Informe', 'Informe del cálculo cerrado.'],
    ajustes: ['Ajustes del cálculo', 'Factores de emisión y datos de la organización.'],
  };

  if (vista === 'biblioteca') {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        {error && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-xl flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm shadow-lg" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError('')} aria-label="Cerrar"><XCircle size={16} /></button></div>}
        <BibliotecaHuella filas={biblio} esConsultor={esConsultor} onAbrir={abrir} onNuevo={() => setNuevoCalculo(true)} onCerrar={onBack}
          onBorrar={async (f) => { try { await huellaService.borrarInventario(f.inventario.id); cargarBiblioteca(); } catch (e) { falla(e); } }} />
        {nuevoCalculo && <NuevoCalculo orgs={orgs} usuario={currentUser} onCerrar={() => setNuevoCalculo(false)} falla={falla} onCreado={(oId, iId) => { setNuevoCalculo(false); cargarBiblioteca(); abrir(oId, iId); }} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-900">
      <aside className="md:w-60 flex-shrink-0 flex flex-col md:border-r border-white/70" style={{ background: 'rgba(255,255,255,.66)', WebkitBackdropFilter: 'blur(14px) saturate(1.2)', backdropFilter: 'blur(14px) saturate(1.2)', color: '#00093D' }}>
        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          <button onClick={volverABiblioteca} className="p-1.5 rounded-lg hover:bg-white/70" style={{ color: '#00093D' }} title="Volver a la biblioteca de cálculos" aria-label="Volver a la biblioteca de cálculos"><ArrowLeft size={17} /></button>
          <img src="/logo-hsgreen-recortado.png" alt="HS GREEN · Environment & Sustainability" className="h-10 w-auto object-contain" />
        </div>
        <p className="px-4 pb-3 text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(0,9,61,.6)' }}>Huella de carbono</p>

        <button onClick={volverABiblioteca} className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/70 transition-colors" style={{ background: 'rgba(0,9,61,.06)', color: '#00093D' }}>
          <Database size={14} /> Biblioteca de cálculos
        </button>

        <nav className="flex md:flex-col gap-0.5 px-2 pb-3 overflow-x-auto md:overflow-visible" role="tablist" aria-label="Secciones">
          {visibles.map((n) => (
            <button key={n.k} role="tab" aria-selected={tab === n.k} onClick={() => setTab(n.k)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === n.k ? 'text-white font-semibold' : 'hover:bg-white/60'}`}
              style={tab === n.k ? { background: '#0002C9' } : { color: '#00093D' }}>
              {n.icono} <span>{n.nombre}</span>
              {!!n.badge && <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: '#F9416D' }}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="hidden md:block mt-auto px-4 py-4 border-t" style={{ borderColor: 'rgba(0,9,61,.12)' }}>
          <img src="/logo-hs-group.png" alt="HS Consulting Group" className="h-9 w-auto object-contain" />
          <p className="text-[11px] mt-2 truncate" style={{ color: 'rgba(0,9,61,.65)' }}>{currentUser}</p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-5xl space-y-4">
          {org && (
            <div className={`${card} flex flex-wrap items-center gap-3`} aria-label="Sociedad y cálculo abiertos">
              <div className="w-11 h-11 rounded-lg bg-green-100 text-green-800 flex items-center justify-center text-lg font-bold shrink-0">{org.nombre.trim().charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{org.suite_cadena && norm(org.suite_cadena) === norm(org.nombre) ? 'Cadena' : 'Sociedad'}</p>
                <p className="text-lg font-extrabold text-slate-900 truncate" title={org.nombre}>{org.nombre}</p>
                <p className="text-xs text-slate-600 truncate">{centros.length === 1 ? `Hotel: ${centros[0].nombre}` : `${centros.length} centro${centros.length === 1 ? '' : 's'} de trabajo`}{org.suite_cadena && norm(org.suite_cadena) !== norm(org.nombre) ? ` · ${org.suite_cadena}` : ''}</p>
              </div>
              {esConsultor && <button className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={() => setTab('ajustes')} title="Ajustes del cálculo" aria-label="Ajustes del cálculo"><Settings size={18} /></button>}
              {inv && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">Cálculo {inv.anio}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${(ESTADO_CALCULO[inv.estado] ?? ESTADO_CALCULO.borrador).chip}`}>{(ESTADO_CALCULO[inv.estado] ?? ESTADO_CALCULO.borrador).texto}</span>
                </div>
              )}
            </div>
          )}
          <div>
            {tab === 'ajustes' && <button className="mb-1 text-xs font-semibold text-slate-600 underline hover:text-slate-900" onClick={() => setTab('resumen')}>← Volver al resumen</button>}
            <h1 className="text-xl font-extrabold text-slate-900">{titulos[tab][0]}</h1>
            <p className="text-sm text-slate-600">{titulos[tab][1]}</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="text-red-600" aria-label="Cerrar"><XCircle size={16} /></button>
            </div>
          )}

          {org && (
            <>
              {tab === 'centros' && esConsultor && (
                <PanelCentros orgId={orgId} onEditar={setCentroEditar} centros={centros} setCentros={setCentros} inv={inv} invCentros={invCentros} abierto={!!abierto} onGuardado={recargarInv} falla={falla} />
              )}
              {tab !== 'centros' && !inv && <div className={`${card} text-sm text-slate-600`}>{esConsultor ? 'Abra un cálculo desde la biblioteca para continuar.' : 'Todavía no hay un cálculo abierto. Su consultor lo creará.'}</div>}
              {tab === 'resumen' && inv && (
                <PanelResumen rol={rol} inv={inv} centros={centros} invCentros={invCentros} docs={docs} actividad={actividad} factores={factores} ir={setTab} />
              )}
              {tab === 'facturas' && inv && (
                <PanelFacturas rol={rol} org={org} inv={inv} abierto={!!abierto} centros={centros} docs={docs} actividad={actividad} factores={factores} onCambio={recargarInv} falla={falla} cargando={cargando} setCargando={setCargando} currentUser={currentUser} />
              )}
              {tab === 'consumos' && inv && (
                <PanelActividad inv={inv} abierto={!!abierto && esConsultor} centros={centros} actividad={actividad} docs={docs} factores={factores} onCambio={recargarInv} falla={falla} />
              )}
              {tab === 'resultados' && inv && <PanelResultados inv={inv} centros={centros} invCentros={invCentros} actividad={actividad} docs={docs} abierto={!!abierto && esConsultor} onCambio={recargarInv} falla={falla} factores={factores} />}
              {tab === 'cierre' && inv && (
                <div className="space-y-4">
                  {esConsultor && <Segmentos etiqueta="Paso" valor={pasoCierre} onCambio={(v) => setPasoCierre(v as 'cierre' | 'informe')} opciones={[['cierre', '1 · Comprobar y cerrar'], ['informe', '2 · Informe']]} />}
                  {esConsultor && pasoCierre === 'cierre'
                    ? <PanelCierre org={org} onCambio={recargarInv} inv={inv} invs={invs} centros={centros} invCentros={invCentros} docs={docs} actividad={actividad} factores={factores} usuario={currentUser} falla={falla}
                        onInventario={(i) => setInvs((l) => l.map((x) => (x.id === i.id ? { ...x, ...i } : x)))} onIr={(d) => setTab(d)} />
                    : <PanelInforme soloLectura={!esConsultor} org={org} inv={inv} invs={invs} centros={centros} invCentros={invCentros} docs={docs} actividad={actividad} factores={factores} usuario={currentUser} falla={falla}
                        onInventario={(i) => setInvs((l) => l.map((x) => (x.id === i.id ? { ...x, ...i } : x)))} />}
                </div>
              )}
              {tab === 'ajustes' && esConsultor && (
                <div className="space-y-4">
                  {inv && elegido && <PanelFactores inv={inv} elegido={elegido} abierto={!!abierto && esConsultor} onElegir={elegirVersion} gasesUsados={Array.from(new Set(actividad.filter((a) => a.categoria === 'fugitiva').map((a) => a.fuente)))} onPca={ajustarPca} />}
                  {inv && (
                    <div className={card}>
                      <label className="text-sm font-bold text-slate-800">Año base del cálculo
                        <div className="flex items-center gap-3 mt-2">
                          <input type="number" min={2007} max={2100} className={`${input} w-32`} defaultValue={inv.anio_base ?? ''} disabled={!abierto} aria-label="Año base"
                            onBlur={async (e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v === (inv.anio_base ?? null)) return; try { const u = await huellaService.guardarAnioBase(inv.id, v); setInvs((l) => l.map((x) => (x.id === u.id ? { ...x, ...u } : x))); } catch (x) { falla(x); } }} />
                          <span className="text-xs font-normal text-slate-600">Año de referencia para comparar y para el plan de reducción (ISO 14064-1, 6.4).</span>
                        </div>
                      </label>
                    </div>
                  )}
                  <div className={card}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><h2 className="text-sm font-bold text-slate-800">Organización</h2><p className="text-xs text-slate-600">{org.nombre}{org.cif ? ` · ${org.cif}` : ''}</p></div>
                      <button className={btnS} onClick={() => setModalOrg('editar')}><Pencil size={14} /> Editar datos</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {modalOrg && <FormOrganizacion org={modalOrg === 'editar' ? org : undefined} centrosOrg={centros} usuario={currentUser} onGuardar={guardarOrg} onCerrar={() => setModalOrg(null)} onError={falla} />}
          {centroEditar && <FormCentro centro={centroEditar} onGuardar={guardarCentro} onCerrar={() => setCentroEditar(null)} onError={falla} />}
          {!org && orgs.length === 0 && <div className={`${card} text-sm text-slate-600`}>{esConsultor ? 'Todavía no hay organizaciones. Cree la primera con el botón + del menú.' : 'Todavía no tiene acceso a ninguna organización.'}</div>}
        </div>
      </main>
    </div>
  );
};

// ───────────────────────────── Biblioteca de cálculos (pantalla de inicio) ─────────────────────────────
const ESTADO_CALCULO: Record<string, { texto: string; chip: string; avatar: string }> = {
  borrador: { texto: 'Borrador', chip: 'bg-amber-100 text-amber-800', avatar: 'bg-green-100 text-green-800' },
  revision: { texto: 'En revisión', chip: 'bg-blue-100 text-blue-800', avatar: 'bg-blue-100 text-blue-800' },
  cerrado: { texto: 'Cerrado', chip: 'bg-slate-200 text-slate-700', avatar: 'bg-slate-200 text-slate-700' },
  verificado: { texto: 'Verificado', chip: 'bg-green-100 text-green-800', avatar: 'bg-blue-100 text-blue-800' },
};
const corto = (email?: string | null) => (email ? email.split('@')[0] : '—');
const fechaCorta = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

const BibliotecaHuella: React.FC<{
  filas: FilaBiblioteca[] | null; esConsultor: boolean; onAbrir: (orgId: string, invId: string) => void; onNuevo: () => void; onCerrar: () => void; onBorrar: (f: FilaBiblioteca) => void;
}> = ({ filas, esConsultor, onAbrir, onNuevo, onCerrar, onBorrar }) => {
  const [q, setQ] = useState('');
  const [consultor, setConsultor] = useState('');
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const consultores = useMemo(() => Array.from(new Set((filas ?? []).map((f) => corto(f.organizacion.consultor_email)).filter((c) => c !== '—'))).sort(), [filas]);
  const visibles = (filas ?? []).filter((f) => {
    const t = norm(`${f.organizacion.nombre} ${f.organizacion.suite_cadena ?? ''} ${f.organizacion.cif ?? ''} ${f.inventario.anio}`);
    return (!q.trim() || q.trim().split(/\s+/).every((w) => t.includes(norm(w)))) && (!consultor || corto(f.organizacion.consultor_email) === consultor);
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="no-glass bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200" role="dialog" aria-label="Biblioteca de cálculos de huella">
        <div className="bg-header px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: '#00093D' }}>
          <div className="flex items-center gap-3">
            <Database size={20} className="text-white/70" />
            <div>
              <h3 className="text-base font-semibold text-white leading-none">Biblioteca de cálculos de huella</h3>
              <p className="text-xs text-white/60 mt-0.5">{filas === null ? 'Cargando…' : `${filas.length} cálculo${filas.length === 1 ? '' : 's'} disponible${filas.length === 1 ? '' : 's'}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {esConsultor && <button onClick={onNuevo} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors"><Plus size={14} /> Nuevo cálculo</button>}
            <button onClick={onCerrar} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" aria-label="Cerrar la biblioteca"><X size={18} /></button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${input} pl-9`} placeholder="Buscar por organización, cadena, CIF o año…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cálculos" />
          </div>
          <select className={`${input.replace('w-full', '')} w-52 shrink-0`} value={consultor} onChange={(e) => setConsultor(e.target.value)} aria-label="Filtrar por consultor"><option value="">Todos los consultores</option>{consultores.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>

        <div className="grid grid-cols-[1fr_130px_90px_80px] gap-2 px-6 py-2 text-[11px] font-bold tracking-wide text-slate-600 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <span>CÁLCULO</span><span>CONSULTOR</span><span>MODIFICADO</span><span className="text-right">ACCIONES</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filas === null ? <p className="p-10 text-center text-sm text-slate-500"><Loader2 size={16} className="inline animate-spin mr-2" />Cargando cálculos…</p>
            : visibles.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Database size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold text-slate-700">{filas.length === 0 ? 'Todavía no hay cálculos' : 'Ningún cálculo coincide con la búsqueda'}</p>
                {filas.length === 0 && esConsultor && <p className="text-xs mt-1">Empiece con «Nuevo cálculo»: busque la cadena o el hotel en HS Suite y elija el año.</p>}
              </div>
            ) : visibles.map((f) => {
              const e = ESTADO_CALCULO[f.inventario.estado] ?? ESTADO_CALCULO.borrador;
              return (
                <div key={f.inventario.id} className="grid grid-cols-[1fr_130px_90px_80px] gap-2 items-center px-6 py-3 border-b border-slate-100 hover:bg-green-50/60 cursor-pointer" onClick={() => onAbrir(f.organizacion.id, f.inventario.id)}
                  role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.key === 'Enter') onAbrir(f.organizacion.id, f.inventario.id); }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0 ${e.avatar}`}>{f.organizacion.nombre.trim().charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{f.organizacion.nombre}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{f.inventario.anio}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${e.chip}`}>{e.texto}</span>
                        <span className="text-[11px] text-slate-500 truncate">{f.centros} centro{f.centros === 1 ? '' : 's'}{f.organizacion.suite_cadena ? ` · ${f.organizacion.suite_cadena}` : ''}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-slate-700 truncate">{corto(f.organizacion.consultor_email)}</span>
                  <span className="text-sm text-slate-700 tabular-nums">{fechaCorta(f.inventario.updated_at)}</span>
                  <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                    {esConsultor && f.inventario.estado === 'borrador' && (
                      <button className="p-1.5 text-slate-500 hover:text-red-600" aria-label={`Eliminar el cálculo ${f.organizacion.nombre} ${f.inventario.anio}`}
                        onClick={() => { if (confirm(`Va a eliminar el cálculo ${f.inventario.anio} de «${f.organizacion.nombre}» con todas sus facturas y datos. No se puede deshacer. ¿Continuar?`)) onBorrar(f); }}><Trash2 size={16} /></button>
                    )}
                    <button className="p-1.5 text-slate-600 hover:text-slate-900" aria-label="Abrir el cálculo" onClick={() => onAbrir(f.organizacion.id, f.inventario.id)}><ChevronRight size={18} /></button>
                  </div>
                </div>
              );
            })}
        </div>
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex-shrink-0">{filas?.length ?? 0} cálculos en la biblioteca · Haga clic en un cálculo para abrirlo</div>
      </div>
    </div>
  );
};

// ───────────────────────────── Asistente «Nuevo cálculo» ─────────────────────────────
const NuevoCalculo: React.FC<{
  orgs: Organizacion[]; usuario: string; onCerrar: () => void; falla: (e: unknown) => void; onCreado: (orgId: string, invId: string) => void;
}> = ({ orgs, usuario, onCerrar, falla, onCreado }) => {
  const anioDefecto = new Date().getFullYear() - 2; // el Registro balear declara el año N-2
  const [hoteles, setHoteles] = useState<HotelSuite[]>([]);
  const [orgSel, setOrgSel] = useState('nueva');
  const [nombre, setNombre] = useState('');
  const [anio, setAnio] = useState(anioDefecto);
  const [creando, setCreando] = useState(false);
  const cadena = useMemo(() => { const c = new Set(hoteles.map((h) => h.cadena_hotelera).filter(Boolean)); return c.size === 1 ? [...c][0] : null; }, [hoteles]);
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // Al elegir hoteles se propone el nombre y, si ya existe una organización de esa cadena o con ese nombre, se sugiere usarla.
  const proponer = (lista: HotelSuite[]) => {
    if (lista.length === 0) return;
    const o = organizacionDesdeHotel(lista[0]);
    setNombre((n) => n || o.nombre);
    const existente = orgs.find((x) => (o.suite_cadena && x.suite_cadena === o.suite_cadena) || norm(x.nombre) === norm(o.nombre));
    if (existente) setOrgSel((s) => (s === 'nueva' ? existente.id : s));
  };
  const crear = async () => {
    setCreando(true);
    try {
      let orgId = orgSel;
      if (orgSel === 'nueva') {
        const base = hoteles[0] ? organizacionDesdeHotel(hoteles[0]) : null;
        const o = await huellaService.crearOrganizacion({ nombre: nombre.trim(), cif: base?.cif ?? null, direccion: hoteles.length === 1 ? base?.direccion ?? null : null, consultor_email: usuario, suite_cadena: cadena ?? base?.suite_cadena ?? null, cnae: CNAE_HOTEL });
        orgId = o.id;
      }
      // Centros: solo los hoteles que aún no están en la organización
      const existentes = new Set((await huellaService.centros(orgId)).map((c) => c.suite_hotel_id).filter(Boolean) as string[]);
      const fallos: string[] = [];
      for (const h of hoteles.filter((x) => !existentes.has(x.id))) {
        try { await huellaService.crearCentro({ organizacion_id: orgId, ...centroDesdeHotel(h), suite_actualizado: new Date().toISOString() }); } catch (e) { fallos.push(`${h.nombre_hotel}: ${e instanceof Error ? e.message : e}`); }
      }
      // Inventario del año: si ya existe se abre el existente
      const invs = await huellaService.inventarios(orgId);
      const inv = invs.find((i) => i.anio === anio) ?? await huellaService.crearInventario(orgId, anio);
      if (fallos.length) falla(`No se pudieron añadir ${fallos.length} centro(s):\n${fallos.join('\n')}`);
      onCreado(orgId, inv.id);
    } catch (e) { falla(e); setCreando(false); }
  };
  const valido = (orgSel !== 'nueva' || nombre.trim().length > 1) && anio >= 2007 && anio <= 2100;
  const existeAnio = orgSel !== 'nueva' ? 'Si el año ya tiene cálculo, se abrirá el existente.' : '';
  return (
    <Modal titulo="Nuevo cálculo de huella" onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: '#F4F7FA' }}>
          <p className="text-xs font-semibold text-slate-700 mb-1">1. Elija la cadena o los hoteles en HS Suite</p>
          <p className="text-[11px] text-slate-600 mb-2">Cada hotel pasa a ser un centro de trabajo con su dirección, municipio, isla y unidades.</p>
          <BuscadorHoteles textoBoton="Añadir" placeholder="Busque el hotel, la cadena o el titular" vinculados={new Set(hoteles.map((h) => h.id))}
            onElegir={(h) => { const l = hoteles.some((x) => x.id === h.id) ? hoteles : [...hoteles, h]; setHoteles(l); proponer(l); }}
            onCadena={async (c) => {
              try {
                const todos = (await huellaService.buscarHoteles({ cadena: c, limite: 200 })).filter((h) => h.activo !== false);
                const l = [...hoteles, ...todos.filter((h) => !hoteles.some((x) => x.id === h.id))]; setHoteles(l); proponer(l);
              } catch (e) { falla(e); }
            }} />
          {hoteles.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white max-h-36 overflow-auto">
              {hoteles.map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <Building2 size={13} className="text-slate-500" />
                  <span className="flex-1 min-w-0 truncate"><strong>{h.nombre_hotel}</strong> · {[h.municipio, h.isla].filter(Boolean).join(' · ')}</span>
                  <button className="p-1 text-slate-500 hover:text-red-600" aria-label={`Quitar ${h.nombre_hotel}`} onClick={() => setHoteles((l) => l.filter((x) => x.id !== h.id))}><XCircle size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="2. Organización" ancho>
            <select className={input} value={orgSel} onChange={(e) => setOrgSel(e.target.value)} aria-label="Organización del cálculo">
              <option value="nueva">Crear una organización nueva</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>Usar «{o.nombre}»</option>)}
            </select>
          </Campo>
          {orgSel === 'nueva' && <Campo etiqueta="Nombre de la organización *" ancho><input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cadena, titular o nombre del hotel" /></Campo>}
          <Campo etiqueta="3. Año del cálculo"><input type="number" min={2007} max={2100} className={input} value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año del cálculo" /></Campo>
          <p className="text-[11px] text-slate-500 self-end pb-2">{existeAnio || 'El Registro balear declara el año N-2.'}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnS} onClick={onCerrar}>Cancelar</button>
        <button className={btnP} onClick={crear} disabled={!valido || creando}>{creando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Crear y abrir</button>
      </div>
    </Modal>
  );
};

// ───────────────────────────── Resumen (pantalla de inicio) ─────────────────────────────
const PanelResumen: React.FC<{
  rol: RolHuella; inv: Inventario; centros: Centro[]; invCentros: InventarioCentro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null; ir: (t: Pestana) => void;
}> = ({ rol, inv, centros, invCentros, docs, actividad, factores, ir }) => {
  const esConsultor = rol === 'consultor';
  const calculo = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const plantilla = invCentros.reduce((s, c) => s + Number(c.plantilla_media || 0), 0);
  const porRevisar = docs.filter((d) => d.estado === 'leido').length;
  const sinLeer = docs.filter((d) => d.estado === 'subido').length;
  const huecos = huecosMensuales(docs.map((d) => ({ estado: d.estado, tipo: (d.extraccion?.tipo ?? d.tipo) as string, contador: d.extraccion?.contador, periodoDesde: d.periodo_desde ?? d.extraccion?.periodoDesde, periodoHasta: d.periodo_hasta ?? d.extraccion?.periodoHasta })), inv.anio);
  const sinIndice = centros.filter((c) => !(Number(invCentros.find((x) => x.centro_id === c.id)?.indice_actividad) > 0));
  const confirmadas = actividad.filter((a) => a.estado === 'confirmada').length;
  const cerrado = inv.estado !== 'borrador';

  const pendientes: Array<{ icono: React.ReactNode; texto: string; boton: string; destino: Pestana; nivel: 'aviso' | 'ok' }> = [];
  if (esConsultor && centros.length === 0) pendientes.push({ icono: <Building2 size={18} />, texto: 'Añada el primer centro de trabajo.', boton: 'Añadir', destino: 'centros', nivel: 'aviso' });
  if (docs.length === 0 && (centros.length > 0 || !esConsultor)) pendientes.push({ icono: <Upload size={18} />, texto: 'Todavía no hay facturas: suba las del año.', boton: 'Subir', destino: 'facturas', nivel: 'aviso' });
  if (sinLeer > 0) pendientes.push({ icono: <Loader2 size={18} />, texto: `${sinLeer} factura(s) subidas sin leer.`, boton: 'Ver', destino: 'facturas', nivel: 'aviso' });
  if (porRevisar > 0) pendientes.push({ icono: <AlertTriangle size={18} />, texto: esConsultor ? `${porRevisar} factura(s) esperan su revisión.` : `${porRevisar} factura(s) en revisión por su consultor.`, boton: esConsultor ? 'Revisar' : 'Ver', destino: 'facturas', nivel: 'aviso' });
  for (const h of huecos.slice(0, 3)) pendientes.push({ icono: <FileText size={18} />, texto: `${h.tipo === 'electricidad' ? 'Electricidad' : 'Gas natural'}${h.contador !== 'sin contador' ? ` (${h.contador})` : ''}: faltan facturas de ${h.faltan.join(', ')}.`, boton: 'Subir', destino: 'facturas', nivel: 'aviso' });
  if (esConsultor && sinIndice.length > 0 && confirmadas > 0) pendientes.push({ icono: <Building2 size={18} />, texto: `Indique las estancias de: ${sinIndice.map((c) => c.nombre).join(', ')}.`, boton: 'Indicar', destino: 'centros', nivel: 'aviso' });
  if (esConsultor && !inv.conjunto_factores && confirmadas > 0) pendientes.push({ icono: <Settings size={18} />, texto: 'Confirme la versión de factores de emisión del cálculo.', boton: 'Revisar', destino: 'ajustes', nivel: 'aviso' });
  if (esConsultor && !cerrado && confirmadas > 0 && porRevisar === 0 && pendientes.length === 0) pendientes.push({ icono: <Lock size={18} />, texto: 'Todo está al día: puede pasar a las comprobaciones de cierre.', boton: 'Cierre', destino: 'cierre', nivel: 'ok' });
  if (cerrado) pendientes.push({ icono: <Lock size={18} />, texto: `Cálculo ${inv.estado}. Sus datos están bloqueados.`, boton: 'Ver', destino: esConsultor ? 'cierre' : 'resultados', nivel: 'ok' });

  const kpi = (titulo: string, valor: string, sub: string) => (
    <div className={card}><p className="text-xs font-semibold text-slate-600">{titulo}</p><p className="text-3xl font-extrabold text-header mt-1 tabular-nums">{valor}</p><p className="text-[11px] text-slate-500">{sub}</p></div>
  );
  return (
    <div className="space-y-4">
      {calculo && confirmadas > 0 ? (
        <div className={`grid grid-cols-2 gap-3 ${plantilla > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          {kpi('Total', t(calculo.totales.kgCO2eTotal), 't CO₂e')}
          {kpi('Emisiones directas', t(calculo.totales.kgCO2eAlcance1), 't CO₂e · Alcance 1')}
          {kpi('Electricidad', t(calculo.totales.kgCO2eAlcance2), 't CO₂e · Alcance 2')}
          {kpi('Por estancia', indice > 0 ? ratio(calculo.totales.kgCO2eTotal, indice).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '—', indice > 0 ? 'kg CO₂e por estancia' : 'Falta indicar las estancias')}
          {plantilla > 0 && kpi('Por trabajador', ratio(calculo.totales.kgCO2eTotal, plantilla).toLocaleString('es-ES', { maximumFractionDigits: 0 }), `kg CO₂e · plantilla media ${plantilla.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`)}
        </div>
      ) : <div className={`${card} text-sm text-slate-600`}>Los resultados aparecerán aquí en cuanto haya facturas revisadas.</div>}

      <GraficoActividad inv={inv} factores={factores} centros={centros} actividad={actividad} filtradas={actividad} fuentesDisp={[]} contadoresDisp={[]}
        fCentro="" setFCentro={() => {}} fFuente="" setFFuente={() => {}} fContador="" setFContador={() => {}} metrica="co2e" setMetrica={() => {}} compacto />

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">{esConsultor ? 'Pendiente de ti' : 'Qué falta'}</h2>
        {pendientes.length === 0 ? <p className="text-sm text-slate-600 py-2">No hay nada pendiente.</p> : (
          <ul className="divide-y divide-slate-100">
            {pendientes.map((x, k) => (
              <li key={k} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={x.nivel === 'ok' ? 'text-green-700' : 'text-amber-600'}>{x.icono}</span>
                <span className="flex-1 text-slate-800">{x.texto}</span>
                <button className={btnS} onClick={() => ir(x.destino)}>{x.boton} <ChevronRight size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────── Buscador de hoteles en HS Suite ─────────────────────────────
const BuscadorHoteles: React.FC<{
  onElegir: (h: HotelSuite) => void; textoBoton?: string; vinculados?: Set<string>; onCadena?: (cadena: string) => void; placeholder?: string;
}> = ({ onElegir, textoBoton = 'Añadir', vinculados, onCadena, placeholder = 'Nombre, cadena, municipio, CIF o código' }) => {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<HotelSuite[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) { setLista(null); setAviso(''); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try { setLista(await huellaService.buscarHoteles({ texto: q })); setAviso(''); } catch (e) { setLista(null); setAviso(e instanceof Error ? e.message : String(e)); } finally { setBuscando(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);
  const cadenas = useMemo(() => {
    const m = new Map<string, number>();
    (lista ?? []).forEach((h) => { if (h.cadena_hotelera) m.set(h.cadena_hotelera, (m.get(h.cadena_hotelera) ?? 0) + 1); });
    return [...m.entries()].filter(([, n]) => n >= 2);
  }, [lista]);
  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className={`${input} pl-9`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} aria-label="Buscar hotel en HS Suite" />
        {buscando && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-500" />}
      </div>
      {aviso && <p className="text-xs text-red-700 mt-2">{aviso}</p>}
      {lista && lista.length === 0 && !buscando && <p className="text-xs text-slate-600 mt-2">No hay hoteles que coincidan en HS Suite.</p>}
      {onCadena && cadenas.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">{cadenas.map(([c, n]) => <button key={c} className={btnS} onClick={() => onCadena(c)}><Plus size={13} /> Añadir todos los de «{c}» ({n}+)</button>)}</div>
      )}
      {lista && lista.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-auto bg-white">
          {lista.map((h) => {
            const ya = vinculados?.has(h.id);
            return (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{h.nombre_hotel}{h.activo === false && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Baja</span>}</p>
                  <p className="text-[11px] text-slate-500 truncate">{[h.cadena_hotelera, h.municipio, h.isla, h.cif, h.codigo_hotel].filter(Boolean).join(' · ')}</p>
                </div>
                <button className={btnS} disabled={!!ya} onClick={() => onElegir(h)}>{ya ? 'Ya añadido' : textoBoton}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ───────────────────────────── Formularios de organización y centro ─────────────────────────────
const Modal: React.FC<{ titulo: string; onCerrar: () => void; children: React.ReactNode }> = ({ titulo, onCerrar, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-label={titulo}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        <button onClick={onCerrar} className="p-1.5 text-slate-500 hover:text-slate-900" aria-label="Cerrar"><XCircle size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Campo: React.FC<{ etiqueta: string; children: React.ReactNode; ancho?: boolean }> = ({ etiqueta, children, ancho }) => (
  <label className={`text-xs font-semibold text-slate-700 ${ancho ? 'col-span-2' : ''}`}>{etiqueta}<div className="mt-1">{children}</div></label>
);

const FormOrganizacion: React.FC<{ org?: Organizacion; centrosOrg?: Centro[]; usuario: string; onGuardar: (v: Partial<Organizacion> & { nombre: string }, hoteles: HotelSuite[]) => Promise<void>; onCerrar: () => void; onError?: (e: unknown) => void }> = ({ org, centrosOrg = [], usuario, onGuardar, onCerrar, onError }) => {
  const [cadenaSuite, setCadenaSuite] = useState<string | null>(org?.suite_cadena ?? null);
  const [hoteles, setHoteles] = useState<HotelSuite[]>([]);
  const [v, setV] = useState({ nombre: org?.nombre ?? '', cif: org?.cif ?? '', direccion: org?.direccion ?? '', cnae: org?.cnae ?? '', iae: org?.iae ?? '', criterio: org?.criterio_consolidacion ?? 'control', consultor: org?.consultor_email ?? usuario });
  const [guardando, setGuardando] = useState(false);
  // Al editar: datos de los hoteles de HS Suite vinculados a los centros (o elegidos a mano), solo lectura salvo lo que se vuelca al formulario
  const [deSuite, setDeSuite] = useState<HotelSuite[]>([]);
  const [cargandoSuite, setCargandoSuite] = useState(false);
  const [notaSuite, setNotaSuite] = useState('');
  const volcar = (hs: HotelSuite[], sobrescribir: boolean) => {
    const o = hs[0] ? organizacionDesdeHotel(hs[0]) : null;
    if (!o) return;
    // Con un solo hotel la dirección de la organización es la del hotel (aunque pertenezca a una cadena); con varios no hay una única dirección
    const direccion = hs.length === 1 ? (hs[0].direccion_completa?.trim() || o.direccion) : o.direccion;
    const cif = hs.map((h) => h.cif?.trim()).find((x) => !!x) ?? o.cif;
    setV((p) => ({ ...p, nombre: p.nombre || o.nombre, cif: sobrescribir || !p.cif ? (cif ?? p.cif) : p.cif, direccion: sobrescribir || !p.direccion ? (direccion ?? p.direccion) : p.direccion, cnae: sobrescribir || !p.cnae ? o.cnae : p.cnae }));
  };
  const cargarVinculados = async (sobrescribir: boolean) => {
    const ids = centrosOrg.map((c) => c.suite_hotel_id).filter((x): x is string => !!x).slice(0, 25);
    if (!ids.length) return;
    setCargandoSuite(true);
    try {
      const res = (await Promise.all(ids.map((id) => huellaService.buscarHoteles({ id }).then((r) => r[0] ?? null)))).filter((h): h is HotelSuite => !!h);
      setDeSuite(res); volcar(res, sobrescribir);
      // Los centros vinculados sin coordenadas las reciben de HS Suite (nunca se pisan las que ya tienen)
      for (const h of res) {
        const lat = coordenada(h.latitud, 90), lon = coordenada(h.longitud, 180);
        const c = centrosOrg.find((x) => x.suite_hotel_id === h.id);
        if (c && lat != null && lon != null && (c.latitud == null || c.longitud == null)) { try { await huellaService.actualizarCentro(c.id, { latitud: lat, longitud: lon }); } catch { /* se podrán escribir a mano en «Editar centro» */ } }
      }
      setNotaSuite(sobrescribir ? 'Datos actualizados desde HS Suite: revíselos y pulse Guardar.' : '');
    } catch (e) { onError?.(e); } finally { setCargandoSuite(false); }
  };
  useEffect(() => { if (org) void cargarVinculados(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const f = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const guardar = async () => { setGuardando(true); try { await onGuardar({ nombre: v.nombre.trim(), cif: v.cif.trim() || null, direccion: v.direccion.trim() || null, cnae: v.cnae.trim() || null, iae: v.iae.trim() || null, criterio_consolidacion: v.criterio as 'control' | 'participacion', consultor_email: v.consultor.trim() || null, suite_cadena: cadenaSuite }, hoteles); onCerrar(); } finally { setGuardando(false); } };
  return (
    <Modal titulo={org ? 'Editar organización' : 'Nueva organización'} onCerrar={onCerrar}>
      {!org && (
        <div className="mb-4 rounded-xl p-3" style={{ background: '#F4F7FA' }}>
          <p className="text-xs font-semibold text-slate-700 mb-1">Buscar en HS Suite (recomendado)</p>
          <p className="text-[11px] text-slate-600 mb-2">Elija el hotel o los hoteles: se rellenan los datos de la organización y cada hotel se crea como <strong>centro de trabajo</strong> con su dirección, municipio, isla y unidades.</p>
          <BuscadorHoteles textoBoton="Añadir" placeholder="Busque el hotel, la cadena o el titular" vinculados={new Set(hoteles.map((h) => h.id))}
            onElegir={(h) => {
              setHoteles((l) => (l.some((x) => x.id === h.id) ? l : [...l, h]));
              if (hoteles.length === 0) { const o = organizacionDesdeHotel(h); setV((p) => ({ ...p, nombre: o.nombre, cif: o.cif ?? '', direccion: o.direccion ?? '', cnae: p.cnae || o.cnae })); setCadenaSuite(o.suite_cadena); }
            }}
            onCadena={async (cadena) => {
              try {
                const todos = (await huellaService.buscarHoteles({ cadena, limite: 200 })).filter((h) => h.activo !== false);
                setHoteles((l) => [...l, ...todos.filter((h) => !l.some((x) => x.id === h.id))]);
                if (hoteles.length === 0 && todos[0]) { const o = organizacionDesdeHotel(todos[0]); setV((p) => ({ ...p, nombre: o.nombre, cif: o.cif ?? '', direccion: '', cnae: p.cnae || o.cnae })); setCadenaSuite(cadena); }
              } catch (e) { onError?.(e); }
            }} />
          {hoteles.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">Se crearán {hoteles.length} centro{hoteles.length === 1 ? '' : 's'} de trabajo:</p>
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white max-h-40 overflow-auto">
                {hoteles.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <Building2 size={13} className="text-slate-500" />
                    <span className="flex-1 min-w-0 truncate"><strong>{h.nombre_hotel}</strong> · {[h.direccion_completa, h.municipio, h.isla].filter(Boolean).join(' · ')}</span>
                    <button className="p-1 text-slate-500 hover:text-red-600" aria-label={`Quitar ${h.nombre_hotel}`} onClick={() => setHoteles((l) => l.filter((x) => x.id !== h.id))}><XCircle size={14} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {org && (
        <div className="mb-4 rounded-xl p-3" style={{ background: '#F4F7FA' }}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold text-slate-700 flex-1 min-w-[200px]">Datos en HS Suite{cargandoSuite && <Loader2 size={12} className="inline animate-spin ml-1" />}
              {notaSuite && <span className="block text-green-700 mt-0.5">{notaSuite}</span>}</p>
            {centrosOrg.some((c) => c.suite_hotel_id) && <button className={btnS} onClick={() => cargarVinculados(true)} disabled={cargandoSuite}><Search size={13} /> Actualizar desde HS Suite</button>}
          </div>
          {!centrosOrg.some((c) => c.suite_hotel_id) && (
            <div className="mt-2">
              <p className="text-[11px] text-slate-600 mb-2">Ningún centro está vinculado a HS Suite. Busque el hotel para traer su CIF, dirección y capacidad (no se crea nada).</p>
              <BuscadorHoteles textoBoton="Traer datos" placeholder="Busque el hotel, la cadena o el titular" vinculados={new Set(deSuite.map((h) => h.id))}
                onElegir={(h) => { setDeSuite([h]); volcar([h], true); setNotaSuite('Datos traídos de HS Suite: revíselos y pulse Guardar.'); }}
                onCadena={async (cadena) => { try { const todos = (await huellaService.buscarHoteles({ cadena, limite: 200 })).filter((h) => h.activo !== false); setDeSuite(todos); volcar(todos, true); setNotaSuite('Datos traídos de la cadena en HS Suite: revíselos y pulse Guardar.'); } catch (e) { onError?.(e); } }} />
            </div>
          )}
          {deSuite.length > 0 && (
            <div className="mt-3">
              {!deSuite.some((h) => h.cif?.trim()) && <p className="text-[11px] text-amber-700 font-semibold mb-1">HS Suite no tiene CIF registrado para {deSuite.length === 1 ? 'este hotel' : 'estos hoteles'}: escríbalo a mano (y complételo en HS Suite para la próxima vez).</p>}
              <p className="text-[11px] text-slate-600 mb-1">{deSuite.length} hotel{deSuite.length === 1 ? '' : 'es'} · <strong>{deSuite.reduce((a, h) => a + (h.num_habitaciones ?? 0), 0).toLocaleString('es-ES')}</strong> habitaciones · <strong>{deSuite.reduce((a, h) => a + (h.num_plazas ?? 0), 0).toLocaleString('es-ES')}</strong> plazas</p>
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white max-h-36 overflow-auto">
                {deSuite.map((h) => (
                  <li key={h.id} className="px-3 py-1.5 text-xs">
                    <strong>{h.nombre_hotel}</strong>{h.titular ? ` · ${h.titular}` : ''}{h.cif ? ` · ${h.cif}` : ''}
                    <span className="block text-slate-500">{[h.direccion_completa, h.municipio, h.isla].filter(Boolean).join(' · ')} · {h.num_habitaciones ?? '—'} hab. · {h.num_plazas ?? '—'} plazas</span>
                    <span className="block text-slate-500">Coordenadas: {coordenada(h.latitud, 90) != null && coordenada(h.longitud, 180) != null ? `${coordenada(h.latitud, 90)!.toLocaleString('es-ES', { maximumFractionDigits: 6 })}, ${coordenada(h.longitud, 180)!.toLocaleString('es-ES', { maximumFractionDigits: 6 })}` : <span className="text-amber-700">no constan en HS Suite (escríbalas en «Editar centro»)</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre (empresa o grupo) *" ancho><input className={input} value={v.nombre} onChange={f('nombre')} autoFocus /></Campo>
        <Campo etiqueta="CIF"><input className={input} value={v.cif} onChange={f('cif')} /></Campo>
        <Campo etiqueta="Consultor responsable (email)"><input className={input} value={v.consultor} onChange={f('consultor')} /></Campo>
        <Campo etiqueta="Dirección" ancho><input className={input} value={v.direccion} onChange={f('direccion')} /></Campo>
        <Campo etiqueta="CNAE"><input className={input} value={v.cnae} onChange={f('cnae')} /></Campo>
        <Campo etiqueta="IAE"><input className={input} value={v.iae} onChange={f('iae')} /></Campo>
        <Campo etiqueta="Criterio de consolidación (ISO 14064-1)" ancho>
          <select className={input} value={v.criterio} onChange={f('criterio')}><option value="control">Control (operativo o financiero)</option><option value="participacion">Participación en el capital</option></select>
        </Campo>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnS} onClick={onCerrar}>Cancelar</button>
        <button className={btnP} onClick={guardar} disabled={!v.nombre.trim() || guardando}>{guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar</button>
      </div>
    </Modal>
  );
};

const FormCentro: React.FC<{ centro: Centro; onGuardar: (v: Partial<Centro>) => Promise<void>; onCerrar: () => void; onError?: (e: unknown) => void }> = ({ centro, onGuardar, onCerrar, onError }) => {
  const [nota, setNota] = useState('');
  const [v, setV] = useState({ nombre: centro.nombre, direccion: centro.direccion ?? '', municipio: centro.municipio ?? '', isla: centro.isla ?? 'Mallorca', balear: centro.en_baleares, unidades: centro.unidades_alojamiento != null ? String(centro.unidades_alojamiento) : '', latitud: centro.latitud != null ? String(centro.latitud) : '', longitud: centro.longitud != null ? String(centro.longitud) : '' });
  const [guardando, setGuardando] = useState(false);
  const actualizarDesdeSuite = async () => {
    try {
      const [h] = await huellaService.buscarHoteles({ id: centro.suite_hotel_id! });
      if (!h) { setNota('El hotel ya no existe en HS Suite.'); return; }
      const c = centroDesdeHotel(h);
      setV({ nombre: c.nombre, direccion: c.direccion ?? '', municipio: c.municipio ?? '', isla: c.isla ?? 'Mallorca', balear: c.en_baleares, unidades: c.unidades_alojamiento != null ? String(c.unidades_alojamiento) : '', latitud: c.latitud != null ? String(c.latitud) : v.latitud, longitud: c.longitud != null ? String(c.longitud) : v.longitud });
      setNota('Datos actualizados desde HS Suite: revíselos y pulse Guardar.');
    } catch (e) { onError?.(e); }
  };
  const guardar = async () => {
    setGuardando(true);
    try { await onGuardar({ nombre: v.nombre.trim(), direccion: v.direccion.trim() || null, municipio: v.municipio.trim() || null, isla: v.balear ? v.isla : null, en_baleares: v.balear, unidades_alojamiento: v.unidades === '' ? null : Math.max(0, Math.round(Number(v.unidades))), latitud: v.latitud.trim() === '' ? null : Number(v.latitud.replace(',', '.')), longitud: v.longitud.trim() === '' ? null : Number(v.longitud.replace(',', '.')) }); onCerrar(); } finally { setGuardando(false); }
  };
  return (
    <Modal titulo="Editar centro de trabajo" onCerrar={onCerrar}>
      {centro.suite_hotel_id && (
        <div className="mb-4 rounded-xl p-3 flex flex-wrap items-center gap-3" style={{ background: '#F4F7FA' }}>
          <p className="text-xs text-slate-700 flex-1 min-w-[200px]">Vinculado a HS Suite{centro.suite_codigo ? ` (${centro.suite_codigo})` : ''}.{nota && <span className="block text-green-700 font-semibold mt-0.5">{nota}</span>}</p>
          <button className={btnS} onClick={actualizarDesdeSuite}><Search size={13} /> Actualizar desde HS Suite</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre *" ancho><input className={input} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} autoFocus /></Campo>
        <Campo etiqueta="Dirección" ancho><input className={input} value={v.direccion} onChange={(e) => setV({ ...v, direccion: e.target.value })} /></Campo>
        <Campo etiqueta="Municipio"><input className={input} value={v.municipio} onChange={(e) => setV({ ...v, municipio: e.target.value })} /></Campo>
        <Campo etiqueta="Isla"><select className={input} value={v.isla} disabled={!v.balear} onChange={(e) => setV({ ...v, isla: e.target.value })}>{['Mallorca', 'Menorca', 'Ibiza', 'Formentera'].map((i) => <option key={i}>{i}</option>)}</select></Campo>
        <Campo etiqueta="Unidades de alojamiento"><input type="number" min={0} className={input} value={v.unidades} onChange={(e) => setV({ ...v, unidades: e.target.value })} /></Campo>
        <Campo etiqueta="Latitud"><input inputMode="decimal" className={input} value={v.latitud} onChange={(e) => setV({ ...v, latitud: e.target.value })} placeholder="Ej.: 39,8330" /></Campo>
        <Campo etiqueta="Longitud"><input inputMode="decimal" className={input} value={v.longitud} onChange={(e) => setV({ ...v, longitud: e.target.value })} placeholder="Ej.: 3,1168" /></Campo>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 self-end pb-2"><input type="checkbox" checked={v.balear} onChange={(e) => setV({ ...v, balear: e.target.checked })} /> Centro en Baleares</label>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnS} onClick={onCerrar}>Cancelar</button>
        <button className={btnP} onClick={guardar} disabled={!v.nombre.trim() || guardando}>{guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar</button>
      </div>
    </Modal>
  );
};

// ───────────────────────────── Versión de factores ─────────────────────────────
const PanelFactores: React.FC<{ inv: Inventario; elegido: ConjuntoElegido; abierto: boolean; onElegir: (v: string) => void; gasesUsados: string[]; onPca: (gas: string, pca: number, justificacion: string) => Promise<void> }> = ({ inv, elegido, abierto, onElegir, gasesUsados, onPca }) => {
  const [gas, setGas] = useState(''); const [pca, setPca] = useState(''); const [just, setJust] = useState(''); const [guardando, setGuardando] = useState(false);
  const fijada = !!inv.conjunto_factores;
  const actual = elegido.conjunto.version.replace('calculadora-', '');
  const comparaciones = (Object.keys(elegido.alternativas) as string[]).map((id) => ({ id, dif: diferencias(elegido.conjunto, elegido.alternativas[id]) }));
  const etiqueta = (id: string) => VERSIONES.find((v) => v.id === id)?.etiqueta ?? id;
  return (
    <div className={`${card} space-y-2`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600 min-w-[260px]">Factores de emisión del cálculo {inv.anio}
          <select className={`${input} mt-1`} value={actual} disabled={!abierto || elegido.disponibles.length < 2 && fijada} onChange={(e) => onElegir(e.target.value)} aria-label="Versión de factores">
            {elegido.disponibles.map((id) => <option key={id} value={id}>{etiqueta(id)}</option>)}
          </select>
        </label>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${fijada ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{fijada ? 'Fijada en el cálculo' : 'Propuesta por defecto: confírmela para fijarla'}</span>
        {!fijada && abierto && <button className={btnP} onClick={() => onElegir(actual)}>Fijar esta versión</button>}
      </div>
      {comparaciones.map(({ id, dif }) => {
        const hay = dif.mix || dif.gwp || dif.pca || dif.combustibles.length;
        return (
          <p key={id} className={`text-xs rounded-lg px-3 py-2 ${hay ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'}`}>
            {hay
              ? <>Frente a la {etiqueta(id)}: {dif.combustibles.length} factores de combustible distintos{dif.combustibles[0] ? ` (p. ej. ${dif.combustibles[0].clave}: ${dif.combustibles[0].a} frente a ${dif.combustibles[0].b} kg CO₂/ud)` : ''}{dif.mix ? `, mix eléctrico ${dif.mix[0]} frente a ${dif.mix[1]}` : ''}{dif.gwp ? ', potenciales de calentamiento distintos' : ''}{dif.pca ? `, ${dif.pca} PCA de refrigerantes distintos` : ''}. Compruebe con el documento oficial que corresponde a su inventario.</>
              : <>Idéntica a la {etiqueta(id)} para el año {inv.anio}.</>}
          </p>
        );
      })}
      {elegido.disponibles.length === 1 && <p className="text-[11px] text-slate-500">Solo una edición cubre el año {inv.anio}.</p>}

      <div className="border-t border-slate-200 pt-3 mt-2">
        <h3 className="text-sm font-bold text-slate-800">Gases que la calculadora oficial no trae</h3>
        {elegido.conjunto.notas.filter((n) => /^PCA /.test(n)).length === 0
          ? <p className="text-xs text-slate-600 mt-1">Ninguno: todos los gases del cálculo están en la calculadora oficial.</p>
          : <p className="text-xs text-slate-600 mt-1">La aplicación calcula su potencial de calentamiento (PCA) y los declara en «Otros» del Excel oficial. No hace falta hacer nada.</p>}
        {elegido.conjunto.notas.filter((n) => /^PCA /.test(n)).map((n, i) => {
          const m = /^PCA (?:manual )?de ([^\s(:]+)[^:]*: ([\d.,]+)/.exec(n);
          return (
            <details key={i} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-800">
              <summary className="cursor-pointer font-semibold">{m ? `${m[1]} · PCA ${m[2]} kg CO₂e/kg` : 'Gas con PCA propio'} <span className="font-normal text-slate-500">· ver cómo se calcula</span></summary>
              <p className="mt-2 text-slate-600">{n}</p>
            </details>
          );
        })}
        {abierto && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">Cambiar el PCA de un gas (solo si hace falta)</summary>
            <p className="text-xs text-slate-600 mt-2 mb-2">Por ejemplo, para mantener el valor de un inventario ya verificado. Indique el gas, su PCA y de dónde sale: quedará en el informe.</p>
            <div className="grid md:grid-cols-[160px_120px_1fr_auto] gap-2 items-end">
              <label className="text-xs font-semibold text-slate-600">Gas<input className={`${input} mt-1`} list="gases-usados" value={gas} onChange={(e) => setGas(e.target.value)} placeholder="R-448A" /><datalist id="gases-usados">{gasesUsados.map((g) => <option key={g} value={g} />)}</datalist></label>
              <label className="text-xs font-semibold text-slate-600">PCA<input className={`${input} mt-1`} inputMode="decimal" value={pca} onChange={(e) => setPca(e.target.value)} placeholder="1387" /></label>
              <label className="text-xs font-semibold text-slate-600">De dónde sale<input className={`${input} mt-1`} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ej.: valor del informe verificado de 2023 (mín. 15 caracteres)" /></label>
              <button className={btnP} disabled={guardando || !gas.trim() || !pca.trim() || just.trim().length < 15} onClick={async () => { setGuardando(true); await onPca(gas.trim(), Number(pca.replace(',', '.')), just); setGuardando(false); setGas(''); setPca(''); setJust(''); }}>Aplicar</button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────── Centros ─────────────────────────────
const PanelCentros: React.FC<{
  orgId: string; onEditar: (c: Centro) => void; centros: Centro[]; setCentros: (c: Centro[]) => void; inv?: Inventario; invCentros: InventarioCentro[]; abierto: boolean; onGuardado: () => void; falla: (e: unknown) => void;
}> = ({ orgId, onEditar, centros, setCentros, inv, invCentros, abierto, onGuardado, falla }) => {
  const [nombre, setNombre] = useState(''); const [municipio, setMunicipio] = useState(''); const [isla, setIsla] = useState('Mallorca'); const [balear, setBalear] = useState(true);
  const crear = async () => {
    if (!nombre.trim()) return;
    try { const c = await huellaService.crearCentro({ organizacion_id: orgId, nombre: nombre.trim(), municipio, isla: balear ? isla : undefined, en_baleares: balear }); setCentros([...centros, c]); setNombre(''); setMunicipio(''); setAnadir(null); } catch (e) { falla(e); }
  };
  const guardar = async (c: Centro, cambios: Partial<InventarioCentro>) => {
    if (!inv) return;
    const base = invCentros.find((x) => x.centro_id === c.id) ?? { inventario_id: inv.id, centro_id: c.id, indice_actividad: 0, plantilla_media: 0 };
    try { await huellaService.guardarInventarioCentro({ ...base, ...cambios }); onGuardado(); } catch (e) { falla(e); }
  };
  const [anadir, setAnadir] = useState<null | 'suite' | 'mano'>(null);
  const vinculados = useMemo(() => new Set(centros.map((c) => c.suite_hotel_id).filter(Boolean) as string[]), [centros]);
  const desdeSuite = async (h: HotelSuite) => {
    try { const c = await huellaService.crearCentro({ organizacion_id: orgId, ...centroDesdeHotel(h), suite_actualizado: new Date().toISOString() }); setCentros([...centros, c]); } catch (e) { falla(e); }
  };
  const cadenaDesdeSuite = async (cadena: string) => {
    try {
      const todos = await huellaService.buscarHoteles({ cadena, limite: 200 });
      const nuevos = todos.filter((h) => h.activo !== false && !vinculados.has(h.id));
      if (nuevos.length === 0) { falla(`No hay hoteles activos nuevos de «${cadena}» por añadir.`); return; }
      if (!confirm(`Se añadirán ${nuevos.length} hoteles activos de «${cadena}» como centros de trabajo. ¿Continuar?`)) return;
      const creados: Centro[] = [];
      for (const h of nuevos) { creados.push(await huellaService.crearCentro({ organizacion_id: orgId, ...centroDesdeHotel(h), suite_actualizado: new Date().toISOString() })); }
      setCentros([...centros, ...creados]);
    } catch (e) { falla(e); }
  };
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-sm font-bold text-slate-800">Centros de trabajo</h2>
          <p className="text-xs text-slate-600">{centros.length === 0 ? 'Todavía no hay centros: añada el primero.' : `${centros.length} centro${centros.length === 1 ? '' : 's'} registrado${centros.length === 1 ? '' : 's'}.`}</p>
        </div>
        <button className={btnP} onClick={() => setAnadir('suite')}><Plus size={14} /> Añadir centro</button>
      </div>
      {anadir === 'suite' && (
        <Modal titulo="Añadir centro de trabajo" onCerrar={() => setAnadir(null)}>
          <p className="text-xs text-slate-600 mb-3">Elija el hotel en HS Suite: se rellenan nombre, dirección, municipio, isla y unidades. También puede añadir de golpe todos los hoteles de una cadena.</p>
          <BuscadorHoteles vinculados={vinculados} onElegir={desdeSuite} onCadena={cadenaDesdeSuite} />
          <div className="flex items-center justify-between mt-4">
            <button className="text-xs font-semibold text-slate-600 underline hover:text-slate-900" onClick={() => setAnadir('mano')}>¿No está en HS Suite? Añadir a mano</button>
            <button className={btnP} onClick={() => setAnadir(null)}>Listo</button>
          </div>
        </Modal>
      )}
      {anadir === 'mano' && (
        <Modal titulo="Añadir centro de trabajo a mano" onCerrar={() => setAnadir(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Nombre *" ancho><input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Hotel / sede" autoFocus /></Campo>
            <Campo etiqueta="Municipio"><input className={input} value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></Campo>
            <Campo etiqueta="Isla"><select className={input} value={isla} onChange={(e) => setIsla(e.target.value)} disabled={!balear}>{['Mallorca', 'Menorca', 'Ibiza', 'Formentera'].map((i) => <option key={i}>{i}</option>)}</select></Campo>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 col-span-2"><input type="checkbox" checked={balear} onChange={(e) => setBalear(e.target.checked)} /> Centro en Baleares</label>
          </div>
          <div className="flex items-center justify-between mt-5">
            <button className="text-xs font-semibold text-slate-600 underline hover:text-slate-900" onClick={() => setAnadir('suite')}>Volver a buscar en HS Suite</button>
            <div className="flex gap-2">
              <button className={btnS} onClick={() => setAnadir(null)}>Cancelar</button>
              <button className={btnP} onClick={crear} disabled={!nombre.trim()}><Plus size={14} /> Añadir</button>
            </div>
          </div>
        </Modal>
      )}

      {centros.length > 0 && (
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-2">Centros registrados ({centros.length})</h2>
          <ul className="divide-y divide-slate-100">
            {centros.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <Building2 size={16} className="text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{c.nombre}{c.suite_hotel_id && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">HS Suite</span>}</p>
                  <p className="text-[11px] text-slate-500 truncate">{[c.direccion, c.municipio, c.en_baleares ? c.isla : 'Fuera de Baleares', c.unidades_alojamiento != null ? `${c.unidades_alojamiento} unidades` : null].filter(Boolean).join(' · ') || 'Sin más datos'}</p>
                </div>
                <button className={btnS} onClick={() => onEditar(c)}><Pencil size={13} /> Editar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800">Periodo operativo e índice de actividad {inv ? `(${inv.anio})` : ''}</h2>
        <p className="text-xs text-slate-600 mt-1 mb-3">Si un centro estuvo cerrado o abrió a mitad de año, indique su periodo. El índice (estancias) puede ser 0: los ratios solo se calculan cuando es mayor que 0. La plantilla media del año (de la empresa, según el listado de la Seguridad Social) es opcional y sirve para el ratio por trabajador.</p>
        {!inv ? <p className="text-sm text-slate-600">Abra un cálculo para indicar estos datos.</p> : centros.length === 0 ? <p className="text-sm text-slate-600">Añada al menos un centro.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Operativo desde</th><th className="pr-3">Hasta</th><th className="pr-3">Estancias</th><th>Plantilla media</th></tr></thead>
              <tbody>
                {centros.map((c) => {
                  const x = invCentros.find((y) => y.centro_id === c.id);
                  return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold text-slate-800">{c.nombre}<span className="block text-[11px] font-normal text-slate-500">{[c.municipio, c.en_baleares ? c.isla : 'Fuera de Baleares'].filter(Boolean).join(' · ')}</span></td>
                      <td className="pr-3"><input type="date" className={input} disabled={!abierto} defaultValue={x?.operativo_desde ?? ''} onBlur={(e) => guardar(c, { operativo_desde: e.target.value || null })} aria-label={`Desde ${c.nombre}`} /></td>
                      <td className="pr-3"><input type="date" className={input} disabled={!abierto} defaultValue={x?.operativo_hasta ?? ''} onBlur={(e) => guardar(c, { operativo_hasta: e.target.value || null })} aria-label={`Hasta ${c.nombre}`} /></td>
                      <td className="pr-3"><input type="number" min={0} className={input} disabled={!abierto} defaultValue={x?.indice_actividad ?? 0} onBlur={(e) => guardar(c, { indice_actividad: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Estancias ${c.nombre}`} /></td>
                      <td><input type="number" min={0} step="any" className={input} disabled={!abierto} defaultValue={x?.plantilla_media ?? 0} onBlur={(e) => guardar(c, { plantilla_media: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Plantilla media ${c.nombre}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────── Facturas y revisión ─────────────────────────────
const TIPOS_SUBIDA: Array<[TipoFactura | '', string]> = [
  ['', 'Detectar automáticamente'], ['electricidad', 'Electricidad'], ['gas_natural', 'Gas natural'], ['gasoleo', 'Gasóleo (calefacción)'],
  ['glp', 'Butano / propano (GLP)'], ['combustible_vehiculo', 'Combustible de vehículos'], ['refrigerante', 'Recarga de refrigerante'],
];

const UN_MES = NOMBRES_MES;
const Meses: React.FC<{ cubiertos: Set<number> }> = ({ cubiertos }) => (
  <span className="inline-flex gap-0.5" aria-label="Meses cubiertos">
    {UN_MES.map((m, i) => <span key={m} title={m} className={`text-[9px] w-4 text-center rounded ${cubiertos.has(i) ? 'bg-green-100 text-green-800 font-bold' : 'bg-slate-100 text-slate-400'}`}>{m[0].toUpperCase()}</span>)}
  </span>
);

const tipoDoc = (d: Documento) => (d.extraccion?.tipo ?? d.tipo) as string;
const contadorDoc = (d: Documento) => d.extraccion?.contador;

/** Cabecera de un grupo de facturas: tipo y CUPS (cuando procede), nº, consumo total y meses cubiertos del año. */
const CabeceraGrupo: React.FC<{ g: { tipo: string; contador: string; items: Documento[] }; anio: number; soloTipo?: boolean }> = ({ g, anio, soloTipo }) => {
  const validas = g.items.filter((d) => d.estado !== 'rechazado');
  const cubiertos = new Set<number>(validas.flatMap((d) => mesesTocados(d.periodo_desde ?? d.extraccion?.periodoDesde, d.periodo_hasta ?? d.extraccion?.periodoHasta, anio)));
  const unidad = validas.find((d) => d.extraccion?.unidad)?.extraccion?.unidad ?? '';
  const total = validas.reduce((s, d) => s + (d.extraccion?.cantidad ?? 0), 0);
  const conCups = g.tipo !== 'refrigerante' && g.contador !== 'sin contador';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-xs font-bold text-slate-800">{TIPOS[g.tipo as TipoFactura] ?? g.tipo}{soloTipo ? '' : conCups ? ` · ${g.contador}` : g.tipo !== 'refrigerante' ? ' · sin contador identificado' : ''}</span>
      <span className="text-[11px] text-slate-600">{g.items.length} factura{g.items.length === 1 ? '' : 's'}{total ? ` · ${num(total, 0)} ${unidad}` : ''}</span>
      {g.tipo !== 'refrigerante' && <Meses cubiertos={cubiertos} />}
    </div>
  );
};

const MAX_BYTES = 5 * 1024 * 1024;
const PARALELO = 3;

interface Tarea { id: number; nombre: string; estado: 'espera' | 'subiendo' | 'leyendo' | 'listo' | 'error'; msg?: string }

/** Evalúa una factura leída: datos propuestos, fuente del factor e incidencias (sirve para la revisión individual y en bloque). */
function evaluarDoc(d: Documento, factores: ConjuntoFactores | null, anio: number, otras: Documento[]) {
  const e0 = d.extraccion as ExtraccionFactura;
  const centro = d.centro_id ?? undefined;
  const existentes = otras.filter((x) => x.id !== d.id && (x.estado === 'revisado' || x.estado === 'leido') && x.extraccion)
    .map((x) => ({ id: x.id.slice(0, 8), centro: x.centro_id ?? undefined, proveedor: x.extraccion?.proveedor, contador: x.extraccion?.contador, periodoDesde: x.extraccion?.periodoDesde, periodoHasta: x.extraccion?.periodoHasta, cantidad: x.extraccion?.cantidad, tipo: x.extraccion!.tipo }));
  // Si no trae contador y su periodo se solapa con el de otros contadores, se deduce a cuál pertenece (propuesta visible y revisable)
  const asignacion = asignarContador(e0, { centro, existentes });
  const eContador: ExtraccionFactura = asignacion.contador ? { ...e0, contador: asignacion.contador } : e0;
  const e = resolverGas(eContador); // gas natural: se decide solo si son PCS, PCI o m³ (con nota)
  const incidencias = factores ? validarExtraccion(e, { anioInventario: anio, centro, factores, existentes }) : [];
  const fuente = fuentePorDefecto(e, factores);
  const errores = incidencias.filter((i) => i.gravedad === 'error').length;
  const sinFuente = e.tipo !== 'electricidad' && !fuente;
  return { e, incidencias, fuente, errores, avisos: incidencias.length - errores, sinFuente, asignacion, listo: !!factores && errores === 0 && !sinFuente && e.tipo !== 'otro' };
}

/** Crea la línea de actividad confirmada y marca la factura como revisada (misma lógica para una o varias). */
async function confirmarDocumento(d: Documento, e: ExtraccionFactura, fuente: string, inv: Inventario) {
  const l = proponerActividad(e, { id: 'x', centro: d.centro_id ?? '', documentoId: d.id, fuenteFactor: fuente });
  await huellaService.crearActividad({
    inventario_id: inv.id, centro_id: d.centro_id!, documento_id: d.id, categoria: l.categoria, fuente: l.categoria === 'electricidad' ? '' : fuente || l.fuente,
    cantidad: e.cantidad ?? 0, unidad: e.unidad ?? null, origen_electricidad: l.origenElectricidad ?? null, contador: e.contador?.trim() || null,
    periodo_desde: e.periodoDesde ?? null, periodo_hasta: e.periodoHasta ?? null, reparto_proporcion: 1, estado: 'confirmada', notas: e.nota ?? null,
  });
  await huellaService.actualizarDocumento(d.id, { estado: 'revisado', extraccion: e, tipo: e.tipo, proveedor: e.proveedor ?? null, periodo_desde: e.periodoDesde ?? null, periodo_hasta: e.periodoHasta ?? null, revisado_en: new Date().toISOString() });
}

const PanelFacturas: React.FC<{
  rol: RolHuella; org: Organizacion; inv: Inventario; abierto: boolean; centros: Centro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null;
  onCambio: () => void; falla: (e: unknown) => void; cargando: boolean; setCargando: (b: boolean) => void; currentUser: string;
}> = ({ rol, org, inv, abierto, centros, docs, factores, onCambio, falla, cargando, setCargando }) => {
  const [centroId, setCentroId] = useState('');
  const [tipo, setTipo] = useState<TipoFactura | ''>('');
  const [revisando, setRevisando] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null); // factura sin leer que se está introduciendo a mano
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [arrastrando, setArrastrando] = useState(false);
  useEffect(() => { if (!centroId && centros[0]) setCentroId(centros[0].id); }, [centros, centroId]);

  const version = inv.conjunto_factores?.version?.replace('calculadora-', '');
  const cambiar = (id: number, c: Partial<Tarea>) => setTareas((t) => t.map((x) => (x.id === id ? { ...x, ...c } : x)));

  // Sube y lee varias facturas a la vez (hasta PARALELO en paralelo); un fallo no detiene al resto.
  const subir = async (lista: File[]) => {
    if (!lista.length || !centroId || !abierto) return;
    const base = Date.now();
    const nuevas: Tarea[] = lista.map((f, i) => ({ id: base + i, nombre: f.name, estado: 'espera' }));
    setTareas(nuevas); setCargando(true);
    let siguiente = 0;
    const trabajador = async () => {
      while (siguiente < lista.length) {
        const i = siguiente++; const file = lista[i]; const id = nuevas[i].id;
        if (file.size > MAX_BYTES) { cambiar(id, { estado: 'error', msg: 'Supera 5 MB' }); continue; }
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { cambiar(id, { estado: 'error', msg: 'Formato no admitido' }); continue; }
        let doc: Documento | null = null;
        try {
          cambiar(id, { estado: 'subiendo' });
          doc = await huellaService.subirDocumento(file, org.id, inv.id, centroId, tipo || undefined);
          cambiar(id, { estado: 'leyendo' });
          const r = await huellaService.leerFactura(file, inv.anio, version, tipo || undefined);
          const e = r.extraccion;
          await huellaService.actualizarDocumento(doc.id, { estado: 'leido', extraccion: e, tipo: e.tipo, proveedor: e.proveedor ?? null, periodo_desde: e.periodoDesde ?? null, periodo_hasta: e.periodoHasta ?? null });
          cambiar(id, { estado: 'listo' });
        } catch (x) {
          cambiar(id, { estado: 'error', msg: doc ? `Guardada, pero no se pudo leer: ${x instanceof Error ? x.message : x}` : x instanceof Error ? x.message : String(x) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, lista.length) }, trabajador));
    setCargando(false);
    onCambio();
  };

  const nombreCentro = (id: string | null) => centros.find((c) => c.id === id)?.nombre ?? '—';
  const pendientes = docs.filter((d) => d.estado === 'leido' && d.extraccion);
  const evaluadas = useMemo(() => new Map(pendientes.map((d) => [d.id, evaluarDoc(d, factores, inv.anio, docs)])), [docs, factores, inv.anio]); // eslint-disable-line
  const gruposPend = useMemo(() => agruparPorTipoYContador(pendientes, tipoDoc, contadorDoc), [docs]); // eslint-disable-line
  // Subidas pero sin lectura utilizable (fallo de lectura): cuentan como pendientes en el cierre y antes quedaban ocultas entre las confirmadas
  const sinLeerDocs = useMemo(() => docs.filter((d) => d.estado === 'subido' || (d.estado === 'leido' && !d.extraccion)), [docs]);
  const docsArchivo = useMemo(() => docs.filter((d) => d.estado !== 'leido' && d.estado !== 'subido'), [docs]);
  const gruposTodas = useMemo(() => agruparPorTipoYContador(docsArchivo, tipoDoc, contadorDoc), [docsArchivo]);
  // Paquetes por tipología (electricidad, gas natural…), cada uno con sus contadores dentro
  const paquetes = useMemo(() => {
    const m = new Map<string, { tipo: string; items: Documento[]; subgrupos: typeof gruposTodas }>();
    for (const g of gruposTodas) { const x = m.get(g.tipo) ?? { tipo: g.tipo, items: [], subgrupos: [] }; x.items.push(...g.items); x.subgrupos.push(g); m.set(g.tipo, x); }
    return [...m.values()].sort((a, b) => b.items.length - a.items.length);
  }, [gruposTodas]);
  const listas = pendientes.filter((d) => evaluadas.get(d.id)?.listo);
  const seleccionadasListas = listas.filter((d) => sel.has(d.id));
  const hechas = tareas.filter((t) => t.estado === 'listo' || t.estado === 'error').length;

  const puedeEliminar = rol === 'consultor' && abierto;
  const sinLeer = (d: Documento) => d.estado === 'subido' || (d.estado === 'leido' && !d.extraccion);
  /** Punto de partida para escribir a mano una factura que no se pudo leer: tipo y mes se deducen del nombre del archivo, el resto lo escribe quien revisa. */
  const semilla = (d: Documento): ExtraccionFactura => {
    const n = d.nombre_archivo ?? '';
    const tipo: TipoFactura = /gas[oó]leo/i.test(n) ? 'gasoleo' : /glp|butano|propano/i.test(n) ? 'glp' : /elec|luz/i.test(n) ? 'electricidad' : /\bgas\b/i.test(n) ? 'gas_natural' : 'otro';
    const m = n.match(/(20\d{2})-(0[1-9]|1[0-2])/);
    const desde = m ? `${m[1]}-${m[2]}-01` : d.periodo_desde ?? undefined;
    const hasta = m ? `${m[1]}-${m[2]}-${String(new Date(Number(m[1]), Number(m[2]), 0).getDate()).padStart(2, '0')}` : d.periodo_hasta ?? undefined;
    return { tipo, periodoDesde: desde, periodoHasta: hasta, confianza: 0, nota: `Introducido a mano: la factura «${n}» no se pudo leer automáticamente.` };
  };
  const listaFacturas = (items: Documento[]) => (
    <ul className="divide-y divide-slate-100">
      {[...items].sort((a, b) => String(a.periodo_desde ?? '').localeCompare(String(b.periodo_desde ?? ''))).map((d) => (
        <li key={d.id} className="py-2 flex flex-wrap items-center gap-3">
          <FileText size={15} className="text-slate-500" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold text-slate-800">{d.nombre_archivo}</p>
            <p className="text-[11px] text-slate-500">{nombreCentro(d.centro_id)}{d.periodo_desde ? ` · ${d.periodo_desde} → ${d.periodo_hasta ?? ''}` : ''}{d.extraccion?.cantidad !== undefined ? ` · ${num(d.extraccion.cantidad, 0)} ${d.extraccion.unidad ?? ''}` : ''}</p>
          </div>
          <Estado e={d.estado} />
          <button className={btnS} onClick={async () => { try { window.open(await huellaService.urlDocumento(d.archivo_path), '_blank', 'noopener'); } catch (x) { falla(x); } }}><Eye size={14} /> Ver</button>
          {puedeEliminar && sinLeer(d) && <button className={btnS} onClick={() => setManual(manual === d.id ? null : d.id)}><Pencil size={14} /> {manual === d.id ? 'Cerrar' : 'Introducir a mano'}</button>}
          {puedeEliminar && <Papelera titulo={`Eliminar la factura ${d.nombre_archivo}`} onClick={() => eliminar([d], `la factura «${d.nombre_archivo}»`)} />}
          {manual === d.id && sinLeer(d) && (
            <div className="basis-full">
              <Revision doc={{ ...d, extraccion: semilla(d) }} factores={factores} inv={inv} otras={docs} manual onHecho={() => { setManual(null); onCambio(); }} falla={falla} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
  const eliminar = async (lista: Documento[], que: string) => {
    if (!lista.length) return;
    const conDato = lista.filter((d) => d.estado === 'revisado').length;
    if (!confirm(`Va a eliminar ${que}${conDato ? ` y ${conDato} dato(s) de actividad que generaron` : ''}. Después podrá volver a subirlas si procede. ¿Continuar?`)) return;
    setCargando(true);
    const fallos: string[] = [];
    for (const d of lista) { try { await huellaService.borrarDocumento(d); } catch (x) { fallos.push(`${d.nombre_archivo}: ${x instanceof Error ? x.message : x}`); } }
    setSel(new Set()); setCargando(false); onCambio();
    if (fallos.length) falla(`No se pudieron eliminar ${fallos.length} factura(s):\n${fallos.join('\n')}`);
  };
  const Papelera: React.FC<{ onClick: () => void; titulo: string }> = ({ onClick, titulo }) => (
    <button className="p-1.5 text-slate-500 hover:text-red-600 disabled:opacity-40" aria-label={titulo} title={titulo} disabled={cargando} onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onClick(); }}><Trash2 size={14} /></button>
  );
  const confirmarSeleccion = async () => {
    if (!seleccionadasListas.length) return;
    if (!confirm(`Va a confirmar ${seleccionadasListas.length} facturas como datos de actividad. ¿Ha comprobado sus valores contra las facturas?`)) return;
    setCargando(true);
    const fallos: string[] = [];
    for (const d of seleccionadasListas) {
      try { const ev = evaluadas.get(d.id)!; await confirmarDocumento(d, ev.e, ev.fuente, inv); } catch (x) { fallos.push(`${d.nombre_archivo}: ${x instanceof Error ? x.message : x}`); }
    }
    setSel(new Set()); setCargando(false); onCambio();
    if (fallos.length) falla(`No se pudieron confirmar ${fallos.length} facturas:\n${fallos.join('\n')}`);
  };
  const alternar = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">Subir facturas</h2>
        <p className="text-xs text-slate-600 mb-3">Puede subir un bloque completo (PDF, JPG o PNG, máx. 5 MB cada una). La lectura es automática pero solo una <strong>propuesta</strong>: nada cuenta hasta que usted lo revisa y confirma.</p>
        {centros.length === 0 ? <p className="text-sm text-slate-600">Primero añada un centro en la pestaña Centros.</p> : (
          <>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <label className="text-xs font-semibold text-slate-600 min-w-[200px]">Centro de las facturas
                <select className={`${input} mt-1`} value={centroId} onChange={(e) => setCentroId(e.target.value)}>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-slate-600 min-w-[220px]">Tipo de consumo del bloque
                <select className={`${input} mt-1`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoFactura | '')} aria-label="Tipo de consumo">
                  {TIPOS_SUBIDA.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <label
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir(Array.from(e.dataTransfer.files)); }}
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${arrastrando ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'} ${!abierto || cargando ? 'opacity-50 pointer-events-none' : ''}`}>
              {cargando ? <Loader2 size={22} className="animate-spin text-brand-700" /> : <Upload size={22} className="text-brand-700" />}
              <span className="text-sm font-semibold text-slate-800">{cargando ? `Leyendo… ${hechas} de ${tareas.length}` : 'Arrastre aquí las facturas o pulse para elegirlas'}</span>
              <span className="text-[11px] text-slate-500">{tipo ? `Se leerán como: ${TIPOS_SUBIDA.find(([k]) => k === tipo)?.[1]}` : 'Sin tipo indicado, la lectura lo detecta (más lento y menos seguro)'}</span>
              <input type="file" className="hidden" multiple accept="application/pdf,image/jpeg,image/png" onChange={(e) => { subir(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            </label>
            {!abierto && <p className="text-xs text-amber-700 mt-2">El cálculo no está en borrador: no admite facturas nuevas.</p>}
            {tareas.length > 0 && !cargando && !tareas.some((t) => t.estado === 'error') && (
              <p className="mt-2 text-xs text-green-700 font-semibold"><CheckCircle2 size={13} className="inline mr-1" />{tareas.length} factura{tareas.length === 1 ? '' : 's'} leída{tareas.length === 1 ? '' : 's'}: revíselas en «Pendientes de revisar».</p>
            )}
            {tareas.length > 0 && (cargando || tareas.some((t) => t.estado === 'error')) && (
              <ul className="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs max-h-48 overflow-auto">
                {tareas.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                    {t.estado === 'listo' ? <CheckCircle2 size={14} className="text-green-600" /> : t.estado === 'error' ? <XCircle size={14} className="text-red-600" /> : t.estado === 'espera' ? <span className="w-3.5 h-3.5 rounded-full border border-slate-300" /> : <Loader2 size={14} className="animate-spin text-brand-700" />}
                    <span className="flex-1 truncate text-slate-800">{t.nombre}</span>
                    <span className={t.estado === 'error' ? 'text-red-700' : 'text-slate-500'}>{t.estado === 'error' ? t.msg : { espera: 'En cola', subiendo: 'Subiendo', leyendo: 'Leyendo', listo: 'Leída' }[t.estado]}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {rol === 'consultor' && sinLeerDocs.length > 0 && (
        <div className={`${card} border-red-200`}>
          <h2 className="text-sm font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle size={15} /> Subidas sin leer ({sinLeerDocs.length})</h2>
          <p className="text-xs text-slate-600 mb-2">No se pudo leer su contenido y impiden cerrar el cálculo. Ábralas con «Ver» para comprobarlas y escriba sus datos con «Introducir a mano» (queda ligado a la factura), o elimínelas y vuelva a subirlas.</p>
          {listaFacturas(sinLeerDocs)}
        </div>
      )}
      {pendientes.length > 0 && rol === 'cliente' && (
        <div className={`${card} text-sm text-slate-700`}><Eye size={15} className="inline mr-2 text-slate-500" />{pendientes.length} factura(s) pendientes de revisión por su consultor.</div>
      )}
      {pendientes.length > 0 && rol === 'consultor' && (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-sm font-bold text-slate-800 flex-1">Pendientes de revisar ({pendientes.length})</h2>
            <button className={btnS} onClick={() => setSel(new Set(listas.map((d) => d.id)))} disabled={!listas.length}>Seleccionar las {listas.length} sin errores</button>
            <button className={btnP} onClick={confirmarSeleccion} disabled={!seleccionadasListas.length || cargando || !abierto}><CheckCircle2 size={15} /> Confirmar {seleccionadasListas.length || ''} seleccionadas</button>
          </div>
          <p className="text-xs text-slate-600 mb-2">Compruebe los valores de la tabla contra las facturas («Ver»). Las que tienen errores o necesitan elegir combustible se revisan una a una.</p>
          <div className="space-y-2">
            {gruposPend.map((g) => (
              <details key={`${g.tipo}|${g.contador}`} className="border border-slate-200 rounded-xl" open={gruposPend.length === 1}>
                <summary className="cursor-pointer px-3 py-2.5 bg-slate-50 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex-1 min-w-[220px]"><CabeceraGrupo g={g} anio={inv.anio} /></span>
                  <span className="text-[11px] font-semibold text-slate-600">{g.items.filter((d) => evaluadas.get(d.id)?.listo).length} listas · {g.items.filter((d) => !evaluadas.get(d.id)?.listo).length} por revisar</span>
                  {puedeEliminar && <Papelera titulo="Eliminar las facturas de este grupo" onClick={() => eliminar(g.items, `las ${g.items.length} facturas de este grupo`)} />}
                </summary>
                <div className="overflow-x-auto px-2 pb-2">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-2 pr-2 w-6" /><th className="pr-3">Archivo</th><th className="pr-3">Tipo</th><th className="pr-3">Proveedor</th><th className="pr-3">Periodo</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3">Estado</th><th /></tr></thead>
                    <tbody>
                {g.items.map((d) => {
                  const ev = evaluadas.get(d.id); const e = d.extraccion!;
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2"><input type="checkbox" disabled={!ev?.listo} checked={sel.has(d.id)} onChange={() => alternar(d.id)} aria-label={`Seleccionar ${d.nombre_archivo}`} /></td>
                        <td className="pr-3 text-slate-800">{d.nombre_archivo}<span className="block text-[10px] text-slate-500">{nombreCentro(d.centro_id)}</span></td>
                        <td className="pr-3">{TIPOS[e.tipo] ?? e.tipo}</td><td className="pr-3">{e.proveedor ?? '—'}<span className="block text-[10px] text-slate-500" title={ev?.asignacion.motivo}>{ev?.e.contador ? `Contador: ${ev.e.contador}${ev.asignacion.contador ? ' (asignado)' : ''}` : ev && ev.asignacion.candidatos.length > 1 ? `¿Contador? ${ev.asignacion.candidatos.join(' o ')}` : 'Sin contador'}</span></td>
                        <td className="pr-3 whitespace-nowrap">{e.periodoDesde ?? '?'} → {e.periodoHasta ?? '?'}</td>
                        <td className="pr-3 text-right tabular-nums" title={ev?.e.nota}>{ev?.e.cantidad !== undefined ? num(ev.e.cantidad, 2) : '—'} {ev?.e.unidad ?? ''}{ev?.e.nota && ev.e.cantidad !== e.cantidad ? <span className="block text-[10px] text-slate-500">convertido</span> : null}</td>
                        <td className="pr-3">{ev?.errores ? <span className="text-red-700 font-semibold">{ev.errores} error(es)</span> : ev?.sinFuente ? <span className="text-amber-700 font-semibold">Elegir combustible</span> : ev?.e.cantidad === 0 ? <span className="text-amber-700 font-semibold">Consumo cero · validar</span> : ev?.avisos ? <span className="text-amber-700 font-semibold">{ev.avisos} aviso(s)</span> : <span className="text-green-700 font-semibold">Sin incidencias</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <button className="p-1.5 text-slate-500 hover:text-brand-700" aria-label="Ver factura" onClick={async () => { try { window.open(await huellaService.urlDocumento(d.archivo_path), '_blank', 'noopener'); } catch (x) { falla(x); } }}><Eye size={14} /></button>
                          <button className={btnS} onClick={() => setRevisando(revisando === d.id ? null : d.id)}>{revisando === d.id ? 'Cerrar' : 'Revisar'}</button>
                          {puedeEliminar && <Papelera titulo={`Eliminar la factura ${d.nombre_archivo}`} onClick={() => eliminar([d], `la factura «${d.nombre_archivo}»`)} />}
                        </td>
                      </tr>
                      {revisando === d.id && (
                        <tr><td colSpan={8}><Revision doc={d} factores={factores} inv={inv} otras={docs} onHecho={() => { setRevisando(null); onCambio(); }} falla={falla} /></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Facturas confirmadas del cálculo {inv.anio} ({docsArchivo.length})</h2>
        {docsArchivo.length === 0 ? <p className="text-sm text-slate-600">{docs.length === 0 ? 'Aún no hay facturas.' : 'Todavía no hay facturas confirmadas: revise las pendientes de arriba.'}</p> : (
          <div className="space-y-3">
            {paquetes.map((pq) => (
              <details key={pq.tipo} className="border border-slate-300 rounded-xl bg-white" open={paquetes.length === 1}>
                <summary className="cursor-pointer px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-slate-50">
                  <span className="w-9 h-9 rounded-lg bg-green-100 text-green-800 flex items-center justify-center shrink-0"><FileText size={17} /></span>
                  <span className="flex-1 min-w-0"><CabeceraGrupo g={{ tipo: pq.tipo, contador: 'sin contador', items: pq.items }} anio={inv.anio} soloTipo /></span>
                  {puedeEliminar && <Papelera titulo={`Eliminar todas las facturas de ${TIPOS[pq.tipo as TipoFactura] ?? pq.tipo}`} onClick={() => eliminar(pq.items, `las ${pq.items.length} facturas de ${TIPOS[pq.tipo as TipoFactura] ?? pq.tipo}`)} />}
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {pq.subgrupos.map((g) => (
                    pq.subgrupos.length === 1 && g.contador === 'sin contador' ? <div key={g.contador}>{listaFacturas(g.items)}</div> : (
                      <details key={g.contador} className="border border-slate-200 rounded-xl">
                        <summary className="cursor-pointer px-3 py-2 bg-slate-50 rounded-xl flex items-center gap-2"><span className="flex-1 inline-block align-middle"><CabeceraGrupo g={g} anio={inv.anio} /></span>{puedeEliminar && <Papelera titulo="Eliminar las facturas de este grupo" onClick={() => eliminar(g.items, `las ${g.items.length} facturas de este grupo`)} />}</summary>
                        <div className="px-3">{listaFacturas(g.items)}</div>
                      </details>
                    )
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Estado: React.FC<{ e: Documento['estado'] }> = ({ e }) => {
  const m = { subido: ['Subida', 'bg-slate-100 text-slate-700'], leido: ['Pendiente de revisar', 'bg-amber-100 text-amber-800'], revisado: ['Confirmada', 'bg-green-100 text-green-800'], rechazado: ['Rechazada', 'bg-red-100 text-red-800'] }[e];
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${m[1]}`}>{m[0]}</span>;
};

const Revision: React.FC<{
  doc: Documento; factores: ConjuntoFactores | null; inv: Inventario; otras: Documento[]; onHecho: () => void; falla: (e: unknown) => void; manual?: boolean; corregir?: boolean;
}> = ({ doc, factores, inv, otras, onHecho, falla, manual, corregir }) => {
  const existentes = useMemo(() => otras.filter((x) => x.id !== doc.id && (x.estado === 'revisado' || x.estado === 'leido') && x.extraccion).map((x) => ({ id: x.id.slice(0, 8), centro: x.centro_id ?? undefined, proveedor: x.extraccion?.proveedor, contador: x.extraccion?.contador, periodoDesde: x.extraccion?.periodoDesde, periodoHasta: x.extraccion?.periodoHasta, cantidad: x.extraccion?.cantidad, tipo: x.extraccion!.tipo })), [otras, doc.id]);
  const asignacion = useMemo(() => asignarContador(doc.extraccion!, { centro: doc.centro_id ?? undefined, existentes }), [doc.id, existentes]); // eslint-disable-line
  const [e, setE] = useState<ExtraccionFactura>(() => (asignacion.contador ? { ...doc.extraccion!, contador: asignacion.contador } : doc.extraccion!));
  const conocidos = useMemo(() => Array.from(new Set(existentes.map((x) => x.contador).filter(Boolean))) as string[], [existentes]);
  const [fuente, setFuente] = useState(() => fuentePorDefecto(doc.extraccion!, factores));
  const [guardando, setGuardando] = useState(false);
  const [modoGas, setModoGas] = useState<ModoGas>(() => modoAutomatico(doc.extraccion!));
  const [pcsM3, setPcsM3] = useState(() => (doc.extraccion!.factorConversion ? String(doc.extraccion!.factorConversion).replace('.', ',') : ''));
  // Para gas natural, la lectura efectiva está ya convertida a kWh PCS según lo que confirma la persona que revisa
  const [kgEnvase, setKgEnvase] = useState(() => (/butano/i.test(doc.extraccion!.producto ?? '') ? String(KG_BOMBONA_BUTANO).replace('.', ',') : ''));
  const efectiva = useMemo(() => (
    e.tipo === 'gas_natural' ? aplicarGas(e, modoGas, Number(pcsM3.replace(',', '.')) || undefined)
    : e.tipo === 'glp' ? aplicarEnvases(e, Number(kgEnvase.replace(',', '.')) || undefined)
    : e
  ), [e, modoGas, pcsM3, kgEnvase]);
  useEffect(() => { if (!fuente) setFuente(fuentePorDefecto(e, factores)); }, [factores]); // eslint-disable-line
  const incidencias = useMemo(() => (factores ? validarExtraccion(efectiva, { anioInventario: inv.anio, centro: doc.centro_id ?? undefined, factores, existentes }) : []), [efectiva, factores, inv.anio, existentes]);
  const errores = incidencias.filter((i) => i.gravedad === 'error');
  const cat: Categoria = e.tipo === 'electricidad' ? 'electricidad' : e.tipo === 'refrigerante' ? 'fugitiva' : e.tipo === 'combustible_vehiculo' ? 'combustion_movil' : 'combustion_fija';
  const opciones = opcionesFuente(factores, cat);
  const sinFuente = cat !== 'electricidad' && !fuente;
  const set = <K extends keyof ExtraccionFactura>(k: K, v: ExtraccionFactura[K]) => setE((p) => ({ ...p, [k]: v }));

  const confirmar = async () => {
    setGuardando(true);
    try {
      if (corregir) await huellaService.borrarActividadDocumento(doc.id); // sustituye el dato anterior de esta factura
      await confirmarDocumento(doc, corregir ? { ...efectiva, verificadoManual: true } : efectiva, cat === 'electricidad' ? '' : fuente, inv); onHecho();
    } catch (x) { falla(x); setGuardando(false); }
  };
  const rechazar = async () => { setGuardando(true); try { await huellaService.actualizarDocumento(doc.id, { estado: 'rechazado' }); onHecho(); } catch (x) { falla(x); setGuardando(false); } };

  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-600 mb-3">{corregir ? 'Abra la factura con «Abrir factura» y escriba el dato correcto (consumo, periodo…). Al confirmar, sustituye al dato anterior de esta factura.' : manual ? 'Escriba cada dato tal como figura en la factura (botón «Ver»). El tipo y el mes se han deducido del nombre del archivo: compruébelos.' : `Compruebe cada dato contra la factura (botón «Ver»). Lectura propuesta con confianza ${Math.round((e.confianza ?? 0) * 100)} %.`}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="text-xs font-semibold text-slate-600">Tipo
          <select className={`${input} mt-1`} value={e.tipo} onChange={(ev) => { set('tipo', ev.target.value as TipoFactura); setFuente(''); }}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Proveedor<input className={`${input} mt-1`} value={e.proveedor ?? ''} onChange={(ev) => set('proveedor', ev.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600 col-span-2">Contador / CUPS<input className={`${input} mt-1`} list={`contadores-${doc.id}`} value={e.contador ?? ''} onChange={(ev) => set('contador', ev.target.value)} placeholder="Identifica el punto de suministro" />
          <datalist id={`contadores-${doc.id}`}>{conocidos.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="text-xs font-semibold text-slate-600">Desde<input type="date" className={`${input} mt-1`} value={e.periodoDesde ?? ''} onChange={(ev) => set('periodoDesde', ev.target.value || undefined)} /></label>
        <label className="text-xs font-semibold text-slate-600">Hasta<input type="date" className={`${input} mt-1`} value={e.periodoHasta ?? ''} onChange={(ev) => set('periodoHasta', ev.target.value || undefined)} /></label>
        <label className="text-xs font-semibold text-slate-600">Cantidad<input type="number" min={0} step="any" className={`${input} mt-1`} value={e.cantidad ?? ''} onChange={(ev) => set('cantidad', ev.target.value === '' ? undefined : Number(ev.target.value))} /></label>
        <label className="text-xs font-semibold text-slate-600">Unidad<input className={`${input} mt-1`} value={e.unidad ?? ''} onChange={(ev) => set('unidad', ev.target.value)} placeholder="kWh, kWh PCS, l, kg" /></label>
        {e.tipo === 'electricidad' ? (
          <label className="text-xs font-semibold text-slate-600 col-span-2">Origen de la electricidad
            <select className={`${input} mt-1`} value={e.garantiaOrigen ?? 'desconocida'} onChange={(ev) => set('garantiaOrigen', ev.target.value as ExtraccionFactura['garantiaOrigen'])}>
              <option value="desconocida">No consta (se trata como red)</option><option value="no">Red (sin garantía de origen)</option>
              <option value="renovable_balear">GdO renovable de Baleares</option><option value="renovable_otra">GdO renovable (otra)</option>
            </select>
          </label>
        ) : e.tipo !== 'gas_natural' && e.tipo !== 'otro' ? (
          <label className="text-xs font-semibold text-slate-600 col-span-2">{e.tipo === 'refrigerante' ? 'Gas refrigerante' : 'Combustible (factor)'}
            <select className={`${input} mt-1`} value={fuente} onChange={(ev) => setFuente(ev.target.value)}><option value="">Elegir…</option>{opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </label>
        ) : null}
      </div>
      {e.tipo === 'gas_natural' && (
        <div className="mt-3 rounded-lg px-3 py-3 bg-blue-50 text-blue-900 text-xs">
          <p className="font-semibold mb-1">Unidad del gas natural: la calculadora oficial exige kWh PCS</p>
          <p className="mb-2 text-blue-800">Decidido automáticamente a partir de la factura. Cámbielo solo si no es correcto.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="font-semibold">¿Qué indica la factura?
              <select className={`${input} mt-1 w-auto min-w-[320px]`} value={modoGas} onChange={(ev) => setModoGas(ev.target.value as ModoGas)} aria-label="Unidad del gas natural">
                <option value="">Elegir…</option>
                <option value="pcs">Los kWh son PCS (es lo habitual en la facturación en España)</option>
                <option value="pci">Los kWh son PCI → convertir a PCS (÷ 0,901)</option>
                <option value="m3">La factura da m³ → convertir con su factor de conversión</option>
              </select>
            </label>
            {modoGas === 'm3' && (
              <label className="font-semibold">Factor de conversión de la factura (kWh/m³)
                <input className={`${input} mt-1 w-40`} inputMode="decimal" value={pcsM3} onChange={(ev) => setPcsM3(ev.target.value)} placeholder="Ej.: 11,63" aria-label="Factor de conversión kWh por m3" />
              </label>
            )}
          </div>
          {efectiva.unidad === 'kWh PCS' && modoGas && <p className="mt-2"><strong>Se calculará con {efectiva.cantidad?.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kWh PCS.</strong> {efectiva.nota}</p>}
        </div>
      )}
      {e.tipo === 'glp' && esEnvase(e.unidad) && (
        <div className="mt-3 rounded-lg px-3 py-3 bg-blue-50 text-blue-900 text-xs">
          <p className="font-semibold mb-2">Butano / propano en envases: la calculadora necesita kg</p>
          <label className="font-semibold">Kg por {e.unidad ?? 'envase'}
            <input className={`${input} mt-1 w-40`} inputMode="decimal" value={kgEnvase} onChange={(ev) => setKgEnvase(ev.target.value)} placeholder="Ej.: 12,5" aria-label="Kg por envase" />
          </label>
          {efectiva.unidad === 'kg' && <p className="mt-2"><strong>Se calculará con {efectiva.cantidad?.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg.</strong> {efectiva.nota}</p>}
        </div>
      )}
      {asignacion.motivo && (
        <div className="mt-3 text-xs rounded-lg px-3 py-2 bg-blue-50 text-blue-900 flex flex-wrap items-center gap-2">
          <Eye size={13} className="shrink-0" /><span><strong>{asignacion.contador && e.contador === asignacion.contador ? 'Contador asignado automáticamente:' : 'Contador por decidir:'}</strong> {asignacion.motivo} Compruébelo con la factura.</span>
          {!asignacion.contador && asignacion.candidatos.map((c) => <button key={c} className={btnS} onClick={() => set('contador', c)}>{c}</button>)}
        </div>
      )}
      {incidencias.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {incidencias.map((i, k) => (
            <li key={k} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${i.gravedad === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span><strong>{i.gravedad === 'error' ? 'Corregir:' : 'Revisar:'}</strong> {i.mensaje}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btnP} onClick={confirmar} disabled={guardando || !factores || errores.length > 0 || sinFuente || e.tipo === 'otro'}><CheckCircle2 size={15} /> {corregir ? 'Guardar dato corregido' : 'Confirmar como actividad'}</button>
        {!corregir && <button className={btnS} onClick={rechazar} disabled={guardando}><XCircle size={15} /> Rechazar factura</button>}
        {(errores.length > 0 || sinFuente) && <span className="text-xs text-slate-600 self-center">{errores.length > 0 ? 'Resuelva los errores para confirmar.' : 'Elija el combustible o gas.'}</span>}
      </div>
    </div>
  );
};


// ───────────────────────────── Tabla de líneas de actividad (la misma en «Consumos» y en «Trazabilidad por línea») ─────────────────────────────
const TablaLineas: React.FC<{
  lineas: Actividad[]; resultados: ResultadoLinea[]; factores: ConjuntoFactores; centros: Centro[]; docs: Documento[]; inv: Inventario; abierto: boolean; onCambio: () => void; falla: (e: unknown) => void;
}> = ({ lineas, resultados, factores, centros, docs, inv, abierto, onCambio, falla }) => {
  const [editando, setEditando] = useState<string | null>(null);
  const [m, setM] = useState({ cantidad: '', contador: '', notas: '', desde: '', hasta: '' });
  const [guardando, setGuardando] = useState(false);
  const nombreCentro = (id: string) => centros.find((c) => c.id === id)?.nombre ?? '—';
  const abrirEditor = (a: Actividad) => {
    if (editando === a.id) { setEditando(null); return; }
    setM({ cantidad: String(a.cantidad), contador: a.contador ?? '', notas: a.notas ?? '', desde: a.periodo_desde ?? '', hasta: a.periodo_hasta ?? '' });
    setEditando(a.id);
  };
  const guardarManual = async (a: Actividad) => {
    setGuardando(true);
    try {
      await huellaService.actualizarActividad(a.id, { cantidad: Number(m.cantidad.replace(',', '.')), contador: m.contador.trim() || null, notas: m.notas.trim() || null, periodo_desde: m.desde || null, periodo_hasta: m.hasta || null });
      setEditando(null); onCambio();
    } catch (e) { falla(e); } finally { setGuardando(false); }
  };
  const kg = new Map<string, ResultadoLinea>(resultados.map((r) => [r.linea.id, r] as [string, ResultadoLinea]));
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Categoría</th><th className="pr-3">Fuente</th><th className="pr-3">Contador</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3 text-right">Factor de emisión</th><th className="pr-3 text-right">t CO₂e</th><th className="pr-3">Origen</th><th /></tr></thead>
      <tbody>{lineas.map((a) => {
        const r = kg.get(a.id);
        const ud = a.categoria === 'electricidad' ? 'kWh' : a.categoria === 'fugitiva' ? 'kg' : factores.unidades[a.fuente] ?? (a.unidad ?? '');
        const base = Number(a.cantidad) * Number(a.reparto_proporcion ?? 1);
        const factor = r && base > 0 ? r.kgCO2e / base : null;
        const doc = a.documento_id ? docs.find((d) => d.id === a.documento_id) : undefined;
        return (
          <React.Fragment key={a.id}>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">{nombreCentro(a.centro_id)}</td><td className="pr-3">{CATEGORIAS[a.categoria]}</td>
              <td className="pr-3">{a.fuente || (a.origen_electricidad ? ORIGEN[a.origen_electricidad] : 'Electricidad')}</td>
              <td className="pr-3 text-slate-600">{a.contador || '—'}</td>
              <td className="pr-3 text-right tabular-nums">{num(a.cantidad, 2)} <span className="text-slate-500">{ud}</span></td>
              <td className="pr-3 text-right tabular-nums">{factor === null ? '—' : <>{num(factor, 4)} <span className="text-slate-500">kg CO₂e/{ud || 'ud'}</span></>}</td>
              <td className="pr-3 text-right tabular-nums font-semibold">{r ? num(r.kgCO2e / 1000, 3) : '—'}</td>
              <td className="pr-3 text-slate-600">{a.documento_id ? 'Factura' : `Manual: ${a.notas ?? ''}`}{a.periodo_desde ? ` · ${a.periodo_desde}` : ''}</td>
              <td className="text-right whitespace-nowrap">
                {doc && <button className="p-1.5 text-slate-500 hover:text-brand-700" aria-label="Ver factura" title="Ver factura" onClick={async () => { try { window.open(await huellaService.urlDocumento(doc.archivo_path), '_blank', 'noopener'); } catch (e) { falla(e); } }}><Eye size={15} /></button>}
                {abierto && <button className="p-1.5 text-slate-500 hover:text-brand-700" aria-label="Editar" title="Editar" onClick={() => abrirEditor(a)}><Pencil size={15} /></button>}
                {abierto && <button className="p-1.5 text-slate-500 hover:text-red-600" aria-label="Eliminar" title="Eliminar" onClick={async () => { if (confirm('¿Eliminar este dato de actividad?')) { try { await huellaService.borrarActividad(a.id); onCambio(); } catch (e) { falla(e); } } }}><Trash2 size={15} /></button>}
              </td>
            </tr>
            {abierto && editando === a.id && (
              <tr className="border-b border-slate-100"><td colSpan={9} className="pb-3">
                {doc && doc.extraccion
                  ? <Revision key={doc.id} doc={doc} factores={factores} inv={inv} otras={docs} corregir onHecho={() => { setEditando(null); onCambio(); }} falla={falla} />
                  : (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="text-xs font-semibold text-slate-600">Cantidad ({ud || 'unidad'})<input inputMode="decimal" className={`${input} mt-1`} value={m.cantidad} onChange={(e) => setM({ ...m, cantidad: e.target.value })} /></label>
                        <label className="text-xs font-semibold text-slate-600">Contador / CUPS<input className={`${input} mt-1`} value={m.contador} onChange={(e) => setM({ ...m, contador: e.target.value })} /></label>
                        <label className="text-xs font-semibold text-slate-600">Desde<input type="date" className={`${input} mt-1`} value={m.desde} onChange={(e) => setM({ ...m, desde: e.target.value })} /></label>
                        <label className="text-xs font-semibold text-slate-600">Hasta<input type="date" className={`${input} mt-1`} value={m.hasta} onChange={(e) => setM({ ...m, hasta: e.target.value })} /></label>
                        <label className="text-xs font-semibold text-slate-600 col-span-2 md:col-span-4">Origen del dato<input className={`${input} mt-1`} value={m.notas} onChange={(e) => setM({ ...m, notas: e.target.value })} /></label>
                      </div>
                      <div className="mt-3 flex gap-2"><button className={btnP} disabled={guardando || m.cantidad.trim() === '' || !(Number(m.cantidad.replace(',', '.')) >= 0)} onClick={() => guardarManual(a)}>{guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar</button><button className={btnS} onClick={() => setEditando(null)}>Cancelar</button></div>
                    </div>
                  )}
              </td></tr>
            )}
          </React.Fragment>
        );
      })}</tbody>
    </table></div>
  );
};

// ───────────────────────────── Actividad (alta manual y listado) ─────────────────────────────
const PanelActividad: React.FC<{ inv: Inventario; abierto: boolean; centros: Centro[]; actividad: Actividad[]; docs: Documento[]; factores: ConjuntoFactores | null; onCambio: () => void; falla: (e: unknown) => void }> = ({ inv, abierto, centros, actividad, docs, factores, onCambio, falla }) => {
  const [centro, setCentro] = useState(''); const [cat, setCat] = useState<Categoria>('combustion_fija'); const [fuente, setFuente] = useState('');
  const [cantidad, setCantidad] = useState(''); const [origen, setOrigen] = useState<OrigenElectricidad>('red'); const [nota, setNota] = useState(''); const [contador, setContador] = useState('');
  const [formAbierto, setFormAbierto] = useState(false); const [fCentro, setFCentro] = useState(''); const [fFuente, setFFuente] = useState(''); const [fContador, setFContador] = useState(''); const [metrica, setMetrica] = useState<'co2e' | 'consumo'>('co2e');
  useEffect(() => { if (!centro && centros[0]) setCentro(centros[0].id); }, [centros, centro]);
  const opciones = opcionesFuente(factores, cat);
  const valido = centro && Number(cantidad) >= 0 && cantidad !== '' && (cat === 'electricidad' || fuente) && nota.trim().length > 3;
  const anadir = async () => {
    try {
      await huellaService.crearActividad({ inventario_id: inv.id, centro_id: centro, categoria: cat, fuente: cat === 'electricidad' ? '' : fuente, cantidad: Number(cantidad), origen_electricidad: cat === 'electricidad' ? origen : null, reparto_proporcion: 1, estado: 'confirmada', notas: nota.trim(), contador: contador.trim() || null });
      setCantidad(''); setNota(''); setFormAbierto(false); onCambio();
    } catch (e) { falla(e); }
  };
  const nombreCentro = (id: string) => centros.find((c) => c.id === id)?.nombre ?? '—';
  const etiquetaFuente = (a: Actividad) => a.fuente || 'Electricidad';
  const fuentesDisp = (Array.from(new Set(actividad.map(etiquetaFuente))) as string[]).sort();
  const contadoresDisp = (Array.from(new Set(actividad.map((a) => a.contador || ''))) as string[]).filter(Boolean).sort();
  const calculoAct = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);
  const filtradas = actividad.filter((a) => (!fCentro || a.centro_id === fCentro) && (!fFuente || etiquetaFuente(a) === fFuente) && (!fContador || (a.contador || '') === fContador));
  return (
    <div className="space-y-4">
      <GraficoActividad inv={inv} factores={factores} centros={centros} actividad={actividad} filtradas={filtradas} fuentesDisp={fuentesDisp} contadoresDisp={contadoresDisp}
        fCentro={fCentro} setFCentro={setFCentro} fFuente={fFuente} setFFuente={setFFuente} fContador={fContador} setFContador={setFContador} metrica={metrica} setMetrica={setMetrica} />
      {formAbierto && abierto && (
        <Modal titulo="Añadir consumo a mano" onCerrar={() => setFormAbierto(false)}>
          <p className="text-xs text-slate-600 mb-3">Para datos sin factura legible (p. ej. un contador). Es obligatorio indicar el origen del dato: queda como evidencia para el verificador.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-600">Centro<select className={`${input} mt-1`} value={centro} onChange={(e) => setCentro(e.target.value)}>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Categoría<select className={`${input} mt-1`} value={cat} onChange={(e) => { setCat(e.target.value as Categoria); setFuente(''); }}>{Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {cat === 'electricidad'
            ? <label className="text-xs font-semibold text-slate-600">Origen<select className={`${input} mt-1`} value={origen} onChange={(e) => setOrigen(e.target.value as OrigenElectricidad)}>{Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            : <label className="text-xs font-semibold text-slate-600">{cat === 'fugitiva' ? 'Gas' : 'Combustible'}<select className={`${input} mt-1`} value={fuente} onChange={(e) => setFuente(e.target.value)}><option value="">Elegir…</option>{opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>}
          <label className="text-xs font-semibold text-slate-600">Cantidad ({cat === 'electricidad' ? 'kWh' : cat === 'fugitiva' ? 'kg' : (factores?.unidades[fuente] ?? 'unidad del factor')})<input type="number" min={0} step="any" className={`${input} mt-1`} value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600">Contador / CUPS (opcional)<input className={`${input} mt-1`} value={contador} onChange={(e) => setContador(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600 col-span-2 md:col-span-3">Origen del dato (obligatorio)<input className={`${input} mt-1`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: lectura de contador del 31/12, albarán 123…" /></label>
                  </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnS} onClick={() => setFormAbierto(false)}>Cancelar</button>
            <button className={btnP} onClick={anadir} disabled={!abierto || !valido}><Plus size={14} /> Añadir</button>
          </div>
        </Modal>
      )}
      <details className={`${card} group`} open>
        <summary className="cursor-pointer list-none flex items-center gap-3 mb-3">
          <ChevronRight size={15} className="transition-transform group-open:rotate-90 shrink-0" />
          <h2 className="flex-1 text-sm font-bold text-slate-800">Consumos confirmados ({filtradas.length}{filtradas.length !== actividad.length ? ` de ${actividad.length}` : ''})</h2>
          {abierto && <button className={btnS} onClick={(e) => { e.preventDefault(); setFormAbierto(true); }}><Plus size={14} /> Añadir consumo a mano</button>}
        </summary>
        {actividad.length === 0 ? <p className="text-sm text-slate-600">Aún no hay consumos. Suba facturas o añada un consumo a mano.</p> : !factores || !calculoAct ? <p className="text-sm text-slate-600"><Loader2 size={14} className="inline animate-spin mr-2" />Cargando factores de emisión…</p> : (
          <TablaLineas lineas={filtradas} resultados={calculoAct.resultados} factores={factores} centros={centros} docs={docs} inv={inv} abierto={abierto} onCambio={onCambio} falla={falla} />
        )}
      </details>
    </div>
  );
};

// ───────────────────────────── Gráfico mensual de la actividad ─────────────────────────────
const COLORES = ['#00BF46', '#022ADA', '#EA980F', '#24CBF5', '#C234D6', '#F9416D', '#77D464', '#000F51'];

const GraficoActividad: React.FC<{
  inv: Inventario; factores: ConjuntoFactores | null; centros: Centro[]; actividad: Actividad[]; filtradas: Actividad[]; fuentesDisp: string[]; contadoresDisp: string[];
  fCentro: string; setFCentro: (v: string) => void; fFuente: string; setFFuente: (v: string) => void; fContador: string; setFContador: (v: string) => void;
  metrica: 'co2e' | 'consumo'; setMetrica: (m: 'co2e' | 'consumo') => void; compacto?: boolean;
}> = ({ inv, factores, centros, actividad, filtradas, fuentesDisp, contadoresDisp, fCentro, setFCentro, fFuente, setFFuente, fContador, setFContador, metrica, setMetrica, compacto }) => {
  const consumoPosible = !!fFuente; // el consumo solo tiene sentido en una única unidad
  const m = consumoPosible ? metrica : 'co2e';
  const unidad = fFuente === 'Electricidad' ? 'kWh' : factores?.unidades[fFuente] ?? (factores?.pcaRefrigerantes[fFuente] !== undefined ? 'kg' : 'unidad del factor');

  const { datos, series, sinPeriodo, fuera } = useMemo(() => {
    const series: string[] = [];
    const datos = UN_MES.map((mes) => ({ mes } as Record<string, number | string>));
    let sinPeriodo = 0; let fuera = 0;
    for (const a of filtradas) {
      const serie = a.fuente || 'Electricidad';
      if (!series.includes(serie)) series.push(serie);
      let valor = Number(a.cantidad);
      if (m === 'co2e') {
        if (!factores) continue;
        try {
          const l: LineaActividad = { id: a.id, centro: a.centro_id, categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad), origenElectricidad: a.origen_electricidad ?? undefined, reparto: a.reparto_proporcion < 1 ? { proporcion: Number(a.reparto_proporcion), justificacion: a.reparto_justificacion ?? '' } : undefined };
          valor = calcularLinea(l, factores).kgCO2e / 1000;
        } catch { continue; }
      }
      const r = repartirPorMes(a.periodo_desde, a.periodo_hasta, valor, inv.anio);
      if (r.sinPeriodo) { sinPeriodo += 1; continue; }
      fuera += r.fueraDeAnio;
      r.meses.forEach((v, i) => { datos[i][serie] = Number(datos[i][serie] ?? 0) + v; });
    }
    return { datos, series, sinPeriodo, fuera };
  }, [filtradas, factores, m, inv.anio]);

  const fmt = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: m === 'co2e' ? 2 : 0 });
  const hayDatos = series.some((s) => datos.some((d) => Number(d[s] ?? 0) > 0));
  return (
    <div className={card}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <h2 className="text-sm font-bold text-slate-800 flex-1 min-w-[180px]">Evolución mensual · {inv.anio}</h2>
        {!compacto && (<>
        <label className="text-[11px] font-semibold text-slate-600">Centro
          <select className={`${input} mt-1`} value={fCentro} onChange={(e) => setFCentro(e.target.value)} aria-label="Filtrar por centro"><option value="">Todos</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label className="text-[11px] font-semibold text-slate-600">Tipo de consumo / fuente
          <select className={`${input} mt-1`} value={fFuente} onChange={(e) => setFFuente(e.target.value)} aria-label="Filtrar por fuente"><option value="">Todas</option>{fuentesDisp.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        </label>
        {contadoresDisp.length > 0 && (
          <label className="text-[11px] font-semibold text-slate-600">Contador / CUPS
            <select className={`${input} mt-1`} value={fContador} onChange={(e) => setFContador(e.target.value)} aria-label="Filtrar por contador"><option value="">Todos</option>{contadoresDisp.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
        )}
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs font-semibold" role="group" aria-label="Magnitud">
          <button className={`px-3 py-2 ${m === 'co2e' ? 'bg-brand-600 text-white' : 'bg-white text-slate-700'}`} onClick={() => setMetrica('co2e')}>t CO₂e</button>
          <button className={`px-3 py-2 ${m === 'consumo' ? 'bg-brand-600 text-white' : 'bg-white text-slate-700'} disabled:opacity-40`} disabled={!consumoPosible} onClick={() => setMetrica('consumo')} title={consumoPosible ? '' : 'Elija una fuente para ver su consumo en su unidad'}>Consumo{consumoPosible ? ` (${unidad})` : ''}</button>
        </div>
        </>)}
      </div>
      {actividad.length === 0 ? <p className="text-sm text-slate-600">Aún no hay datos de actividad para representar.</p>
        : !hayDatos ? <p className="text-sm text-slate-600">No hay datos con periodo para estos filtros.</p> : (
        <div style={{ width: '100%', height: 280 }} role="img" aria-label={`Gráfico mensual de ${m === 'co2e' ? 'emisiones en toneladas de CO2 equivalente' : `consumo en ${unidad}`}`}>
          <ResponsiveContainer>
            <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} width={56} />
              <Tooltip formatter={(v: number) => `${fmt(v)} ${m === 'co2e' ? 't CO₂e' : unidad}`} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {series.map((sr, i) => <Bar key={sr} dataKey={sr} stackId="a" fill={COLORES[i % COLORES.length]} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {(sinPeriodo > 0 || fuera > 0.5) && (
        <p className="text-[11px] text-amber-800 mt-2">
          {sinPeriodo > 0 && `${sinPeriodo} dato(s) sin periodo no aparecen en el gráfico. `}
          {fuera > 0.5 && `Parte de algún periodo cae fuera de ${inv.anio} y no se representa.`}
        </p>
      )}
      <p className="text-[11px] text-slate-500 mt-1">Cada consumo se reparte por meses en proporción a los días de su periodo de facturación.</p>
    </div>
  );
};

/** Calcula el inventario a partir de los datos confirmados; los que no tienen factor se devuelven aparte (nunca se asume cero). */
function calcularActividad(actividad: Actividad[], centros: Centro[], factores: ConjuntoFactores) {
  const nombre = (id: string) => centros.find((c) => c.id === id)?.nombre ?? id;
  const lineas: LineaActividad[] = []; const fallos: string[] = [];
  for (const a of actividad.filter((x) => x.estado === 'confirmada')) {
    lineas.push({ id: a.id, centro: nombre(a.centro_id), categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad), origenElectricidad: a.origen_electricidad ?? undefined, evidencia: a.documento_id ?? undefined, contador: a.contador ?? undefined,
      reparto: a.reparto_proporcion < 1 ? { proporcion: Number(a.reparto_proporcion), justificacion: a.reparto_justificacion ?? '' } : undefined });
  }
  const validas = lineas.filter((l) => { try { calcularInventario([l], factores); return true; } catch (e) { fallos.push(`${l.centro} · ${l.fuente || 'electricidad'}: ${e instanceof Error ? e.message : e}`); return false; } });
  return { ...calcularInventario(validas, factores), fallos, lineas: validas.length };
}

// ───────────────────────────── Cierre del cálculo ─────────────────────────────
const PanelCierre: React.FC<{
  org: Organizacion; onCambio: () => void; inv: Inventario; invs: Inventario[]; centros: Centro[]; invCentros: InventarioCentro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null;
  usuario: string; falla: (e: unknown) => void; onInventario: (i: Inventario) => void; onIr: (destino: 'facturas' | 'consumos' | 'centros') => void;
}> = ({ org, onCambio, inv, invs, centros, invCentros, docs, actividad, factores, usuario, falla, onInventario, onIr }) => {
  const abierto = inv.estado === 'borrador';
  const [origenSel, setOrigenSel] = useState<'' | 'no' | 'renovable_balear' | 'renovable_otra'>('');
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null); // factura del cierre cuyo dato se está corrigiendo a mano
  const [correo, setCorreo] = useState<{ asunto: string; cuerpo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Facturas de electricidad ya confirmadas en las que no consta la garantía de origen
  const docsSinOrigen = docs.filter((d) => d.estado === 'revisado' && (d.extraccion?.tipo ?? d.tipo) === 'electricidad' && (!d.extraccion?.garantiaOrigen || d.extraccion.garantiaOrigen === 'desconocida'));
  const aplicarOrigen = async () => {
    if (!origenSel || !docsSinOrigen.length) return;
    const nombre = { no: 'Red (sin garantía de origen)', renovable_balear: 'GdO renovable de Baleares', renovable_otra: 'GdO renovable (otra)' }[origenSel];
    if (!confirm(`Va a marcar ${docsSinOrigen.length} factura(s) de electricidad como «${nombre}» y recalcular su huella. ${origenSel === 'no' ? '' : 'Hágalo solo si todas acreditan esa garantía de origen. '}¿Continuar?`)) return;
    setTrabajando(true);
    try {
      const act = { no: 'red', renovable_balear: 'gdo_renovable_balear', renovable_otra: 'gdo_otra' }[origenSel] as OrigenElectricidad;
      for (const d of docsSinOrigen) {
        await huellaService.actualizarDocumento(d.id, { extraccion: { ...d.extraccion!, garantiaOrigen: origenSel } });
        await huellaService.fijarOrigenActividadDocumento(d.id, act);
      }
      setOrigenSel(''); onCambio();
    } catch (e) { falla(e); } finally { setTrabajando(false); }
  };
  const eliminarFactura = async (d: Documento) => {
    if (!confirm(`Va a eliminar la factura «${d.nombre_archivo}»${d.estado === 'revisado' ? ' y el dato de actividad que generó' : ''}. Después podrá volver a subirla si procede. ¿Continuar?`)) return;
    setTrabajando(true);
    try { await huellaService.borrarDocumento(d); onCambio(); } catch (e) { falla(e); } finally { setTrabajando(false); }
  };
  const redactar = () => {
    const c = redactarCorreoPendientes({
      organizacion: org.nombre, anio: inv.anio, anioCompleto: inv.anio < new Date().getFullYear(), remitente: usuario,
      docs: docs.map((d) => ({ nombre: d.nombre_archivo, centro: centros.find((x) => x.id === d.centro_id)?.nombre, estado: d.estado, tipo: (d.extraccion?.tipo ?? d.tipo) as string, contador: d.extraccion?.contador, periodoDesde: d.periodo_desde ?? d.extraccion?.periodoDesde, periodoHasta: d.periodo_hasta ?? d.extraccion?.periodoHasta, origenElectricidad: d.extraccion?.garantiaOrigen })),
    });
    setCorreo({ asunto: c.asunto, cuerpo: c.cuerpo }); setCopiado(false);
  };
  const [exclusiones, setExclusiones] = useState<Exclusion[]>([]);
  const [ncs, setNcs] = useState<NoConformidad[]>([]);
  const [previo, setPrevio] = useState<{ a1: number; a2: number; total: number; anio: number } | null | undefined>(undefined);
  const [analisis, setAnalisis] = useState(inv.cierre?.analisisVariacion ?? '');
  const [fx, setFx] = useState({ fuente: '', otra: '', porcentaje: '', justificacion: '' });
  const [nc, setNc] = useState({ descripcion: '', medida: '', responsable: '' });
  const [reabrir, setReabrir] = useState(false);
  const [modalEx, setModalEx] = useState(false);
  const [modalNc, setModalNc] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => { setAnalisis(inv.cierre?.analisisVariacion ?? ''); }, [inv.id, inv.cierre?.analisisVariacion]);
  useEffect(() => {
    Promise.all([huellaService.exclusiones(inv.id), huellaService.noConformidades(inv.id)]).then(([e, n]) => { setExclusiones(e); setNcs(n); }).catch(falla);
  }, [inv.id]); // eslint-disable-line

  // Totales del año anterior (con los factores con que se cerró o, si no, la edición propuesta para ese año)
  useEffect(() => {
    setPrevio(undefined);
    const prev = invs.find((i) => i.anio === inv.anio - 1);
    if (!prev) { setPrevio(null); return; }
    (async () => {
      try {
        const [act, conj] = await Promise.all([huellaService.actividad(prev.id), prev.conjunto_factores ? Promise.resolve(prev.conjunto_factores) : cargarConjunto(prev.anio).then((c) => c.conjunto)]);
        const t = calcularActividad(act, centros, conj).totales;
        setPrevio({ a1: t.kgCO2eAlcance1, a2: t.kgCO2eAlcance2, total: t.kgCO2eTotal, anio: prev.anio });
      } catch { setPrevio(null); }
    })();
  }, [inv.id, invs.length]); // eslint-disable-line

  const calculo = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);
  type FilaCert = { incluir: boolean; documento: DocumentoExt; concepto: string; operacion: OperacionExt; cantidad: string; kg: string; fecha?: string; pagina?: number; agente: string };
  const [filasCert, setFilasCert] = useState<FilaCert[]>([]);
  const [certExt, setCertExt] = useState<File | null>(null);
  const [certPath, setCertPath] = useState<string | null>(null);
  const [leyendoCert, setLeyendoCert] = useState(false);
  const [obsCert, setObsCert] = useState('');
  const esExt = fx.fuente === FUENTE_EXTINTORES;
  const totalInvT = (calculo?.totales.kgCO2eTotal ?? 0) / 1000;
  const num = (x: string) => Number(x.replace(',', '.')) || 0;
  const elegidas = filasCert.filter((f) => f.incluir && num(f.cantidad) > 0 && num(f.kg) > 0);
  const calcExt = useMemo(() => calcularExtintores(agruparPorKg(elegidas.map((f) => ({ cantidad: num(f.cantidad), kgPorExtintor: num(f.kg) }))), totalInvT), [filasCert, totalInvT]); // eslint-disable-line
  const cambiarFila = (i: number, c: Partial<FilaCert>) => setFilasCert((l) => l.map((f, k) => (k === i ? { ...f, ...c } : f)));
  const elegirCert = async (f: File | null) => {
    setCertExt(f); setFilasCert([]); setCertPath(null); setObsCert('');
    if (!f) return;
    setLeyendoCert(true);
    try {
      const path = await huellaService.subirCertificadoExclusion(f, org.id, inv.id);
      setCertPath(path);
      if (f.type === 'application/pdf') {
        const l = await huellaService.leerExtintores(path);
        const inc = incluirPorDefecto(l.lineas);
        setFilasCert(l.lineas.map((x, i) => ({ incluir: inc[i], documento: x.documento, concepto: x.concepto, operacion: x.operacion, agente: x.agente, cantidad: String(x.cantidad), kg: x.kgPorExtintor ? String(x.kgPorExtintor) : '', fecha: x.fecha, pagina: x.pagina })));
        setObsCert(l.observaciones ?? '');
      }
    } catch (e) { falla(e); } finally { setLeyendoCert(false); }
  };
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const plantilla = invCentros.reduce((s, c) => s + Number(c.plantilla_media || 0), 0);
  const variaciones = previo && calculo ? [
    { nombre: 'Alcance 1', actual: calculo.totales.kgCO2eAlcance1, anterior: previo.a1 },
    { nombre: 'Alcance 2', actual: calculo.totales.kgCO2eAlcance2, anterior: previo.a2 },
    { nombre: 'Total', actual: calculo.totales.kgCO2eTotal, anterior: previo.total },
  ] : undefined;

  const evaluacion = useMemo(() => {
    if (!factores || !calculo || previo === undefined) return null;
    return evaluarCierre({
      anio: inv.anio,
      docs: docs.map((d) => ({ id: d.id, nombre: d.nombre_archivo, centro: centros.find((c) => c.id === d.centro_id)?.nombre, estado: d.estado, tipo: (d.extraccion?.tipo ?? d.tipo) as string, contador: d.extraccion?.contador, periodoDesde: d.periodo_desde ?? d.extraccion?.periodoDesde, periodoHasta: d.periodo_hasta ?? d.extraccion?.periodoHasta, origenElectricidad: d.extraccion?.garantiaOrigen, cantidad: d.extraccion?.cantidad, verificado: d.extraccion?.verificadoManual })),
      actividadConfirmada: actividad.filter((a) => a.estado === 'confirmada').length,
      actividadManual: actividad.filter((a) => !a.documento_id).length,
      fallosCalculo: calculo.fallos.length, fallosDetalle: calculo.fallos,
      centrosSinIndice: centros.filter((c) => !(invCentros.find((x) => x.centro_id === c.id)?.indice_actividad > 0)).map((c) => c.nombre),
      centrosSinPlantilla: plantilla > 0 ? centros.filter((c) => !(Number(invCentros.find((x) => x.centro_id === c.id)?.plantilla_media) > 0)).map((c) => c.nombre) : [],
      factoresId: factores.id, factoresFijados: !!inv.conjunto_factores,
      variaciones, analisisVariacion: analisis,
      exclusiones: exclusiones.map((x) => ({ fuente: x.fuente, porcentaje: x.porcentaje, justificacion: x.justificacion })),
      ncAbiertas: ncs.filter((n) => !n.cerrada_en).length,
    });
  }, [factores, calculo, previo, docs, actividad, centros, invCentros, exclusiones, ncs, analisis, inv.anio, inv.conjunto_factores]); // eslint-disable-line

  const guardarAnalisis = async () => {
    if (!abierto || analisis === (inv.cierre?.analisisVariacion ?? '')) return;
    try { onInventario(await huellaService.guardarCierre(inv.id, { ...(inv.cierre ?? {}), analisisVariacion: analisis })); } catch (e) { falla(e); }
  };
  const cerrar = async () => {
    if (!factores || !calculo || !evaluacion?.puedeCerrar) return;
    if (!confirm(`Va a cerrar el cálculo ${inv.anio}. Se fijarán los factores (${factores.id}) y los resultados, y no podrá modificarse ningún dato sin reabrirlo con su causa. ¿Continuar?`)) return;
    setTrabajando(true);
    try {
      const resumen = { kgCO2eAlcance1: calculo.totales.kgCO2eAlcance1, kgCO2eAlcance2: calculo.totales.kgCO2eAlcance2, kgCO2eTotal: calculo.totales.kgCO2eTotal, indiceActividad: indice, factores: factores.id, lineas: calculo.lineas, fecha: new Date().toISOString() };
      onInventario(await huellaService.cerrarInventario(inv.id, factores, { ...(inv.cierre ?? {}), analisisVariacion: analisis, resumen }));
    } catch (e) { falla(e); } finally { setTrabajando(false); }
  };
  const reabrirInv = async () => {
    setTrabajando(true);
    try {
      const reaperturas = [...(inv.cierre?.reaperturas ?? []), { fecha: new Date().toISOString(), usuario, motivo: motivo.trim() }];
      onInventario(await huellaService.reabrirInventario(inv.id, { ...(inv.cierre ?? {}), reaperturas }));
      setReabrir(false); setMotivo('');
    } catch (e) { falla(e); } finally { setTrabajando(false); }
  };
  const anadirExclusion = async () => {
    setTrabajando(true);
    try {
      let x;
      if (esExt) {
        const c = { ...calcExt, certificadoPath: certPath!, certificadoNombre: certExt!.name, leidoConIA: filasCert.length > 0, detalle: elegidas.map((f) => ({ documento: f.documento, concepto: f.concepto, operacion: f.operacion, cantidad: num(f.cantidad), kgPorExtintor: num(f.kg), fecha: f.fecha, pagina: f.pagina })) };
        x = await huellaService.crearExclusion({ inventario_id: inv.id, fuente: FUENTE_EXTINTORES, porcentaje: Math.round(c.porcentaje * 1000) / 1000, justificacion: fx.justificacion.trim() || justificacionExtintores(c), calculo: c, certificado_path: certPath, certificado_nombre: certExt!.name });
      } else {
        x = await huellaService.crearExclusion({ inventario_id: inv.id, fuente: fx.fuente === FUENTE_OTRA ? fx.otra.trim() : fx.fuente, porcentaje: fx.porcentaje === '' ? null : Number(fx.porcentaje), justificacion: fx.justificacion.trim() });
      }
      setExclusiones((l) => [...l, x]); setFx({ fuente: '', otra: '', porcentaje: '', justificacion: '' }); setFilasCert([]); setCertExt(null); setCertPath(null); setObsCert(''); setModalEx(false);
    } catch (e) { falla(e); } finally { setTrabajando(false); }
  };
  const anadirNc = async () => {
    try {
      const x = await huellaService.crearNoConformidad({ inventario_id: inv.id, descripcion: nc.descripcion.trim(), medida: nc.medida.trim() || null, responsable: nc.responsable.trim() || null });
      setNcs((l) => [...l, x]); setNc({ descripcion: '', medida: '', responsable: '' }); setModalNc(false);
    } catch (e) { falla(e); }
  };

  const icono = (n: string) => n === 'error' ? <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" /> : n === 'aviso' ? <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" /> : n === 'ok' ? <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" /> : <Eye size={15} className="text-slate-500 shrink-0 mt-0.5" />;
  const cerrado = !abierto;
  const r = inv.cierre?.resumen;

  return (
    <div className="space-y-4">
      {cerrado && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
          <p className="font-bold flex items-center gap-2"><Lock size={15} /> Cálculo {inv.anio} {inv.estado}{inv.cerrado_en ? ` el ${new Date(inv.cerrado_en).toLocaleDateString('es-ES')}` : ''}</p>
          {r && <p className="text-xs mt-1">Resultados fijados: Alcance 1 {t(r.kgCO2eAlcance1)} · Alcance 2 {t(r.kgCO2eAlcance2)} · Total {t(r.kgCO2eTotal)} t CO₂e · {r.lineas} líneas · factores {r.factores}.</p>}
          {inv.estado === 'cerrado' && <button className={`${btnS} mt-3`} onClick={() => setReabrir(true)}><Unlock size={14} /> Reabrir con registro de la causa</button>}
        </div>
      )}
      {(inv.cierre?.reaperturas?.length ?? 0) > 0 && (
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Reaperturas</h3>
          <ul className="text-xs text-slate-700 space-y-1">{inv.cierre!.reaperturas!.map((x, i) => <li key={i}>{new Date(x.fecha).toLocaleString('es-ES')} · {x.usuario}: {x.motivo}</li>)}</ul>
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Lista de comprobación previa al cierre</h2>
        {!evaluacion ? <p className="text-sm text-slate-600"><Loader2 size={14} className="inline animate-spin mr-2" />Calculando…</p> : (
          <>
            <ul className="space-y-2">{evaluacion.items.map((i, k) => (
              <li key={k} className="flex items-start gap-2 text-xs text-slate-800">{icono(i.nivel)}
                <div className="flex-1 min-w-0">
                  <p>{i.mensaje}</p>
                  {i.detalle && i.detalle.length > 0 && (
                    <details className="mt-1" open={i.nivel === 'error' && i.detalle.length <= 8}>
                      <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-900">Ver las {i.detalle.length} afectadas</summary>
                      <ul className="mt-1 ml-1 border-l-2 border-slate-200 pl-3 space-y-0.5 max-h-48 overflow-auto">
                        {i.detalle.map((x, n) => {
                          const doc = x.docId ? docs.find((d) => d.id === x.docId) : undefined;
                          return (
                            <li key={n} className="text-[11px] text-slate-700 flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
                              <span className="flex-1 min-w-[200px]"><strong>{x.texto}</strong>{x.nota ? <span className="text-slate-500"> · {x.nota}</span> : null}</span>
                              {doc && <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50" onClick={async () => { try { window.open(await huellaService.urlDocumento(doc.archivo_path), '_blank', 'noopener'); } catch (e) { falla(e); } }}><Eye size={12} /> Abrir factura</button>}
                              {doc && abierto && doc.extraccion && doc.estado !== 'rechazado' && <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-brand-300 bg-white font-semibold text-brand-700 hover:bg-brand-50" onClick={() => setCorrigiendo(corrigiendo === doc.id ? null : doc.id)}><Pencil size={12} /> {corrigiendo === doc.id ? 'Cerrar' : 'Introducir dato'}</button>}
                              {doc && abierto && <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={trabajando} onClick={() => eliminarFactura(doc)}><Trash2 size={12} /> Eliminar</button>}
                              {doc && abierto && doc.extraccion && corrigiendo === doc.id && (
                                <div className="w-full"><Revision key={doc.id} doc={doc} factores={factores} inv={inv} otras={docs} corregir onHecho={() => { setCorrigiendo(null); onCambio(); }} falla={falla} /></div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                  {i.ir && abierto && <button className="mt-1 text-[11px] font-bold text-brand-700 underline hover:text-brand-900" onClick={() => onIr(i.ir!)}>{i.irEtiqueta ?? 'Resolver'} →</button>}
                </div>
              </li>
            ))}</ul>
            {abierto && docsSinOrigen.length > 0 && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                <p className="font-semibold mb-2">Garantía de origen de la electricidad: no consta en {docsSinOrigen.length} factura{docsSinOrigen.length === 1 ? '' : 's'}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="font-semibold">Aplicar a todas ellas
                    <select className={`${input} mt-1 w-auto min-w-[260px]`} value={origenSel} onChange={(e) => setOrigenSel(e.target.value as typeof origenSel)} aria-label="Garantía de origen para las facturas afectadas">
                      <option value="">Elegir…</option><option value="no">Red (sin garantía de origen)</option>
                      <option value="renovable_balear">GdO renovable de Baleares</option><option value="renovable_otra">GdO renovable (otra)</option>
                    </select>
                  </label>
                  <button className={btnS} onClick={aplicarOrigen} disabled={!origenSel || trabajando}>Aplicar a las {docsSinOrigen.length} facturas</button>
                </div>
                <p className="mt-2 text-blue-800">Sin elegir nada se tratan como energía de red. Si solo algunas tienen garantía, aplique «Red» a todas aquí y corrija después las que la acrediten desde su factura.</p>
              </div>
            )}
            {abierto && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className={btnS} onClick={redactar}><Mail size={14} /> Redactar correo al cliente con lo pendiente</button>
                <button className={btnP} onClick={cerrar} disabled={!evaluacion.puedeCerrar || trabajando}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Cerrar cálculo {inv.anio}</button>
                {!evaluacion.puedeCerrar && <span className="text-xs text-red-700">Resuelva los errores para poder cerrar.</span>}
              </div>
            )}
          </>
        )}
      </div>

      {previo && variaciones && (
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-2">Comparación con {previo.anio}</h2>
          <table className="w-full text-sm mb-3"><thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-1.5">Magnitud</th><th className="text-right">{previo.anio} (t CO₂e)</th><th className="text-right">{inv.anio} (t CO₂e)</th><th className="text-right">Variación</th></tr></thead>
            <tbody>{variaciones.map((v) => { const x = variacionAnual(v.actual, v.anterior); return (
              <tr key={v.nombre} className="border-b border-slate-100"><td className="py-1.5">{v.nombre}</td><td className="text-right tabular-nums">{t(v.anterior)}</td><td className="text-right tabular-nums">{t(v.actual)}</td>
                <td className={`text-right tabular-nums font-semibold ${x.analizar ? 'text-red-700' : 'text-slate-700'}`}>{x.variacion === null ? '—' : `${x.variacion > 0 ? '+' : ''}${(x.variacion * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`}</td></tr>); })}</tbody></table>
          <label className="text-xs font-semibold text-slate-700">Análisis de variaciones (obligatorio si alguna supera el 20 %)
            <textarea className={`${input} mt-1`} rows={3} value={analisis} disabled={!abierto} onChange={(e) => setAnalisis(e.target.value)} onBlur={guardarAnalisis} placeholder="Causa de las variaciones: apertura o cierre de instalaciones, cambios de ocupación, de combustible, del factor de emisión…" />
          </label>
        </div>
      )}

      <div className={card}>
        <div className="flex items-center gap-3 mb-1"><h2 className="flex-1 text-sm font-bold text-slate-800">Fuentes excluidas</h2>{abierto && <button className={btnS} onClick={() => setModalEx(true)}><Plus size={14} /> Añadir exclusión</button>}</div>
        <p className="text-xs text-slate-600 mb-3">Fuentes que no se cuantifican, con su justificación. Criterio de insignificancia: cada una por debajo del 3 % y el conjunto como máximo el 5 % de las emisiones (ISO 14064-1, 9.3.1 i).</p>
        {exclusiones.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-3">{exclusiones.map((x) => (
            <li key={x.id} className="py-2 flex items-start gap-3 text-xs"><div className="flex-1"><p className="font-semibold text-slate-800">{x.fuente} · {x.porcentaje != null ? `${x.porcentaje} %` : 'sin porcentaje'}</p><p className="text-slate-600">{x.justificacion}</p>{x.certificado_path && <button className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 underline" onClick={async () => { try { window.open(await huellaService.urlDocumento(x.certificado_path!), '_blank', 'noopener'); } catch (e) { falla(e); } }}><Eye size={11} /> Certificado: {x.certificado_nombre ?? 'ver'}</button>}</div>
              {abierto && <button className="p-1.5 text-slate-500 hover:text-red-600" aria-label="Eliminar exclusión" onClick={async () => { try { await huellaService.borrarExclusion(x.id); setExclusiones((l) => l.filter((y) => y.id !== x.id)); } catch (e) { falla(e); } }}><Trash2 size={14} /></button>}</li>
          ))}</ul>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-3 mb-1"><h2 className="flex-1 text-sm font-bold text-slate-800">Registro de no conformidades</h2>{abierto && <button className={btnS} onClick={() => setModalNc(true)}><Plus size={14} /> Añadir no conformidad</button>}</div>
        <p className="text-xs text-slate-600 mb-3">Incidencias detectadas en la revisión interna y la medida adoptada. El verificador las examina.</p>
        {ncs.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-3">{ncs.map((x) => (
            <li key={x.id} className="py-2 flex items-start gap-3 text-xs"><div className="flex-1"><p className="font-semibold text-slate-800">{x.fecha} · {x.descripcion}</p><p className="text-slate-600">{[x.medida && `Medida: ${x.medida}`, x.responsable && `Responsable: ${x.responsable}`, x.cerrada_en && `Cerrada el ${x.cerrada_en}`].filter(Boolean).join(' · ')}</p></div>
              {abierto && !x.cerrada_en && <button className={btnS} onClick={async () => { try { const u = await huellaService.cerrarNoConformidad(x.id); setNcs((l) => l.map((y) => (y.id === u.id ? u : y))); } catch (e) { falla(e); } }}>Cerrar</button>}</li>
          ))}</ul>
        )}
      </div>

      {modalEx && abierto && (
        <Modal titulo="Añadir una fuente excluida" onCerrar={() => setModalEx(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fuente *" ancho>
              <select className={input} value={fx.fuente} onChange={(e) => setFx({ ...fx, fuente: e.target.value })} autoFocus aria-label="Fuente excluida">
                <option value="">Elegir…</option>{FUENTES_EXCLUIBLES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Campo>
            {fx.fuente === FUENTE_OTRA && <Campo etiqueta="¿Cuál? *" ancho><input className={input} value={fx.otra} onChange={(e) => setFx({ ...fx, otra: e.target.value })} /></Campo>}
            {esExt ? (
              <div className="col-span-2 space-y-3">
                <Campo etiqueta="Certificado anual de mantenimiento (PDF) *" ancho>
                  <input type="file" accept="application/pdf" className="block w-full text-xs" onChange={(e) => elegirCert(e.target.files?.[0] ?? null)} aria-label="Certificado de mantenimiento de extintores" />
                </Campo>
                {leyendoCert && <p className="text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2"><Loader2 size={13} className="inline animate-spin mr-2" />Subiendo y leyendo el certificado con IA (puede tardar un minuto)…</p>}
                {certPath && !leyendoCert && filasCert.length === 0 && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">No se han detectado operaciones sobre extintores. Añádalas a mano.</p>}
                {obsCert && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2"><strong>Aviso de la lectura:</strong> {obsCert}</p>}
                {certPath && !leyendoCert && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">Operaciones leídas del certificado (propuesta de la IA: compruébelas con el documento)</p>
                    <p className="text-[11px] text-slate-600 mb-2">Marcadas: las recargas y retimbrados de CO₂ de la factura. Un retimbrado vacía y rellena el extintor, por lo que cuenta como emisión; un extintor nuevo o una simple revisión, no.</p>
                    <div className="overflow-auto max-h-64">
                      <table className="w-full text-[11px]"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-1">Incl.</th><th className="pr-2">Concepto</th><th className="pr-2">Operación</th><th className="pr-2">Nº</th><th className="pr-2">Kg/ud.</th><th></th></tr></thead>
                        <tbody>{filasCert.map((f, i) => (
                          <tr key={i} className={`border-t border-slate-100 ${f.incluir ? '' : 'text-slate-400'}`}>
                            <td className="py-1 pr-1"><input type="checkbox" checked={f.incluir} onChange={(e) => cambiarFila(i, { incluir: e.target.checked })} aria-label="Incluir en el cálculo" /></td>
                            <td className="pr-2">{f.concepto}<span className="block text-[10px] text-slate-400">{f.documento === 'factura' ? 'Factura' : f.documento === 'parte_revision' ? 'Parte de revisión' : 'Otro'}{f.pagina ? ` · pág. ${f.pagina}` : ''}{f.agente !== 'CO2' ? ` · ${f.agente}` : ''}</span></td>
                            <td className="pr-2"><select className={`${input} !py-1 !text-[11px]`} value={f.operacion} onChange={(e) => cambiarFila(i, { operacion: e.target.value as OperacionExt })}>{Object.entries(OPERACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                            <td className="pr-2 w-16"><input inputMode="decimal" className={`${input} !py-1 !text-[11px]`} value={f.cantidad} onChange={(e) => cambiarFila(i, { cantidad: e.target.value })} /></td>
                            <td className="pr-2 w-16"><input inputMode="decimal" className={`${input} !py-1 !text-[11px]`} value={f.kg} placeholder="kg" onChange={(e) => cambiarFila(i, { kg: e.target.value })} /></td>
                            <td><button className="p-1 text-slate-400 hover:text-red-600" aria-label="Quitar línea" onClick={() => setFilasCert((l) => l.filter((_, k) => k !== i))}><Trash2 size={12} /></button></td>
                          </tr>))}</tbody></table>
                    </div>
                    <button className={`${btnS} mt-2`} onClick={() => setFilasCert((l) => [...l, { incluir: true, documento: 'otro', concepto: 'Línea añadida a mano', operacion: 'recarga', agente: 'CO2', cantidad: '', kg: '' }])}><Plus size={14} /> Añadir línea</button>
                  </div>
                )}
                <div className="rounded-lg bg-blue-50 text-blue-900 text-xs px-3 py-2.5 space-y-0.5">
                  <p><strong>Total de extintores recargados:</strong> {calcExt.totalExtintores.toLocaleString('es-ES')}</p>
                  <p><strong>Emisión:</strong> {calcExt.kgCO2.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg CO₂ = {calcExt.tCO2e.toLocaleString('es-ES', { maximumFractionDigits: 3 })} t CO₂e (PCA 1; cada recarga repone el CO₂ liberado)</p>
                  <p><strong>Porcentaje excluido:</strong> {calcExt.porcentaje.toLocaleString('es-ES', { maximumFractionDigits: 3 })} % del total del inventario ({totalInvT.toLocaleString('es-ES', { maximumFractionDigits: 2 })} t CO₂e + esta exclusión). {calcExt.porcentaje < 3 ? 'Cumple el umbral de insignificancia (< 3 %).' : 'Supera el 3 %: no sería insignificante, conviene incluirla en el cálculo.'}</p>
                </div>
                <Campo etiqueta="Justificación (opcional: si la deja vacía se redacta sola con el cálculo)" ancho><input className={input} value={fx.justificacion} onChange={(e) => setFx({ ...fx, justificacion: e.target.value })} /></Campo>
              </div>
            ) : (
              <>
                <Campo etiqueta="% estimado de las emisiones"><input type="number" min={0} step="any" className={input} value={fx.porcentaje} onChange={(e) => setFx({ ...fx, porcentaje: e.target.value })} /></Campo>
                <Campo etiqueta="Justificación *" ancho><input className={input} value={fx.justificacion} onChange={(e) => setFx({ ...fx, justificacion: e.target.value })} /></Campo>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5"><button className={btnS} onClick={() => setModalEx(false)}>Cancelar</button>
            <button className={btnP} onClick={anadirExclusion} disabled={trabajando || !fx.fuente || (fx.fuente === FUENTE_OTRA && !fx.otra.trim()) || (esExt ? !certPath || leyendoCert || calcExt.totalExtintores === 0 : !fx.justificacion.trim())}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir</button></div>
        </Modal>
      )}
      {modalNc && abierto && (
        <Modal titulo="Añadir una no conformidad" onCerrar={() => setModalNc(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Descripción *" ancho><input className={input} value={nc.descripcion} onChange={(e) => setNc({ ...nc, descripcion: e.target.value })} autoFocus /></Campo>
            <Campo etiqueta="Medida adoptada" ancho><input className={input} value={nc.medida} onChange={(e) => setNc({ ...nc, medida: e.target.value })} /></Campo>
            <Campo etiqueta="Responsable"><input className={input} value={nc.responsable} onChange={(e) => setNc({ ...nc, responsable: e.target.value })} /></Campo>
          </div>
          <div className="flex justify-end gap-2 mt-5"><button className={btnS} onClick={() => setModalNc(false)}>Cancelar</button><button className={btnP} onClick={anadirNc} disabled={!nc.descripcion.trim()}><Plus size={14} /> Añadir</button></div>
        </Modal>
      )}

      {correo && (
        <Modal titulo="Correo al cliente: documentación pendiente" onCerrar={() => setCorreo(null)}>
          <p className="text-xs text-slate-600 mb-3">Borrador generado con lo que falta hoy en este cálculo. Revíselo y edítelo antes de enviarlo; no se envía desde aquí.</p>
          <label className="text-xs font-semibold text-slate-600">Asunto<input className={`${input} mt-1`} value={correo.asunto} onChange={(e) => setCorreo({ ...correo, asunto: e.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-600 block mt-3">Mensaje<textarea className={`${input} mt-1 font-mono text-xs`} rows={16} value={correo.cuerpo} onChange={(e) => setCorreo({ ...correo, cuerpo: e.target.value })} /></label>
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            <button className={btnS} onClick={() => setCorreo(null)}>Cerrar</button>
            <button className={btnS} onClick={async () => { try { await navigator.clipboard.writeText(`Asunto: ${correo.asunto}\n\n${correo.cuerpo}`); setCopiado(true); } catch (x) { falla(x); } }}><Copy size={14} /> {copiado ? 'Copiado' : 'Copiar'}</button>
            <a className={btnP} href={`mailto:?subject=${encodeURIComponent(correo.asunto)}&body=${encodeURIComponent(correo.cuerpo)}`}><Mail size={14} /> Abrir en el correo</a>
          </div>
        </Modal>
      )}
      {reabrir && (
        <Modal titulo={`Reabrir el cálculo ${inv.anio}`} onCerrar={() => setReabrir(false)}>
          <p className="text-xs text-slate-700 mb-3">Al reabrirlo podrá modificar datos. La causa queda registrada junto con la fecha y el usuario, y la base anota el cambio en la auditoría. Deberá volver a cerrarlo.</p>
          <textarea className={input} rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Causa de la reapertura (mínimo 10 caracteres)" autoFocus />
          <div className="flex justify-end gap-2 mt-4">
            <button className={btnS} onClick={() => setReabrir(false)}>Cancelar</button>
            <button className={btnP} onClick={reabrirInv} disabled={motivo.trim().length < 10 || trabajando}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />} Reabrir</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ───────────────────────────── Informe de inventario (ISO 14064-1) ─────────────────────────────
async function totalesAnterior(inv: Inventario, invs: Inventario[], centros: Centro[]) {
  const prev = invs.find((i) => i.anio === inv.anio - 1);
  if (!prev) return null;
  try {
    const [act, conj] = await Promise.all([huellaService.actividad(prev.id), prev.conjunto_factores ? Promise.resolve(prev.conjunto_factores) : cargarConjunto(prev.anio).then((c) => c.conjunto)]);
    const tt = calcularActividad(act, centros, conj).totales;
    return { anio: prev.anio, a1: tt.kgCO2eAlcance1, a2: tt.kgCO2eAlcance2, total: tt.kgCO2eTotal };
  } catch { return null; }
}

const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const imagenBytes = async (url: string) => { try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined; } catch { return undefined; } };

const PanelInforme: React.FC<{
  soloLectura?: boolean; org: Organizacion; inv: Inventario; invs: Inventario[]; centros: Centro[]; invCentros: InventarioCentro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null;
  usuario: string; falla: (e: unknown) => void; onInventario: (i: Inventario) => void;
}> = ({ soloLectura, org, inv, invs, centros, invCentros, docs, actividad, factores, usuario, falla, onInventario }) => {
  const [exclusiones, setExclusiones] = useState<Exclusion[]>([]);
  const [ncs, setNcs] = useState<NoConformidad[]>([]);
  const [anterior, setAnterior] = useState<DatosInforme['anterior'] | undefined>(undefined);
  const [trabajando, setTrabajando] = useState('');
  const [ver, setVer] = useState<Verificacion>({ nivel: 'Limitado' });
  const [modalVer, setModalVer] = useState(false);
  const [notaExp, setNotaExp] = useState<{ avisos: string[]; pendientes: string[] } | null>(null);
  const marco = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    Promise.all([huellaService.exclusiones(inv.id), huellaService.noConformidades(inv.id)]).then(([e, n]) => { setExclusiones(e); setNcs(n); }).catch(falla);
  }, [inv.id]); // eslint-disable-line
  useEffect(() => { setAnterior(undefined); totalesAnterior(inv, invs, centros).then(setAnterior); }, [inv.id, invs.length]); // eslint-disable-line

  const datos: DatosInforme | null = useMemo(() => {
    if (!factores || anterior === undefined) return null;
    const c = calcularActividad(actividad, centros, factores);
    const nombreDoc = (id?: string | null) => docs.find((d) => d.id === id)?.nombre_archivo ?? null;
    const nombreCentro = (id: string) => centros.find((x) => x.id === id)?.nombre ?? id;
    return {
      organizacion: { nombre: org.nombre, cif: org.cif, direccion: org.direccion, cnae: org.cnae, iae: org.iae, criterio: org.criterio_consolidacion ?? 'control', consultorEmail: org.consultor_email },
      centros: centros.map((x) => { const ic = invCentros.find((y) => y.centro_id === x.id); return { nombre: x.nombre, direccion: x.direccion, municipio: x.municipio, isla: x.isla, enBaleares: x.en_baleares, unidades: x.unidades_alojamiento, operativoDesde: ic?.operativo_desde, operativoHasta: ic?.operativo_hasta, indice: Number(ic?.indice_actividad ?? 0), plantilla: Number(ic?.plantilla_media ?? 0) }; }),
      inventario: { anio: inv.anio, estado: inv.estado, anioBase: inv.anio_base, cerradoEn: inv.cerrado_en, conjuntoFijado: !!inv.conjunto_factores, cierre: inv.cierre, verificacion: inv.verificacion },
      factores, resultados: c.resultados, totales: c.totales,
      actividad: actividad.filter((a) => a.estado === 'confirmada').map((a) => ({ centro: nombreCentro(a.centro_id), categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad), unidad: a.unidad, contador: a.contador, periodoDesde: a.periodo_desde, periodoHasta: a.periodo_hasta, documento: nombreDoc(a.documento_id), notas: a.notas, origenElectricidad: a.origen_electricidad })),
      anterior, exclusiones: exclusiones.map((x) => ({ fuente: x.fuente, porcentaje: x.porcentaje, justificacion: x.justificacion })),
      noConformidades: ncs.map((n) => ({ fecha: n.fecha, descripcion: n.descripcion, medida: n.medida, responsable: n.responsable, cerradaEn: n.cerrada_en })),
      documentos: docs.filter((d) => d.estado === 'revisado').map((d) => ({ nombre: d.nombre_archivo ?? d.archivo_path, tipo: (d.extraccion?.tipo ?? d.tipo) as string, centro: nombreCentro(d.centro_id ?? ''), periodoDesde: d.periodo_desde, periodoHasta: d.periodo_hasta, estado: d.estado })),
      mensualPorFuente: emisionesMensuales(actividad.filter((a) => a.estado === 'confirmada').flatMap((a) => {
        try { return [{ fuente: a.fuente, kgCO2e: calcularLinea({ id: a.id, centro: a.centro_id, categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad), origenElectricidad: a.origen_electricidad ?? undefined, reparto: a.reparto_proporcion < 1 ? { proporcion: Number(a.reparto_proporcion), justificacion: a.reparto_justificacion ?? '' } : undefined }, factores).kgCO2e, desde: a.periodo_desde, hasta: a.periodo_hasta }]; } catch { return []; }
      }), inv.anio),
      emitidoPor: usuario, fecha: new Date().toISOString().slice(0, 10),
    };
  }, [factores, anterior, actividad, centros, invCentros, docs, exclusiones, ncs, org, inv, usuario]);

  const modelo = useMemo(() => (datos ? construirInforme(datos) : null), [datos]);
  const html = useMemo(() => (modelo ? informeAHtml(modelo, { baseUrl: window.location.origin }) : ''), [modelo]);

  const word = async () => {
    if (!modelo) return; setTrabajando('word');
    try {
      const [{ informeADocx }, { svgAPng }, { cargarMarca }] = await Promise.all([import('../huella/informeDocx'), import('../huella/svgPng'), import('../huella/marca')]);
      const marca = await cargarMarca();
      descargar(await informeADocx(modelo, marca, svgAPng), `${modelo.meta.codigo}_V01.docx`);
    } catch (e) { falla(e); } finally { setTrabajando(''); }
  };
  const nombreArchivo = org.nombre.replace(/[^\w]+/g, '_');
  /** Calculadora oficial del Registro balear (la versión que corresponde a los factores del cálculo) con los datos del inventario. */
  const libroOficial = async () => {
    const { rellenarCalculadora, versionDeFactores } = await import('../huella/calculadoraOficial');
    const version = inv.conjunto_factores?.version ?? factores?.version;
    const ver = versionDeFactores(version);
    if (!ver) throw new Error(`No hay calculadora oficial incorporada para los factores «${version ?? 'sin fijar'}» (disponibles: 2023.2 y 2024.1).`);
    const r = await fetch(`/plantillas/calculadora-${ver}.xlsx`);
    if (!r.ok) throw new Error('No se pudo cargar la plantilla de la calculadora oficial.');
    const plantilla = new Uint8Array(await r.arrayBuffer());
    const nombreCentro = (id: string) => centros.find((x) => x.id === id)?.nombre ?? id;
    const proveedorDoc = (id?: string | null) => { const d = docs.find((x) => x.id === id); return d?.extraccion?.proveedor ?? d?.proveedor ?? undefined; };
    const estancias = invCentros.reduce((t, c) => t + Number(c.indice_actividad || 0), 0);
    const conjunto = inv.conjunto_factores ?? factores;
    const lista = await gasesOficiales(ver);
    const out = rellenarCalculadora(plantilla, {
      anio: inv.anio, verificacion: true,
      gases: conjunto ? { oficiales: lista, pca: conMezclas(conjunto).pcaRefrigerantes } : undefined,
      organizacion: { nombre: org.nombre, cif: org.cif, cnae: org.cnae || (centros.some((c) => c.suite_hotel_id) ? CNAE_HOTEL : null) },
      centros: centros.map((c) => ({ nombre: c.nombre, enBaleares: c.en_baleares, isla: c.isla, municipio: c.municipio, direccion: c.direccion, latitud: c.latitud != null ? Number(c.latitud) : null, longitud: c.longitud != null ? Number(c.longitud) : null })),
      plantillaTotal: invCentros.reduce((t, c) => t + Number(c.plantilla_media || 0), 0),
      indice: estancias > 0 ? { nombre: 'Estancias', valor: estancias, unidades: 'estancias' } : undefined,
      lineas: actividad.filter((a) => a.estado === 'confirmada').map((a) => ({
        centro: nombreCentro(a.centro_id), categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad) * Number(a.reparto_proporcion ?? 1),
        origenElectricidad: a.origen_electricidad ?? undefined, proveedor: proveedorDoc(a.documento_id),
      })),
    });
    const anioVer = Number(ver.slice(0, 4));
    if (inv.anio < 2020 || inv.anio > anioVer) out.avisos.push(`El año ${inv.anio} está fuera del rango de la calculadora ${ver} (2020-${anioVer}): el libro no podrá seleccionarlo.`);
    return { ...out, version: ver };
  };
  const calculadora = async () => {
    setTrabajando('calc'); setNotaExp(null);
    try {
      const r = await libroOficial();
      descargar(new Blob([r.bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Calculadora_Registro_HC_${inv.anio}_${nombreArchivo}.xlsx`);
      setNotaExp({ avisos: r.avisos, pendientes: r.pendientes });
    } catch (e) { falla(e); } finally { setTrabajando(''); }
  };
  /** Paquete para el verificador: libro de recálculo + calculadora oficial cumplimentada, en un ZIP. */
  const paquete = async () => {
    if (!datos) return; setTrabajando('xlsx'); setNotaExp(null);
    try {
      const [{ paqueteAXlsx }, { zipSync, strToU8 }, lib] = await Promise.all([import('../huella/paquete'), import('fflate'), libroOficial()]);
      const t = datos.totales;
      const leeme = [
        `PAQUETE DEL VERIFICADOR · HUELLA DE CARBONO ${inv.anio} · ${org.nombre}`, '',
        `1_Paquete_verificador_${inv.anio}.xlsx · datos de actividad con su evidencia, recálculo con fórmulas visibles y factores.`,
        `2_Calculadora_oficial_${inv.anio}.xlsx · calculadora oficial del Registro balear (versión ${lib.version}) cumplimentada con los mismos datos.`, '',
        'Al abrir la calculadora oficial en Excel se recalcula sola. Sus resultados (hoja 4.1) deben coincidir con los de la aplicación:',
        `  Alcance 1: ${(t.kgCO2eAlcance1 / 1000).toFixed(3)} t CO2e · Alcance 2: ${(t.kgCO2eAlcance2 / 1000).toFixed(3)} t CO2e · Total: ${(t.kgCO2eTotal / 1000).toFixed(3)} t CO2e`, '',
        ...(lib.avisos.length ? ['AVISOS', ...lib.avisos.map((x) => `  - ${x}`), ''] : []),
        ...(lib.pendientes.length ? ['PENDIENTE DE COMPLETAR EN LA CALCULADORA (la aplicación no tiene el dato)', ...lib.pendientes.map((x) => `  - ${x}`), ''] : []),
      ].join('\n');
      const zip = zipSync({
        [`1_Paquete_verificador_${inv.anio}.xlsx`]: new Uint8Array(await paqueteAXlsx(datos).arrayBuffer()),
        [`2_Calculadora_oficial_${inv.anio}.xlsx`]: lib.bytes, 'LEEME.txt': strToU8(leeme),
      }, { level: 1 });
      descargar(new Blob([zip as BlobPart], { type: 'application/zip' }), `Paquete_verificador_${inv.anio}_${nombreArchivo}.zip`);
      setNotaExp({ avisos: lib.avisos, pendientes: lib.pendientes });
    } catch (e) { falla(e); } finally { setTrabajando(''); }
  };
  const marcarVerificado = async () => {
    if (!confirm('Va a marcar el cálculo como verificado con los datos indicados. ¿Continuar?')) return;
    setTrabajando('ver');
    try { onInventario(await huellaService.marcarVerificado(inv.id, ver)); } catch (e) { falla(e); } finally { setTrabajando(''); }
  };

  if (!modelo || !datos) return <div className={`${card} text-sm text-slate-600`}><Loader2 size={14} className="inline animate-spin mr-2" />Preparando el informe…</div>;
  const cerrado = inv.estado === 'cerrado' || inv.estado === 'verificado';
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <p className="text-xs font-semibold text-slate-600">{modelo.meta.codigo}</p>
            <p className="text-sm font-bold text-slate-900">{modelo.meta.subtitulo}</p>
            <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${inv.estado === 'verificado' ? 'bg-green-100 text-green-800' : cerrado ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{modelo.meta.estado}</span>
          </div>
          {!soloLectura && inv.estado === 'cerrado' && <button className={btnS} onClick={() => setModalVer(true)}><CheckCircle2 size={15} /> Registrar verificación</button>}
          <button className={btnS} onClick={() => marco.current?.contentWindow?.print()}><Printer size={15} /> Imprimir / guardar PDF</button>
          <button className={btnP} onClick={word} disabled={!!trabajando}>{trabajando === 'word' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Word (.docx)</button>
          <button className={btnS} onClick={paquete} disabled={!!trabajando}>{trabajando === 'xlsx' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Paquete del verificador (ZIP)</button>
          <button className={btnS} onClick={calculadora} disabled={!!trabajando} title="Calculadora oficial del Registro balear con los datos de este cálculo">{trabajando === 'calc' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Calculadora oficial (Excel)</button>
        </div>
      </div>

      {notaExp && (notaExp.avisos.length > 0 || notaExp.pendientes.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={15} /> Calculadora oficial: revise antes de presentarla</p>
          {notaExp.avisos.length > 0 && <ul className="list-disc pl-5 text-xs space-y-0.5">{notaExp.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {notaExp.pendientes.length > 0 && <><p className="text-xs font-semibold mt-2">Datos que el libro pide y la aplicación no tiene:</p><ul className="list-disc pl-5 text-xs space-y-0.5">{notaExp.pendientes.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          <p className="text-[11px] mt-2 text-amber-800">Al abrir el libro en Excel se recalculan solos los resultados (hoja 4.1); compruebe que el total coincide con el de la aplicación.</p>
        </div>
      )}

      {!soloLectura && modelo.pendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={15} /> Antes de entregarlo al verificador</p>
          <ul className="list-disc pl-5 text-xs space-y-0.5">{modelo.pendientes.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}

      {modalVer && inv.estado === 'cerrado' && (
        <Modal titulo="Registrar la verificación" onCerrar={() => setModalVer(false)}>
          <p className="text-xs text-slate-600 mb-3">La entidad verificadora varía según el cliente: elija SGS o AENOR de la lista o escriba otra. Cuando emita su informe de verificación (ISO 14064-3), anote sus datos. El cálculo pasa a «verificado» y el informe los recoge en el apartado 11.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-700">Entidad verificadora<input className={`${input} mt-1`} list="entidades-verificadoras" placeholder="SGS, AENOR u otra" value={ver.entidad ?? ''} onChange={(e) => setVer({ ...ver, entidad: e.target.value })} />
              <datalist id="entidades-verificadoras"><option value="SGS" /><option value="AENOR" /></datalist></label>
            <label className="text-xs font-semibold text-slate-700">Nivel de aseguramiento<select className={`${input} mt-1`} value={ver.nivel} onChange={(e) => setVer({ ...ver, nivel: e.target.value })}><option>Limitado</option><option>Razonable</option></select></label>
            <label className="text-xs font-semibold text-slate-700">Fecha<input type="date" className={`${input} mt-1`} value={ver.fecha ?? ''} onChange={(e) => setVer({ ...ver, fecha: e.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-700">Referencia del informe<input className={`${input} mt-1`} value={ver.referencia ?? ''} onChange={(e) => setVer({ ...ver, referencia: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className={btnS} onClick={() => setModalVer(false)}>Cancelar</button>
            <button className={btnP} onClick={marcarVerificado} disabled={!ver.entidad?.trim() || !ver.fecha || trabajando === 'ver'}><CheckCircle2 size={15} /> Marcar como verificado</button>
          </div>
        </Modal>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-2">Vista previa</h2>
        <iframe ref={marco} title="Vista previa del informe" srcDoc={html} className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: 640 }} />
      </div>
    </div>
  );
};

// ───────────────────────────── Resultados ─────────────────────────────
const PanelResultados: React.FC<{ inv: Inventario; centros: Centro[]; invCentros: InventarioCentro[]; actividad: Actividad[]; docs: Documento[]; abierto: boolean; onCambio: () => void; falla: (e: unknown) => void; factores: ConjuntoFactores | null }> = ({ inv, centros, invCentros, actividad, docs, abierto, onCambio, falla, factores }) => {
  const calculo = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);

  if (!factores || !calculo) return <div className={`${card} text-sm text-slate-600`}><Loader2 className="inline animate-spin mr-2" size={14} />Cargando factores de emisión…</div>;
  const { totales, resultados, fallos } = calculo;
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const plantilla = invCentros.reduce((s, c) => s + Number(c.plantilla_media || 0), 0);
  const elec = resultados.filter((r) => r.electricidad);
  const ubic = elec.reduce((s, r) => s + (r.electricidad?.kgCO2eUbicacion ?? 0), 0);
  const merc = elec.reduce((s, r) => s + (r.electricidad?.kgCO2eMercado ?? 0), 0);
  const acum: Record<string, number> = {};
  for (const r of resultados) { const k = `${r.linea.centro} · ${r.linea.contador || 'sin contador'}`; acum[k] = (acum[k] ?? 0) + r.kgCO2e; }
  const porContador = (Object.keys(acum) as string[]).map((k) => [k, acum[k]] as [string, number]);

  // Datos de los gráficos (toneladas de CO₂e)
  const porFuenteKg: Record<string, number> = {};
  for (const r of resultados) { const k = r.linea.fuente ? r.linea.fuente.replace(/\s*\([^)]*\)\**/g, '').replace(/\*+$/, '').trim() : 'Electricidad'; porFuenteKg[k] = (porFuenteKg[k] ?? 0) + r.kgCO2e; }
  const datosFuente = (Object.keys(porFuenteKg) as string[]).map((k) => ({ nombre: k, t: porFuenteKg[k] / 1000 })).filter((d) => d.t > 0).sort((a, b) => b.t - a.t);
  const datosCentro = (Object.keys(totales.porCentro) as string[]).map((k) => ({ nombre: k, t: totales.porCentro[k] / 1000 })).sort((a, b) => b.t - a.t);
  const totalT = totales.kgCO2eTotal / 1000;
  const fmtT = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 });

  const kpi = (titulo: string, kg: number, sub?: string) => (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-semibold text-slate-600">{titulo}</p><p className="text-2xl font-extrabold text-header mt-1 tabular-nums">{t(kg)}</p><p className="text-[11px] text-slate-500">{sub ?? 't CO₂e'}</p></div>
  );
  return (
    <div className="space-y-4">
      {fallos.length > 0 && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs space-y-1" role="alert">{fallos.map((f, i) => <p key={i}><AlertTriangle size={12} className="inline mr-1" />{f} (excluido del cálculo hasta corregirlo)</p>)}</div>}
      <div className={`grid grid-cols-2 gap-3 ${plantilla > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {kpi('Alcance 1 · emisiones directas', totales.kgCO2eAlcance1)}
        {kpi('Alcance 2 · electricidad', totales.kgCO2eAlcance2, 't CO₂e (criterio registro balear)')}
        {kpi('Total', totales.kgCO2eTotal)}
        {kpi('Por estancia', indice > 0 ? ratio(totales.kgCO2eTotal, indice) * 1000 : 0, indice > 0 ? `kg CO₂e/estancia (${num(indice)} estancias)` : 'Indique estancias en Centros')}
        {plantilla > 0 && kpi('Por trabajador', ratio(totales.kgCO2eTotal, plantilla) * 1000, `kg CO₂e/trabajador (plantilla media ${num(plantilla, 2)})`)}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Reparto por fuente (t CO₂e)</h3>
          {datosFuente.length === 0 ? <p className="text-sm text-slate-600">Aún no hay emisiones que representar.</p> : (
            <div className="flex flex-wrap items-center gap-4">
              <div style={{ width: 210, height: 210 }} role="img" aria-label="Gráfico de reparto de las emisiones por fuente">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={datosFuente} dataKey="t" nameKey="nombre" innerRadius={55} outerRadius={95} paddingAngle={2} isAnimationActive={false}>
                      {datosFuente.map((d, i) => <Cell key={d.nombre} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmtT(v)} t CO₂e`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-[180px] space-y-1.5 text-sm">
                {datosFuente.map((d, i) => (
                  <li key={d.nombre} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
                    <span className="flex-1 text-slate-800">{d.nombre}</span>
                    <span className="tabular-nums text-slate-700">{fmtT(d.t)} t</span>
                    <span className="tabular-nums text-xs text-slate-500 w-12 text-right">{totalT > 0 ? `${((d.t / totalT) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <GraficoActividad inv={inv} factores={factores} centros={centros} actividad={actividad} filtradas={actividad} fuentesDisp={[]} contadoresDisp={[]}
          fCentro="" setFCentro={() => {}} fFuente="" setFFuente={() => {}} fContador="" setFContador={() => {}} metrica="co2e" setMetrica={() => {}} compacto />
      </div>

      {datosCentro.length > 1 && (
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Emisiones por centro (t CO₂e)</h3>
          <div style={{ width: '100%', height: Math.max(140, datosCentro.length * 38 + 40) }} role="img" aria-label="Gráfico de emisiones por centro">
            <ResponsiveContainer>
              <BarChart data={datosCentro} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtT(v)} />
                <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${fmtT(v)} t CO₂e`} />
                <Bar dataKey="t" fill="#00BF46" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Por gas (t CO₂e)</h3>
          <Tabla filas={desgloseGases(resultados, factores).filter((x) => !x.fluorado || x.toneladasCO2e > 0).map((x): [string, number] => [x.fluorado ? `${x.gas} (${x.familia})` : x.gas, x.toneladasCO2e * 1000])} />
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Electricidad: dos métodos (t CO₂e)</h3>
          <Tabla filas={[['Basado en la ubicación (mix de red)', ubic], ['Basado en el mercado (garantías de origen / autoconsumo)', merc]]} />
          <p className="text-[11px] text-slate-500 mt-1">Se informan por separado (ISO 14064-1, anexo E).</p>
        </div>
      </div>

      {porContador.length > 1 && (
        <details className={`${card} group`}>
          <summary className="cursor-pointer text-sm font-bold text-slate-800 flex items-center gap-2"><ChevronRight size={15} className="transition-transform group-open:rotate-90" /> Por contador / punto de suministro <span className="text-xs font-normal text-slate-500">({porContador.length}) · t CO₂e</span></summary>
          <div className="mt-3"><Tabla filas={porContador} unidad="t CO₂e" /></div>
        </details>
      )}

      <details className={`${card} group`}>
        <summary className="cursor-pointer text-sm font-bold text-slate-800 flex items-center gap-2"><ChevronRight size={15} className="transition-transform group-open:rotate-90" /> Trazabilidad por línea <span className="text-xs font-normal text-slate-500">({resultados.length})</span></summary>
        <p className="text-xs text-slate-600 mt-2">Cantidad × factor de emisión = CO₂e. Es la misma tabla que en «Consumos»: desde aquí también se puede ver la factura y editar o eliminar el dato.</p>
        <div className="mt-2"><TablaLineas lineas={resultados.map((r) => actividad.find((x) => x.id === r.linea.id)).filter((x): x is Actividad => !!x)} resultados={resultados} factores={factores} centros={centros} docs={docs} inv={inv} abierto={abierto} onCambio={onCambio} falla={falla} /></div>
      </details>
    </div>
  );
};

const Tabla: React.FC<{ filas: Array<[string, number]>; unidad?: string }> = ({ filas, unidad }) => (
  <table className="w-full text-sm"><tbody>{filas.map(([k, v]) => <tr key={k} className="border-b border-slate-100"><td className="py-1.5 text-slate-700">{k}</td><td className="py-1.5 text-right font-semibold tabular-nums">{t(v)}{unidad && <span className="ml-1 text-[11px] font-normal text-slate-500">{unidad}</span>}</td></tr>)}</tbody></table>
);

export default HuellaView;
