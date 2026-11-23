// Acceso a los datos de Huella de carbono (tablas hc_*, con RLS) y a la función de lectura de facturas.
import type { CalculoExtintores } from '../huella/exclusiones';
import type { LecturaExtintores } from '../huella/extintores';
import type { CriteriosSignificancia, SubcategoriaPlantilla } from '../huella/significancia';
import type { LecturaInformeBase } from '../huella/lecturaInformeBase';
import type { AnioBaseDef, ConfigRecalculo, DecisionRecalculo } from '../huella/anioBase';
import { supabase } from './supabase';
import type { ExtraccionFactura, Incidencia } from '../huella/extraccion';
import type { Categoria, ConjuntoFactores, OrigenElectricidad } from '../huella/tipos';
import type { HotelSuite } from '../huella/hotelesSuite';

export interface Organizacion { id: string; /** Nombre comercial. */ nombre: string; /** Denominación legal. */ razon_social?: string | null; consolidacion_justificacion?: string | null; responsable_nombre?: string | null; responsable_cargo?: string | null; responsable_entidad?: string | null; responsable_email?: string | null; /** Año base de la organización (inventario vinculado o datos manuales). */ anio_base_def?: AnioBaseDef | null; /** Reglas de recálculo del año base (si no, las de por defecto). */ config_recalculo?: Partial<ConfigRecalculo> | null; /** Criterios de significancia propios de la organización (si no, los de por defecto). */ config_significancia?: Partial<CriteriosSignificancia> | null; cif?: string | null; direccion?: string | null; cnae?: string | null; iae?: string | null; criterio_consolidacion?: 'control_operativo' | 'control_financiero' | 'cuota_participacion' | null; consultor_email?: string | null; suite_cadena?: string | null }
export interface Centro { id: string; organizacion_id: string; nombre: string; direccion?: string | null; municipio?: string | null; isla?: string | null; en_baleares: boolean; unidades_alojamiento?: number | null; latitud?: number | string | null; longitud?: number | string | null; suite_hotel_id?: string | null; suite_codigo?: string | null; suite_actualizado?: string | null }
export interface CierreDatos {
  analisisVariacion?: string;
  /** Resultados fijados al cerrar (para reproducir y detectar cambios posteriores). */
  resumen?: { kgCO2eAlcance1: number; kgCO2eAlcance2: number; kgCO2eTotal: number; indiceActividad: number; factores: string; lineas: number; fecha: string };
  reaperturas?: Array<{ fecha: string; usuario: string; motivo: string }>;
}
export interface FilaBiblioteca { inventario: Inventario; organizacion: Organizacion; centros: number }
export interface Verificacion { entidad?: string; nivel?: string; fecha?: string; referencia?: string }
export interface Exclusion { id: string; inventario_id: string; fuente: string; porcentaje: number | null; justificacion: string; /** Enlace o referencia de la evidencia de la exclusión. */ evidencia_url?: string | null; /** Categoría ISO 14064-1 (1 a 6) a la que pertenece lo excluido. */ categoria_iso?: number | null; /** Cálculo de la emisión excluida (extintores). */ calculo?: CalculoExtintores | null; certificado_path?: string | null; certificado_nombre?: string | null }
export interface EvaluacionDB { id: string; inventario_id: string; metodo?: 'criterios' | 'no_aplica'; categoria: number; codigo: string; nombre: string; magnitud_pct: number | null; influencia: 'alta' | 'media' | 'baja' | null; datos: 'buenos' | 'parciales' | 'no_disponibles' | null; requisitos: boolean | null; resultado: 'significativa' | 'no_significativa' | null; justificacion: string | null; cuantificada: boolean }
export interface NoConformidad { id: string; inventario_id: string; fecha: string; descripcion: string; medida?: string | null; responsable?: string | null; cerrada_en?: string | null }
export interface Inventario { id: string; organizacion_id: string; /** Decisión documentada sobre el recálculo del año base. */ recalculo_base?: DecisionRecalculo | null; anio: number; estado: 'borrador' | 'revision' | 'cerrado' | 'verificado'; indice_actividad: string; conjunto_factores?: ConjuntoFactores | null; cierre?: CierreDatos | null; cerrado_en?: string | null; anio_base?: number | null; verificacion?: Verificacion | null; updated_at?: string }
export interface InventarioCentro { inventario_id: string; centro_id: string; operativo_desde?: string | null; operativo_hasta?: string | null; indice_actividad: number; /** Plantilla media del año (trabajadores), para el ratio por trabajador. */ plantilla_media?: number; notas?: string | null }
export interface Documento {
  id: string; inventario_id: string; centro_id: string | null; tipo: string; proveedor?: string | null;
  periodo_desde?: string | null; periodo_hasta?: string | null; archivo_path: string; nombre_archivo?: string | null;
  estado: 'subido' | 'leido' | 'revisado' | 'rechazado'; extraccion?: ExtraccionFactura | null;
}
export interface Actividad {
  id: string; inventario_id: string; centro_id: string; documento_id?: string | null; categoria: Categoria; fuente: string;
  cantidad: number; unidad?: string | null; origen_electricidad?: OrigenElectricidad | null;
  periodo_desde?: string | null; periodo_hasta?: string | null; reparto_proporcion: number; reparto_justificacion?: string | null;
  estado: 'borrador' | 'confirmada'; notas?: string | null; contador?: string | null;
}
export interface ResultadoLecturaApi {
  extraccion: ExtraccionFactura; incidencias: Incidencia[]; modelo: string; usoRefuerzo: boolean;
  consumo: Array<{ modelo: string; tokensEntrada?: number; tokensSalida?: number }>;
}

