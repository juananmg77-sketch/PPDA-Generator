// Acceso a los planes de circularidad guardados (tabla circ_planes, con RLS: gestores escriben, clientes con acceso leen).
import { supabase } from './supabase';
import type { Plan } from '../circularidad/plan';

export interface FilaPlan { id: string; organizacion_id: string; nombre: string; vigencia_desde: number | null; vigencia_hasta: number | null; estado: 'borrador' | 'vigente' | 'renovado'; updated_at: string }

const COLS = 'id, organizacion_id, nombre, vigencia_desde, vigencia_hasta, estado, updated_at';

export const circularidadService = {
  async listar(): Promise<FilaPlan[]> {
    const { data, error } = await supabase.from('circ_planes').select(COLS).order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []) as FilaPlan[];
  },
  async abrir(id: string): Promise<Plan> {
    const { data, error } = await supabase.from('circ_planes').select('plan').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { ...(data!.plan as Plan), id };
  },
  async crear(organizacionId: string, plan: Plan): Promise<FilaPlan & { plan: Plan }> {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('circ_planes').insert({
      organizacion_id: organizacionId, nombre: plan.ficha.establecimiento, vigencia_desde: plan.ficha.vigenciaDesde, vigencia_hasta: plan.ficha.vigenciaHasta, plan, created_by: u?.user?.id,
    }).select(`${COLS}, plan`).single();
    if (error) throw new Error(error.message);
    return { ...(data as FilaPlan), plan: { ...plan, id: (data as FilaPlan).id } };
  },
  async guardar(id: string, plan: Plan): Promise<void> {
    const { error, data } = await supabase.from('circ_planes').update({ nombre: plan.ficha.establecimiento, vigencia_desde: plan.ficha.vigenciaDesde, vigencia_hasta: plan.ficha.vigenciaHasta, plan }).eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No se ha guardado: no tiene permiso de edición sobre este plan.');
  },
};
