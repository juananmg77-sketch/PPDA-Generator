/**
 * Script: Crear plan corporativo INTELIER HOTELES en PPDA Generator
 * Uso: node create_intelier_plan.mjs <email> <password>
 *
 * Las acciones de cada objetivo están extraídas del Excel:
 * "Medidas Reducción Desperdicio Alimentario.xlsx" — INTELIER HOTELES
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqxwrclzmcotkehnglhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxeHdyY2x6bWNvdGtlaG5nbGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTc4MDYsImV4cCI6MjA4OTg3MzgwNn0.Mm1JTfNrawKsf07JB8LCYIq1qBnmhgNHvUVDhsR9AAA';

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Uso: node create_intelier_plan.mjs <email> <password>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function makeAction(objId, letter, descripcion, responsable, plazo = '2026-12-31') {
  return {
    id: `${objId}_${letter}_intelier`,
    codigo: `OE${objId}${letter}`,
    descripcion,
    responsable,
    plazo
  };
}

// ─── ESTADO DE LOS OBJETIVOS (basado en Excel "Estado" columna) ─────────────
// implantado → "En curso"   |   COMPLETADO → "Completado"   |   NaN → "Pendiente"

const INTELIER_OBJECTIVES = [

  // ─── OE1: Buffet desayunos ───────────────────────────────────────────────
  {
    id: '1', codigo: 'OE1',
    descripcion: 'Reducir desperdicio en buffet de desayunos',
    indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual',
    meta: '-20%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(1,'a', 'Reposición progresiva en bandejas: dividir grandes bandejas en GN 1/2 o 1/3 y reponer según demanda real en buffet de desayuno', 'Jefe Cocina'),
      makeAction(1,'b', 'Activar y cerrar estaciones del buffet de desayuno según ocupación, cerrando secciones al menos 30 min antes del fin del servicio', 'Jefe Cocina / Maître'),
      makeAction(1,'c', 'Servir bollería y postres de desayuno en formato tipo bocado (porciones pequeñas) para minimizar excedentes expuestos', 'Sala / Jefe Cocina'),
      makeAction(1,'d', 'Mantener y ampliar la cartelería "Sírvete lo que consumirás, repite sin pena" en todas las estaciones del buffet de desayuno', 'Marketing'),
      makeAction(1,'e', 'Disponer de suficientes expositores en horas punta para evitar que el cliente se sirva en exceso por miedo a escasez', 'Sala / Jefe Cocina'),
    ]
  },

  // ─── OE2: Buffet almuerzos ───────────────────────────────────────────────
  {
    id: '2', codigo: 'OE2',
    descripcion: 'Reducir desperdicio en buffet de almuerzos',
    indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual',
    meta: '-20%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(2,'a', 'Reposición progresiva en bandejas del buffet de almuerzo en unidades GN 1/2 repuestas según demanda, sin exponer todo al inicio del servicio', 'Jefe Cocina'),
      makeAction(2,'b', 'Ajustar el menú diario del almuerzo según stock disponible y productos próximos a caducar, documentando la decisión', 'Jefe Cocina'),
      makeAction(2,'c', 'Cerrar estaciones del buffet de almuerzo faltando 30 min e incorporar show cooking o servicio asistido para alimentos de alto valor', 'Sala / Jefe Cocina'),
      makeAction(2,'d', 'Destinar excedentes del buffet de almuerzo aptos al comedor de personal como primera línea de aprovechamiento', 'Jefe Cocina'),
      makeAction(2,'e', 'Usar utensilios de tamaño adecuado a las raciones para evitar que el cliente se sirva cantidades excesivas', 'Sala / Jefe Cocina'),
    ]
  },

  // ─── OE3: Buffet cenas ───────────────────────────────────────────────────
  {
    id: '3', codigo: 'OE3',
    descripcion: 'Reducir desperdicio en buffet de cenas',
    indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual',
    meta: '-20%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(3,'a', 'Ajustar la producción de cena al ratio de comensales reales de las últimas 4 semanas con factor corrector por día y temporada', 'Jefe Cocina'),
      makeAction(3,'b', 'No reponer completamente el buffet los últimos 45 min del servicio de cena; asistir a quien solicite directamente', 'Sala / Jefe Cocina'),
      makeAction(3,'c', 'Planificar la cocina del día siguiente aprovechando creativamente los excedentes de cena: caldos, sopas, preparaciones de base', 'Jefe Cocina'),
      makeAction(3,'d', 'Activar estaciones de show cooking en cena para producir bajo demanda en tiempo real y reducir sobrantes expuestos', 'Sala / Jefe Cocina'),
      makeAction(3,'e', 'Conservar refrigerados (abatimiento <3°C en <90 min) los excedentes de cena no expuestos y aptos para segundo uso', 'Jefe Cocina'),
    ]
  },

  // ─── OE4: Platos de clientes ─────────────────────────────────────────────
  {
    id: '4', codigo: 'OE4',
    descripcion: 'Reducir desperdicio en platos de clientes',
    indicador: '% reducción vs línea base', lineaBase: 'kg devoluciones/total emplatado',
    meta: '-15%', plazo: '2026-12-31', responsable: 'Jefe Sala',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(4,'a', 'Extender la política de llevar sobras (doggy bag) ya implantada en Restaurante a todos los servicios de los hoteles INTELIER, incluido buffet', 'Personal de Sala'),
      makeAction(4,'b', 'Adecuar el formato de bebida envasada servida al volumen medio consumido por cliente en INTELIER para minimizar excedentes', 'Sala / Jefe Cocina'),
      makeAction(4,'c', 'Servir alimentos en raciones tipo bocado —especialmente postres y aperitivos— para que el cliente controle mejor su consumo', 'Sala / Jefe Cocina'),
      makeAction(4,'d', 'Mantener y potenciar la encuesta de satisfacción ya implementada incluyendo preguntas específicas sobre adecuación de cantidades', 'Calidad', '2026-06-30'),
      makeAction(4,'e', 'Instalar cartelería de consumo responsable en todos los puntos de servicio de cliente: "Sírvete lo que consumirás, puedes repetir"', 'Marketing'),
    ]
  },

  // ─── OE5: Cocina (elaboración) ───────────────────────────────────────────
  {
    id: '5', codigo: 'OE5',
    descripcion: 'Reducir desperdicio en cocina (elaboración)',
    indicador: '% reducción mermas elaboración', lineaBase: 'kg mermas/total materia prima',
    meta: '-15%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(5,'a', 'Estandarizar porciones tipo bocado en elaboraciones —especialmente postres y aperitivos— midiendo el consumo promedio real de INTELIER', 'Jefe Cocina'),
      makeAction(5,'b', 'Usar creativamente ingredientes próximos a caducar para caldos con pieles y tallos, sopas con verduras cocidas y snacks con pan duro', 'Jefe Cocina'),
      makeAction(5,'c', 'Aplicar la guía interna de reutilización de sobras: verduras → cremas/sopas, carne → albóndigas/arroces, pan → migas/tostadas, fruta madura → compotas', 'Jefe Cocina'),
      makeAction(5,'d', 'Evaluar el equilibrio entre fruta íntegra vs pelada y granel vs porcionado, buscando reducir merma de elaboración sin aumentar residuo de envase', 'Sala / Jefe Cocina'),
      makeAction(5,'e', 'Estandarizar recetas con ficha técnica que incluya gramajes, rendimiento esperado y merma prevista por partida/turno', 'Jefe Cocina'),
    ]
  },

  // ─── OE6: Almacén (caducidades) ──────────────────────────────────────────
  {
    id: '6', codigo: 'OE6',
    descripcion: 'Reducir desperdicio en almacén (caducidades)',
    indicador: '% caducidades sobre compras', lineaBase: 'kg caducidades/total compras',
    meta: '< 2%', plazo: '2026-12-31', responsable: 'Economato',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(6,'a', 'Mantener el control de inventarios ya implantado y reducir el ciclo de revisión de caducidades de 6 meses a frecuencia mensual o inferior', 'Jefe Cocina / Almacén / Maître', '2026-06-30'),
      makeAction(6,'b', 'Reforzar la aplicación del sistema FIFO en todos los almacenes de INTELIER con etiquetado obligatorio de fecha de entrada y caducidad en recepción', 'Jefe Cocina'),
      makeAction(6,'c', 'Revisar diariamente refrigeradores y congeladores para garantizar la vida útil (refrigeración 0-4°C, congelación ≤-18°C)', 'Cocina / Restaurante'),
      makeAction(6,'d', 'Registrar semanalmente los alimentos vencidos o dañados por referencia y las sobras de cliente, para ajustar pedidos con datos reales', 'Cocina / Restaurante'),
      makeAction(6,'e', 'Adaptar menús priorizando productos con caducidad inminente y comunicar a cocina el stock crítico con al menos 48h de antelación', 'Jefe Cocina'),
    ]
  },

  // ─── OE7: Convenio de donación ───────────────────────────────────────────
  {
    id: '7', codigo: 'OE7',
    descripcion: 'Establecer convenio de donación activo',
    indicador: 'Realizado / No realizado', lineaBase: 'NO',
    meta: 'Realizado', plazo: '2026-09-30', responsable: 'Dirección',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(7,'a', 'Identificar y contactar el banco de alimentos territorial (FESBAL) o entidad social autorizada más próxima a cada establecimiento INTELIER', 'Dirección / Sostenibilidad', '2026-06-30'),
      makeAction(7,'b', 'Formalizar alianza con banco de alimentos o entidad social para recogida periódica de excedentes aptos, con convenio firmado conforme al Art. 7 de la Ley 1/2025', 'Dirección / Sostenibilidad', '2026-09-30'),
      makeAction(7,'c', 'Activar protocolo de donación diaria de excedentes seguros con registro de kg donados por tipo de alimento y entidad receptora', 'Dirección / Sostenibilidad'),
      makeAction(7,'d', 'Formalizar acuerdos con organizaciones locales para recoger y distribuir alimentos sobrantes con protocolo documentado de transporte y conservación', 'Dirección / Sostenibilidad'),
    ]
  },

  // ─── OE8: Donar 100% excedentes aptos ────────────────────────────────────
  {
    id: '8', codigo: 'OE8',
    descripcion: 'Donar el 100% de excedentes aptos',
    indicador: '% excedentes aptos donados', lineaBase: '0%',
    meta: '100%', plazo: '2026-12-31', responsable: 'Resp. Donación',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(8,'a', 'Establecer frecuencia mínima de 2 recogidas semanales de donaciones con la entidad social autorizada, con horarios y persona de contacto definidos', 'Dirección / Sostenibilidad'),
      makeAction(8,'b', 'Definir protocolo de clasificación de excedentes aptos: criterios organolépticos, temperatura, contaminación cruzada y vida útil residual', 'Jefe Cocina'),
      makeAction(8,'c', 'Habilitar zona refrigerada específica (0-4°C) señalizada como "DONACIÓN" para conservar excedentes hasta la recogida', 'Jefe Cocina'),
      makeAction(8,'d', 'Etiquetar cada partida donada: producto, ingredientes, alérgenos, fecha de elaboración y condiciones de conservación, con firma de entrega', 'Jefe Cocina'),
    ]
  },

  // ─── OE9: Too Good To Go ─────────────────────────────────────────────────
  {
    id: '9', codigo: 'OE9',
    descripcion: 'Activar plataforma Too Good To Go',
    indicador: 'Realizado / No realizado', lineaBase: 'NO',
    meta: 'Realizado', plazo: '', responsable: 'F&B',
    estado: 'Pendiente', selected: false, trackingHistory: {},
    actions: []
  },

  // ─── OE10: Formación cocina ───────────────────────────────────────────────
  {
    id: '10', codigo: 'OE10',
    descripcion: 'Formación 100% personal cocina en PPDA',
    indicador: 'Fase 0-4 (% personal formado)', lineaBase: 'FASE 1 (formación manipulación completada)',
    meta: '100% personal formado en PPDA', plazo: '2026-12-31', responsable: 'RRHH',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(10,'a', 'La formación de manipulación básica ya está completada; ampliar con módulo PPDA específico (≥2h) sobre jerarquía de prioridades, medición y aprovechamiento', 'Calidad', '2026-09-30'),
      makeAction(10,'b', 'Activar curso de manipulación y almacenamiento avanzado para nuevos responsables por incorporación desde el primer día', 'Jefe Cocina'),
      makeAction(10,'c', 'Realizar auditoría mensual de residuos de cocina con el Jefe de Cocina para identificar qué se desperdicia, cuánto y por qué', 'Jefe Cocina'),
      makeAction(10,'d', 'Instaurar ruedas de mejora continua semanales con el equipo de cocina para revisar errores comunes y avances en reducción', 'Jefe Cocina'),
      makeAction(10,'e', 'Organizar el "Día Cero Residuos en Buffet" mensualmente como reto de máximo aprovechamiento con el equipo de cocina', 'Cocina / Sala'),
    ]
  },

  // ─── OE11: Formación sala ─────────────────────────────────────────────────
  {
    id: '11', codigo: 'OE11',
    descripcion: 'Formación 100% personal sala en PPDA',
    indicador: 'Fase 0-4 (% personal formado)', lineaBase: 'FASE 0 (0%)',
    meta: '100% personal formado', plazo: '2026-12-31', responsable: 'RRHH',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(11,'a', 'Instalar carteles con recordatorios visuales de buenas prácticas anti-desperdicio en todas las zonas de personal de sala de INTELIER', 'Calidad', '2026-06-30'),
      makeAction(11,'b', 'Impartir sesión anual de sensibilización al personal de sala sobre el impacto ambiental y económico del desperdicio alimentario en INTELIER', 'Equipo de Cocinas'),
      makeAction(11,'c', 'Publicar newsletter trimestral interna con métricas de avance en reducción de desperdicio y logros del equipo de INTELIER', 'Marketing'),
      makeAction(11,'d', 'Organizar concurso anual de recetas con sobras para estimular la creatividad del equipo y reforzar la cultura de aprovechamiento', 'Marketing'),
    ]
  },

  // ─── OE12: Sistemas de medición ──────────────────────────────────────────
  {
    id: '12', codigo: 'OE12',
    descripcion: 'Implementación de sistemas de medición del desperdicio por zonas de producción',
    indicador: 'Realizado / No realizado', lineaBase: 'NO',
    meta: 'Realizado', plazo: '2026-09-30', responsable: 'Calidad',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(12,'a', 'Implementar medición diaria de kg de comida desperdiciada por zona de producción: buffet, cocina, almacén, comedor de personal y sobras de cliente', 'Cocina', '2026-09-30'),
      makeAction(12,'b', 'Calcular mensualmente el coste del desperdicio (cantidad × precio medio del producto) para asignar el impacto económico directo en INTELIER', 'Cocina'),
      makeAction(12,'c', 'Medir el ratio de devolución de platos y el % de bandejas de buffet vacías al cierre del servicio para ajustar la producción', 'Restaurante'),
      makeAction(12,'d', 'Registrar la frecuencia de pedidos de emergencia semanal/mensual como indicador de diagnóstico de planificación deficiente', 'Cocina / Compras'),
      makeAction(12,'e', 'Activar canal interno de sugerencias sobre desperdicio (buzón físico o encuesta digital) entre el equipo de INTELIER', 'Calidad'),
    ]
  },

  // ─── OE13: Valorización orgánicos ────────────────────────────────────────
  {
    id: '13', codigo: 'OE13',
    descripcion: 'Tasa valorización residuos orgánicos',
    indicador: '% valorización orgánicos', lineaBase: 'kg valorizados/total orgánicos',
    meta: '≥ 70%', plazo: '2026-12-31', responsable: 'Medio Ambiente',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(13,'a', 'Evaluar e implementar sistema de compostaje para los residuos orgánicos de cocina en los establecimientos INTELIER, reduciendo el impacto ambiental del desperdicio', 'Mantenimiento / Gestión de Residuos'),
      makeAction(13,'b', 'Segregar en origen los residuos orgánicos no aptos para consumo (friegue) destinándolos a compostaje o gestor de residuos orgánicos autorizado (LER 20 01 08)', 'Friegue / Cocina'),
      makeAction(13,'c', 'Contratar gestor autorizado para fracción orgánica con destino compostaje o biogás, con justificantes de entrega y kg tratados', 'Medio Ambiente / Dirección'),
    ]
  },

  // ─── OE14: Envases llevar ────────────────────────────────────────────────
  {
    id: '14', codigo: 'OE14',
    descripcion: 'Ofrecer envases llevar al 100% clientes',
    indicador: 'Realizado / No realizado', lineaBase: 'Implantado solo en Restaurante',
    meta: 'Extendido a todos los servicios', plazo: '2026-09-30', responsable: 'Jefe Sala',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(14,'a', 'Extender la política de doggy bag (ya implantada en Restaurante) a todos los servicios y áreas de buffet de los hoteles INTELIER', 'Personal de Sala', '2026-06-30'),
      makeAction(14,'b', 'Instalar señalética visible en el buffet sobre la opción de llevarse la comida no consumida: "¿Te lo llevas? Pídenoslo"', 'Marketing / Sala'),
      makeAction(14,'c', 'Adquirir envases aptos para contacto alimentario (Reg. UE 10/2011), reutilizables o reciclables, sin plástico de un solo uso', 'Compras / Sala'),
      makeAction(14,'d', 'Registrar mensualmente el número de envases entregados para cuantificar el impacto de la medida en kg de desperdicio evitado', 'Sala / Calidad'),
    ]
  },

  // ─── OE15: Comedor personal ──────────────────────────────────────────────
  {
    id: '15', codigo: 'OE15',
    descripcion: 'Reducir desperdicio comedor personal',
    indicador: '% reducción comedor personal', lineaBase: 'kg/empleado/día actual',
    meta: '-20%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(15,'a', 'Destinar los excedentes del buffet y cocina aptos para consumo al comedor de personal de INTELIER como primera línea de aprovechamiento', 'Jefe Cocina'),
      makeAction(15,'b', 'Aplicar la guía de reutilización de sobras en el menú del comedor de personal: arroces, pastas, caldos, bollería y lácteos del mismo día', 'Jefe Cocina'),
      makeAction(15,'c', 'Instalar señalética en el comedor de personal: "Sírvete lo justo — puedes repetir" con información del desperdicio generado', 'Calidad'),
    ]
  },

  // ─── OE16: Gestión de compras ────────────────────────────────────────────
  {
    id: '16', codigo: 'OE16',
    descripcion: 'Optimizar gestión de compras y provisionamiento',
    indicador: '% desviación compras vs consumo', lineaBase: 'Desviación actual',
    meta: '< 10%', plazo: '2026-12-31', responsable: 'Compras',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(16,'a', 'Mantener y reforzar el sistema de compra basada en demanda real ya implantado, incorporando la proyección de ocupación del PMS para pedidos semanales/quincenales', 'Jefes de Cocina / Maître / Dirección'),
      makeAction(16,'b', 'Negociar el aumento de la frecuencia de entrega con proveedores clave (mínimo 2-3 veces/semana en frescos) para reducir el stock almacenado y el riesgo de caducidad', 'Compras / Jefe Cocina'),
      makeAction(16,'c', 'Establecer canales de comunicación fluidos entre proveedores, compras y cocina para ajustar calidades, cantidades, porciones y formatos en tiempos cortos', 'Director F&B', '2026-09-30'),
      makeAction(16,'d', 'Priorizar la compra de productos de temporada y alta rotación para minimizar el riesgo de caducidad y el coste de almacenamiento', 'Jefe Cocina'),
      makeAction(16,'e', 'Realizar informe mensual de rotación de stock: % caducidades sobre compras y análisis de las referencias problemáticas para ajuste de pedidos', 'Economato / Jefe Cocina'),
    ]
  },

  // ─── OE17: Carta/menús anti-desperdicio ──────────────────────────────────
  {
    id: '17', codigo: 'OE17',
    descripcion: 'Diseñar carta/menús orientados a reducción de desperdicio',
    indicador: 'Realizado / No realizado', lineaBase: 'NO',
    meta: 'Realizado', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(17,'a', 'Diseñar ciclo de menús con aprovechamiento transversal: los excedentes de un servicio se integran como base de las elaboraciones del servicio siguiente', 'Jefe Cocina'),
      makeAction(17,'b', 'Crear carta flexible semanal con sugerencias del día basadas en excedentes de calidad y productos próximos a caducar en INTELIER', 'Jefe Cocina'),
      makeAction(17,'c', 'Crear eventos temáticos "Día Cero Desperdicio" en los establecimientos INTELIER —comenzando por Rosella, Orange y Bonaire— con platos elaborados a partir de ingredientes sobrantes', 'Marketing / Cocina'),
      makeAction(17,'d', 'Incluir en menús al menos un plato de "cocina de aprovechamiento" por servicio usando partes no convencionales: tallos, pieles, recortes', 'Jefe Cocina'),
    ]
  },

  // ─── OE18: KPIs y cuadro de mando ────────────────────────────────────────
  {
    id: '18', codigo: 'OE18',
    descripcion: 'Establecer indicadores y cuadro de mando PPDA',
    indicador: 'Realizado / No realizado', lineaBase: 'Encuesta cliente completada',
    meta: 'Cuadro de mando activo', plazo: '2026-09-30', responsable: 'Calidad',
    estado: 'En curso', selected: true, trackingHistory: {},
    actions: [
      makeAction(18,'a', 'Implementar los KPIs identificados en el plan de monitoreo de INTELIER: kg/comensal, % recuperación de sobras, % caducidades en stock, ratio devolución de platos y % bandejas vacías al cierre', 'Cocina / Calidad', '2026-09-30'),
      makeAction(18,'b', 'Calcular mensualmente el coste del desperdicio y el % de alimentos comprados no utilizados como KPIs de gestión económica', 'Cocina'),
      makeAction(18,'c', 'Mantener e integrar en el cuadro de mando el indicador "% clientes que valoran el compromiso sostenible" ya implementado como KPI de percepción', 'Calidad'),
      makeAction(18,'d', 'Publicar dashboard mensual consolidado con evolución de KPIs, comparativa vs objetivos y semáforo de cumplimiento para INTELIER', 'Calidad / Marketing'),
    ]
  },

  // ─── OE19: Innovación en conservación ────────────────────────────────────
  {
    id: '19', codigo: 'OE19',
    descripcion: 'Innovación en conservación y vida útil de productos',
    indicador: 'Realizado / No realizado', lineaBase: 'NO',
    meta: 'Realizado', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(19,'a', 'Implementar el envasado al vacío en cocina, medida ya identificada por INTELIER, para alargar la vida útil de elaboraciones y reducir el desperdicio en almacén', 'Jefe Cocina', '2026-09-30'),
      makeAction(19,'b', 'Verificar el uso sistemático del abatidor de temperatura (centro del producto <3°C en <90 min) para todos los excedentes aptos de buffet y cocina', 'Jefe Cocina'),
      makeAction(19,'c', 'Desarrollar protocolo de congelación de excedentes: criterios de aptitud, método, etiquetado con fecha y plazo máximo, y registro de salida', 'Jefe Cocina'),
    ]
  },

  // ─── OE20: Economía circular ─────────────────────────────────────────────
  {
    id: '20', codigo: 'OE20',
    descripcion: 'Economía circular interna con subproductos',
    indicador: '% subproductos valorizados', lineaBase: '0 kg',
    meta: '≥ 30%', plazo: '2026-12-31', responsable: 'Jefe Cocina',
    estado: 'Pendiente', selected: true, trackingHistory: {},
    actions: [
      makeAction(20,'a', 'Aplicar la guía interna de reutilización de sobras de INTELIER: verduras cocidas → cremas/sopas/quiches; aves y carnes → empanadas/arroces; pescado → croquetas/brandada; pan duro → migas/pan rallado; fruta madura → compotas/smoothies', 'Jefe Cocina'),
      makeAction(20,'b', 'Producir caldos y fondos semanalmente con huesos, espinas, pieles y tallos conforme a protocolo APPCC, con ficha técnica y registro de kg valorizados', 'Jefe Cocina'),
      makeAction(20,'c', 'Reutilizar yogur, leche y nata en salsas, batidos o repostería en el mismo día; destinar el queso sobrante a gratinados, rellenos o salsas', 'Jefe Cocina'),
      makeAction(20,'d', 'Registrar semanalmente los kg de subproductos valorizados vs kg totales de mermas para calcular el indicador de circularidad interna', 'Jefe Cocina'),
    ]
  },
];

// ─── AppState completo INTELIER ──────────────────────────────────────────────

const INTELIER_STATE = {
  step: 9,
  scope: 'corporate',
  society: {
    razonSocial: 'INTELIER HOTELES, S.L.',
    cif: '',
    direccion: '',
    codigoPostal: '',
    municipio: '',
    provincia: ''
  },
  hotels: [
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Rosella',
      cif: '', categoria: '4 estrellas',
      direccion: 'Calle Tamarell, s/n', codigoPostal: '07560', municipio: 'Sa Coma (Sant Llorenç des Cardassar)', provincia: 'Illes Balears',
      numHabitaciones: 118, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Airén (Alcázar de San Juan)',
      cif: '', categoria: '4 estrellas',
      direccion: 'Av. de Herencia, s/n', codigoPostal: '13600', municipio: 'Alcázar de San Juan', provincia: 'Ciudad Real',
      numHabitaciones: 72, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Bonaire',
      cif: '', categoria: '4 estrellas',
      direccion: 'Av. Gimeno Tomás, 3', codigoPostal: '12560', municipio: 'Benicàssim', provincia: 'Castellón',
      numHabitaciones: 82, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Orange',
      cif: '', categoria: '4 estrellas',
      direccion: 'Av. Gimeno Tomás, 9', codigoPostal: '12560', municipio: 'Benicàssim', provincia: 'Castellón',
      numHabitaciones: 407, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Rosa (Castellón)',
      cif: '', categoria: '4 estrellas',
      direccion: 'C/ Herrero, 20', codigoPostal: '12002', municipio: 'Castellón de la Plana', provincia: 'Castellón',
      numHabitaciones: 118, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Palacio San Martín',
      cif: '', categoria: '4 estrellas',
      direccion: 'Plaza de San Martín, 5', codigoPostal: '28013', municipio: 'Madrid', provincia: 'Madrid',
      numHabitaciones: 94, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Villa Katalina',
      cif: '', categoria: '4 estrellas',
      direccion: 'C/ Hondarribia, 42', codigoPostal: '20006', municipio: 'Donostia-San Sebastián', provincia: 'Gipuzkoa',
      numHabitaciones: 34, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Casa de Indias',
      cif: '', categoria: '4 estrellas',
      direccion: 'Plaza de la Encarnación, 5-6', codigoPostal: '41003', municipio: 'Sevilla', provincia: 'Sevilla',
      numHabitaciones: 61, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Hotel Victoria',
      cif: '', categoria: '4 estrellas',
      direccion: 'C/ San Bartolomé, 13', codigoPostal: '20007', municipio: 'Donostia-San Sebastián', provincia: 'Gipuzkoa',
      numHabitaciones: 34, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
    {
      razonSocial: 'INTELIER HOTELES, S.L.',
      nombreComercial: 'Aquarama (Parque Acuático)',
      cif: '', categoria: 'Parque Acuático',
      direccion: '', codigoPostal: '12560', municipio: 'Benicàssim', provincia: 'Castellón',
      numHabitaciones: 0, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
      superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '', areas: []
    },
  ],
  hotelData: {
    razonSocial: 'INTELIER HOTELES, S.L.',
    nombreComercial: 'INTELIER HOTELES',
    cif: '', categoria: '', direccion: '', codigoPostal: '', municipio: '', provincia: '',
    numHabitaciones: 0, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0,
    superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: ''
  },
  areas: [],
  team: [
    { id: 'dir', departamento: 'Dirección', funcion: 'Aprobación y Revisión', nombre: '', cargo: 'Director/a', email: '', telefono: '' },
    { id: 'cal', departamento: 'Calidad/Medio Ambiente', funcion: 'Coordinación del Plan', nombre: '', cargo: 'Resp. Calidad', email: '', telefono: '' },
    { id: 'fb', departamento: 'F&B / Jefe Cocina', funcion: 'Responsable de Medición', nombre: '', cargo: 'Jefe/a de Cocina', email: '', telefono: '' },
    { id: 'com', departamento: 'Compras / Economato', funcion: 'Gestión de Compras', nombre: '', cargo: 'Resp. Compras', email: '', telefono: '' },
    { id: 'sala', departamento: 'Sala / Restaurante', funcion: 'Supervisión de Sala', nombre: '', cargo: 'Maître', email: '', telefono: '' },
    { id: 'mkt', departamento: 'Marketing', funcion: 'Comunicación Interna', nombre: '', cargo: 'Resp. Marketing', email: '', telefono: '' },
    { id: 'sos', departamento: 'Sostenibilidad / RSE', funcion: 'Gestión de Donaciones', nombre: '', cargo: 'Resp. Sostenibilidad', email: '', telefono: '' },
  ],
  diagnosisData: [],
  objectives: INTELIER_OBJECTIVES,
  measurementConfig: {
    kpis: [
      { id: 'kpi_1', nombre: 'Kg Desperdicio Totales', selected: true, frecuencia: 'Diaria', responsable: 'Jefe de Cocina', lineaBase: '' },
      { id: 'kpi_2', nombre: 'Kg Desperdicio / Comensal', selected: true, frecuencia: 'Mensual', responsable: 'F&B Manager', lineaBase: '' },
      { id: 'kpi_3', nombre: '% Desperdicio / Área generación', selected: true, frecuencia: 'Semanal', responsable: 'Jefe de Cocina', lineaBase: '' },
      { id: 'kpi_4', nombre: 'Coste mensual del desperdicio (€)', selected: true, frecuencia: 'Mensual', responsable: 'Cocina / F&B', lineaBase: '' },
      { id: 'kpi_5', nombre: '% Recuperación de sobras', selected: true, frecuencia: 'Mensual', responsable: 'Jefe de Cocina', lineaBase: '' },
      { id: 'kpi_6', nombre: 'Ratio devolución de platos', selected: true, frecuencia: 'Semanal', responsable: 'Restaurante', lineaBase: '' },
      { id: 'kpi_7', nombre: '% Bandejas vacías al cierre de buffet', selected: true, frecuencia: 'Semanal', responsable: 'Restaurante', lineaBase: '' },
      { id: 'kpi_8', nombre: '% Productos vencidos en stock', selected: true, frecuencia: 'Mensual', responsable: 'Cocina', lineaBase: '' },
      { id: 'kpi_9', nombre: '% Clientes que valoran el compromiso sostenible', selected: true, frecuencia: 'Trimestral', responsable: 'Calidad', lineaBase: '' },
    ],
    reporting: { frecuencia: 'Mensual', responsable: 'Responsable PPDA / Calidad' },
    annualReview: { frecuencia: 'Anual', responsable: 'Dirección INTELIER' }
  },
  baselineYear: '2025',
  periodoPlan: '2026-2028',
  objetivoGeneralReduccion: 30,
  fechaVisita: new Date().toISOString().split('T')[0],
  consultor: '',
  aiAdvice: null,
  isAiLoading: false,
  currentTrackingYear: 2026,
  lastModified: new Date().toISOString(),
  version: 'V1',
  planId: 'INTELIER-HOTELES-SL',
  originalHotelName: 'INTELIER HOTELES, S.L.'
};

// ─── BUILD DB ROW (replica buildPlanRow de planService.ts) ──────────────────

function buildPlanRow(state) {
  return {
    plan_id: state.planId,
    scope: 'corporate',
    hotel_name: state.society.razonSocial,
    razon_social: state.society.razonSocial,
    cif: state.society.cif || null,
    categoria: null,
    municipio: state.society.municipio || null,
    provincia: state.society.provincia || null,
    num_habitaciones: null,
    num_empleados: null,
    num_hoteles: state.hotels.length,
    version: 'V1',
    version_num: 1,
    baseline_year: state.baselineYear,
    periodo_plan: state.periodoPlan,
    fecha_visita: state.fechaVisita,
    consultor: state.consultor || null,
    objetivo_reduccion: state.objetivoGeneralReduccion,
    num_objetivos: state.objectives.filter(o => o.selected).length,
    estado: 'Activo',
    data: state,
    updated_at: new Date().toISOString(),
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 Autenticando en Supabase...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('❌ Error de autenticación:', authError.message);
    process.exit(1);
  }
  console.log('✅ Autenticado como:', authData.user.email);

  const row = buildPlanRow(INTELIER_STATE);
  const selectedObjs = INTELIER_STATE.objectives.filter(o => o.selected);
  const totalActions = selectedObjs.reduce((sum, o) => sum + o.actions.length, 0);

  console.log(`\n📋 Plan a crear:`);
  console.log(`   Cliente: ${row.hotel_name}`);
  console.log(`   Tipo: Corporativo (${row.num_hoteles} hoteles)`);
  console.log(`   Objetivos seleccionados: ${row.num_objetivos}`);
  console.log(`   Acciones personalizadas: ${totalActions}`);

  console.log('\n💾 Insertando en Supabase...');
  const { error } = await supabase.from('plans').upsert(row, { onConflict: 'plan_id' });

  if (error) {
    console.error('❌ Error al guardar:', error.message);
    process.exit(1);
  }

  console.log('✅ Plan de INTELIER HOTELES creado con éxito en la app PPDA.');
  console.log(`\n📊 Acciones por objetivo:`);
  selectedObjs.forEach(o => {
    console.log(`   ${o.codigo}: ${o.actions.length} acciones [${o.estado}]`);
  });

  await supabase.auth.signOut();
}

main().catch(console.error);
