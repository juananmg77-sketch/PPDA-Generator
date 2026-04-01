import { Objective, DiagnosisItem, MeasurementConfig } from './types';

// --- CONFIGURACIÓN DE CONEXIÓN ---
// ⚠️ IMPORTANTE: Crea una NUEVA Hoja de Google Sheets y un NUEVO Script con el código actualizado.
// No uses la URL anterior o podrías corromper los datos de la versión en producción.
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzTryeob4dxm_vKmM1aOmp8rk65xi7gDz1cQXQD1K1DlK52KzO3aTSuxZUeftwKLLQw/exec";

// --- CONFIGURACIÓN DE SEGURIDAD ---
// 1. Ve a https://console.cloud.google.com/
// 2. Crea credenciales OAuth 2.0 (Web Client)
// 3. Añade tu dominio a "Authorized JavaScript origins"
export const GOOGLE_CLIENT_ID = "695386207540-enmngfj6edl6da96neo6meji6jtlptnh.apps.googleusercontent.com"; 

// ----------------------------------

export const INITIAL_MEASUREMENT_CONFIG: MeasurementConfig = {
  kpis: [
    { id: 'kpi_1', nombre: 'Kg Desperdicio Totales', selected: true, frecuencia: 'Diaria', responsable: 'Jefe de Cocina', lineaBase: '' },
    { id: 'kpi_2', nombre: 'Kg Desperdicio / Estancia', selected: false, frecuencia: 'Mensual', responsable: 'Calidad', lineaBase: '' },
    { id: 'kpi_3', nombre: 'Kg Desperdicio / Área generación', selected: true, frecuencia: 'Semanal', responsable: 'Jefe de Cocina', lineaBase: '' },
    { id: 'kpi_4', nombre: 'Kg Desperdicio / Comensal', selected: true, frecuencia: 'Mensual', responsable: 'F&B Manager', lineaBase: '' },
  ],
  reporting: {
    frecuencia: 'Trimestral',
    responsable: 'Comité de Sostenibilidad'
  },
  annualReview: {
    frecuencia: 'Anual',
    responsable: 'Dirección'
  }
};

