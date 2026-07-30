import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';
const supabase = createClient(
  'https://uqxwrclzmcotkehnglhe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxeHdyY2x6bWNvdGtlaG5nbGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTc4MDYsImV4cCI6MjA4OTg3MzgwNn0.Mm1JTfNrawKsf07JB8LCYIq1qBnmhgNHvUVDhsR9AAA'
);

const { data, error } = await supabase.from('plans').select('*').order('updated_at', { ascending: false });
if (error) { console.error(error); process.exit(1); }

// Filter P&V plans (by consultor: aramos, arubilar, or hotel name contains Pierre/P&V)
const pv = data.filter(p => {
  const c = (p.consultor || '').toLowerCase();
  const h = (p.hotel_name || '').toLowerCase();
  return c.includes('aramos') || c.includes('arubilar') || h.includes('pierre') || h.includes('p&v') || h.includes('roquetas') || h.includes('terrazas') || h.includes('fuengirola') || h.includes('granada') || h.includes('levante') || h.includes('horitz') || h.includes('salins') || h.includes('monterrey') || h.includes('figueres') || h.includes('puerto de la luz') || h.includes('lloret');
});

console.log(`Planes P&V encontrados: ${pv.length}`);

for (const plan of pv) {
  const d = plan.data;
  const hotel = plan.hotel_name;
  const objs = d?.objectives || [];
  const selected = objs.filter(o => o.selected);
  const withActions = selected.filter(o => o.actions?.length > 0);
  const withPlazo = selected.filter(o => o.plazo && o.plazo.trim() !== '');
  const diag = d?.diagnosisData || [];
  const diagFilled = diag.filter(item => item.nivel && item.nivel !== '');
  const kpis = d?.measurementConfig?.kpis || [];
  const kpisSelected = kpis.filter(k => k.selected);
  const metodo = d?.measurementConfig?.metodologia?.tipo || 'bascula';
  const consultor = plan.consultor || '';
  const firmas = { consultor: !!(d?.consultantSignature), director: !!(d?.directorSignature) };
  const tracking = Object.keys(d?.objectives?.[0]?.trackingHistory || {}).length > 0;
  const areas = d?.areas?.length || 0;
  const team = d?.team?.filter(t => t.nombre && t.nombre.trim() !== '')?.length || 0;
  const hotelData = d?.hotelData || {};
  
  // General data completeness (8 fields: razonSocial, cif, categoria, direccion, numHabitaciones, municipio, provincia, logo/director)
  const gFields = ['razonSocial','nombreComercial','cif','categoria','direccion','numHabitaciones','municipio','provincia'];
  const gFilled = gFields.filter(f => hotelData[f] && hotelData[f] !== '' && hotelData[f] !== 0).length;
  
  // Tracking check - any objective has non-empty trackingHistory
  const hasTracking = selected.some(o => Object.keys(o.trackingHistory || {}).length > 0);
  
  // Actions status
  let accionesStr = 'No';
  if (withActions.length === selected.length && selected.length > 0) accionesStr = `${withActions.length}/${selected.length} OE`;
  else if (withActions.length > 0) accionesStr = `${withActions.length}/${selected.length} OE`;
  
  // Firmas
  let firmasStr = 'Ninguna';
  if (firmas.consultor && firmas.director) firmasStr = 'Ambas';
  else if (firmas.consultor) firmasStr = 'Consultor';
  else if (firmas.director) firmasStr = 'Director';

  // Score (simplified)
  let score = 7;
  if (diagFilled.length >= 30) score++;
  if (selected.length >= 10) score++;
  if (withActions.length > 0) score++;
  
  // Estado
  let estado = 'Incompleto';
  if (score >= 10) estado = 'Avanzado';
  else if (score >= 9) estado = withActions.length > 0 ? 'Avanzado' : 'En progreso';
  else if (score >= 7) estado = 'En progreso';

  const metodStr = metodo === 'ia' ? 'Winnow' : metodo === 'bascula' ? 'Báscula' : metodo.toUpperCase();

  console.log(JSON.stringify({
    hotel,
    consultor,
    fechaVisita: plan.fecha_visita,
    score,
    diag: `${diagFilled.length}/37`,
    objSeleccionados: selected.length,
    acciones: accionesStr,
    plazosOE: `${withPlazo.length}/${selected.length}`,
    kpis: kpisSelected.length,
    metodo: metodStr,
    firmas: firmasStr,
    seguimiento: hasTracking ? 'Sí' : 'No',
    datosGenerales: `${gFilled}/8`,
    areas,
    team,
    estado
  }));
}
