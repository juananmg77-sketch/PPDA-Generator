import { supabase } from './supabase';
import { AppState } from '../types';

export interface SupabasePlan {
  id: string;
  plan_id: string;
  scope: string;
  hotel_name: string;
  razon_social: string | null;
  cif: string | null;
  categoria: string | null;
  municipio: string | null;
  provincia: string | null;
  num_habitaciones: number | null;
  num_empleados: number | null;
  num_hoteles: number | null;
  version: string;
  version_num: number;
  baseline_year: string | null;
  periodo_plan: string | null;
  fecha_visita: string | null;
  consultor: string | null;
  objetivo_reduccion: number | null;
  num_objetivos: number | null;
  estado: string;
  data: AppState;
  updated_at: string;
  created_at: string;
}

function buildPlanRow(state: AppState, extraFields?: Partial<SupabasePlan>) {
  const isCorporate = state.scope === 'corporate';

  const hotelName = isCorporate
    ? state.society?.razonSocial || ''
    : state.hotelData?.nombreComercial || '';

  const razonSocial = isCorporate
    ? state.society?.razonSocial || null
    : state.hotelData?.razonSocial || null;

  const cif = isCorporate
    ? state.society?.cif || null
    : state.hotelData?.cif || null;

  const municipio = isCorporate
    ? state.society?.municipio || null
    : state.hotelData?.municipio || null;

  const provincia = isCorporate
    ? state.society?.provincia || null
    : state.hotelData?.provincia || null;

  const numHoteles = isCorporate ? (state.hotels?.length || 1) : 1;

  const numHabitaciones = isCorporate
    ? state.hotels?.reduce((sum, h) => sum + (h.numHabitaciones || 0), 0) || null
    : state.hotelData?.numHabitaciones || null;

  const numEmpleados = isCorporate
    ? state.hotels?.reduce((sum, h) => sum + (h.numEmpleados || 0), 0) || null
    : state.hotelData?.numEmpleados || null;

  // Parse version number from string like "V3" → 3
  const versionNum = parseInt((state.version || 'V1').replace(/\D/g, ''), 10) || 1;

  return {
    plan_id: state.planId || hotelName,
    scope: state.scope || 'individual',
    hotel_name: hotelName,
    razon_social: razonSocial,
    cif: cif || null,
    categoria: (!isCorporate && state.hotelData?.categoria) || null,
    municipio: municipio || null,
    provincia: provincia || null,
    num_habitaciones: numHabitaciones || null,
    num_empleados: numEmpleados || null,
    num_hoteles: numHoteles,
    version: state.version || 'V1',
    version_num: versionNum,
    baseline_year: state.baselineYear || null,
    periodo_plan: state.periodoPlan || null,
    fecha_visita: state.fechaVisita || null,
    consultor: state.consultor || null,
    objetivo_reduccion: state.objetivoGeneralReduccion || null,
    num_objetivos: state.objectives?.length || 0,
    estado: 'Activo',
    data: state,
    updated_at: new Date().toISOString(),
    ...extraFields,
  };
}

export const planService = {

  async getAll(): Promise<SupabasePlan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as SupabasePlan[]) || [];
  },

  // Guardar borrador (sin cambiar versión, estado Borrador)
  async saveDraft(state: AppState): Promise<void> {
    const row = buildPlanRow(state);
    row.estado = 'Borrador';
    const { error } = await supabase
      .from('plans')
      .upsert(row, { onConflict: 'plan_id' });
    if (error) throw error;
  },

  // Guardar nueva versión (incrementa versión, guarda historial con descripción)
  async saveNewVersion(state: AppState, changeDescription: string): Promise<void> {
    const row = buildPlanRow(state);
    row.estado = 'Activo';

    // Primero guardamos el plan con la nueva versión
    const { error } = await supabase
      .from('plans')
      .upsert(row, { onConflict: 'plan_id' });
    if (error) throw error;

    // Luego insertamos la entrada en el historial con la descripción de cambios
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('plan_history').insert({
      plan_id: row.plan_id,
      version: row.version,
      version_num: row.version_num,
      saved_by: user?.id || null,
      data: state,
      change_description: changeDescription,
    });
  },

  // upsert genérico (compatibilidad con migración)
  async upsert(state: AppState): Promise<void> {
    const row = buildPlanRow(state);
    const { error } = await supabase
      .from('plans')
      .upsert(row, { onConflict: 'plan_id' });
    if (error) throw error;
  },

  async delete(planId: string): Promise<void> {
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('plan_id', planId);
    if (error) throw error;
  },

  // Importa los planes existentes del backup de Google Sheets
  async migrateFromGoogleSheets(
    rawPlans: any[],
    onProgress: (done: number, total: number) => void
  ): Promise<{ success: number; errors: string[] }> {
    let success = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawPlans.length; i++) {
      const raw = rawPlans[i];
      onProgress(i, rawPlans.length);

      try {
        const planData: AppState = JSON.parse(raw.json_completo);

        const row = buildPlanRow(planData, {
          estado: 'Activo',
          updated_at: planData.lastModified || raw.date || new Date().toISOString(),
        } as any);

        // Override plan_id with whatever was stored in the backup
        if (raw.planId || planData.planId) {
          row.plan_id = raw.planId || planData.planId;
        }

        const { error } = await supabase
          .from('plans')
          .upsert(row, { onConflict: 'plan_id' });

        if (error) errors.push(`${raw.hotel || row.hotel_name}: ${error.message}`);
        else success++;
      } catch (e: any) {
        errors.push(`${raw.hotel || '?'}: ${e.message}`);
      }
    }

    onProgress(rawPlans.length, rawPlans.length);
    return { success, errors };
  },
};