const ok = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? ([] as unknown)) as T;
};

export const huellaService = {
  async organizaciones() { return ok<Organizacion[]>(await supabase.from('hc_organizaciones').select('*').eq('activa', true).order('nombre')); },
  async crearOrganizacion(o: Partial<Omit<Organizacion, 'id'>> & { nombre: string }) {
    const { data: u } = await supabase.auth.getUser();
    return ok<Organizacion>(await supabase.from('hc_organizaciones').insert({ ...o, created_by: u?.user?.id }).select().single());
  },
  /** Busca hoteles en HS Suite (solo lectura, solo consultores) a través de la función de servidor. */
  async buscarHoteles(c: { texto?: string; cadena?: string; id?: string; limite?: number }): Promise<HotelSuite[]> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sesión caducada: vuelva a entrar.');
    const resp = await fetch('/api/buscar-hoteles', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(c) });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error ?? `Error ${resp.status}`);
    return (cuerpo.hoteles ?? []) as HotelSuite[];
  },
  /** Todos los cálculos (inventarios) visibles para el usuario, con su organización y nº de centros, para la pantalla de inicio. */
  async biblioteca(): Promise<FilaBiblioteca[]> {
    const [inv, orgs, cen] = await Promise.all([
      ok<Inventario[]>(await supabase.from('hc_inventarios').select('*')),
      ok<Organizacion[]>(await supabase.from('hc_organizaciones').select('*')),
      ok<Array<{ organizacion_id: string }>>(await supabase.from('hc_centros').select('organizacion_id')),
    ]);
    const nCentros = new Map<string, number>();
    cen.forEach((c) => nCentros.set(c.organizacion_id, (nCentros.get(c.organizacion_id) ?? 0) + 1));
    const porId = new Map(orgs.map((o) => [o.id, o]));
    return inv.filter((i) => porId.has(i.organizacion_id)).map((i) => ({ inventario: i, organizacion: porId.get(i.organizacion_id)!, centros: nCentros.get(i.organizacion_id) ?? 0 }))
      .sort((a, b) => String(b.inventario.updated_at ?? '').localeCompare(String(a.inventario.updated_at ?? '')));
  },
  /** Elimina un inventario en borrador con todos sus datos (la base impide borrar los cerrados). */
  async borrarInventario(id: string) { ok(await supabase.from('hc_inventarios').delete().eq('id', id)); },
  async actualizarOrganizacion(id: string, c: Partial<Omit<Organizacion, 'id'>>) {
    return ok<Organizacion>(await supabase.from('hc_organizaciones').update(c).eq('id', id).select().single());
  },
  async actualizarCentro(id: string, c: Partial<Omit<Centro, 'id' | 'organizacion_id'>>) {
    return ok<Centro>(await supabase.from('hc_centros').update(c).eq('id', id).select().single());
  },
  async centros(org: string) { return ok<Centro[]>(await supabase.from('hc_centros').select('*').eq('organizacion_id', org).order('nombre')); },
  async crearCentro(c: Partial<Omit<Centro, 'id'>> & { organizacion_id: string; nombre: string; en_baleares: boolean }) {
    return ok<Centro>(await supabase.from('hc_centros').insert(c).select().single());
  },
  async inventarios(org: string) { return ok<Inventario[]>(await supabase.from('hc_inventarios').select('*').eq('organizacion_id', org).order('anio', { ascending: false })); },
  async crearInventario(org: string, anio: number) {
    const { data: u } = await supabase.auth.getUser();
    return ok<Inventario>(await supabase.from('hc_inventarios').insert({ organizacion_id: org, anio, created_by: u?.user?.id }).select().single());
  },
  /** Fija el conjunto de factores (versión y valores) de un inventario en borrador. */
  async guardarFactores(inv: string, conjunto: ConjuntoFactores) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ conjunto_factores: conjunto }).eq('id', inv).select().single());
  },
  async guardarCierre(inv: string, cierre: CierreDatos) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ cierre }).eq('id', inv).select().single());
  },
  /** Cierra el inventario fijando el conjunto de factores y el resumen; desde ese momento la base impide modificar sus datos. */
  async cerrarInventario(inv: string, conjunto: ConjuntoFactores, cierre: CierreDatos) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ estado: 'cerrado', conjunto_factores: conjunto, cierre }).eq('id', inv).select().single());
  },
  /** Reabre un inventario cerrado; la causa queda en `cierre.reaperturas` y la base lo anota en la auditoría. */
  async reabrirInventario(inv: string, cierre: CierreDatos) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ estado: 'borrador', cierre }).eq('id', inv).select().single());
  },
  async exclusiones(inv: string) { return ok<Exclusion[]>(await supabase.from('hc_exclusiones').select('*').eq('inventario_id', inv).order('created_at')); },
  async crearExclusion(x: Omit<Exclusion, 'id'>) { return ok<Exclusion>(await supabase.from('hc_exclusiones').insert(x).select().single()); },
  /** Sube el certificado de mantenimiento (PDF o imagen) de una exclusión a la carpeta privada. */
  async subirCertificadoExclusion(file: File, org: string, inv: string) {
    const path = `${org}/${inv}/exclusion_${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`;
    const up = await supabase.storage.from('hc-facturas').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new Error(up.error.message);
    return path;
  },
  /** Lee con IA el informe del año base ya subido (propuesta que la persona revisa). */
  async leerInformeBase(path: string): Promise<LecturaInformeBase & { modelo?: string }> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sesión caducada: vuelva a entrar.');
    const resp = await fetch('/api/leer-informe-base', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ path }) });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error ?? `Error ${resp.status}`);
    return cuerpo;
  },
  /** Lee con IA el certificado ya subido (devuelve solo una propuesta que la persona revisa). */
  async leerExtintores(path: string): Promise<LecturaExtintores & { modelo?: string }> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sesión caducada: vuelva a entrar.');
    const resp = await fetch('/api/leer-extintores', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ path }) });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error ?? `Error ${resp.status}`);
    return cuerpo;
  },
  // ── Significancia de las emisiones indirectas (configuración y evaluación por inventario)
  async plantillaSubcategorias(sector: string) { return ok<Array<SubcategoriaPlantilla & { id: string }>>(await supabase.from('hc_plantillas_subcategorias').select('*').eq('sector', sector).order('orden')); },
  /** Sustituye la plantilla de un sector (solo administradores: lo impone la base de datos). */
  async guardarPlantilla(sector: string, filas: SubcategoriaPlantilla[]) {
    ok(await supabase.from('hc_plantillas_subcategorias').delete().eq('sector', sector));
    if (filas.length) ok(await supabase.from('hc_plantillas_subcategorias').insert(filas.map((f, i) => ({ sector, categoria: f.categoria, codigo: f.codigo, nombre: f.nombre, descripcion: f.descripcion ?? null, orden: i + 1, activa: f.activa }))));
  },
  async configuracion<T>(clave: string): Promise<T | null> { const r = await supabase.from('hc_configuracion').select('valor').eq('clave', clave).maybeSingle(); if (r.error) throw new Error(r.error.message); return (r.data?.valor as T) ?? null; },
  async guardarConfiguracion(clave: string, valor: unknown) { ok(await supabase.from('hc_configuracion').upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })); },
  async evaluaciones(inv: string) { return ok<EvaluacionDB[]>(await supabase.from('hc_evaluaciones_significancia').select('*').eq('inventario_id', inv).order('codigo')); },
  async guardarEvaluacion(x: Omit<EvaluacionDB, 'id'>) { return ok<EvaluacionDB>(await supabase.from('hc_evaluaciones_significancia').upsert({ ...x, updated_at: new Date().toISOString() }, { onConflict: 'inventario_id,codigo' }).select().single()); },
  async borrarEvaluacion(id: string) { ok(await supabase.from('hc_evaluaciones_significancia').delete().eq('id', id)); },
  async guardarCriteriosOrganizacion(org: string, c: Partial<CriteriosSignificancia>) { return ok<Organizacion>(await supabase.from('hc_organizaciones').update({ config_significancia: c }).eq('id', org).select().single()); },
  async borrarExclusion(id: string) { ok(await supabase.from('hc_exclusiones').delete().eq('id', id)); },
  async noConformidades(inv: string) { return ok<NoConformidad[]>(await supabase.from('hc_no_conformidades').select('*').eq('inventario_id', inv).order('created_at')); },
  async crearNoConformidad(x: Omit<NoConformidad, 'id' | 'fecha'>) { return ok<NoConformidad>(await supabase.from('hc_no_conformidades').insert(x).select().single()); },
  async cerrarNoConformidad(id: string) { return ok<NoConformidad>(await supabase.from('hc_no_conformidades').update({ cerrada_en: new Date().toISOString().slice(0, 10) }).eq('id', id).select().single()); },
  async borrarNoConformidad(id: string) { ok(await supabase.from('hc_no_conformidades').delete().eq('id', id)); },
  async guardarAnioBaseOrganizacion(org: string, def: AnioBaseDef | null) { return ok<Organizacion>(await supabase.from('hc_organizaciones').update({ anio_base_def: def }).eq('id', org).select().single()); },
  async guardarConfigRecalculo(org: string, c: Partial<ConfigRecalculo>) { return ok<Organizacion>(await supabase.from('hc_organizaciones').update({ config_recalculo: c }).eq('id', org).select().single()); },
  async guardarRecalculoBase(inv: string, d: DecisionRecalculo) { return ok<Inventario>(await supabase.from('hc_inventarios').update({ recalculo_base: d }).eq('id', inv).select().single()); },
  async guardarAnioBase(inv: string, anio: number | null) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ anio_base: anio }).eq('id', inv).select().single());
  },
  /** Marca un inventario cerrado como verificado con los datos de la entidad verificadora. */
  async marcarVerificado(inv: string, v: Verificacion) {
    return ok<Inventario>(await supabase.from('hc_inventarios').update({ estado: 'verificado', verificacion: v }).eq('id', inv).select().single());
  },
  async inventarioCentros(inv: string) { return ok<InventarioCentro[]>(await supabase.from('hc_inventario_centros').select('*').eq('inventario_id', inv)); },
  async guardarInventarioCentro(x: InventarioCentro) {
    return ok<InventarioCentro>(await supabase.from('hc_inventario_centros').upsert(x, { onConflict: 'inventario_id,centro_id' }).select().single());
  },

  async documentos(inv: string) { return ok<Documento[]>(await supabase.from('hc_documentos').select('*').eq('inventario_id', inv).order('created_at', { ascending: false })); },
  /** Sube el archivo a la carpeta privada y crea el documento en estado «subido». */
  async subirDocumento(file: File, org: string, inv: string, centro: string, tipo?: string) {
    const limpio = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${org}/${inv}/${Date.now()}_${limpio}`;
    const up = await supabase.storage.from('hc-facturas').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { data: u } = await supabase.auth.getUser();
    return ok<Documento>(await supabase.from('hc_documentos').insert({ inventario_id: inv, centro_id: centro, archivo_path: path, nombre_archivo: file.name, ...(tipo ? { tipo } : {}), created_by: u?.user?.id }).select().single());
  },
  async actualizarDocumento(id: string, cambios: Partial<Documento> & { revisado_por?: string; revisado_en?: string }) {
    return ok<Documento>(await supabase.from('hc_documentos').update(cambios).eq('id', id).select().single());
  },
  async urlDocumento(path: string) {
    const r = await supabase.storage.from('hc-facturas').createSignedUrl(path, 300);
    if (r.error) throw new Error(r.error.message);
    return r.data.signedUrl;
  },

  /** Elimina una factura con el dato de actividad que generó (si no, quedaría un dato sin evidencia) y su archivo; se puede volver a subir. */
  async borrarDocumento(d: { id: string; archivo_path: string }) {
    ok(await supabase.from('hc_actividad').delete().eq('documento_id', d.id));
    ok(await supabase.from('hc_documentos').delete().eq('id', d.id));
    try { await supabase.storage.from('hc-facturas').remove([d.archivo_path]); } catch { /* el archivo huérfano no impide seguir */ }
  },
  async actividad(inv: string) { return ok<Actividad[]>(await supabase.from('hc_actividad').select('*').eq('inventario_id', inv).order('created_at')); },
  async crearActividad(a: Omit<Actividad, 'id'>) {
    const { data: u } = await supabase.auth.getUser();
    return ok<Actividad>(await supabase.from('hc_actividad').insert({ ...a, created_by: u?.user?.id, confirmada_por: a.estado === 'confirmada' ? u?.user?.id : null }).select().single());
  },
  /** Fija el origen de la electricidad en las líneas de actividad que proceden de una factura. */
  async fijarOrigenActividadDocumento(documentoId: string, origen: OrigenElectricidad) { ok(await supabase.from('hc_actividad').update({ origen_electricidad: origen }).eq('documento_id', documentoId)); },
  /** Quita la línea de actividad generada por una factura (para sustituirla por el dato corregido a mano). */
  async borrarActividadDocumento(documentoId: string) { ok(await supabase.from('hc_actividad').delete().eq('documento_id', documentoId)); },
  async actualizarActividad(id: string, c: Partial<Omit<Actividad, 'id' | 'inventario_id'>>) { return ok<Actividad>(await supabase.from('hc_actividad').update(c).eq('id', id).select().single()); },
  async borrarActividad(id: string) { ok(await supabase.from('hc_actividad').delete().eq('id', id)); },

  /** Envía la factura a la función de servidor (Haiku 5.5, con refuerzo si hace falta). Devuelve solo una PROPUESTA. */
  async leerFactura(file: File, anioInventario: number, version?: string, tipo?: string): Promise<ResultadoLecturaApi> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sesión caducada: vuelva a entrar.');
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] ?? '');
      r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
      r.readAsDataURL(file);
    });
    const resp = await fetch('/api/leer-factura', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ anioInventario, version, tipo, base64, mediaType: file.type }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(cuerpo.error ?? `Error ${resp.status}`);
    return cuerpo as ResultadoLecturaApi;
  },
};
