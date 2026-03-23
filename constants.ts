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
    "Implementar sistema de producción escalonada durante el servicio (Ley 7/2022)",
    "Reducir tamaño de bandejas/recipientes en línea de buffet",
    "Instalar señalización visual sobre cantidades recomendadas por persona",
    "Registro diario de mermas por categoría de producto",
    "Formación personal en control de reposición just-in-time"
  ],
  '2': [
    "Sistema de reserva previa para estimar comensales (±10%)",
    "Producción basada en histórico de consumo por día/temporada",
    "Rotación de menús para optimizar aprovechamiento de ingredientes",
    "Control de temperatura diferenciado por zonas del buffet",
    "Planificación de segundos usos para excedentes aptos"
  ],
  '3': [
    "Ajuste de cantidades según ratio ocupación/comensales reales",
    "Sistema de reposición controlada (no completar bandejas hasta vacío)",
    "Señalética sobre repetición permitida (\"puede volver las veces que desee\")",
    "Monitorización fotográfica pre/post servicio para análisis",
    "Protocolo de conservación refrigerada para excedentes aptos día siguiente"
  ],
  '4': [
    "Ofrecer opción de medio plato o plato reducido en carta",
    "Información visible sobre ingredientes/composición del plato",
    "Sistema de feedback sobre raciones (muy grande/adecuada/pequeña)",
    "Posibilidad de modificar guarniciones a petición del cliente",
    "Envases para llevar excedentes cumpliendo Reglamento (UE) 852/2004"
  ],
  '5': [
    "Planificación de menús cíclicos con aprovechamiento cruzado",
    "Estandarización de recetas con gramajes exactos",
    "Formación en técnicas de aprovechamiento integral (fondos, caldos, etc.)",
    "Control de mermas por operario/turno según APPCC",
    "Revisión quincenal de históricos para ajustar producciones"
  ],
  '6': [
    "Implantación estricta FIFO con etiquetado fecha entrada",
    "Revisión semanal de próximas caducidades (alerta ≤7 días)",
    "Planificación de menús priorizando productos cercanos a vencimiento",
    "Control de temperaturas según categorías (RD 3484/2000)",
    "Auditoría mensual de rotación de stock con KPI de caducidades"
  ],
  '7': [
    "Identificar banco de alimentos local certificado (FESBAL u homólogo)",
    "Protocolo documentado según Ley 7/2022 Art. 6 (trazabilidad donaciones)",
    "Formación personal en segregación y conservación para donación",
    "Registro de donaciones con kg/tipo de alimento/fecha (obligatorio)",
    "Certificado de donación para desgravación fiscal Art. 27.3 Ley 7/2022"
  ],
  '8': [
    "Procedimiento de evaluación de aptitud según criterios AESAN",
    "Sistema de conservación adecuado hasta recogida (≤4°C perecederos)",
    "Coordinación logística con frecuencia definida (mínimo 2 recogidas/semana)",
    "Etiquetado identificativo según RD 1801/2008 (alérgenos incluidos)",
    "Documento de entrega con descripción, cantidad y fecha de consumo preferente"
  ],
  '9': [
    "Alta en plataforma y configuración de perfil del establecimiento",
    "Definición de franjas horarias de recogida adaptadas a operativa",
    "Formación personal en preparación de \"magic boxes\"",
    "Protocolo de seguridad alimentaria para productos comercializados (temperatura, etiquetado)",
    "Medición mensual de kg salvados y equivalente CO₂"
  ],
  '10': [
    "Programa formativo según Ley 7/2022 Art. 8 (mínimo 2h anuales)",
    "Contenidos: jerarquía desperdicio, medición, técnicas de reducción",
    "Evaluación de conocimientos adquiridos (registro obligatorio)",
    "Actualización anual con nuevas técnicas y normativa",
    "Designación de responsable interno PPDA"
  ],
  '11': [
    "Formación específica en comunicación con cliente sobre raciones",
    "Técnicas de servicio para minimizar devoluciones",
    "Protocolo de actuación ante excedentes en platos",
    "Conocimiento de política de donación y reducción del establecimiento",
    "Evaluación y certificado interno de competencia"
  ],
  '12': [
    "Instalación de contenedores de medición diferenciados (desayuno/almuerzo/cena/cocina/almacén)",
    "Registro diario con báscula calibrada (kg por fracción)",
    "Categorización según origen: preparación/servicio/devoluciones clientes",
    "Software de registro conforme Art. 4 Ley 7/2022 (medición obligatoria)",
    "Informe mensual con análisis de tendencias y puntos críticos"
  ],
  '13': [
    "Contrato con gestor autorizado para fracción orgánica (código LER 20 01 08)",
    "Segregación en origen con contenedor específico señalizado",
    "Justificante de entrega a gestor con kg y destino (compostaje/biogás)",
    "Cálculo de tasa de valorización: (kg valorizados/kg totales)×100",
    "Objetivo: ≥70% según Directiva (UE) 2018/851"
  ],
  '14': [
    "Adquisición de envases aptos para contacto alimentario (Reglamento UE 10/2011)",
    "Señalización visible en carta y establecimiento",
    "Protocolo de envasado garantizando seguridad alimentaria (temperatura, cierre)",
    "Información sobre conservación y consumo en domicilio",
    "Registro de servicios con \"take away\" para medición de impacto"
  ],
  '15': [
    "Sistema de autoservicio con gramajes visibles y controlados",
    "Posibilidad de repetir en lugar de servir ración completa inicial",
    "Encuesta de satisfacción sobre cantidades servidas",
    "Segregación específica de residuos comedor personal para medición",
    "Campaña de sensibilización interna sobre impacto desperdicio"
  ],
  '16': [
    "Análisis histórico de consumo real vs. comprado (últimos 12 meses)",
    "Implementación de sistema de compra basada en previsión de ocupación",
    "Negociación con proveedores de entregas fraccionadas (reducir stock)",
    "Especificaciones de compra con formatos adaptados a necesidades reales",
    "Revisión trimestral de proveedores según calidad/formato/vida útil productos"
  ],
  '17': [
    "Menús con aprovechamiento transversal de ingredientes base",
    "Incorporación de platos que utilicen partes \"nobles\" no convencionales",
    "Ajuste de oferta según temporada y disponibilidad local (km0)",
    "Eliminación de referencias con bajo índice de rotación (ventas <5%)",
    "Carta dinámica con sugerencias según excedentes de calidad"
  ],
  '18': [
    "KPI principal: kg desperdicio/comensal/día (objetivo <150g según MAPA)",
    "Ratio desperdicio/kg alimento comprado (objetivo <10%)",
    "% excedentes aptos donados (objetivo 100%)",
    "Tasa valorización residuos orgánicos (objetivo ≥70%)",
    "Dashboard mensual con evolución y comparativa vs. objetivos"
  ],
  '19': [
    "Evaluación de tecnologías de envasado al vacío/atmósfera protectora",
    "Abatidor rápido de temperatura para optimizar conservación",
    "Estudio de vida útil real de elaboraciones propias (challenge test)",
    "Protocolo de congelación de excedentes aptos para uso posterior",
    "Formación en técnicas de conservación avanzadas (sous-vide, deshidratación)"
  ],
  '20': [
    "Aprovechamiento de recortes vegetales para elaboración caldos/fondos",
    "Pieles cítricos para elaboraciones (infusiones, aromatizantes)",
    "Huesos y espinas para fumet/consomés",
    "Pan duro para ralladura, picatostes, puddings",
    "Registro de kg subproductos valorizados internamente"
  ]
};