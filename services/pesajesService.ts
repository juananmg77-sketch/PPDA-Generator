import { supabase } from './supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PesajeRow {
  id?: string;
  plan_id: string;
  area_id: string;
  area_nombre: string;
  hotel_nombre?: string;
  fecha: string;               // YYYY-MM-DD
  kg: number;
  relativizar_por?: 'estancia' | 'comensal' | 'ambos' | null;
  estancias?: number | null;
  comensales?: number | null;
  categoria?: string;
  registrado_por?: string;
  notas?: string;
  desglose_kg?: Record<string, number>; // kg por subcategoría de alimento
}

export interface OcupacionRow {
  id?: string;
  plan_id: string;
  hotel_nombre: string;
  fecha: string;               // YYYY-MM-DD
  estancias?: number | null;
  comensales?: number | null;
  registrado_por?: string;
}

// ── pesajes ───────────────────────────────────────────────────────────────────

export const pesajesService = {

  /** Upsert de un pesaje (un registro por zona+día) */
  async upsert(row: PesajeRow): Promise<PesajeRow> {
    const { data, error } = await supabase
      .from('pesajes')
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: 'plan_id,area_id,fecha' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as PesajeRow;
  },

  /** Todos los pesajes de un plan (opcionalmente filtrado por mes YYYY-MM) */
  async fetchByPlan(planId: string, mes?: string): Promise<PesajeRow[]> {
    let q = supabase
      .from('pesajes')
      .select('*')
      .eq('plan_id', planId)
      .order('fecha', { ascending: false });

    if (mes) {
      const from = `${mes}-01`;
      const to   = `${mes}-31`;
      q = q.gte('fecha', from).lte('fecha', to);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as PesajeRow[]) || [];
  },

  /** Pesaje concreto de una zona en una fecha */
  async fetchOne(planId: string, areaId: string, fecha: string): Promise<PesajeRow | null> {
    const { data, error } = await supabase
      .from('pesajes')
      .select('*')
      .eq('plan_id', planId)
      .eq('area_id', areaId)
      .eq('fecha', fecha)
      .maybeSingle();
    if (error) throw error;
    return data as PesajeRow | null;
  },

  /** Eliminar un pesaje */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('pesajes').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── ocupacion_diaria ──────────────────────────────────────────────────────────

export const ocupacionService = {

  /** Upsert de ocupación hotel+día */
  async upsert(row: OcupacionRow): Promise<OcupacionRow> {
    const { data, error } = await supabase
      .from('ocupacion_diaria')
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: 'plan_id,hotel_nombre,fecha' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as OcupacionRow;
  },

  /** Ocupación de un plan en un mes (YYYY-MM) */
  async fetchByPlan(planId: string, mes?: string): Promise<OcupacionRow[]> {
    let q = supabase
      .from('ocupacion_diaria')
      .select('*')
      .eq('plan_id', planId)
      .order('fecha', { ascending: false });

    if (mes) {
      q = q.gte('fecha', `${mes}-01`).lte('fecha', `${mes}-31`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as OcupacionRow[]) || [];
  },

  /** Ocupación de un hotel en una fecha concreta */
  async fetchOne(planId: string, hotelNombre: string, fecha: string): Promise<OcupacionRow | null> {
    const { data, error } = await supabase
      .from('ocupacion_diaria')
      .select('*')
      .eq('plan_id', planId)
      .eq('hotel_nombre', hotelNombre)
      .eq('fecha', fecha)
      .maybeSingle();
    if (error) throw error;
    return data as OcupacionRow | null;
  },
};

// ── Helpers de cálculo ────────────────────────────────────────────────────────

/** Ratio kg/estancia o kg/comensal */
export function calcRatio(kg: number, denominador: number | null | undefined): number | null {
  if (!denominador || denominador === 0) return null;
  return Math.round((kg / denominador) * 1000) / 1000; // 3 decimales
}

/** Agrupa pesajes por zona y calcula totales + ratios */
export function agregarPorZona(pesajes: PesajeRow[]): Record<string, {
  totalKg: number;
  dias: number;
  avgKgDia: number;
  avgKgEstancia: number | null;
  avgKgComensal: number | null;
  entradas: PesajeRow[];
}> {
  const map: Record<string, PesajeRow[]> = {};
  pesajes.forEach(p => {
    if (!map[p.area_id]) map[p.area_id] = [];
    map[p.area_id].push(p);
  });

  const result: ReturnType<typeof agregarPorZona> = {};

  Object.entries(map).forEach(([areaId, rows]) => {
    const totalKg      = rows.reduce((s, r) => s + r.kg, 0);
    const dias         = rows.length;
    const avgKgDia     = dias > 0 ? totalKg / dias : 0;

    const rowsConEst   = rows.filter(r => r.estancias && r.estancias > 0);
    const rowsConCom   = rows.filter(r => r.comensales && r.comensales > 0);

    const avgKgEstancia = rowsConEst.length > 0
      ? rowsConEst.reduce((s, r) => s + r.kg / r.estancias!, 0) / rowsConEst.length
      : null;

    const avgKgComensal = rowsConCom.length > 0
      ? rowsConCom.reduce((s, r) => s + r.kg / r.comensales!, 0) / rowsConCom.length
      : null;

    result[areaId] = {
      totalKg: Math.round(totalKg * 10) / 10,
      dias,
      avgKgDia: Math.round(avgKgDia * 100) / 100,
      avgKgEstancia: avgKgEstancia !== null ? Math.round(avgKgEstancia * 1000) / 1000 : null,
      avgKgComensal: avgKgComensal !== null ? Math.round(avgKgComensal * 1000) / 1000 : null,
      entradas: rows,
    };
  });

  return result;
}
