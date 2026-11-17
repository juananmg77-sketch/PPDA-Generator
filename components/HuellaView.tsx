import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, FileText, ListChecks, BarChart3, Upload, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2, Eye, Pencil, Lock, Unlock, LayoutDashboard, Settings, Leaf, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NOMBRES_MES, agruparPorTipoYContador, mesesTocados, repartirPorMes } from '../huella/mensual';
import { evaluarCierre, huecosMensuales } from '../huella/cierre';
import { huellaService, Actividad, Centro, CierreDatos, Documento, Exclusion, Inventario, InventarioCentro, NoConformidad, Organizacion } from '../services/huellaService';
import { cargarConjunto, diferencias, VERSIONES, ConjuntoElegido } from '../huella/catalogo';
import { calcularInventario, calcularLinea, ratio } from '../huella/motor';
import { asignarContador, proponerActividad, validarExtraccion, variacionAnual, ExtraccionFactura, TipoFactura } from '../huella/extraccion';
import type { Categoria, ConjuntoFactores, LineaActividad, OrigenElectricidad } from '../huella/tipos';

type Pestana = 'resumen' | 'centros' | 'facturas' | 'actividad' | 'resultados' | 'cierre' | 'ajustes';
export type RolHuella = 'consultor' | 'cliente';

const t = (kg: number) => (kg / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number, d = 0) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
const TIPOS: Record<TipoFactura, string> = {
  electricidad: 'Electricidad', gas_natural: 'Gas natural', gasoleo: 'Gasóleo', glp: 'GLP (propano/butano)',
  combustible_vehiculo: 'Combustible de vehículos', refrigerante: 'Recarga de refrigerante', otro: 'Otro',
};
const CATEGORIAS: Record<Categoria, string> = {
  combustion_fija: 'Combustión fija', combustion_movil: 'Combustión móvil', fugitiva: 'Emisiones fugitivas', electricidad: 'Electricidad',
};
const ORIGEN: Record<OrigenElectricidad, string> = {
  red: 'Red (sin garantía)', autoconsumo: 'Autoconsumo', gdo_renovable_balear: 'GdO renovable de Baleares', gdo_otra: 'GdO renovable (otra)',
};
const card = 'no-glass bg-white rounded-2xl border border-slate-200 p-5 shadow-sm';
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
  if (e.tipo === 'refrigerante') return e.producto && f?.pcaRefrigerantes[e.producto] !== undefined ? e.producto : '';
  if (e.tipo === 'electricidad' || !e.producto) return '';
  const p = e.producto.trim().toLowerCase();
  const cat: Categoria = e.tipo === 'combustible_vehiculo' ? 'combustion_movil' : 'combustion_fija';
  return opcionesFuente(f, cat).find((k) => k.toLowerCase().startsWith(p)) ?? '';
}

