import * as XLSX from 'xlsx';
import { SupabasePlan } from '../services/planService';
import { AppState, Objective } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcImplementacion(data: AppState): number {
  const objs = data?.objectives || [];
  const selected = objs.filter((o: Objective) => o.selected);
  const diag = data?.diagnosisData || [];
  const diagFilled = diag.filter((d: any) => d.prioridad && d.prioridad.trim() !== '').length;
  const withActions = selected.filter((o: Objective) => o.actions?.length > 0);
  const hasFormacion = selected.some((o: Objective) => o.codigo === 'OE12' && o.actions?.length > 0);
  const hasTracking = selected.some((o: Objective) =>
    Object.keys(o.trackingHistory || {}).length > 0
  );

  if (hasTracking) return 100;
  if (hasFormacion) return 75;
  if (withActions.length > 0) return 50;
  if (diagFilled >= 10 && selected.length >= 4) return 25;
  return 0;
}

function calcScore(data: AppState): number {
  const objs = data?.objectives || [];
  const selected = objs.filter((o: Objective) => o.selected);
  const diag = data?.diagnosisData || [];
  const diagFilled = diag.filter((d: any) => d.prioridad && d.prioridad.trim() !== '').length;
  const withActions = selected.filter((o: Objective) => o.actions?.length > 0);
  let score = 7;
  if (diagFilled >= 20) score++;
  if (selected.length >= 8) score++;
  if (withActions.length > 0) score++;
  return Math.min(10, score);
}

function calcEstado(data: AppState): string {
  const impl = calcImplementacion(data);
  const score = calcScore(data);
  if (impl === 100) return 'Seguimiento activo';
  if (impl >= 75) return 'Formación completada';
  if (impl >= 50) return 'Acciones definidas';
  if (impl >= 25) return 'En progreso';
  if (score >= 9) return 'En progreso';
  return 'Incompleto';
}

function getMetodo(data: AppState): string {
  const tipo = data?.measurementConfig?.metodologia?.tipo;
  const map: Record<string, string> = { bascula: 'Báscula', ia: 'Winnow/IA', p1: 'Campaña P1', p3: 'Cubo P3' };
  return map[tipo || ''] || 'Báscula';
}

function getFirmas(data: AppState): string {
  const c = !!(data?.consultantSignature?.trim());
  const d = !!(data?.directorSignature?.trim());
  if (c && d) return 'Ambas';
  if (c) return 'Consultor';
  if (d) return 'Director';
  return 'Ninguna';
}

function shortConsultor(email: string | null): string {
  if (!email) return '—';
  return email.split('@')[0];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Handle both ISO dates and dd/mm/yyyy
  if (iso.includes('/')) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Main export function ─────────────────────────────────────────────────────

export function exportStatusXLS(plans: SupabasePlan[]): void {
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows = plans.map((plan) => {
    const d = plan.data;
    const objs = d?.objectives || [];
    const selected = objs.filter((o: Objective) => o.selected);
    const withActions = selected.filter((o: Objective) => o.actions?.length > 0);
    const withPlazo = selected.filter((o: Objective) => o.plazo?.trim());
    const diag = d?.diagnosisData || [];
    const diagFilled = diag.filter((i: any) => i.nivel && i.nivel.trim() !== '').length;
    const kpis = (d?.measurementConfig?.kpis || []).filter((k: any) => k.selected).length;
    const impl = calcImplementacion(d);
    const score = calcScore(d);
    const estado = calcEstado(d);

    return {
      'Hotel': plan.hotel_name || '—',
      'Consultor': shortConsultor(plan.consultor),
      'Alcance': plan.scope === 'corporate' ? 'Corporativo' : 'Individual',
      'Nº Hoteles': plan.num_hoteles ?? 1,
      'Categoría': plan.categoria || '—',
      'Municipio': plan.municipio || '—',
      'Provincia': plan.provincia || '—',
      'Habitaciones': plan.num_habitaciones ?? '—',
      'Fecha Visita': fmtDate(plan.fecha_visita),
      'Periodo Plan': plan.periodo_plan || '—',
      'Versión': plan.version || 'V1',
      'Score (/10)': score,
      'Avance (%)': impl,
      'Estado': estado,
      'Diagnóstico': `${diagFilled}/37`,
      'Obj. Seleccionados': selected.length,
      'Acciones Definidas': withActions.length > 0 ? `${withActions.length}/${selected.length}` : 'No',
      'Plazos OE': `${withPlazo.length}/${selected.length}`,
      'KPIs Config.': kpis,
      'Metodología': getMetodo(d),
      'Firmas': getFirmas(d),
      'Obj. Reducción (%)': plan.objetivo_reduccion ?? '—',
      'Última Actualización': fmtDate(plan.updated_at),
    };
  });

  // ── Create workbook ─────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Sheet 1: Full detail — build with title rows first, then data
  const titleRows: any[][] = [
    [`PPDA GENERATOR — STATUS GLOBAL DE PLANES · ${fechaStr} ${timeStr}`],
    [`Total planes: ${plans.length}   ·   Exportado por administrador`],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(titleRows);
  XLSX.utils.sheet_add_json(wsData, rows, { origin: 'A3', skipHeader: false });

  // Column widths
  wsData['!cols'] = [
    { wch: 42 }, // Hotel
    { wch: 12 }, // Consultor
    { wch: 12 }, // Alcance
    { wch: 10 }, // Nº Hoteles
    { wch: 18 }, // Categoría
    { wch: 16 }, // Municipio
    { wch: 14 }, // Provincia
    { wch: 13 }, // Habitaciones
    { wch: 13 }, // Fecha Visita
    { wch: 13 }, // Periodo
    { wch: 8 },  // Versión
    { wch: 10 }, // Score
    { wch: 11 }, // Avance %
    { wch: 22 }, // Estado
    { wch: 12 }, // Diagnóstico
    { wch: 17 }, // Obj Seleccionados
    { wch: 17 }, // Acciones
    { wch: 12 }, // Plazos
    { wch: 11 }, // KPIs
    { wch: 14 }, // Metodología
    { wch: 10 }, // Firmas
    { wch: 17 }, // Obj Reducción
    { wch: 20 }, // Última actualización
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Status Planes');

  // Sheet 2: Summary by consultant
  const byConsultor: Record<string, { planes: number; avanceSum: number; conAcciones: number }> = {};
  rows.forEach((r) => {
    const c = r['Consultor'];
    if (!byConsultor[c]) byConsultor[c] = { planes: 0, avanceSum: 0, conAcciones: 0 };
    byConsultor[c].planes++;
    byConsultor[c].avanceSum += r['Avance (%)'] as number;
    if (r['Acciones Definidas'] !== 'No') byConsultor[c].conAcciones++;
  });

  const summaryRows = Object.entries(byConsultor)
    .sort((a, b) => b[1].planes - a[1].planes)
    .map(([consultor, s]) => ({
      'Consultor': consultor,
      'Nº Planes': s.planes,
      'Avance Medio (%)': Math.round(s.avanceSum / s.planes),
      'Planes con Acciones': s.conAcciones,
      'Sin Acciones': s.planes - s.conAcciones,
    }));

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['RESUMEN POR CONSULTOR'],
    [`Fecha: ${fechaStr}`],
  ]);
  XLSX.utils.sheet_add_json(wsSummary, summaryRows, { origin: 'A3', skipHeader: false });
  wsSummary['!cols'] = [{ wch: 14 }, { wch: 11 }, { wch: 18 }, { wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Por Consultor');

  // ── Download ────────────────────────────────────────────────────────────────
  const fileName = `PPDA_Status_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
