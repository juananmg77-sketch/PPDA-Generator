// Acceso a los datos de Huella de carbono (tablas hc_*, con RLS) y a la función de lectura de facturas.
import { supabase } from './supabase';
import type { ExtraccionFactura, Incidencia } from '../huella/extraccion';
import type { Categoria, ConjuntoFactores, OrigenElectricidad } from '../huella/tipos';

export interface Organizacion { id: string; nombre: string; cif?: string | null; consultor_email?: string | null }
export interface Centro { id: string; organizacion_id: string; nombre: string; municipio?: string | null; isla?: string | null; en_baleares: boolean }
export interface Inventario { id: string; organizacion_id: string; anio: number; estado: 'borrador' | 'revision' | 'cerrado' | 'verificado'; indice_actividad: string; conjunto_factores?: ConjuntoFactores | null }
export interface InventarioCentro { inventario_id: string; centro_id: string; operativo_desde?: string | null; operativo_hasta?: string | null; indice_actividad: number; notas?: string | null }
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
  async crearOrganizacion(o: { nombre: string; cif?: string; consultor_email?: string }) {
    const { data: u } = await supabase.auth.getUser();
    return ok<Organizacion>(await supabase.from('hc_organizaciones').insert({ ...o, created_by: u?.user?.id }).select().single());
  },
  async centros(org: string) { return ok<Centro[]>(await supabase.from('hc_centros').select('*').eq('organizacion_id', org).order('nombre')); },
  async crearCentro(c: { organizacion_id: string; nombre: string; municipio?: string; isla?: string; en_baleares: boolean }) {
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

  async actividad(inv: string) { return ok<Actividad[]>(await supabase.from('hc_actividad').select('*').eq('inventario_id', inv).order('created_at')); },
  async crearActividad(a: Omit<Actividad, 'id'>) {
    const { data: u } = await supabase.auth.getUser();
    return ok<Actividad>(await supabase.from('hc_actividad').insert({ ...a, created_by: u?.user?.id, confirmada_por: a.estado === 'confirmada' ? u?.user?.id : null }).select().single());
  },
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