export const HuellaView: React.FC<{ onBack: () => void; currentUser: string; rol?: RolHuella }> = ({ onBack, currentUser, rol = 'consultor' }) => {
  const esConsultor = rol === 'consultor';
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState('');
  const [invs, setInvs] = useState<Inventario[]>([]);
  const [invId, setInvId] = useState('');
  const [tab, setTab] = useState<Pestana>('resumen');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [invCentros, setInvCentros] = useState<InventarioCentro[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [elegido, setElegido] = useState<ConjuntoElegido | null>(null);
  const factores = elegido?.conjunto ?? null;
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalOrg, setModalOrg] = useState<'nueva' | 'editar' | null>(null);
  const [centroEditar, setCentroEditar] = useState<Centro | null>(null);

  const org = orgs.find((o) => o.id === orgId);
  const inv = invs.find((i) => i.id === invId);
  const abierto = inv?.estado === 'borrador';
  const falla = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  useEffect(() => { huellaService.organizaciones().then((o) => { setOrgs(o); if (o[0]) setOrgId(o[0].id); }).catch(falla); }, []);
  useEffect(() => {
    setInvs([]); setInvId(''); setCentros([]);
    if (!orgId) return;
    huellaService.inventarios(orgId).then((i) => { setInvs(i); if (i[0]) setInvId(i[0].id); }).catch(falla);
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

  const guardarOrg = async (v: Partial<Organizacion> & { nombre: string }) => {
    try {
      if (modalOrg === 'editar' && org) { const o = await huellaService.actualizarOrganizacion(org.id, v); setOrgs((l) => l.map((x) => (x.id === o.id ? o : x))); }
      else { const o = await huellaService.crearOrganizacion(v); setOrgs((l) => [...l, o]); setOrgId(o.id); }
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

  const pendientes = docs.filter((d) => d.estado === 'leido').length;
  const nav: Array<{ k: Pestana; nombre: string; icono: React.ReactNode; solo?: 'consultor'; badge?: number }> = [
    { k: 'resumen', nombre: 'Resumen', icono: <LayoutDashboard size={17} /> },
    { k: 'centros', nombre: 'Centros', icono: <Building2 size={17} />, solo: 'consultor' },
    { k: 'facturas', nombre: esConsultor ? 'Facturas' : 'Mis facturas', icono: <FileText size={17} />, badge: esConsultor ? pendientes : 0 },
    { k: 'actividad', nombre: 'Consumos', icono: <ListChecks size={17} /> },
    { k: 'resultados', nombre: 'Resultados', icono: <BarChart3 size={17} /> },
    { k: 'cierre', nombre: 'Cierre', icono: <Lock size={17} />, solo: 'consultor' },
    { k: 'ajustes', nombre: 'Ajustes', icono: <Settings size={17} />, solo: 'consultor' },
  ];
  const visibles = nav.filter((n) => !n.solo || esConsultor);
  const titulos: Record<Pestana, [string, string]> = {
    resumen: [esConsultor ? 'Resumen del inventario' : 'Su huella de carbono', esConsultor ? 'Dónde estás y qué falta para cerrar.' : 'Suba sus facturas y consulte sus resultados.'],
    centros: ['Centros de trabajo', 'Datos de cada centro, su periodo operativo y estancias.'],
    facturas: [esConsultor ? 'Facturas' : 'Mis facturas', 'Suba un bloque completo; se leen solas y usted las revisa.'],
    actividad: ['Consumos', 'Evolución mensual y datos de actividad confirmados.'],
    resultados: ['Resultados', 'Huella del inventario según el Registro balear.'],
    cierre: ['Cierre del inventario', 'Comprobaciones, variaciones y cierre con registro.'],
    ajustes: ['Ajustes técnicos', 'Factores de emisión y datos de la organización.'],
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-900" style={{ background: '#F3F5F9' }}>
      <aside className="md:w-60 flex-shrink-0 text-white flex flex-col" style={{ background: '#00093D' }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10" title="Volver al inicio" aria-label="Volver al inicio"><ArrowLeft size={17} /></button>
          <div className="leading-tight">
            <p className="text-sm font-bold flex items-center gap-1.5"><Leaf size={15} style={{ color: '#77D464' }} /> HS GREEN</p>
            <p className="text-[10px] text-white/60">Huella de carbono</p>
          </div>
        </div>

        <div className="mx-3 mb-3 rounded-xl p-2.5 space-y-2" style={{ background: 'rgba(255,255,255,0.10)' }}>
          {esConsultor || orgs.length > 1 ? (
            <div className="flex gap-1.5">
              <select className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 bg-white" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Organización">
                {orgs.length === 0 && <option value="">Sin organizaciones</option>}
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
              {esConsultor && <button className="px-2 rounded-lg bg-white/15 hover:bg-white/25" onClick={() => setModalOrg('nueva')} title="Nueva organización" aria-label="Nueva organización"><Plus size={14} /></button>}
            </div>
          ) : <p className="text-sm font-bold px-1">{org?.nombre ?? '—'}</p>}
          <div className="flex gap-1.5">
            <select className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 bg-white" value={invId} onChange={(e) => setInvId(e.target.value)} disabled={!orgId} aria-label="Inventario">
              {invs.length === 0 && <option value="">Sin inventarios</option>}
              {invs.map((i) => <option key={i.id} value={i.id}>Año {i.anio} · {i.estado}</option>)}
            </select>
            {esConsultor && <button className="px-2 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40" onClick={nuevoInv} disabled={!orgId} title="Nuevo inventario" aria-label="Nuevo inventario"><Plus size={14} /></button>}
          </div>
        </div>

        <nav className="flex md:flex-col gap-0.5 px-2 pb-3 overflow-x-auto md:overflow-visible" role="tablist" aria-label="Secciones">
          {visibles.map((n) => (
            <button key={n.k} role="tab" aria-selected={tab === n.k} onClick={() => setTab(n.k)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === n.k ? 'text-white font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
              style={tab === n.k ? { background: '#0002C9' } : undefined}>
              {n.icono} <span>{n.nombre}</span>
              {!!n.badge && <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: '#F9416D' }}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="hidden md:block mt-auto px-4 py-3 text-[11px] text-white/55 border-t border-white/10">{currentUser}</div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-5xl space-y-4">
          <div>
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
              {tab !== 'centros' && !inv && <div className={`${card} text-sm text-slate-600`}>{esConsultor ? 'Cree un inventario (año) con el botón + del menú para continuar.' : 'Todavía no hay un inventario abierto. Su consultor lo creará.'}</div>}
              {tab === 'resumen' && inv && (
                <PanelResumen rol={rol} inv={inv} centros={centros} invCentros={invCentros} docs={docs} actividad={actividad} factores={factores} ir={setTab} />
              )}
              {tab === 'facturas' && inv && (
                <PanelFacturas rol={rol} org={org} inv={inv} abierto={!!abierto} centros={centros} docs={docs} actividad={actividad} factores={factores} onCambio={recargarInv} falla={falla} cargando={cargando} setCargando={setCargando} currentUser={currentUser} />
              )}
              {tab === 'actividad' && inv && (
                <PanelActividad inv={inv} abierto={!!abierto && esConsultor} centros={centros} actividad={actividad} factores={factores} onCambio={recargarInv} falla={falla} />
              )}
              {tab === 'resultados' && inv && <PanelResultados inv={inv} centros={centros} invCentros={invCentros} actividad={actividad} factores={factores} />}
              {tab === 'cierre' && inv && esConsultor && (
                <PanelCierre inv={inv} invs={invs} centros={centros} invCentros={invCentros} docs={docs} actividad={actividad} factores={factores} usuario={currentUser} falla={falla}
                  onInventario={(i) => setInvs((l) => l.map((x) => (x.id === i.id ? { ...x, ...i } : x)))} />
              )}
              {tab === 'ajustes' && esConsultor && (
                <div className="space-y-4">
                  {inv && elegido && <PanelFactores inv={inv} elegido={elegido} abierto={!!abierto} onElegir={elegirVersion} />}
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
          {modalOrg && <FormOrganizacion org={modalOrg === 'editar' ? org : undefined} usuario={currentUser} onGuardar={guardarOrg} onCerrar={() => setModalOrg(null)} />}
          {centroEditar && <FormCentro centro={centroEditar} onGuardar={guardarCentro} onCerrar={() => setCentroEditar(null)} />}
          {!org && orgs.length === 0 && <div className={`${card} text-sm text-slate-600`}>{esConsultor ? 'Todavía no hay organizaciones. Cree la primera con el botón + del menú.' : 'Todavía no tiene acceso a ninguna organización.'}</div>}
        </div>
      </main>
    </div>
  );
};

// ───────────────────────────── Resumen (pantalla de inicio) ─────────────────────────────
const PanelResumen: React.FC<{
  rol: RolHuella; inv: Inventario; centros: Centro[]; invCentros: InventarioCentro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null; ir: (t: Pestana) => void;
}> = ({ rol, inv, centros, invCentros, docs, actividad, factores, ir }) => {
  const esConsultor = rol === 'consultor';
  const calculo = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const porRevisar = docs.filter((d) => d.estado === 'leido').length;
  const sinLeer = docs.filter((d) => d.estado === 'subido').length;
  const huecos = huecosMensuales(docs.map((d) => ({ estado: d.estado, tipo: (d.extraccion?.tipo ?? d.tipo) as string, contador: d.extraccion?.contador, periodoDesde: d.periodo_desde ?? d.extraccion?.periodoDesde, periodoHasta: d.periodo_hasta ?? d.extraccion?.periodoHasta })), inv.anio);
  const sinIndice = centros.filter((c) => !(Number(invCentros.find((x) => x.centro_id === c.id)?.indice_actividad) > 0));
  const confirmadas = actividad.filter((a) => a.estado === 'confirmada').length;
  const cerrado = inv.estado !== 'borrador';

  type Paso = { nombre: string; estado: 'ok' | 'ahora' | 'espera' };
  const pasos: Paso[] = esConsultor ? [
    { nombre: 'Centros', estado: centros.length > 0 ? 'ok' : 'ahora' },
    { nombre: 'Facturas', estado: docs.length > 0 && sinLeer === 0 ? 'ok' : centros.length > 0 ? 'ahora' : 'espera' },
    { nombre: 'Revisión', estado: confirmadas > 0 && porRevisar === 0 ? 'ok' : docs.length > 0 ? 'ahora' : 'espera' },
    { nombre: 'Resultados', estado: confirmadas > 0 ? 'ok' : 'espera' },
    { nombre: 'Cierre', estado: cerrado ? 'ok' : confirmadas > 0 && porRevisar === 0 ? 'ahora' : 'espera' },
  ] : [
    { nombre: 'Subir facturas', estado: docs.length > 0 ? 'ok' : 'ahora' },
    { nombre: 'Revisión por su consultor', estado: confirmadas > 0 && porRevisar === 0 ? 'ok' : docs.length > 0 ? 'ahora' : 'espera' },
    { nombre: 'Resultados', estado: confirmadas > 0 ? 'ok' : 'espera' },
  ];

  const pendientes: Array<{ icono: React.ReactNode; texto: string; boton: string; destino: Pestana; nivel: 'aviso' | 'ok' }> = [];
  if (esConsultor && centros.length === 0) pendientes.push({ icono: <Building2 size={18} />, texto: 'Añada el primer centro de trabajo.', boton: 'Añadir', destino: 'centros', nivel: 'aviso' });
  if (docs.length === 0 && (centros.length > 0 || !esConsultor)) pendientes.push({ icono: <Upload size={18} />, texto: 'Todavía no hay facturas: suba las del año.', boton: 'Subir', destino: 'facturas', nivel: 'aviso' });
  if (sinLeer > 0) pendientes.push({ icono: <Loader2 size={18} />, texto: `${sinLeer} factura(s) subidas sin leer.`, boton: 'Ver', destino: 'facturas', nivel: 'aviso' });
  if (porRevisar > 0) pendientes.push({ icono: <AlertTriangle size={18} />, texto: esConsultor ? `${porRevisar} factura(s) esperan su revisión.` : `${porRevisar} factura(s) en revisión por su consultor.`, boton: esConsultor ? 'Revisar' : 'Ver', destino: 'facturas', nivel: 'aviso' });
  for (const h of huecos.slice(0, 3)) pendientes.push({ icono: <FileText size={18} />, texto: `${h.tipo === 'electricidad' ? 'Electricidad' : 'Gas natural'}${h.contador !== 'sin contador' ? ` (${h.contador})` : ''}: faltan facturas de ${h.faltan.join(', ')}.`, boton: 'Subir', destino: 'facturas', nivel: 'aviso' });
  if (esConsultor && sinIndice.length > 0 && confirmadas > 0) pendientes.push({ icono: <Building2 size={18} />, texto: `Indique las estancias de: ${sinIndice.map((c) => c.nombre).join(', ')}.`, boton: 'Indicar', destino: 'centros', nivel: 'aviso' });
  if (esConsultor && !inv.conjunto_factores && confirmadas > 0) pendientes.push({ icono: <Settings size={18} />, texto: 'Confirme la versión de factores de emisión del inventario.', boton: 'Revisar', destino: 'ajustes', nivel: 'aviso' });
  if (esConsultor && !cerrado && confirmadas > 0 && porRevisar === 0 && pendientes.length === 0) pendientes.push({ icono: <Lock size={18} />, texto: 'Todo está al día: puede pasar a las comprobaciones de cierre.', boton: 'Cierre', destino: 'cierre', nivel: 'ok' });
  if (cerrado) pendientes.push({ icono: <Lock size={18} />, texto: `Inventario ${inv.estado}. Sus datos están bloqueados.`, boton: 'Ver', destino: esConsultor ? 'cierre' : 'resultados', nivel: 'ok' });

  const kpi = (titulo: string, valor: string, sub: string) => (
    <div className={card}><p className="text-xs font-semibold text-slate-600">{titulo}</p><p className="text-3xl font-extrabold text-header mt-1 tabular-nums">{valor}</p><p className="text-[11px] text-slate-500">{sub}</p></div>
  );
  return (
    <div className="space-y-4">
      <div className={`${card} flex gap-2`} aria-label="Progreso">
        {pasos.map((p, i) => (
          <div key={p.nombre} className="flex-1 text-center">
            <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-bold border ${p.estado === 'ok' ? 'text-white border-transparent' : p.estado === 'ahora' ? 'text-white border-transparent' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
              style={p.estado === 'ok' ? { background: '#00BF46' } : p.estado === 'ahora' ? { background: '#0002C9' } : undefined}>
              {p.estado === 'ok' ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            <p className={`text-[11px] mt-1 ${p.estado === 'ahora' ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{p.nombre}</p>
          </div>
        ))}
      </div>

      {calculo && confirmadas > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpi('Total', t(calculo.totales.kgCO2eTotal), 't CO₂e')}
          {kpi('Emisiones directas', t(calculo.totales.kgCO2eAlcance1), 't CO₂e · Alcance 1')}
          {kpi('Electricidad', t(calculo.totales.kgCO2eAlcance2), 't CO₂e · Alcance 2')}
          {kpi('Por estancia', indice > 0 ? (ratio(calculo.totales.kgCO2eTotal, indice) * 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '—', indice > 0 ? 'kg CO₂e por estancia' : 'Falta indicar las estancias')}
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

const FormOrganizacion: React.FC<{ org?: Organizacion; usuario: string; onGuardar: (v: Partial<Organizacion> & { nombre: string }) => Promise<void>; onCerrar: () => void }> = ({ org, usuario, onGuardar, onCerrar }) => {
  const [v, setV] = useState({ nombre: org?.nombre ?? '', cif: org?.cif ?? '', direccion: org?.direccion ?? '', cnae: org?.cnae ?? '', iae: org?.iae ?? '', criterio: org?.criterio_consolidacion ?? 'control', consultor: org?.consultor_email ?? usuario });
  const [guardando, setGuardando] = useState(false);
  const f = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const guardar = async () => { setGuardando(true); try { await onGuardar({ nombre: v.nombre.trim(), cif: v.cif.trim() || null, direccion: v.direccion.trim() || null, cnae: v.cnae.trim() || null, iae: v.iae.trim() || null, criterio_consolidacion: v.criterio as 'control' | 'participacion', consultor_email: v.consultor.trim() || null }); onCerrar(); } finally { setGuardando(false); } };
  return (
    <Modal titulo={org ? 'Editar organización' : 'Nueva organización'} onCerrar={onCerrar}>
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

const FormCentro: React.FC<{ centro: Centro; onGuardar: (v: Partial<Centro>) => Promise<void>; onCerrar: () => void }> = ({ centro, onGuardar, onCerrar }) => {
  const [v, setV] = useState({ nombre: centro.nombre, direccion: centro.direccion ?? '', municipio: centro.municipio ?? '', isla: centro.isla ?? 'Mallorca', balear: centro.en_baleares, unidades: centro.unidades_alojamiento != null ? String(centro.unidades_alojamiento) : '' });
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try { await onGuardar({ nombre: v.nombre.trim(), direccion: v.direccion.trim() || null, municipio: v.municipio.trim() || null, isla: v.balear ? v.isla : null, en_baleares: v.balear, unidades_alojamiento: v.unidades === '' ? null : Math.max(0, Math.round(Number(v.unidades))) }); onCerrar(); } finally { setGuardando(false); }
  };
  return (
    <Modal titulo="Editar centro de trabajo" onCerrar={onCerrar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre *" ancho><input className={input} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} autoFocus /></Campo>
        <Campo etiqueta="Dirección" ancho><input className={input} value={v.direccion} onChange={(e) => setV({ ...v, direccion: e.target.value })} /></Campo>
        <Campo etiqueta="Municipio"><input className={input} value={v.municipio} onChange={(e) => setV({ ...v, municipio: e.target.value })} /></Campo>
        <Campo etiqueta="Isla"><select className={input} value={v.isla} disabled={!v.balear} onChange={(e) => setV({ ...v, isla: e.target.value })}>{['Mallorca', 'Menorca', 'Ibiza', 'Formentera'].map((i) => <option key={i}>{i}</option>)}</select></Campo>
        <Campo etiqueta="Unidades de alojamiento"><input type="number" min={0} className={input} value={v.unidades} onChange={(e) => setV({ ...v, unidades: e.target.value })} /></Campo>
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
const PanelFactores: React.FC<{ inv: Inventario; elegido: ConjuntoElegido; abierto: boolean; onElegir: (v: string) => void }> = ({ inv, elegido, abierto, onElegir }) => {
  const fijada = !!inv.conjunto_factores;
  const actual = elegido.conjunto.version.replace('calculadora-', '');
  const comparaciones = (Object.keys(elegido.alternativas) as string[]).map((id) => ({ id, dif: diferencias(elegido.conjunto, elegido.alternativas[id]) }));
  const etiqueta = (id: string) => VERSIONES.find((v) => v.id === id)?.etiqueta ?? id;
  return (
    <div className={`${card} space-y-2`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600 min-w-[260px]">Factores de emisión del inventario {inv.anio}
          <select className={`${input} mt-1`} value={actual} disabled={!abierto || elegido.disponibles.length < 2 && fijada} onChange={(e) => onElegir(e.target.value)} aria-label="Versión de factores">
            {elegido.disponibles.map((id) => <option key={id} value={id}>{etiqueta(id)}</option>)}
          </select>
        </label>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${fijada ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{fijada ? 'Fijada en el inventario' : 'Propuesta por defecto: confírmela para fijarla'}</span>
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
    try { const c = await huellaService.crearCentro({ organizacion_id: orgId, nombre: nombre.trim(), municipio, isla: balear ? isla : undefined, en_baleares: balear }); setCentros([...centros, c]); setNombre(''); setMunicipio(''); } catch (e) { falla(e); }
  };
  const guardar = async (c: Centro, cambios: Partial<InventarioCentro>) => {
    if (!inv) return;
    const base = invCentros.find((x) => x.centro_id === c.id) ?? { inventario_id: inv.id, centro_id: c.id, indice_actividad: 0 };
    try { await huellaService.guardarInventarioCentro({ ...base, ...cambios }); onGuardado(); } catch (e) { falla(e); }
  };
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Centros de trabajo</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <label className="md:col-span-2 text-xs font-semibold text-slate-600">Nombre<input className={`${input} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Hotel / sede" /></label>
          <label className="text-xs font-semibold text-slate-600">Municipio<input className={`${input} mt-1`} value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600">Isla
            <select className={`${input} mt-1`} value={isla} onChange={(e) => setIsla(e.target.value)} disabled={!balear}>{['Mallorca', 'Menorca', 'Ibiza', 'Formentera'].map((i) => <option key={i}>{i}</option>)}</select>
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={balear} onChange={(e) => setBalear(e.target.checked)} /> En Baleares</label>
            <button className={btnP} onClick={crear} disabled={!nombre.trim()}><Plus size={14} /> Añadir</button>
          </div>
        </div>
      </div>

      {centros.length > 0 && (
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-2">Centros registrados ({centros.length})</h2>
          <ul className="divide-y divide-slate-100">
            {centros.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <Building2 size={16} className="text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
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
        <p className="text-xs text-slate-600 mt-1 mb-3">Si un centro estuvo cerrado o abrió a mitad de año, indique su periodo. El índice (estancias) puede ser 0: los ratios solo se calculan cuando es mayor que 0.</p>
        {!inv ? <p className="text-sm text-slate-600">Cree un inventario para indicar estos datos.</p> : centros.length === 0 ? <p className="text-sm text-slate-600">Añada al menos un centro.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Operativo desde</th><th className="pr-3">Hasta</th><th>Estancias</th></tr></thead>
              <tbody>
                {centros.map((c) => {
                  const x = invCentros.find((y) => y.centro_id === c.id);
                  return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold text-slate-800">{c.nombre}<span className="block text-[11px] font-normal text-slate-500">{[c.municipio, c.en_baleares ? c.isla : 'Fuera de Baleares'].filter(Boolean).join(' · ')}</span></td>
                      <td className="pr-3"><input type="date" className={input} disabled={!abierto} defaultValue={x?.operativo_desde ?? ''} onBlur={(e) => guardar(c, { operativo_desde: e.target.value || null })} aria-label={`Desde ${c.nombre}`} /></td>
                      <td className="pr-3"><input type="date" className={input} disabled={!abierto} defaultValue={x?.operativo_hasta ?? ''} onBlur={(e) => guardar(c, { operativo_hasta: e.target.value || null })} aria-label={`Hasta ${c.nombre}`} /></td>
                      <td><input type="number" min={0} className={input} disabled={!abierto} defaultValue={x?.indice_actividad ?? 0} onBlur={(e) => guardar(c, { indice_actividad: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Estancias ${c.nombre}`} /></td>
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
  ['glp', 'GLP (propano/butano)'], ['combustible_vehiculo', 'Combustible de vehículos'], ['refrigerante', 'Recarga de refrigerante'],
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
const CabeceraGrupo: React.FC<{ g: { tipo: string; contador: string; items: Documento[] }; anio: number }> = ({ g, anio }) => {
  const validas = g.items.filter((d) => d.estado !== 'rechazado');
  const cubiertos = new Set<number>(validas.flatMap((d) => mesesTocados(d.periodo_desde ?? d.extraccion?.periodoDesde, d.periodo_hasta ?? d.extraccion?.periodoHasta, anio)));
  const unidad = validas.find((d) => d.extraccion?.unidad)?.extraccion?.unidad ?? '';
  const total = validas.reduce((s, d) => s + (d.extraccion?.cantidad ?? 0), 0);
  const conCups = g.tipo !== 'refrigerante' && g.contador !== 'sin contador';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-xs font-bold text-slate-800">{TIPOS[g.tipo as TipoFactura] ?? g.tipo}{conCups ? ` · ${g.contador}` : g.tipo !== 'refrigerante' ? ' · sin contador identificado' : ''}</span>
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
  const e: ExtraccionFactura = asignacion.contador ? { ...e0, contador: asignacion.contador } : e0;
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
    periodo_desde: e.periodoDesde ?? null, periodo_hasta: e.periodoHasta ?? null, reparto_proporcion: 1, estado: 'confirmada',
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
  const gruposTodas = useMemo(() => agruparPorTipoYContador(docs, tipoDoc, contadorDoc), [docs]);
  const listas = pendientes.filter((d) => evaluadas.get(d.id)?.listo);
  const seleccionadasListas = listas.filter((d) => sel.has(d.id));
  const hechas = tareas.filter((t) => t.estado === 'listo' || t.estado === 'error').length;

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
            {!abierto && <p className="text-xs text-amber-700 mt-2">El inventario no está en borrador: no admite facturas nuevas.</p>}
            {tareas.length > 0 && (
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-2 pr-2 w-6" /><th className="pr-3">Archivo</th><th className="pr-3">Tipo</th><th className="pr-3">Proveedor</th><th className="pr-3">Periodo</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3">Estado</th><th /></tr></thead>
              <tbody>
                {gruposPend.map((g) => (
                  <React.Fragment key={`${g.tipo}|${g.contador}`}>
                    <tr className="bg-slate-100"><td colSpan={8} className="px-2 py-1.5"><CabeceraGrupo g={g} anio={inv.anio} /></td></tr>
                {g.items.map((d) => {
                  const ev = evaluadas.get(d.id); const e = d.extraccion!;
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2"><input type="checkbox" disabled={!ev?.listo} checked={sel.has(d.id)} onChange={() => alternar(d.id)} aria-label={`Seleccionar ${d.nombre_archivo}`} /></td>
                        <td className="pr-3 text-slate-800">{d.nombre_archivo}<span className="block text-[10px] text-slate-500">{nombreCentro(d.centro_id)}</span></td>
                        <td className="pr-3">{TIPOS[e.tipo] ?? e.tipo}</td><td className="pr-3">{e.proveedor ?? '—'}<span className="block text-[10px] text-slate-500" title={ev?.asignacion.motivo}>{ev?.e.contador ? `Contador: ${ev.e.contador}${ev.asignacion.contador ? ' (asignado)' : ''}` : ev && ev.asignacion.candidatos.length > 1 ? `¿Contador? ${ev.asignacion.candidatos.join(' o ')}` : 'Sin contador'}</span></td>
                        <td className="pr-3 whitespace-nowrap">{e.periodoDesde ?? '?'} → {e.periodoHasta ?? '?'}</td>
                        <td className="pr-3 text-right tabular-nums">{e.cantidad !== undefined ? num(e.cantidad, 2) : '—'} {e.unidad ?? ''}</td>
                        <td className="pr-3">{ev?.errores ? <span className="text-red-700 font-semibold">{ev.errores} error(es)</span> : ev?.sinFuente ? <span className="text-amber-700 font-semibold">Elegir combustible</span> : ev?.avisos ? <span className="text-amber-700 font-semibold">{ev.avisos} aviso(s)</span> : <span className="text-green-700 font-semibold">Sin incidencias</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <button className="p-1.5 text-slate-500 hover:text-brand-700" aria-label="Ver factura" onClick={async () => { try { window.open(await huellaService.urlDocumento(d.archivo_path), '_blank', 'noopener'); } catch (x) { falla(x); } }}><Eye size={14} /></button>
                          <button className={btnS} onClick={() => setRevisando(revisando === d.id ? null : d.id)}>{revisando === d.id ? 'Cerrar' : 'Revisar'}</button>
                        </td>
                      </tr>
                      {revisando === d.id && (
                        <tr><td colSpan={8}><Revision doc={d} factores={factores} inv={inv} otras={docs} onHecho={() => { setRevisando(null); onCambio(); }} falla={falla} /></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Todas las facturas del inventario {inv.anio} ({docs.length})</h2>
        {docs.length === 0 ? <p className="text-sm text-slate-600">Aún no hay facturas.</p> : (
          <div className="space-y-3">
            {gruposTodas.map((g) => (
              <details key={`${g.tipo}|${g.contador}`} open className="border border-slate-200 rounded-xl">
                <summary className="cursor-pointer px-3 py-2 bg-slate-50 rounded-xl"><span className="inline-block align-middle"><CabeceraGrupo g={g} anio={inv.anio} /></span></summary>
                <ul className="divide-y divide-slate-100 px-3">
                  {[...g.items].sort((a, b) => String(a.periodo_desde ?? '').localeCompare(String(b.periodo_desde ?? ''))).map((d) => (
                    <li key={d.id} className="py-2 flex flex-wrap items-center gap-3">
                      <FileText size={15} className="text-slate-500" />
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-sm font-semibold text-slate-800">{d.nombre_archivo}</p>
                        <p className="text-[11px] text-slate-500">{nombreCentro(d.centro_id)}{d.periodo_desde ? ` · ${d.periodo_desde} → ${d.periodo_hasta ?? ''}` : ''}{d.extraccion?.cantidad !== undefined ? ` · ${num(d.extraccion.cantidad, 0)} ${d.extraccion.unidad ?? ''}` : ''}</p>
                      </div>
                      <Estado e={d.estado} />
                      <button className={btnS} onClick={async () => { try { window.open(await huellaService.urlDocumento(d.archivo_path), '_blank', 'noopener'); } catch (x) { falla(x); } }}><Eye size={14} /> Ver</button>
                    </li>
                  ))}
                </ul>
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
  doc: Documento; factores: ConjuntoFactores | null; inv: Inventario; otras: Documento[]; onHecho: () => void; falla: (e: unknown) => void;
}> = ({ doc, factores, inv, otras, onHecho, falla }) => {
  const existentes = useMemo(() => otras.filter((x) => x.id !== doc.id && (x.estado === 'revisado' || x.estado === 'leido') && x.extraccion).map((x) => ({ id: x.id.slice(0, 8), centro: x.centro_id ?? undefined, proveedor: x.extraccion?.proveedor, contador: x.extraccion?.contador, periodoDesde: x.extraccion?.periodoDesde, periodoHasta: x.extraccion?.periodoHasta, cantidad: x.extraccion?.cantidad, tipo: x.extraccion!.tipo })), [otras, doc.id]);
  const asignacion = useMemo(() => asignarContador(doc.extraccion!, { centro: doc.centro_id ?? undefined, existentes }), [doc.id, existentes]); // eslint-disable-line
  const [e, setE] = useState<ExtraccionFactura>(() => (asignacion.contador ? { ...doc.extraccion!, contador: asignacion.contador } : doc.extraccion!));
  const conocidos = useMemo(() => Array.from(new Set(existentes.map((x) => x.contador).filter(Boolean))) as string[], [existentes]);
  const [fuente, setFuente] = useState(() => fuentePorDefecto(doc.extraccion!, factores));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (!fuente) setFuente(fuentePorDefecto(e, factores)); }, [factores]); // eslint-disable-line
  const incidencias = useMemo(() => (factores ? validarExtraccion(e, { anioInventario: inv.anio, centro: doc.centro_id ?? undefined, factores, existentes }) : []), [e, factores, inv.anio, existentes]);
  const errores = incidencias.filter((i) => i.gravedad === 'error');
  const cat: Categoria = e.tipo === 'electricidad' ? 'electricidad' : e.tipo === 'refrigerante' ? 'fugitiva' : e.tipo === 'combustible_vehiculo' ? 'combustion_movil' : 'combustion_fija';
  const opciones = opcionesFuente(factores, cat);
  const sinFuente = cat !== 'electricidad' && !fuente;
  const set = <K extends keyof ExtraccionFactura>(k: K, v: ExtraccionFactura[K]) => setE((p) => ({ ...p, [k]: v }));

  const confirmar = async () => {
    setGuardando(true);
    try { await confirmarDocumento(doc, e, cat === 'electricidad' ? '' : fuente, inv); onHecho(); } catch (x) { falla(x); setGuardando(false); }
  };
  const rechazar = async () => { setGuardando(true); try { await huellaService.actualizarDocumento(doc.id, { estado: 'rechazado' }); onHecho(); } catch (x) { falla(x); setGuardando(false); } };

  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-600 mb-3">Compruebe cada dato contra la factura (botón «Ver»). Lectura propuesta con confianza {Math.round((e.confianza ?? 0) * 100)} %.</p>
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
        <button className={btnP} onClick={confirmar} disabled={guardando || !factores || errores.length > 0 || sinFuente || e.tipo === 'otro'}><CheckCircle2 size={15} /> Confirmar como actividad</button>
        <button className={btnS} onClick={rechazar} disabled={guardando}><XCircle size={15} /> Rechazar factura</button>
        {(errores.length > 0 || sinFuente) && <span className="text-xs text-slate-600 self-center">{errores.length > 0 ? 'Resuelva los errores para confirmar.' : 'Elija el combustible o gas.'}</span>}
      </div>
    </div>
  );
};

// ───────────────────────────── Actividad (alta manual y listado) ─────────────────────────────
const PanelActividad: React.FC<{ inv: Inventario; abierto: boolean; centros: Centro[]; actividad: Actividad[]; factores: ConjuntoFactores | null; onCambio: () => void; falla: (e: unknown) => void }> = ({ inv, abierto, centros, actividad, factores, onCambio, falla }) => {
  const [centro, setCentro] = useState(''); const [cat, setCat] = useState<Categoria>('combustion_fija'); const [fuente, setFuente] = useState('');
  const [cantidad, setCantidad] = useState(''); const [origen, setOrigen] = useState<OrigenElectricidad>('red'); const [nota, setNota] = useState(''); const [contador, setContador] = useState('');
  const [fCentro, setFCentro] = useState(''); const [fFuente, setFFuente] = useState(''); const [fContador, setFContador] = useState(''); const [metrica, setMetrica] = useState<'co2e' | 'consumo'>('co2e');
  useEffect(() => { if (!centro && centros[0]) setCentro(centros[0].id); }, [centros, centro]);
  const opciones = opcionesFuente(factores, cat);
  const valido = centro && Number(cantidad) >= 0 && cantidad !== '' && (cat === 'electricidad' || fuente) && nota.trim().length > 3;
  const anadir = async () => {
    try {
      await huellaService.crearActividad({ inventario_id: inv.id, centro_id: centro, categoria: cat, fuente: cat === 'electricidad' ? '' : fuente, cantidad: Number(cantidad), origen_electricidad: cat === 'electricidad' ? origen : null, reparto_proporcion: 1, estado: 'confirmada', notas: nota.trim(), contador: contador.trim() || null });
      setCantidad(''); setNota(''); onCambio();
    } catch (e) { falla(e); }
  };
  const nombreCentro = (id: string) => centros.find((c) => c.id === id)?.nombre ?? '—';
  const etiquetaFuente = (a: Actividad) => a.fuente || 'Electricidad';
  const fuentesDisp = (Array.from(new Set(actividad.map(etiquetaFuente))) as string[]).sort();
  const contadoresDisp = (Array.from(new Set(actividad.map((a) => a.contador || ''))) as string[]).filter(Boolean).sort();
  const filtradas = actividad.filter((a) => (!fCentro || a.centro_id === fCentro) && (!fFuente || etiquetaFuente(a) === fFuente) && (!fContador || (a.contador || '') === fContador));
  return (
    <div className="space-y-4">
      <GraficoActividad inv={inv} factores={factores} centros={centros} actividad={actividad} filtradas={filtradas} fuentesDisp={fuentesDisp} contadoresDisp={contadoresDisp}
        fCentro={fCentro} setFCentro={setFCentro} fFuente={fFuente} setFFuente={setFFuente} fContador={fContador} setFContador={setFContador} metrica={metrica} setMetrica={setMetrica} />
      {abierto && (<div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">Añadir dato a mano</h2>
        <p className="text-xs text-slate-600 mb-3">Para datos sin factura legible (p. ej. un contador). Es obligatorio indicar el origen del dato: queda como evidencia para el verificador.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-slate-600">Centro<select className={`${input} mt-1`} value={centro} onChange={(e) => setCentro(e.target.value)}>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Categoría<select className={`${input} mt-1`} value={cat} onChange={(e) => { setCat(e.target.value as Categoria); setFuente(''); }}>{Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {cat === 'electricidad'
            ? <label className="text-xs font-semibold text-slate-600">Origen<select className={`${input} mt-1`} value={origen} onChange={(e) => setOrigen(e.target.value as OrigenElectricidad)}>{Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            : <label className="text-xs font-semibold text-slate-600">{cat === 'fugitiva' ? 'Gas' : 'Combustible'}<select className={`${input} mt-1`} value={fuente} onChange={(e) => setFuente(e.target.value)}><option value="">Elegir…</option>{opciones.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>}
          <label className="text-xs font-semibold text-slate-600">Cantidad ({cat === 'electricidad' ? 'kWh' : cat === 'fugitiva' ? 'kg' : (factores?.unidades[fuente] ?? 'unidad del factor')})<input type="number" min={0} step="any" className={`${input} mt-1`} value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600">Contador / CUPS (opcional)<input className={`${input} mt-1`} value={contador} onChange={(e) => setContador(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600 col-span-2 md:col-span-3">Origen del dato (obligatorio)<input className={`${input} mt-1`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: lectura de contador del 31/12, albarán 123…" /></label>
          <div className="flex items-end"><button className={btnP} onClick={anadir} disabled={!abierto || !valido}><Plus size={14} /> Añadir</button></div>
        </div>
      </div>)}
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Datos de actividad confirmados ({filtradas.length}{filtradas.length !== actividad.length ? ` de ${actividad.length}` : ''})</h2>
        {actividad.length === 0 ? <p className="text-sm text-slate-600">Aún no hay datos. Suba facturas o añada un dato a mano.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Categoría</th><th className="pr-3">Fuente</th><th className="pr-3">Contador</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3">Origen</th><th /></tr></thead>
              <tbody>
                {filtradas.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{nombreCentro(a.centro_id)}</td><td className="pr-3">{CATEGORIAS[a.categoria]}</td>
                    <td className="pr-3">{a.fuente || (a.origen_electricidad ? ORIGEN[a.origen_electricidad] : '—')}</td>
                    <td className="pr-3 text-xs text-slate-600">{a.contador || '—'}</td>
                    <td className="pr-3 text-right tabular-nums">{num(a.cantidad, 2)}</td>
                    <td className="pr-3 text-xs text-slate-600">{a.documento_id ? 'Factura' : `Manual: ${a.notas ?? ''}`}{a.periodo_desde ? ` · ${a.periodo_desde}` : ''}</td>
                    <td className="text-right">{abierto && <button className="p-1.5 text-slate-500 hover:text-red-600" aria-label="Eliminar" onClick={async () => { if (confirm('¿Eliminar este dato de actividad?')) { try { await huellaService.borrarActividad(a.id); onCambio(); } catch (e) { falla(e); } } }}><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
              {series.map((sr, i) => <Bar key={sr} dataKey={sr} stackId="a" fill={COLORES[i % COLORES.length]} />)}
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

// ───────────────────────────── Cierre del inventario ─────────────────────────────
const PanelCierre: React.FC<{
  inv: Inventario; invs: Inventario[]; centros: Centro[]; invCentros: InventarioCentro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null;
  usuario: string; falla: (e: unknown) => void; onInventario: (i: Inventario) => void;
}> = ({ inv, invs, centros, invCentros, docs, actividad, factores, usuario, falla, onInventario }) => {
  const abierto = inv.estado === 'borrador';
  const [exclusiones, setExclusiones] = useState<Exclusion[]>([]);
  const [ncs, setNcs] = useState<NoConformidad[]>([]);
  const [previo, setPrevio] = useState<{ a1: number; a2: number; total: number; anio: number } | null | undefined>(undefined);
  const [analisis, setAnalisis] = useState(inv.cierre?.analisisVariacion ?? '');
  const [fx, setFx] = useState({ fuente: '', porcentaje: '', justificacion: '' });
  const [nc, setNc] = useState({ descripcion: '', medida: '', responsable: '' });
  const [reabrir, setReabrir] = useState(false);
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
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const variaciones = previo && calculo ? [
    { nombre: 'Alcance 1', actual: calculo.totales.kgCO2eAlcance1, anterior: previo.a1 },
    { nombre: 'Alcance 2', actual: calculo.totales.kgCO2eAlcance2, anterior: previo.a2 },
    { nombre: 'Total', actual: calculo.totales.kgCO2eTotal, anterior: previo.total },
  ] : undefined;

  const evaluacion = useMemo(() => {
    if (!factores || !calculo || previo === undefined) return null;
    return evaluarCierre({
      anio: inv.anio,
      docs: docs.map((d) => ({ estado: d.estado, tipo: (d.extraccion?.tipo ?? d.tipo) as string, contador: d.extraccion?.contador, periodoDesde: d.periodo_desde ?? d.extraccion?.periodoDesde, periodoHasta: d.periodo_hasta ?? d.extraccion?.periodoHasta })),
      actividadConfirmada: actividad.filter((a) => a.estado === 'confirmada').length,
      actividadManual: actividad.filter((a) => !a.documento_id).length,
      fallosCalculo: calculo.fallos.length,
      centrosSinIndice: centros.filter((c) => !(invCentros.find((x) => x.centro_id === c.id)?.indice_actividad > 0)).map((c) => c.nombre),
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
    if (!confirm(`Va a cerrar el inventario ${inv.anio}. Se fijarán los factores (${factores.id}) y los resultados, y no podrá modificarse ningún dato sin reabrirlo con su causa. ¿Continuar?`)) return;
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
    try {
      const x = await huellaService.crearExclusion({ inventario_id: inv.id, fuente: fx.fuente.trim(), porcentaje: fx.porcentaje === '' ? null : Number(fx.porcentaje), justificacion: fx.justificacion.trim() });
      setExclusiones((l) => [...l, x]); setFx({ fuente: '', porcentaje: '', justificacion: '' });
    } catch (e) { falla(e); }
  };
  const anadirNc = async () => {
    try {
      const x = await huellaService.crearNoConformidad({ inventario_id: inv.id, descripcion: nc.descripcion.trim(), medida: nc.medida.trim() || null, responsable: nc.responsable.trim() || null });
      setNcs((l) => [...l, x]); setNc({ descripcion: '', medida: '', responsable: '' });
    } catch (e) { falla(e); }
  };

  const icono = (n: string) => n === 'error' ? <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" /> : n === 'aviso' ? <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" /> : n === 'ok' ? <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" /> : <Eye size={15} className="text-slate-500 shrink-0 mt-0.5" />;
  const cerrado = !abierto;
  const r = inv.cierre?.resumen;

  return (
    <div className="space-y-4">
      {cerrado && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
          <p className="font-bold flex items-center gap-2"><Lock size={15} /> Inventario {inv.anio} {inv.estado}{inv.cerrado_en ? ` el ${new Date(inv.cerrado_en).toLocaleDateString('es-ES')}` : ''}</p>
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
            <ul className="space-y-1.5">{evaluacion.items.map((i, k) => <li key={k} className="flex items-start gap-2 text-xs text-slate-800">{icono(i.nivel)}<span>{i.mensaje}</span></li>)}</ul>
            {abierto && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className={btnP} onClick={cerrar} disabled={!evaluacion.puedeCerrar || trabajando}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Cerrar inventario {inv.anio}</button>
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
        <h2 className="text-sm font-bold text-slate-800 mb-1">Fuentes excluidas</h2>
        <p className="text-xs text-slate-600 mb-3">Fuentes que no se cuantifican, con su justificación. Criterio de insignificancia: cada una por debajo del 3 % y el conjunto como máximo el 5 % de las emisiones (ISO 14064-1, 9.3.1 i).</p>
        {exclusiones.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-3">{exclusiones.map((x) => (
            <li key={x.id} className="py-2 flex items-start gap-3 text-xs"><div className="flex-1"><p className="font-semibold text-slate-800">{x.fuente} · {x.porcentaje != null ? `${x.porcentaje} %` : 'sin porcentaje'}</p><p className="text-slate-600">{x.justificacion}</p></div>
              {abierto && <button className="p-1.5 text-slate-500 hover:text-red-600" aria-label="Eliminar exclusión" onClick={async () => { try { await huellaService.borrarExclusion(x.id); setExclusiones((l) => l.filter((y) => y.id !== x.id)); } catch (e) { falla(e); } }}><Trash2 size={14} /></button>}</li>
          ))}</ul>
        )}
        {abierto && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <label className="text-xs font-semibold text-slate-700 md:col-span-2">Fuente<input className={`${input} mt-1`} value={fx.fuente} onChange={(e) => setFx({ ...fx, fuente: e.target.value })} placeholder="Ej.: extintores de CO₂" /></label>
            <label className="text-xs font-semibold text-slate-700">% estimado<input type="number" min={0} step="any" className={`${input} mt-1`} value={fx.porcentaje} onChange={(e) => setFx({ ...fx, porcentaje: e.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-700 md:col-span-2">Justificación<input className={`${input} mt-1`} value={fx.justificacion} onChange={(e) => setFx({ ...fx, justificacion: e.target.value })} /></label>
            <button className={btnP} onClick={anadirExclusion} disabled={!fx.fuente.trim() || !fx.justificacion.trim()}><Plus size={14} /> Añadir</button>
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-1">Registro de no conformidades</h2>
        <p className="text-xs text-slate-600 mb-3">Incidencias detectadas en la revisión interna y la medida adoptada. El verificador las examina.</p>
        {ncs.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-3">{ncs.map((x) => (
            <li key={x.id} className="py-2 flex items-start gap-3 text-xs"><div className="flex-1"><p className="font-semibold text-slate-800">{x.fecha} · {x.descripcion}</p><p className="text-slate-600">{[x.medida && `Medida: ${x.medida}`, x.responsable && `Responsable: ${x.responsable}`, x.cerrada_en && `Cerrada el ${x.cerrada_en}`].filter(Boolean).join(' · ')}</p></div>
              {abierto && !x.cerrada_en && <button className={btnS} onClick={async () => { try { const u = await huellaService.cerrarNoConformidad(x.id); setNcs((l) => l.map((y) => (y.id === u.id ? u : y))); } catch (e) { falla(e); } }}>Cerrar</button>}</li>
          ))}</ul>
        )}
        {abierto && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <label className="text-xs font-semibold text-slate-700 md:col-span-2">Descripción<input className={`${input} mt-1`} value={nc.descripcion} onChange={(e) => setNc({ ...nc, descripcion: e.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-700 md:col-span-2">Medida adoptada<input className={`${input} mt-1`} value={nc.medida} onChange={(e) => setNc({ ...nc, medida: e.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-700">Responsable<input className={`${input} mt-1`} value={nc.responsable} onChange={(e) => setNc({ ...nc, responsable: e.target.value })} /></label>
            <button className={btnP} onClick={anadirNc} disabled={!nc.descripcion.trim()}><Plus size={14} /> Añadir</button>
          </div>
        )}
      </div>

      {reabrir && (
        <Modal titulo={`Reabrir el inventario ${inv.anio}`} onCerrar={() => setReabrir(false)}>
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

// ───────────────────────────── Resultados ─────────────────────────────
const PanelResultados: React.FC<{ inv: Inventario; centros: Centro[]; invCentros: InventarioCentro[]; actividad: Actividad[]; factores: ConjuntoFactores | null }> = ({ inv, centros, invCentros, actividad, factores }) => {
  const calculo = useMemo(() => (factores ? calcularActividad(actividad, centros, factores) : null), [factores, actividad, centros]);

  if (!factores || !calculo) return <div className={`${card} text-sm text-slate-600`}><Loader2 className="inline animate-spin mr-2" size={14} />Cargando factores de emisión…</div>;
  const { totales, resultados, fallos } = calculo;
  const indice = invCentros.reduce((s, c) => s + Number(c.indice_actividad || 0), 0);
  const elec = resultados.filter((r) => r.electricidad);
  const ubic = elec.reduce((s, r) => s + (r.electricidad?.kgCO2eUbicacion ?? 0), 0);
  const merc = elec.reduce((s, r) => s + (r.electricidad?.kgCO2eMercado ?? 0), 0);
  const gas = totales.kgCO2PorGas;
  const acum: Record<string, number> = {};
  for (const r of resultados) { const k = `${r.linea.centro} · ${r.linea.contador || 'sin contador'}`; acum[k] = (acum[k] ?? 0) + r.kgCO2e; }
  const porContador = (Object.keys(acum) as string[]).map((k) => [k, acum[k]] as [string, number]);
  const kpi = (titulo: string, kg: number, sub?: string) => (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-semibold text-slate-600">{titulo}</p><p className="text-2xl font-extrabold text-header mt-1 tabular-nums">{t(kg)}</p><p className="text-[11px] text-slate-500">{sub ?? 't CO₂e'}</p></div>
  );
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs">
        Resultado provisional del inventario {inv.anio} ({inv.estado}). Factores: <strong>{factores.id}</strong> · GWP CH₄ {factores.gwp.ch4}, N₂O {factores.gwp.n2o} · mix eléctrico balear {factores.mixElectrico} kg CO₂e/kWh. Solo cuentan los datos confirmados.
      </div>
      {fallos.length > 0 && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs space-y-1" role="alert">{fallos.map((f, i) => <p key={i}><AlertTriangle size={12} className="inline mr-1" />{f} (excluido del cálculo hasta corregirlo)</p>)}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpi('Alcance 1 · emisiones directas', totales.kgCO2eAlcance1)}
        {kpi('Alcance 2 · electricidad', totales.kgCO2eAlcance2, 't CO₂e (criterio registro balear)')}
        {kpi('Total', totales.kgCO2eTotal)}
        {kpi('Por estancia', indice > 0 ? ratio(totales.kgCO2eTotal, indice) * 1000 : 0, indice > 0 ? `kg CO₂e/estancia (${num(indice)} estancias)` : 'Indique estancias en Centros')}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Por gas (t CO₂e)</h3>
          <Tabla filas={[['CO₂', gas.co2], ['CH₄', gas.ch4_co2e], ['N₂O', gas.n2o_co2e], ['Fluorados (refrigerantes)', gas.fluorados_co2e]]} />
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Por categoría y centro (t CO₂e)</h3>
          <Tabla filas={[...Object.entries(totales.porCategoria).map(([k, v]) => [CATEGORIAS[k as Categoria] ?? k, v] as [string, number]), ...Object.entries(totales.porCentro).map(([k, v]) => [`Centro: ${k}`, v] as [string, number])]} />
        </div>
      </div>
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Electricidad: dos métodos, informados por separado (ISO 14064-1, anexo E)</h3>
        <Tabla filas={[['Basado en la ubicación (mix de red)', ubic], ['Basado en el mercado (garantías de origen / autoconsumo)', merc]]} />
      </div>
      {porContador.length > 1 && (
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Por contador / punto de suministro (t CO₂e)</h3>
          <Tabla filas={porContador} />
        </div>
      )}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-800 mb-2">Trazabilidad por línea</h3>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Fuente</th><th className="pr-3">Contador</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3 text-right">kg CO₂e</th><th>Cálculo</th></tr></thead>
          <tbody>{resultados.map((r) => (
            <tr key={r.linea.id} className="border-b border-slate-100 align-top"><td className="py-1.5 pr-3">{r.linea.centro}</td><td className="pr-3">{r.linea.fuente || 'Electricidad'}</td><td className="pr-3">{r.linea.contador || '—'}</td>
              <td className="pr-3 text-right tabular-nums">{num(r.linea.cantidad, 2)}</td><td className="pr-3 text-right tabular-nums">{num(r.kgCO2e, 1)}</td><td className="text-slate-600">{r.trazabilidad.factorUsado}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
};

const Tabla: React.FC<{ filas: Array<[string, number]> }> = ({ filas }) => (
  <table className="w-full text-sm"><tbody>{filas.map(([k, v]) => <tr key={k} className="border-b border-slate-100"><td className="py-1.5 text-slate-700">{k}</td><td className="py-1.5 text-right font-semibold tabular-nums">{t(v)}</td></tr>)}</tbody></table>
);

export default HuellaView;