export const INITIAL_DIAGNOSIS: DiagnosisItem[] = [
  // 0. DIRECCIÓN Y ESTRATEGIA
  { id: 'd00_1', etapa: 'DIRECCIÓN Y ESTRATEGIA', tipoDesperdicio: 'ESTRATÉGICO', elemento: 'Establecimiento de convenios de donación con entidades sociales', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd00_2', etapa: 'DIRECCIÓN Y ESTRATEGIA', tipoDesperdicio: 'ESTRATÉGICO', elemento: 'Alineamiento de la reducción de desperdicio con el sistema APPCC', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd00_3', etapa: 'DIRECCIÓN Y ESTRATEGIA', tipoDesperdicio: 'ESTRATÉGICO', elemento: 'Designación de responsable interno PPDA', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd00_4', etapa: 'DIRECCIÓN Y ESTRATEGIA', tipoDesperdicio: 'ESTRATÉGICO', elemento: 'Existencia de política documentada anti-desperdicio', genera: false, nivel: '', causa: '', prioridad: '' },

  // 1. COMPRAS Y ALMACENAMIENTO
  { id: 'd1', etapa: 'COMPRAS Y ALMACENAMIENTO', tipoDesperdicio: 'DETERIORO', elemento: 'Productos caducados o próximos a caducidad sin rotación', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd2', etapa: 'COMPRAS Y ALMACENAMIENTO', tipoDesperdicio: 'DETERIORO', elemento: 'Alimentos deteriorados por condiciones inadecuadas de almacenamiento', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd3', etapa: 'COMPRAS Y ALMACENAMIENTO', tipoDesperdicio: 'DETERIORO', elemento: 'Exceso de stock por falta de planificación de compras', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd4', etapa: 'COMPRAS Y ALMACENAMIENTO', tipoDesperdicio: 'DETERIORO', elemento: 'Productos rechazados en recepción de mercancías', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd5', etapa: 'COMPRAS Y ALMACENAMIENTO', tipoDesperdicio: 'DETERIORO', elemento: 'Falta de aplicación sistema FIFO/FEFO', genera: false, nivel: '', causa: '', prioridad: '' },
  
  // 2. PREPARACIÓN
  { id: 'd6', etapa: 'PREPARACIÓN', tipoDesperdicio: 'ELABORACIÓN', elemento: 'Mermas de pelado, corte y preparación excesivas', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd7', etapa: 'PREPARACIÓN', tipoDesperdicio: 'ELABORACIÓN', elemento: 'Partes comestibles desechadas (hojas, pieles, tallos aprovechables)', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd8', etapa: 'PREPARACIÓN', tipoDesperdicio: 'ELABORACIÓN', elemento: 'Errores de cocción o preparación (quemados, contaminados)', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd9', etapa: 'PREPARACIÓN', tipoDesperdicio: 'ELABORACIÓN', elemento: 'Restos de mise en place no utilizados al final del servicio', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd10', etapa: 'PREPARACIÓN', tipoDesperdicio: 'ELABORACIÓN', elemento: 'Elaboraciones incorrectas por falta de formación', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd10_1', etapa: 'PREPARACIÓN', tipoDesperdicio: 'PRODUCCIÓN', elemento: 'Falta de estandarización de recetas y gramajes', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd10_2', etapa: 'PREPARACIÓN', tipoDesperdicio: 'PRODUCCIÓN', elemento: 'Ausencia de aprovechamiento de subproductos (caldos, fondos)', genera: false, nivel: '', causa: '', prioridad: '' },
  
  // 3. SERVICIO ALIMENTOS
  { id: 'd11', etapa: 'SERVICIO ALIMENTOS', tipoDesperdicio: 'PLATO CLIENTE', elemento: 'Restos de comida devueltos en platos (raciones excesivas)', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd13', etapa: 'SERVICIO ALIMENTOS', tipoDesperdicio: 'PLATO CLIENTE', elemento: 'Pan y guarniciones servidas por defecto no consumidas', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd14', etapa: 'SERVICIO ALIMENTOS', tipoDesperdicio: 'PLATO CLIENTE', elemento: 'Productos de room service devueltos sin consumir', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd14_1', etapa: 'SERVICIO ALIMENTOS', tipoDesperdicio: 'SERVICIO', elemento: 'Falta de opciones de raciones variables (media/completa)', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd14_2', etapa: 'SERVICIO ALIMENTOS', tipoDesperdicio: 'SERVICIO', elemento: 'Ausencia de política llevar a casa (Doggy bag)', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  
  // 4. FIN SERVICIO / BUFFET
  { id: 'd15', etapa: 'FIN SERVICIO / BUFFET', tipoDesperdicio: 'EXCEDENTE', elemento: 'Producto de buffet expuesto y no consumido', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd16', etapa: 'FIN SERVICIO / BUFFET', tipoDesperdicio: 'EXCEDENTE', elemento: 'Excedente de buffet no expuesto (bandejas reserva)', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd18', etapa: 'FIN SERVICIO / BUFFET', tipoDesperdicio: 'EXCEDENTE', elemento: 'Exceso de productos del showcooking / estaciones en vivo', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd19', etapa: 'FIN SERVICIO / BUFFET', tipoDesperdicio: 'EXCEDENTE', elemento: 'Producto de snack bar no vendido', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd19_1', etapa: 'FIN SERVICIO / BUFFET', tipoDesperdicio: 'OPERATIVO', elemento: 'Falta de producción escalonada durante servicio', genera: false, nivel: '', causa: '', prioridad: '' },

  // 5. MEDICIÓN Y CONTROL
  { id: 'd20', etapa: 'MEDICIÓN Y CONTROL', tipoDesperdicio: 'SISTEMÁTICO', elemento: 'Sistema de pesaje y registro de desperdicio por origen', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd21', etapa: 'MEDICIÓN Y CONTROL', tipoDesperdicio: 'SISTEMÁTICO', elemento: 'Registro de kg donados y valorizados', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd22', etapa: 'MEDICIÓN Y CONTROL', tipoDesperdicio: 'ANÁLISIS', elemento: 'Indicadores de seguimiento (kg/comensal, %desperdicio/compra)', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd23', etapa: 'MEDICIÓN Y CONTROL', tipoDesperdicio: 'CALIDAD', elemento: 'Auditorías periódicas del sistema', genera: false, nivel: '', causa: '', prioridad: '' },

  // 6. FORMACIÓN Y SENSIBILIZACIÓN
  { id: 'd24', etapa: 'FORMACIÓN Y SENSIBILIZACIÓN', tipoDesperdicio: 'CULTURAL', elemento: 'Formación específica personal cocina en PPDA', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd25', etapa: 'FORMACIÓN Y SENSIBILIZACIÓN', tipoDesperdicio: 'CULTURAL', elemento: 'Formación específica personal sala en PPDA', genera: false, nivel: 'Alto', causa: '', prioridad: '1', isMandatory: true },
  { id: 'd26', etapa: 'FORMACIÓN Y SENSIBILIZACIÓN', tipoDesperdicio: 'COMUNICACIÓN', elemento: 'Campañas de sensibilización clientes', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd27', etapa: 'FORMACIÓN Y SENSIBILIZACIÓN', tipoDesperdicio: 'COMUNICACIÓN', elemento: 'Comunicación interna de resultados', genera: false, nivel: '', causa: '', prioridad: '' },

  // 7. VALORIZACIÓN
  { id: 'd28', etapa: 'VALORIZACIÓN', tipoDesperdicio: 'MEDIOAMBIENTAL', elemento: 'Contrato con gestor autorizado fracción orgánica', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd29', etapa: 'VALORIZACIÓN', tipoDesperdicio: 'MEDIOAMBIENTAL', elemento: 'Compostaje in-situ', genera: false, nivel: '', causa: '', prioridad: '' },
  { id: 'd30', etapa: 'VALORIZACIÓN', tipoDesperdicio: 'REDISTRIBUCIÓN', elemento: 'Uso de plataformas redistribución (Too Good To Go)', genera: false, nivel: '', causa: '', prioridad: '' },
];

export const INITIAL_OBJECTIVES: Objective[] = [
  { id: '1', codigo: 'OE1', descripcion: 'Reducir desperdicio en buffet de desayunos', indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual', meta: '-20%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '2', codigo: 'OE2', descripcion: 'Reducir desperdicio en buffet de almuerzos', indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual', meta: '-20%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '3', codigo: 'OE3', descripcion: 'Reducir desperdicio en buffet de cenas', indicador: '% reducción vs línea base', lineaBase: 'kg desperdicio/servicio actual', meta: '-20%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '4', codigo: 'OE4', descripcion: 'Reducir desperdicio en platos de clientes', indicador: '% reducción vs línea base', lineaBase: 'kg devoluciones/total emplatado', meta: '-15%', plazo: '', responsable: 'Jefe Sala', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '5', codigo: 'OE5', descripcion: 'Reducir desperdicio en cocina (elaboración)', indicador: '% reducción mermas elaboración', lineaBase: 'kg mermas/total materia prima', meta: '-15%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '6', codigo: 'OE6', descripcion: 'Reducir desperdicio en almacén (caducidades)', indicador: '% caducidades sobre compras', lineaBase: 'kg caducidades/total compras', meta: '< 2%', plazo: '', responsable: 'Economato', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '7', codigo: 'OE7', descripcion: 'Establecer convenio de donación activo', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Dirección', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '8', codigo: 'OE8', descripcion: 'Donar el 100% de excedentes aptos', indicador: '% excedentes aptos donados', lineaBase: '0%', meta: '100%', plazo: '', responsable: 'Resp. Donación', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '9', codigo: 'OE9', descripcion: 'Activar plataforma Too Good To Go', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'F&B', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '10', codigo: 'OE10', descripcion: 'Formación 100% personal cocina en PPDA', indicador: 'Fase 0-4 (% personal formado)', lineaBase: 'FASE 0 (0%)', meta: '100% personal formado', plazo: '', responsable: 'RRHH', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '11', codigo: 'OE11', descripcion: 'Formación 100% personal sala en PPDA', indicador: 'Fase 0-4 (% personal formado)', lineaBase: 'FASE 0 (0%)', meta: '100% personal formado', plazo: '', responsable: 'RRHH', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '12', codigo: 'OE12', descripcion: 'Implementación de sistemas de medición del desperdicio por zonas de producción', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Calidad', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '13', codigo: 'OE13', descripcion: 'Tasa valorización residuos orgánicos', indicador: '% valorización orgánicos', lineaBase: 'kg valorizados/total orgánicos', meta: '≥ 70%', plazo: '', responsable: 'Medio Ambiente', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '14', codigo: 'OE14', descripcion: 'Ofrecer envases llevar al 100% clientes', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Jefe Sala', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '15', codigo: 'OE15', descripcion: 'Reducir desperdicio comedor personal', indicador: '% reducción comedor personal', lineaBase: 'kg/empleado/día actual', meta: '-20%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '16', codigo: 'OE16', descripcion: 'Optimizar gestión de compras y provisionamiento', indicador: '% desviación compras vs consumo', lineaBase: 'Desviación actual', meta: '< 10%', plazo: '', responsable: 'Compras', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '17', codigo: 'OE17', descripcion: 'Diseñar carta/menús orientados a reducción de desperdicio', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '18', codigo: 'OE18', descripcion: 'Establecer indicadores y cuadro de mando PPDA', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Calidad', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '19', codigo: 'OE19', descripcion: 'Innovación en conservación y vida útil de productos', indicador: 'Realizado / No realizado', lineaBase: 'NO', meta: 'Realizado', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
  { id: '20', codigo: 'OE20', descripcion: 'Economía circular interna con subproductos', indicador: '% subproductos valorizados', lineaBase: '0 kg', meta: '≥ 30%', plazo: '', responsable: 'Jefe Cocina', estado: 'Pendiente', actions: [], selected: false, trackingHistory: {} },
];

export const INITIAL_DEPARTMENTS = [
  { id: 'dir', departamento: 'Dirección', funcion: 'Aprobación y Revisión', nombre: '', cargo: '', email: '', telefono: '' },
  { id: 'cal', departamento: 'Calidad/Medio Ambiente', funcion: 'Coordinación del Plan', nombre: '', cargo: '', email: '', telefono: '' },
  { id: 'fb', departamento: 'F&B / Jefe Cocina', funcion: 'Responsable de Medición', nombre: '', cargo: '', email: '', telefono: '' },
  { id: 'com', departamento: 'Compras / Economato', funcion: 'Gestión de Compras', nombre: '', cargo: '', email: '', telefono: '' },
  { id: 'sala', departamento: 'Sala / Restaurante', funcion: 'Supervisión de Sala', nombre: '', cargo: '', email: '', telefono: '' },
];

export const COMMON_PPDA_FUNCTIONS = [
  "Coordinación del Plan",
  "Responsable de Medición",
  "Gestión de Donaciones",
  "Formación y Sensibilización",
  "Supervisión de Cocina",
  "Supervisión de Sala",
  "Gestión de Compras",
  "Comunicación Interna",
  "Aprobación y Revisión",
  "Otro"
];

export const OBJECTIVE_ACTIONS: Record<string, string[]> = {
  '1': [
    "Producción escalonada: preparar 60% al inicio, reponer en tandas de 30-40% cada 20 min según afluencia",
    "Sustituir bandejas GN 1/1 por GN 1/2 o 1/3 en la última hora de servicio",
    "Instalar cartelería en cada estación: «Puede repetir — sírvase lo justo»",
    "Registro diario de excedentes por categoría (panadería, fruta, proteínas, lácteos) con báscula calibrada",
    "Formación práctica al personal de desayunos en reposición just-in-time con evaluación"
  ],
  '2': [
    "Previsión de comensales cruzando PMS + reservas + histórico semanal",
    "Ciclo de menús rotativo (mín. 14 días) con aprovechamiento cruzado de ingredientes entre días",
    "Protocolo escrito de segundos usos para excedentes aptos (sopas, croquetas, ensaladas) con registro de kg",
    "Control de temperatura diferenciado por zonas del buffet (caliente >65°C, frío <8°C) con termómetros visibles",
    "Fotografía estandarizada pre/post cierre de buffet para correlacionar con datos de pesaje"
  ],
  '3': [
    "Ajustar producción al ratio comensales reales de las últimas 4 semanas con factor corrector día/temporada",
    "No reposición completa los últimos 45 min; ofrecer al cliente que solicite su preferencia directamente",
    "Señalética positiva: «Puede repetir las veces que desee» para reducir servirse en exceso",
    "Estaciones de show-cooking para producir bajo demanda en tiempo real",
    "Conservación refrigerada inmediata (abatimiento <3°C en <90 min) de excedentes no expuestos aptos"
  ],
  '4': [
    "Ofrecer media ración o ración reducida en carta con precio ajustado y gramaje indicado",
    "Incluir en carta gramaje orientativo, ingredientes principales y alérgenos (Reg. UE 1169/2011)",
    "Sistema de feedback de raciones: tarjeta o QR con pregunta «¿La ración fue adecuada?»",
    "Formación semestral a sala en recomendación de raciones y ofrecimiento de compartir platos",
    "Disponer de envases aptos (reutilizables/reciclables) y ofrecer activamente el take-away (Art. 8)"
  ],
  '5': [
    "Estandarizar 100% recetas con ficha técnica: gramajes, rendimiento esperado y merma prevista",
    "Técnicas de aprovechamiento integral: fondos, caldos, chips de piel, brunoise de tallos — recetario interno",
    "Registro de mermas por partida/turno vinculado al APPCC (producto, causa, peso)",
    "Revisión quincenal de históricos de mermas para ajustar volúmenes de pedido y producción",
    "Batch cooking y cook & chill para productos de alta rotación, reduciendo preparación excesiva"
  ],
  '6': [
    "Sistema FIFO/FEFO con etiquetado obligatorio de fecha entrada y caducidad en recepción",
    "Revisión semanal de caducidades con alerta a 7 días (etiqueta roja) y comunicación a cocina",
    "Adaptar menús priorizando productos con caducidad inminente, documentando la decisión",
    "Registro de temperaturas de cámaras 2 veces/día (refrigeración 0-4°C, congelación ≤-18°C)",
    "Informe mensual de rotación de stock: % caducidades sobre compras y análisis de referencias problemáticas"
  ],
  '7': [
    "Contactar banco de alimentos territorial (FESBAL) o entidad social autorizada más próxima",
    "Formalizar convenio con contenido mínimo Art. 7: recogida, transporte, almacenamiento, compromisos",
    "Protocolo interno de segregación, conservación (≤4°C) y etiquetado con alérgenos para donación",
    "Registro de donaciones: fecha, tipo alimento, kg, lote, entidad receptora, firma de entrega",
    "Solicitar certificado de donación a la entidad receptora para desgravación fiscal y evidencia"
  ],
  '8': [
    "Procedimiento de evaluación de aptitud: criterios organolépticos, Tª, contaminación cruzada, vida útil",
    "Zona refrigerada específica (0-4°C) señalizada «DONACIÓN» para conservar hasta recogida",
    "Frecuencia mínima de 2 recogidas/semana con horarios y persona de contacto definidos",
    "Etiquetado de cada partida donada: producto, ingredientes, alérgenos, fecha elaboración, conservación",
    "Documento de entrega por donación: descripción, kg, fecha, lote, firma donante y receptor"
  ],
  '9': [
    "Alta del establecimiento en plataforma de redistribución (TGTG, Phenix u otra local)",
    "Definir franjas horarias de recogida compatibles con operativa (post-almuerzo, post-cena)",
    "Protocolo de preparación de packs: selección, verificación Tª, envasado seguro, etiquetado alérgenos",
    "Formar a mín. 2 personas en el procedimiento operativo de la plataforma",
    "Registro mensual de kg redistribuidos y equivalente CO₂ evitado"
  ],
  '10': [
    "Programa formativo anual (mín. 2h): jerarquía de prioridades, medición, aprovechamiento integral",
    "Impartir formación inicial a todo el personal de cocina antes del 3 de abril de 2026",
    "Evaluación de conocimientos con test escrito/práctico y registro firmado por trabajador",
    "Sesión de actualización anual con resultados PPDA del año anterior y cambios normativos",
    "Designación formal del responsable PPDA (Champion) con nombramiento escrito y funciones definidas"
  ],
  '11': [
    "Módulo formativo específico sala (mín. 1,5h): comunicación raciones, take-away, devoluciones",
    "Role-playing práctico: simulación de situaciones con cliente (ración grande, alergia, media ración)",
    "Protocolo escrito de actuación ante excedentes en platos: ofrecer envase, preguntar satisfacción",
    "Formar al personal en la política de donación y reducción del establecimiento",
    "Certificado interno de competencia con registro nominal, fecha y contenidos"
  ],
  '12': [
    "Contenedores diferenciados y señalizados por zona: desayuno, almuerzo, cena, cocina, almacén, personal, cliente",
    "Báscula en cada punto de medición con registro rutinario (kg, hora, responsable y ratios de ocupación)",
    "Categorización de cada pesaje por origen: mermas, sobreproducción, buffet, devolución cliente, caducidad",
    "Sistema de registro digital (app/Excel/Effiwaste o HSAPP) con trazabilidad e informes automáticos",
    "Informe mensual: tendencias, comparativa servicios, ratio g/comensal, puntos críticos y acciones correctoras"
  ],
  '13': [
    "Contrato con gestor autorizado para fracción orgánica (LER 20 01 08) con destino compostaje/biogás",
    "Contenedor específico señalizado para orgánico en cocina y zona de residuos",
    "Justificantes de entrega al gestor: fecha, kg, destino final, nº autorización",
    "Cálculo mensual tasa de valorización: (kg valorizados / kg orgánicos totales) × 100, objetivo ≥70%",
    "Evaluación trimestral de viabilidad de compostaje in situ para fracción verde"
  ],
  '14': [
    "Adquirir envases aptos contacto alimentario (Reg. UE 10/2011), reutilizables o reciclables, sin plástico un solo uso",
    "Mención visible en carta y señalética en comedor: «Puede llevarse lo no consumido — solicítelo»",
    "Protocolo de envasado seguro: cadena frío/calor, cierre hermético, etiqueta con fecha y conservación",
    "Formar a sala para ofrecer activamente el envase al retirar platos con sobras",
    "Registro mensual de envases entregados para cuantificar impacto"
  ],
  '15': [
    "Autoservicio con gramajes visibles: cucharones estandarizados e indicación de gramos por ración",
    "Permitir repetir en lugar de ración completa inicial con señalética «Sírvase lo justo — puede repetir»",
    "Encuesta trimestral anónima al personal sobre cantidades, variedad y calidad del menú",
    "Contenedor de medición específico para residuos de comedor de personal con pesaje diario",
    "Campaña interna de sensibilización con cartelería y datos mensuales de desperdicio"
  ],
  '16': [
    "Análisis de 12 meses de consumo real vs comprado, identificando las 10 referencias con mayor desviación",
    "Compra basada en previsión de ocupación semanal (PMS) con revisión de pedidos cada lunes",
    "Negociar entregas fraccionadas con proveedores (mín. 2-3/semana en frescos) para reducir stock",
    "Especificaciones de compra con formatos adaptados: calibres, pesos unitarios, envasado que minimice merma",
    "Revisión trimestral de proveedores: calidad, formatos, vida útil residual y tasa de rechazos"
  ],
  '17': [
    "Menús con aprovechamiento transversal: un mismo ingrediente base en 3+ elaboraciones del ciclo",
    "Platos de «cocina de aprovechamiento» con partes no convencionales (tallos, pieles, recortes)",
    "Priorizar producto de temporada y km 0 en mín. 30% de las referencias de carta",
    "Eliminar referencias con rotación <5% de ventas en los últimos 3 meses",
    "Carta dinámica con «sugerencias del día» basadas en excedentes de calidad y producto próximo a caducidad"
  ],
  '18': [
    "KPI principal: g desperdicio/comensal/día con objetivo progresivo hacia <150 g (referencia MAPA)",
    "Ratio mensual desperdicio/compras: (kg desperdicio / kg comprado) × 100, objetivo <10%",
    "Porcentaje de excedentes aptos donados vs generados, objetivo 100%",
    "Tasa de valorización orgánica mensual, objetivo ≥70% (Directiva 2018/851)",
    "Dashboard mensual consolidado con evolución KPIs, comparativa vs objetivos y semáforo de cumplimiento"
  ],
  '19': [
    "Evaluar implantación de envasado al vacío/MAP para elaboraciones con alta generación de excedentes",
    "Verificar uso sistemático del abatidor (centro producto <3°C en <90 min) para excedentes aptos",
    "Estudio de vida útil (shelf life/challenge test) de las 5 elaboraciones propias de mayor volumen",
    "Protocolo de congelación de excedentes: criterios aptitud, método, etiquetado, plazo y registro de salida",
    "Formación específica (mín. 2h) en conservación avanzada: sous-vide, deshidratación, fermentación"
  ],
  '20': [
    "Recetario interno de aprovechamiento: caldos con huesos/recortes, fumet con espinas, chips de piel, infusiones cítricos",
    "Pan duro destinado a elaboraciones documentadas: pan rallado, picatostes, pudding, torrijas, migas",
    "Producción semanal programada de fondos y fumets con huesos y espinas, con ficha APPCC",
    "Valorización de pieles de cítricos: aromatización, mermeladas, ralladura, confituras",
    "Registro semanal de kg subproductos valorizados vs kg totales de mermas (indicador de circularidad)"
  ]
};