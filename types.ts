

export interface HotelData {
  razonSocial: string;
  nombreComercial: string;
  cif: string;
  categoria: string;
  direccion: string;
  codigoPostal: string;
  municipio: string;
  provincia: string;
  numHabitaciones: number;
  capacidadMax: number;
  numEmpleados: number;
  numEmpleadosFB: number;
  superficieRestauracion: number;
  logo: string; // Base64 string del logo
  hasDonationProtocol: boolean; // Nuevo: Dispone de protocolo
  donationProtocolFile: string; // Nuevo: Archivo adjunto (imagen base64)
  areas?: Area[]; // Nuevo: Zonas específicas por hotel (para corporativo)
}

export interface Area {
  id: string;
  nombre: string;
  superficie: number;
  capacidad: number;
  numServiciosDia: number; // Nuevo campo: Servicios medios por día
  tipoServicio: string;
  esBuffet: boolean;
  horarios: string;
  tienePuntoPesaje?: boolean;
  tipoSistemaPesaje?: string;
}

export interface TeamMember {
  id: string;
  departamento: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  funcion: string;
}

export interface QuarterData {
  cumple: boolean;
  evidencia: string;
}

export interface AnnualTracking {
  year: number;
  isClosed: boolean;
  globalProgress: number; 
  globalNotes: string;    
  lastUpdate?: string; 
  updateSummary?: string; 
  actions: Record<string, { 
    t1: QuarterData;
    t2: QuarterData;
    t3: QuarterData;
    t4: QuarterData;
    notes: string;
    status?: 'open' | 't1' | 't2' | 't3' | 't4'; // Nuevo campo: Estado de finalización
  }>;
}

export interface SpecificAction {
  id: string;
  codigo: string; 
  descripcion: string;
  responsable: string;
  plazo: string; 
}

export interface Objective {
  id: string;
  codigo: string;
  descripcion: string;
  indicador: string;
  lineaBase: string; 
  meta: string; 
  plazo: string; 
  responsable: string; 
  estado: 'Pendiente' | 'En curso' | 'Completado';
  actions: SpecificAction[]; 
  selected: boolean;
  isAutoProposed?: boolean; // New field
  trackingHistory: Record<number, AnnualTracking>;
}

export interface DiagnosisItem {
  id: string;
  etapa: string;
  tipoDesperdicio: string;
  elemento: string;
  genera: boolean;
  nivel: 'Bajo' | 'Medio' | 'Alto' | '';
  causa: string;
  prioridad: '1' | '2' | '3' | '';
  isMandatory?: boolean; // Campo nuevo para Ley 1/2025
}

// --- NUEVAS INTERFACES PARA MEDICIÓN ---
export interface KPIData {
  id: string;
  nombre: string;
  selected: boolean;
  frecuencia: string;
  responsable: string;
  lineaBase?: string;
}

export interface ProcessConfig {
  frecuencia: string;
  responsable: string;
}

export interface MeasurementConfig {
  kpis: KPIData[];
  reporting: ProcessConfig;
  annualReview: ProcessConfig;
}

export interface SocietyData {
  razonSocial: string;
  cif: string;
  direccion: string;
  codigoPostal: string;
  municipio: string;
  provincia: string;
}

export interface AppState {
  step: number;
  scope: 'individual' | 'corporate'; // Nuevo: Alcance del plan
  society: SocietyData; // Nuevo: Datos de la sociedad (para corporativo)
  hotels: HotelData[]; // Nuevo: Lista de hoteles (para corporativo)
  hotelData: HotelData; // Mantenemos para individual o como "hotel activo"
  areas: Area[];
  team: TeamMember[];
  diagnosisData: DiagnosisItem[];
  objectives: Objective[];
  measurementConfig: MeasurementConfig; // Nuevo campo
  baselineYear: string;
  periodoPlan: string;
  objetivoGeneralReduccion: number;
  fechaVisita: string;
  consultor: string;
  aiAdvice: string | null;
  isAiLoading: boolean;
  currentTrackingYear: number;
  lastModified?: string;
  consultantSignature?: string;
  directorSignature?: string;
  originalHotelName?: string; // Nuevo: Para controlar renombrados y evitar duplicados
  version: string; // Nuevo: Control de versiones (V1, V2...)
  planId: string; // Nuevo: Identificador único del plan
}

export const initialSocietyData: SocietyData = {
  razonSocial: '',
  cif: '',
  direccion: '',
  codigoPostal: '',
  municipio: '',
  provincia: ''
};

export const initialHotelData: HotelData = {
  razonSocial: '',
  nombreComercial: '',
  cif: '',
  categoria: '',
  direccion: '',
  codigoPostal: '',
  municipio: '',
  provincia: '',
  numHabitaciones: 0,
  capacidadMax: 0,
  numEmpleados: 0,
  numEmpleadosFB: 0,
  superficieRestauracion: 0,
  logo: '',
  hasDonationProtocol: false,
  donationProtocolFile: ''
};