import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, FileText, ListChecks, BarChart3, Upload, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react';
import { huellaService, Actividad, Centro, Documento, Inventario, InventarioCentro, Organizacion } from '../services/huellaService';
import { cargarConjunto, diferencias, VERSIONES, ConjuntoElegido } from '../huella/catalogo';
import { calcularInventario, ratio } from '../huella/motor';
import { proponerActividad, validarExtraccion, ExtraccionFactura, TipoFactura } from '../huella/extraccion';
import type { Categoria, ConjuntoFactores, LineaActividad, OrigenElectricidad } from '../huella/tipos';

type Pestana = 'centros' | 'facturas' | 'actividad' | 'resultados';

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

export const HuellaView: React.FC<{ onBack: () => void; currentUser: string }> = ({ onBack, currentUser }) => {
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState('');
  const [invs, setInvs] = useState<Inventario[]>([]);
  const [invId, setInvId] = useState('');
  const [tab, setTab] = useState<Pestana>('centros');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [invCentros, setInvCentros] = useState<InventarioCentro[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [elegido, setElegido] = useState<ConjuntoElegido | null>(null);
  const factores = elegido?.conjunto ?? null;
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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

  const nuevaOrg = async () => {
    const nombre = prompt('Nombre de la organización (empresa o grupo hotelero):')?.trim();
    if (!nombre) return;
    try { const o = await huellaService.crearOrganizacion({ nombre, consultor_email: currentUser }); setOrgs([...orgs, o]); setOrgId(o.id); } catch (e) { falla(e); }
  };
  const nuevoInv = async () => {
    const a = Number(prompt('Año del inventario (p. ej. 2024):'));
    if (!orgId || !Number.isInteger(a) || a < 2007 || a > 2100) return;
    try { const i = await huellaService.crearInventario(orgId, a); setInvs([i, ...invs]); setInvId(i.id); } catch (e) { falla(e); }
  };

  const pestanas: Array<[Pestana, string, React.ReactNode]> = [
    ['centros', 'Centros', <Building2 size={15} key="c" />], ['facturas', 'Facturas', <FileText size={15} key="f" />],
    ['actividad', 'Actividad', <ListChecks size={15} key="a" />], ['resultados', 'Resultados', <BarChart3 size={15} key="r" />],
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-header shadow-lg">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg" title="Volver"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Huella de carbono</h1>
            <p className="text-[11px] text-header-muted mt-1">Inventario Categorías 1 y 2 · Registro balear (Decreto 48/2021) · ISO 14064-1</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-600" aria-label="Cerrar"><XCircle size={16} /></button>
          </div>
        )}

        <div className={`${card} flex flex-wrap items-end gap-4`}>
          <label className="flex-1 min-w-[220px] text-xs font-semibold text-slate-600">Organización
            <div className="flex gap-2 mt-1">
              <select className={input} value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Organización">
                {orgs.length === 0 && <option value="">Sin organizaciones</option>}
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
              <button className={btnS} onClick={nuevaOrg}><Plus size={14} /> Nueva</button>
            </div>
          </label>
          <label className="w-56 text-xs font-semibold text-slate-600">Inventario (año)
            <div className="flex gap-2 mt-1">
              <select className={input} value={invId} onChange={(e) => setInvId(e.target.value)} disabled={!orgId} aria-label="Inventario">
                {invs.length === 0 && <option value="">Sin inventarios</option>}
                {invs.map((i) => <option key={i.id} value={i.id}>{i.anio} · {i.estado}</option>)}
              </select>
              <button className={btnS} onClick={nuevoInv} disabled={!orgId}><Plus size={14} /></button>
            </div>
          </label>
        </div>

        {inv && elegido && (
          <PanelFactores inv={inv} elegido={elegido} abierto={!!abierto} onElegir={elegirVersion} />
        )}

        {org && (
          <>
            <nav className="flex gap-1 border-b border-slate-300" role="tablist">
              {pestanas.map(([k, nombre, icono]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                  {icono} {nombre}
                </button>
              ))}
            </nav>

            {tab === 'centros' && (
              <PanelCentros orgId={orgId} centros={centros} setCentros={setCentros} inv={inv} invCentros={invCentros} abierto={!!abierto} onGuardado={recargarInv} falla={falla} />
            )}
            {tab !== 'centros' && !inv && <div className={`${card} text-sm text-slate-600`}>Cree un inventario (año) para continuar.</div>}
            {tab === 'facturas' && inv && (
              <PanelFacturas org={org} inv={inv} abierto={!!abierto} centros={centros} docs={docs} actividad={actividad} factores={factores} onCambio={recargarInv} falla={falla} cargando={cargando} setCargando={setCargando} currentUser={currentUser} />
            )}
            {tab === 'actividad' && inv && (
              <PanelActividad inv={inv} abierto={!!abierto} centros={centros} actividad={actividad} factores={factores} onCambio={recargarInv} falla={falla} />
            )}
            {tab === 'resultados' && inv && <PanelResultados inv={inv} centros={centros} invCentros={invCentros} actividad={actividad} factores={factores} />}
          </>
        )}
        {!org && orgs.length === 0 && <div className={`${card} text-sm text-slate-600`}>Todavía no hay organizaciones. Cree la primera con «Nueva».</div>}
      </main>
    </div>
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
  orgId: string; centros: Centro[]; setCentros: (c: Centro[]) => void; inv?: Inventario; invCentros: InventarioCentro[]; abierto: boolean; onGuardado: () => void; falla: (e: unknown) => void;
}> = ({ orgId, centros, setCentros, inv, invCentros, abierto, onGuardado, falla }) => {
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
const MAX_BYTES = 5 * 1024 * 1024;
const PARALELO = 3;

interface Tarea { id: number; nombre: string; estado: 'espera' | 'subiendo' | 'leyendo' | 'listo' | 'error'; msg?: string }

/** Evalúa una factura leída: datos propuestos, fuente del factor e incidencias (sirve para la revisión individual y en bloque). */
function evaluarDoc(d: Documento, factores: ConjuntoFactores | null, anio: number, otras: Documento[]) {
  const e = d.extraccion as ExtraccionFactura;
  const existentes = otras.filter((x) => x.id !== d.id && (x.estado === 'revisado' || x.estado === 'leido') && x.extraccion)
    .map((x) => ({ id: x.id.slice(0, 8), proveedor: x.extraccion?.proveedor, contador: x.extraccion?.contador, periodoDesde: x.extraccion?.periodoDesde, periodoHasta: x.extraccion?.periodoHasta, cantidad: x.extraccion?.cantidad, tipo: x.extraccion!.tipo }));
  const incidencias = factores ? validarExtraccion(e, { anioInventario: anio, factores, existentes }) : [];
  const fuente = fuentePorDefecto(e, factores);
  const errores = incidencias.filter((i) => i.gravedad === 'error').length;
  const sinFuente = e.tipo !== 'electricidad' && !fuente;
  return { e, incidencias, fuente, errores, avisos: incidencias.length - errores, sinFuente, listo: !!factores && errores === 0 && !sinFuente && e.tipo !== 'otro' };
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
  org: Organizacion; inv: Inventario; abierto: boolean; centros: Centro[]; docs: Documento[]; actividad: Actividad[]; factores: ConjuntoFactores | null;
  onCambio: () => void; falla: (e: unknown) => void; cargando: boolean; setCargando: (b: boolean) => void; currentUser: string;
}> = ({ org, inv, abierto, centros, docs, factores, onCambio, falla, cargando, setCargando }) => {
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

      {pendientes.length > 0 && (
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
                {pendientes.map((d) => {
                  const ev = evaluadas.get(d.id); const e = d.extraccion!;
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2"><input type="checkbox" disabled={!ev?.listo} checked={sel.has(d.id)} onChange={() => alternar(d.id)} aria-label={`Seleccionar ${d.nombre_archivo}`} /></td>
                        <td className="pr-3 text-slate-800">{d.nombre_archivo}<span className="block text-[10px] text-slate-500">{nombreCentro(d.centro_id)}</span></td>
                        <td className="pr-3">{TIPOS[e.tipo] ?? e.tipo}</td><td className="pr-3">{e.proveedor ?? '—'}<span className="block text-[10px] text-slate-500">{e.contador ? `Contador: ${e.contador}` : 'Sin contador'}</span></td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Todas las facturas del inventario {inv.anio} ({docs.length})</h2>
        {docs.length === 0 ? <p className="text-sm text-slate-600">Aún no hay facturas.</p> : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <FileText size={16} className="text-slate-500" />
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-slate-800">{d.nombre_archivo}</p>
                  <p className="text-[11px] text-slate-500">{nombreCentro(d.centro_id)} · {TIPOS[(d.tipo as TipoFactura)] ?? d.tipo}{d.periodo_desde ? ` · ${d.periodo_desde} → ${d.periodo_hasta ?? ''}` : ''}</p>
                </div>
                <Estado e={d.estado} />
                <button className={btnS} onClick={async () => { try { window.open(await huellaService.urlDocumento(d.archivo_path), '_blank', 'noopener'); } catch (x) { falla(x); } }}><Eye size={14} /> Ver</button>
              </li>
            ))}
          </ul>
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
  const existentes = useMemo(() => otras.filter((x) => x.id !== doc.id && (x.estado === 'revisado' || x.estado === 'leido') && x.extraccion).map((x) => ({ id: x.id.slice(0, 8), proveedor: x.extraccion?.proveedor, contador: x.extraccion?.contador, periodoDesde: x.extraccion?.periodoDesde, periodoHasta: x.extraccion?.periodoHasta, cantidad: x.extraccion?.cantidad, tipo: x.extraccion!.tipo })), [otras, doc.id]);
  const [e, setE] = useState<ExtraccionFactura>(doc.extraccion!);
  const [fuente, setFuente] = useState(() => fuentePorDefecto(doc.extraccion!, factores));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (!fuente) setFuente(fuentePorDefecto(e, factores)); }, [factores]); // eslint-disable-line
  const incidencias = useMemo(() => (factores ? validarExtraccion(e, { anioInventario: inv.anio, factores, existentes }) : []), [e, factores, inv.anio, existentes]);
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
        <label className="text-xs font-semibold text-slate-600 col-span-2">Contador / CUPS<input className={`${input} mt-1`} value={e.contador ?? ''} onChange={(ev) => set('contador', ev.target.value)} placeholder="Identifica el punto de suministro" /></label>
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
  return (
    <div className="space-y-4">
      <div className={card}>
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
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Datos de actividad confirmados ({actividad.length})</h2>
        {actividad.length === 0 ? <p className="text-sm text-slate-600">Aún no hay datos. Suba facturas o añada un dato a mano.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-600 border-b border-slate-200"><th className="py-2 pr-3">Centro</th><th className="pr-3">Categoría</th><th className="pr-3">Fuente</th><th className="pr-3">Contador</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3">Origen</th><th /></tr></thead>
              <tbody>
                {actividad.map((a) => (
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

// ───────────────────────────── Resultados ─────────────────────────────
const PanelResultados: React.FC<{ inv: Inventario; centros: Centro[]; invCentros: InventarioCentro[]; actividad: Actividad[]; factores: ConjuntoFactores | null }> = ({ inv, centros, invCentros, actividad, factores }) => {
  const calculo = useMemo(() => {
    if (!factores) return null;
    const nombre = (id: string) => centros.find((c) => c.id === id)?.nombre ?? id;
    const lineas: LineaActividad[] = []; const fallos: string[] = [];
    for (const a of actividad.filter((x) => x.estado === 'confirmada')) {
      lineas.push({ id: a.id, centro: nombre(a.centro_id), categoria: a.categoria, fuente: a.fuente, cantidad: Number(a.cantidad), origenElectricidad: a.origen_electricidad ?? undefined, evidencia: a.documento_id ?? undefined, contador: a.contador ?? undefined,
        reparto: a.reparto_proporcion < 1 ? { proporcion: Number(a.reparto_proporcion), justificacion: a.reparto_justificacion ?? '' } : undefined });
    }
    const validas = lineas.filter((l) => { try { calcularInventario([l], factores); return true; } catch (e) { fallos.push(`${l.centro} · ${l.fuente || 'electricidad'}: ${e instanceof Error ? e.message : e}`); return false; } });
    return { ...calcularInventario(validas, factores), fallos };
  }, [factores, actividad, centros]);

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
