import React, { useState, useEffect, useRef } from 'react';
import { AppState, initialHotelData, initialSocietyData, DiagnosisItem, Objective } from './types';
import { INITIAL_OBJECTIVES, INITIAL_DEPARTMENTS, INITIAL_DIAGNOSIS, INITIAL_MEASUREMENT_CONFIG, GOOGLE_SCRIPT_URL } from './constants';
import { planService } from './services/planService';
import { supabase } from './services/supabase';
import { GeneralForm, AreasForm, TeamForm, SignaturesForm, SocietyForm, HotelListForm, PlanContextForm } from './components/Forms';
import { DiagnosisForm } from './components/DiagnosisForm';
import { ObjectiveSelection } from './components/ObjectiveSelection';
import { MeasurementForm } from './components/MeasurementForm'; 
import { TrackingView } from './components/TrackingView';
import { FinalReport } from './components/FinalReport';
import { VersionHistory } from './components/VersionHistory';
import { LoginView } from './components/Login';
import { ChevronRight, ChevronLeft, Save, Leaf, LayoutDashboard, Maximize, Minimize, Home, Plus, Trash2, Clock, FileJson, Download, RefreshCw, CloudDownload, CloudUpload, X, LogOut, Database, Link, GitBranch, Users, Briefcase } from 'lucide-react';
import { UserManagement } from './components/UserManagement';
import { ClientDashboard } from './components/ClientDashboard';

interface CloudPlan {
  hotel: string;
  data: AppState;
  date: string;
  sheetIdName?: string; // Para borrado: guarda el nombre exacto que tiene la hoja en Columna A
  version?: string;
  planId: string; // Nuevo identificador único
}

// Logo Component
const HsGreenLogoDashboard = () => (
    <div className="flex flex-col md:flex-row items-center gap-3 select-none">
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 35 C 5 35, 25 55, 40 55 C 40 55, 30 35, 15 25 C 10 22, 5 35, 5 35 Z" fill="#66cc33" />
            <path d="M15 25 C 15 25, 30 35, 40 55 C 45 45, 25 25, 15 25" fill="#75c05d" /> 
            <path d="M5 50 C 5 50, 25 55, 40 65 C 40 65, 35 55, 30 50 C 20 40, 5 50, 5 50 Z" fill="#009933" />
            <path d="M40 55 C 40 55, 45 75, 42 85 C 42 85, 50 75, 52 55 L 40 55" fill="#4ade80" />
            <path d="M52 55 C 52 55, 55 70, 45 85 C 55 80, 65 65, 60 50 L 52 55" fill="#ff9900" />
            <path d="M52 55 L 60 50 C 60 50, 70 50, 75 35 C 75 35, 65 30, 55 40 C 55 40, 50 45, 52 55" fill="#0033cc" />
            <path d="M75 35 L 85 40 L 75 42" fill="#0033cc" />
            <circle cx="68" cy="38" r="2" fill="white" />
        </svg>
        <div className="flex flex-col items-center md:items-start justify-center">
            <h1 className="text-5xl font-black text-[#5bb545] tracking-tight leading-none m-0">
                HSGREEN
            </h1>
            <p className="text-xs font-bold tracking-[0.3em] text-slate-500 uppercase leading-none md:ml-0.5 mt-2">
                Environment & Sustainability
            </p>
        </div>
    </div>
);

// MATRIZ DE TRAZABILIDAD (Mantenida igual)
const FULL_TRACEABILITY_MAP: Record<string, string[]> = {
  'd00_1': ['7', '8'], 'd00_2': ['5', '12'], 'd00_3': ['10', '11'], 'd00_4': ['18'],
  'd1': ['6'], 'd2': ['6', '19'], 'd3': ['16'], 'd4': ['16'], 'd5': ['6'],
  'd6': ['5', '20'], 'd7': ['20'], 'd8': ['5'], 'd9': ['5', '17'], 'd10': ['10'],
  'd10_1': ['5'], 'd10_2': ['20'], 'd11': ['4'], 'd13': ['4', '20'], 'd14': ['4', '17'],
  'd14_1': ['4'], 'd14_2': ['14'], 'd15': ['1', '2', '3'], 'd16': ['1', '2', '3', '19'],
  'd18': ['1', '2', '3'], 'd19': ['17', '9'], 'd19_1': ['1', '2', '3'], 'd20': ['12'],
  'd21': ['12', '18'], 'd22': ['18'], 'd23': ['18'], 'd24': ['10'], 'd25': ['11'],
  'd26': ['4', '14'], 'd27': ['18'], 'd28': ['13'], 'd29': ['13', '20'], 'd30': ['9'],
};

// ESTADO INICIAL COMPLETO (Reset Factory)
const INITIAL_STATE_FACTORY: AppState = {
    step: 1,
    scope: 'individual',
    society: initialSocietyData,
    hotels: [],
    hotelData: initialHotelData,
    areas: [],
    team: INITIAL_DEPARTMENTS,
    diagnosisData: INITIAL_DIAGNOSIS,
    objectives: INITIAL_OBJECTIVES,
    measurementConfig: INITIAL_MEASUREMENT_CONFIG,
    baselineYear: new Date().getFullYear().toString(),
    periodoPlan: '2026-2030',
    objetivoGeneralReduccion: 50,
    fechaVisita: new Date().toISOString().split('T')[0],
    consultor: '',
    aiAdvice: null,
    isAiLoading: false,
    currentTrackingYear: new Date().getFullYear() + 1,
    originalHotelName: '', // Estado inicial vacío
    version: 'V0', // Versión inicial borrador
    planId: '', // Se generará al crear nuevo plan
};

// Helper para fetch con timeout
const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('consultor');
  const [view, setView] = useState<'dashboard' | 'wizard' | 'users'>('dashboard');
  
  // Cloud Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudPlans, setCloudPlans] = useState<CloudPlan[]>([]);
  const [cloudFilter, setCloudFilter] = useState('');

  // Asignación de cliente a plan
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState<string>('');
  const [clientUsers, setClientUsers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  const [assignedClients, setAssignedClients] = useState<string[]>([]);
  const [planAssignedMap, setPlanAssignedMap] = useState<Record<string, boolean>>({});

  // Consultores disponibles para el selector
  const [consultorOptions, setConsultorOptions] = useState<{ email: string; full_name: string }[]>([]);

  // Modal nueva versión
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');

  const [state, setState] = useState<AppState>(INITIAL_STATE_FACTORY);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.error(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setView('dashboard');
  };

  // --- CLOUD OPERATIONS (Supabase) ---

  const executeDelete = async (planId: string): Promise<boolean> => {
    try {
      await planService.delete(planId);
      return true;
    } catch (error) {
      console.error("Delete Error:", error);
      return false;
    }
  };

  // Guardar borrador (sin cambiar versión)
  const handleCloudSave = async () => {
    const isCorporate = state.scope === 'corporate';
    const identifier = isCorporate ? state.society.razonSocial : state.hotelData.nombreComercial;
    if (!identifier) {
      alert(`⚠️ Por favor, introduce el ${isCorporate ? 'Nombre de la Sociedad' : 'Nombre Comercial del hotel'} en el paso 1.`);
      return;
    }
    setIsSyncing(true);
    try {
      const currentPlanId = state.planId || crypto.randomUUID();
      const dataToSave: AppState = {
        ...state,
        version: state.version || 'V1',
        originalHotelName: identifier.trim(),
        planId: currentPlanId,
        lastModified: new Date().toISOString(),
      };
      await planService.saveDraft(dataToSave);
      setState(s => ({ ...s, planId: currentPlanId, originalHotelName: identifier.trim() }));
      alert(`✅ Borrador guardado (${state.version || 'V1'}).`);
    } catch (error: any) {
      alert(`❌ Error al guardar: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Abrir modal para nueva versión
  const handleSaveNewVersion = () => {
    const isCorporate = state.scope === 'corporate';
    const identifier = isCorporate ? state.society.razonSocial : state.hotelData.nombreComercial;
    if (!identifier) {
      alert(`⚠️ Por favor, introduce el ${isCorporate ? 'Nombre de la Sociedad' : 'Nombre Comercial del hotel'} en el paso 1.`);
      return;
    }
    setVersionDescription('');
    setShowVersionModal(true);
  };

  // Confirmar nueva versión desde el modal
  const handleConfirmNewVersion = async () => {
    if (!versionDescription.trim()) {
      alert('⚠️ Describe los cambios de esta versión.');
      return;
    }
    const isCorporate = state.scope === 'corporate';
    const identifier = isCorporate ? state.society.razonSocial : state.hotelData.nombreComercial;
    setIsSyncing(true);
    setShowVersionModal(false);
    try {
      const currentVersionNumber = parseInt((state.version || 'V1').replace(/[^0-9]/g, '')) || 1;
      const newVersion = `V${currentVersionNumber + 1}`;
      const currentPlanId = state.planId || crypto.randomUUID();
      const dataToSave: AppState = {
        ...state,
        version: newVersion,
        originalHotelName: identifier!.trim(),
        planId: currentPlanId,
        lastModified: new Date().toISOString(),
      };
      await planService.saveNewVersion(dataToSave, versionDescription.trim());
      setState(s => ({ ...s, version: newVersion, planId: currentPlanId, originalHotelName: identifier!.trim() }));
      alert(`✅ Nueva versión creada: ${newVersion}.`);
    } catch (error: any) {
      alert(`❌ Error al guardar: ${error.message}`);
    } finally {
      setIsSyncing(false);
      setVersionDescription('');
    }
  };

  const handleCloudDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`⚠️ ¿Eliminar este plan de Supabase?\n\nEsta acción es permanente.`)) return;

    const previousPlans = [...cloudPlans];
    setCloudPlans(plans => plans.filter(p => p.planId !== planId));
    setIsSyncing(true);

    try {
      const success = await executeDelete(planId);
      if (!success) {
        setCloudPlans(previousPlans);
        alert(`Error: No se pudo eliminar el plan.`);
      }
    } catch {
      setCloudPlans(previousPlans);
      alert(`Error de conexión al eliminar.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchCloudPlans = async (showAlertIfEmpty = true) => {
    setIsSyncing(true);
    try {
      const plans = await planService.getAll();
      const validPlans: CloudPlan[] = plans.map(p => ({
        hotel: p.hotel_name,
        data: p.data,
        date: p.updated_at,
        sheetIdName: p.plan_id,
        version: p.version,
        planId: p.plan_id,
      }));

      // Load which plans have clients assigned
      const { data: accessRows } = await supabase.from('plan_access').select('plan_id');
      const assignedMap: Record<string, boolean> = {};
      for (const row of (accessRows || []) as any[]) {
        assignedMap[row.plan_id] = true;
      }
      setPlanAssignedMap(assignedMap);

      if (validPlans.length > 0) {
        setCloudPlans(validPlans);
        setShowCloudModal(true);
      } else {
        if (showAlertIfEmpty) alert("No se encontraron planes en Supabase.");
        setCloudPlans([]);
      }
    } catch (error: any) {
      alert(`Error de conexión con Supabase: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- MIGRACIÓN DESDE GOOGLE SHEETS (usar una sola vez) ---
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateFromSheets = async () => {
    if (!window.confirm(`¿Migrar los 13 planes de Google Sheets a Supabase?\n\nLos planes ya existentes en Supabase se actualizarán. No se elimina nada.`)) return;
    setIsMigrating(true);
    try {
      const url = `${GOOGLE_SCRIPT_URL}?nocache=${Date.now()}`;
      const response = await fetchWithTimeout(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Formato inesperado de Google Sheets');

      const result = await planService.migrateFromGoogleSheets(data, () => {});
      alert(`✅ Migración completada:\n• ${result.success} planes importados${result.errors.length > 0 ? `\n• ${result.errors.length} errores:\n${result.errors.join('\n')}` : ''}`);
      handleFetchCloudPlans(false);
    } catch (error: any) {
      alert(`❌ Error en migración: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const openAssignModal = async (planId: string) => {
    setAssignPlanId(planId);
    // Cargar clientes registrados
    const { data: clients } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'viewer')
      .eq('active', true);
    setClientUsers(clients || []);
    // Cargar asignaciones actuales
    const { data: current } = await supabase
      .from('plan_access')
      .select('user_id')
      .eq('plan_id', planId);
    const currentIds = (current || []).map((r: any) => r.user_id);
    setAssignedClients(currentIds);
    setShowAssignModal(true);
  };

  const saveAssignment = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('plan_access').delete().eq('plan_id', assignPlanId);
    if (assignedClients.length > 0) {
      await supabase.from('plan_access').insert(
        assignedClients.map(userId => ({
          plan_id: assignPlanId,
          user_id: userId,
          granted_by: user?.id,
        }))
      );
    }
    setPlanAssignedMap(prev => ({ ...prev, [assignPlanId]: assignedClients.length > 0 }));
    setShowAssignModal(false);
    alert('✅ Acceso de clientes actualizado.');
  };

  const importCloudPlan = (plan: CloudPlan) => {
      if (!plan.data) {
          alert("❌ Archivo Dañado\n\nEste plan contiene datos corruptos (probablemente debido a una imagen demasiado grande que excedió el límite de la celda) y no se puede abrir.\n\nPor favor, elimínelo usando el icono de basura para limpiar la lista.");
          return;
      }

      try {
          const incomingData = plan.data;
          
          // ESTRATEGIA DE FUSIÓN DE DATOS (DATA MERGE STRATEGY)
          const mergedState: AppState = {
              ...INITIAL_STATE_FACTORY, // Base limpia
              ...incomingData,          // Datos importados
              
              // IMPORTANTE: Aquí está la clave. Usamos 'sheetIdName' (el valor real de la celda, aunque sea una fecha corrupta)
              // como el 'originalHotelName'. De esta forma, 'handleCloudSave' detectará que el nombre actual ("Hotel X")
              // es diferente al original ("2026-02-17...") y ofrecerá limpiar el registro corrupto.
              originalHotelName: plan.sheetIdName || plan.hotel, 
              version: plan.version || 'V1', // Recuperar versión

              // Asegurar sub-objetos críticos
              measurementConfig: incomingData.measurementConfig || INITIAL_MEASUREMENT_CONFIG,
              diagnosisData: (incomingData.diagnosisData && incomingData.diagnosisData.length > 0) ? incomingData.diagnosisData : INITIAL_DIAGNOSIS,
              
              step: 1, 
              
              // Asegurar firmas nulas si no existen
              consultantSignature: incomingData.consultantSignature || '',
              directorSignature: incomingData.directorSignature || ''
          };

          setState(mergedState);
          setView('wizard');
          setShowCloudModal(false);
      } catch (e) {
          console.error("Import Error:", e);
          alert("Error al procesar el plan seleccionado. Los datos pueden estar corruptos.");
      }
  };

  const createNewPlan = () => {
    setState({ 
        ...INITIAL_STATE_FACTORY, 
        consultor: currentUser || '',
        planId: crypto.randomUUID() // Generar ID único para el nuevo plan
    });
    setView('wizard');
  };

  // --- MOCK DATA GENERATOR ---
  const generateMockData = (type: 'individual' | 'corporate') => {
      const mockAreas = (prefix: string) => [
          { id: crypto.randomUUID(), nombre: `${prefix} - Buffet Principal`, superficie: 150, capacidad: 200, numServiciosDia: 3, tipoServicio: 'Desayuno/Cena', esBuffet: true, horarios: '07:00-10:30, 19:00-22:00' },
          { id: crypto.randomUUID(), nombre: `${prefix} - Bar Piscina`, superficie: 80, capacidad: 50, numServiciosDia: 1, tipoServicio: 'Snack', esBuffet: false, horarios: '11:00-18:00' },
          { id: crypto.randomUUID(), nombre: `${prefix} - Cocina Central`, superficie: 100, capacidad: 0, numServiciosDia: 3, tipoServicio: 'Producción', esBuffet: false, horarios: '06:00-23:00' }
      ];

      const mockTeam = [
          { id: 'dir', departamento: 'Dirección', nombre: 'Ana García', cargo: 'Directora', email: 'direccion@hotel.com', telefono: '600123456', funcion: 'Supervisión General' },
          { id: 'coc', departamento: 'Cocina', nombre: 'Carlos Ruiz', cargo: 'Jefe de Cocina', email: 'chef@hotel.com', telefono: '600654321', funcion: 'Control de Producción' },
          { id: 'cal', departamento: 'Calidad', nombre: 'Laura M.', cargo: 'Resp. Calidad', email: 'calidad@hotel.com', telefono: '600987654', funcion: 'Gestión del Plan' }
      ];

      // MOCK DIAGNOSIS
      const mockDiagnosis = INITIAL_DIAGNOSIS.map(d => {
          if (d.id === 'd1') return { ...d, genera: true, nivel: 'Alto', prioridad: '1', causa: 'Exceso de producción en buffet desayuno por falta de previsión de ocupación real.' };
          if (d.id === 'd5') return { ...d, genera: true, nivel: 'Medio', prioridad: '2', causa: 'Mermas en preparación de frutas y verduras por personal nuevo.' };
          if (d.id === 'd15') return { ...d, genera: true, nivel: 'Bajo', prioridad: '3', causa: 'Caducidad puntual de lácteos en almacén.' };
          return d;
      });

      // MOCK OBJECTIVES & TRACKING
      const mockObjectives = INITIAL_OBJECTIVES.map(obj => {
          if (obj.id === '6') { // Optimizar Buffet
              return {
                  ...obj,
                  selected: true,
                  estado: 'En curso',
                  meta: 'Reducir 15% merma buffet',
                  plazo: '2026-12-31',
                  responsable: 'Jefe de Cocina',
                  actions: [
                      { id: 'a1', codigo: 'A-01', descripcion: 'Implementar sistema de registro de mermas diario en tablet', responsable: 'Jefe de Cocina', plazo: '2026-03-01' },
                      { id: 'a2', codigo: 'A-02', descripcion: 'Ajustar bandejas de reposición a formato pequeño en última hora', responsable: 'Maitre', plazo: '2026-02-15' }
                  ],
                  trackingHistory: {
                      2026: {
                          year: 2026, isClosed: false, globalProgress: 40, globalNotes: 'Buen avance en T1',
                          actions: {
                              'a1': { t1: { cumple: true, evidencia: 'Registros en app' }, t2: { cumple: false, evidencia: '' }, t3: { cumple: false, evidencia: '' }, t4: { cumple: false, evidencia: '' }, notes: 'Implementado ok', status: 't1' },
                              'a2': { t1: { cumple: true, evidencia: 'Fotos bandejas' }, t2: { cumple: false, evidencia: '' }, t3: { cumple: false, evidencia: '' }, t4: { cumple: false, evidencia: '' }, notes: 'Realizado', status: 't1' }
                          }
                      }
                  }
              };
          }
          if (obj.id === '1') { // Formación
              return {
                  ...obj,
                  selected: true,
                  estado: 'Pendiente',
                  meta: '100% Staff formado',
                  plazo: '2026-06-30',
                  responsable: 'RRHH',
                  actions: [
                      { id: 'a3', codigo: 'A-03', descripcion: 'Curso online desperdicio cero para nuevas incorporaciones', responsable: 'RRHH', plazo: '2026-04-01' }
                  ],
                  trackingHistory: {}
              };
          }
          return obj;
      });

      // MOCK MEASUREMENT
      const mockMeasurement = {
          kpis: INITIAL_MEASUREMENT_CONFIG.kpis.map(k => {
              if (k.id === 'kpi1' || k.id === 'kpi2') return { ...k, selected: true, frecuencia: 'Mensual', responsable: 'Calidad' };
              return k;
          }),
          reporting: { frecuencia: 'Trimestral', responsable: 'Comité Sostenibilidad' },
          annualReview: { frecuencia: 'Anual', responsable: 'Dirección' }
      };

      const commonState = {
          ...INITIAL_STATE_FACTORY,
          diagnosisData: mockDiagnosis as any, // Type assertion to avoid strict literal checks issues if any
          objectives: mockObjectives as any,
          measurementConfig: mockMeasurement,
          team: mockTeam,
          consultor: currentUser || 'Consultor Test',
          step: 1,
          baselineYear: '2025',
          periodoPlan: '2026-2030',
          objetivoGeneralReduccion: 30
      };

      if (type === 'corporate') {
          const mockHotels = Array.from({ length: 5 }, (_, i) => ({
              razonSocial: `Hotelera del Sur S.L.`,
              nombreComercial: `Hotel Paradise ${i + 1}`,
              cif: `B-1234567${i}`,
              categoria: `${4 + (i % 2)} Estrellas`,
              direccion: `Calle del Sol, ${i + 10}`,
              codigoPostal: `2900${i}`,
              municipio: 'Málaga',
              provincia: 'Málaga',
              numHabitaciones: 100 + (i * 20),
              capacidadMax: 200 + (i * 40),
              numEmpleados: 50 + (i * 10),
              numEmpleadosFB: 20 + (i * 5),
              superficieRestauracion: 300 + (i * 50),
              logo: '',
              hasDonationProtocol: i % 2 === 0,
              donationProtocolFile: '',
              areas: mockAreas(`Hotel ${i + 1}`)
          }));

          setState({
              ...commonState,
              scope: 'corporate',
              society: {
                  razonSocial: 'Grupo Hotelero Internacional S.A.',
                  cif: 'A-99887766',
                  direccion: 'Av. de la Constitución, 100',
                  codigoPostal: '28046',
                  municipio: 'Madrid',
                  provincia: 'Madrid'
              },
              hotels: mockHotels,
          });
      } else {
          setState({
              ...commonState,
              scope: 'individual',
              hotelData: {
                  razonSocial: 'Hotel Individual S.L.',
                  nombreComercial: 'Grand Hotel Test',
                  cif: 'B-11223344',
                  categoria: '5 Estrellas GL',
                  direccion: 'Paseo Marítimo, 1',
                  codigoPostal: '07001',
                  municipio: 'Palma',
                  provincia: 'Illes Balears',
                  numHabitaciones: 250,
                  capacidadMax: 500,
                  numEmpleados: 120,
                  numEmpleadosFB: 45,
                  superficieRestauracion: 800,
                  logo: '',
                  hasDonationProtocol: true,
                  donationProtocolFile: ''
              },
              areas: mockAreas('Grand Hotel'),
          });
      }
      setView('wizard');
  };

  // --- EFFECTS FOR AUTO-OBJECTIVES ---
  useEffect(() => {
    if (view === 'dashboard') return; 

    const recommendedObjectiveIds = new Set<string>();
    state.diagnosisData.forEach(item => {
       const shouldTrigger = item.genera && (item.nivel === 'Alto' || item.prioridad === '1');
       if (shouldTrigger) {
          const mappedObjectives = FULL_TRACEABILITY_MAP[item.id];
          if (mappedObjectives) {
             mappedObjectives.forEach(id => recommendedObjectiveIds.add(id));
          }
       }
    });

    setState(prev => {
      const updatedObjectives = prev.objectives.map(obj => {
        if (recommendedObjectiveIds.has(obj.id)) {
          return { ...obj, isAutoProposed: true, selected: true }; 
        }
        return { ...obj, isAutoProposed: false };
      });
      if (JSON.stringify(updatedObjectives) === JSON.stringify(prev.objectives)) return prev;
      return { ...prev, objectives: updatedObjectives };
    });
  }, [state.diagnosisData, view]);

  const nextStep = () => setState(s => {
      const next = s.step + 1;
      if (s.scope === 'corporate' && next === 2) return { ...s, step: 3 };
      return { ...s, step: Math.min(next, 8) };
  });

  const prevStep = () => setState(s => {
      const prev = s.step - 1;
      if (s.scope === 'corporate' && prev === 2) return { ...s, step: 1 };
      return { ...s, step: Math.max(prev, 1) };
  });
  const goToTracking = () => setState(s => ({ ...s, step: 6 }));

  const stepNames = ["ID", "Zonas", "Diagnóstico", "Estrategia", "Medición", "Seguimiento", "Reporte", "Historial"];

  // LOGIN PROTECTION
  if (!currentUser) {
      return <LoginView onLoginSuccess={async (email) => {
        setCurrentUser(email);
        const { data } = await supabase.from('profiles').select('role').eq('email', email).single();
        setCurrentUserRole(data?.role || 'consultor');
        // Cargar lista de consultores para el selector
        const { data: consultors } = await supabase
          .from('profiles')
          .select('email, full_name')
          .in('role', ['admin', 'consultor'])
          .eq('active', true)
          .order('full_name');
        setConsultorOptions((consultors || []) as { email: string; full_name: string }[]);
      }} />;
  }

  // RENDER: CLIENTE (viewer) — solo ve sus planes asignados
  if (currentUserRole === 'viewer') {
    if (view === 'wizard') {
      // El cliente puede abrir un plan en el wizard (solo lectura/seguimiento)
      // fall through to wizard render below
    } else {
      return (
        <ClientDashboard
          currentUser={currentUser}
          onOpenPlan={(data) => { setState(s => ({ ...s, ...data, step: 1 })); setView('wizard'); }}
          onLogout={handleLogout}
        />
      );
    }
  }

  // RENDER: USER MANAGEMENT VIEW (admin only)
  if (view === 'users') {
    return <UserManagement onBack={() => setView('dashboard')} />;
  }

  // RENDER: DASHBOARD VIEW
  if (view === 'dashboard') {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 sm:p-12 relative flex items-center justify-center">
            
            {/* Modal de Nube */}
            {showCloudModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                            <h3 className="text-xl font-black text-brand-800 flex items-center gap-3">
                                <CloudDownload size={24} /> Planes en Nube Corporativa
                            </h3>
                            <button onClick={() => setShowCloudModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-white">
                            <input 
                                type="text" 
                                placeholder="Filtrar por nombre o cadena hotelera..." 
                                value={cloudFilter}
                                onChange={(e) => setCloudFilter(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                            {cloudPlans.length === 0 ? (
                                <div className="text-center py-12">
                                    <CloudDownload size={48} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-slate-400 font-bold">No hay planes registrados en Google Sheets.</p>
                                </div>
                            ) : (
                                (() => {
                                    const filteredPlans = cloudPlans.filter(plan => {
                                        if (!cloudFilter) return true;
                                        const filterLower = cloudFilter.toLowerCase();
                                        const nameMatch = plan.hotel.toLowerCase().includes(filterLower);
                                        const chainMatch = plan.data?.society?.razonSocial?.toLowerCase().includes(filterLower) || false;
                                        return nameMatch || chainMatch;
                                    });

                                    if (filteredPlans.length === 0) {
                                        return (
                                            <div className="text-center py-12">
                                                <p className="text-slate-400 font-bold">No se encontraron planes que coincidan con el filtro.</p>
                                            </div>
                                        );
                                    }

                                    return filteredPlans.map((plan, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => importCloudPlan(plan)}
                                            className={`flex items-center justify-between p-5 bg-white border border-slate-200 rounded-xl hover:shadow-lg transition-all cursor-pointer group ${!plan.data ? 'border-red-200 bg-red-50 hover:border-red-300' : 'hover:border-brand-400'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${!plan.data ? 'bg-red-100 text-red-500' : 'bg-brand-100 text-brand-600'}`}>
                                                    {!plan.data ? '!' : plan.hotel.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`font-bold text-lg transition-colors ${!plan.data ? 'text-red-700' : 'text-slate-800 group-hover:text-brand-700'}`}>
                                                            {plan.hotel}
                                                        </h4>
                                                        {!plan.data ? (
                                                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black border border-red-200">DAÑADO</span>
                                                        ) : (
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-black border border-slate-200">{plan.version || 'V1'}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                                        <Clock size={12} /> Modificado: {new Date(plan.date).toLocaleDateString()} {new Date(plan.date).toLocaleTimeString()}
                                                        {plan.data?.society?.razonSocial && (
                                                            <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-[9px] text-slate-500">
                                                                {plan.data.society.razonSocial}
                                                            </span>
                                                        )}
                                                    </p>
                                                    {plan.data?.consultor && (
                                                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Briefcase size={11} /> {plan.data.consultor}
                                                      </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {plan.data && (
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); openAssignModal(plan.planId); }}
                                                    className={`p-2 rounded-lg transition-colors border z-10 ${
                                                      planAssignedMap[plan.planId]
                                                        ? 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'
                                                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-100'
                                                    }`}
                                                    title="Asignar a cliente"
                                                  >
                                                    <Users size={18} />
                                                  </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleCloudDelete(plan.planId, e)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 z-10"
                                                    title="Eliminar de la Nube"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                                <div className={`p-2 transition-colors ${!plan.data ? 'text-red-200' : 'text-brand-200 group-hover:text-brand-600'}`}>
                                                    <ChevronRight size={24} />
                                                </div>
                                            </div>
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* User Bar */}
            <div className="absolute top-6 right-6 flex items-center gap-4">
                 <div className="text-right hidden sm:block">
                    <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Usuario</span>
                    <span className="block text-sm font-bold text-slate-700">{currentUser}</span>
                 </div>
                 {currentUserRole === 'admin' && (
                   <button onClick={() => setView('users')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Gestión de usuarios">
                     <Users size={20} />
                 </button>
                 )}
                 <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                     <LogOut size={20} />
                 </button>
            </div>

            <div className="max-w-4xl w-full flex flex-col items-center">
                <div className="mb-16 scale-125">
                    <HsGreenLogoDashboard />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                     {/* BOTÓN 1: NUBE CORPORATIVA */}
                     <button 
                        onClick={() => handleFetchCloudPlans(true)}
                        disabled={isSyncing}
                        className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl hover:border-brand-400 transition-all flex flex-col items-center text-center overflow-hidden"
                     >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-brand-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                             {isSyncing ? <RefreshCw size={40} className="animate-spin" /> : <Database size={40} />}
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">Nube Corporativa</h2>
                        <p className="text-slate-500 font-medium text-sm">Acceder a los planes guardados en la base de datos centralizada.</p>
                     </button>

                     {/* BOTÓN 2: NUEVO PLAN */}
                     <button 
                        onClick={createNewPlan}
                        className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl hover:border-brand-400 transition-all flex flex-col items-center text-center overflow-hidden"
                     >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-brand-600 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                        <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                             <Plus size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-brand-700 transition-colors">Nuevo Plan</h2>
                        <p className="text-slate-500 font-medium text-sm">Iniciar una nueva auditoría desde cero para un establecimiento.</p>
                     </button>
                </div>

            </div>
        </div>
    );
  }

  // RENDER: WIZARD VIEW
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors pr-4 border-r border-slate-200">
                  <Home size={18} />
              </button>
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setState(s => ({...s, step: 1}))}>
                <img src="/icon-48.png" alt="HsGreen" className="w-8 h-8 rounded-lg object-contain" />
                <div className="hidden sm:block">
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-black tracking-tight leading-none text-slate-900">EcoHotel PPDA</h1>
                        <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black border border-slate-200 flex items-center gap-0.5"><GitBranch size={8}/> {state.version}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold truncate max-w-[150px]">{state.hotelData.nombreComercial || 'Nuevo Plan'}</p>
                </div>
              </div>
          </div>

          <nav className="hidden md:flex items-end gap-1 self-stretch">
              {stepNames.map((name, i) => {
                  const stepNum = i + 1;
                  if (state.scope === 'corporate' && stepNum === 2) return null;
                  const isActive = state.step === stepNum;
                  return (
                      <button
                        key={i}
                        onClick={() => setState(s => ({...s, step: stepNum}))}
                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-t-lg border-t border-x ${
                          isActive
                            ? 'bg-white border-slate-200 text-brand-600 border-b-white -mb-px z-10'
                            : 'bg-slate-50 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {name}
                      </button>
                  );
              })}
          </nav>

          <div className="flex items-center gap-2">
             {state.step !== 7 && state.step !== 8 && (
               <>
                <button
                   onClick={handleCloudSave}
                   disabled={isSyncing}
                   title="Guardar borrador (no cambia la versión)"
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-wider transition-all shadow-sm ${
                       isSyncing
                       ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                       : 'bg-brand-600 text-white border-brand-700 hover:bg-brand-700 shadow-brand-500/20 shadow-md'
                   }`}
                >
                    {isSyncing ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    <span className="hidden sm:inline">{isSyncing ? 'Guardando...' : 'Guardar borrador'}</span>
                </button>
                <button
                   onClick={handleSaveNewVersion}
                   disabled={isSyncing}
                   title={`Crear nueva versión (actual: ${state.version || 'V1'})`}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-wider transition-all ${
                       isSyncing
                       ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                       : 'bg-white text-slate-600 border-slate-300 hover:border-brand-500 hover:text-brand-600'
                   }`}
                >
                    <GitBranch size={12} />
                    <span className="hidden sm:inline">Nueva versión</span>
                </button>
               </>
             )}

             <button onClick={toggleFullScreen} className="text-slate-400 hover:text-brand-600 transition-colors p-2 rounded-lg hover:bg-slate-50" title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}>
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
             </button>

             {state.step < 6 && (
                 <button onClick={goToTracking} className="flex items-center gap-1.5 text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 font-black text-[10px] uppercase tracking-wider hover:bg-brand-100 transition-all">
                    <LayoutDashboard size={12} /> Seguimiento
                 </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">
        {state.step === 1 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Identificación y Alcance</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setState(s => ({ ...s, scope: 'individual' }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-md transition-all ${state.scope === 'individual' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Individual
                    </button>
                    <button 
                        onClick={() => setState(s => ({ ...s, scope: 'corporate' }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-md transition-all ${state.scope === 'corporate' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Corporativo
                    </button>
                </div>
            </header>

            {state.scope === 'individual' ? (
                <GeneralForm
                    data={state.hotelData}
                    onChange={(d) => setState(s => ({ ...s, hotelData: d }))}
                    baselineYear={state.baselineYear}
                    setBaselineYear={(y) => setState(s => ({ ...s, baselineYear: y }))}
                    periodoPlan={state.periodoPlan}
                    setPeriodoPlan={(p) => setState(s => ({ ...s, periodoPlan: p }))}
                    fechaVisita={state.fechaVisita}
                    setFechaVisita={(v) => setState(s => ({ ...s, fechaVisita: v }))}
                    consultor={state.consultor}
                    setConsultor={(c) => setState(s => ({ ...s, consultor: c }))}
                    consultorOptions={consultorOptions}
                />
            ) : (
                <>
                    <SocietyForm 
                        data={state.society} 
                        onChange={(d) => setState(s => ({ ...s, society: d }))} 
                    />
                    <PlanContextForm
                        baselineYear={state.baselineYear}
                        setBaselineYear={(y) => setState(s => ({ ...s, baselineYear: y }))}
                        periodoPlan={state.periodoPlan}
                        setPeriodoPlan={(p) => setState(s => ({ ...s, periodoPlan: p }))}
                        fechaVisita={state.fechaVisita}
                        setFechaVisita={(v) => setState(s => ({ ...s, fechaVisita: v }))}
                        consultor={state.consultor}
                        setConsultor={(c) => setState(s => ({ ...s, consultor: c }))}
                        consultorOptions={consultorOptions}
                    />
                    <HotelListForm 
                        hotels={state.hotels} 
                        setHotels={(h) => setState(s => ({ ...s, hotels: h }))} 
                    />
                </>
            )}

            <TeamForm team={state.team} setTeam={(t) => setState(s => ({ ...s, team: t }))} />
            <SignaturesForm 
              consultantSignature={state.consultantSignature} 
              setConsultantSignature={(sig) => setState(s => ({ ...s, consultantSignature: sig }))} 
              directorSignature={state.directorSignature} 
              setDirectorSignature={(sig) => setState(s => ({ ...s, directorSignature: sig }))} 
            />
          </div>
        )}

        {state.step === 2 && (
          <div className="space-y-6">
            <AreasForm areas={state.areas} setAreas={(a) => setState(s => ({ ...s, areas: a }))} />
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Diagnóstico Operativo</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Niveles Altos o Prioridad 1 generan objetivos automáticos.</p>
            </header>
            <DiagnosisForm data={state.diagnosisData} onChange={(d) => setState(s => ({ ...s, diagnosisData: d }))} />
          </div>
        )}

        {state.step === 4 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estrategia SMART</h2>
            </header>
            <ObjectiveSelection objectives={state.objectives} setObjectives={(o) => setState(s => ({ ...s, objectives: o }))} />
          </div>
        )}

        {state.step === 5 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sistema de Medición</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Definición de KPIs y procedimientos de control.</p>
            </header>
            <MeasurementForm config={state.measurementConfig} setConfig={(c) => setState(s => ({ ...s, measurementConfig: c }))} />
          </div>
        )}

        {state.step === 6 && (
           <div className="space-y-6">
              <TrackingView objectives={state.objectives} setObjectives={(o) => setState(s => ({ ...s, objectives: o }))} currentYear={state.currentTrackingYear} setCurrentYear={(y) => setState(s => ({...s, currentTrackingYear: y}))} />
           </div>
        )}

        {state.step === 7 && (
            <FinalReport
                state={state}
                setState={setState}
                onCloudSave={handleCloudSave}
                onSaveNewVersion={handleSaveNewVersion}
                isSyncing={isSyncing}
            />
        )}

        {state.step === 8 && (
          <div className="space-y-6">
            <VersionHistory planId={state.planId} />
          </div>
        )}
      </main>

      {/* Modal asignación de cliente */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Asignar clientes al plan</h3>
              <p className="text-sm text-slate-500 mt-1">Selecciona los clientes que pueden ver y editar este plan.</p>
            </div>
            <div className="p-6 max-h-72 overflow-y-auto space-y-2">
              {clientUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No hay clientes registrados. Invita usuarios con rol "Cliente" desde el panel de usuarios.</p>
              ) : (
                clientUsers.map(client => (
                  <label key={client.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg p-2">
                    <input
                      type="checkbox"
                      checked={assignedClients.includes(client.id)}
                      onChange={() => setAssignedClients(prev =>
                        prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id]
                      )}
                      className="w-4 h-4 accent-green-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{client.full_name || client.email}</p>
                      <p className="text-xs text-slate-400">{client.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button onClick={saveAssignment} className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">Guardar acceso</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva versión */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Nueva versión</h3>
              <p className="text-sm text-slate-500 mt-1">
                Se creará la versión <strong>{`V${(parseInt((state.version || 'V1').replace(/[^0-9]/g, '')) || 1) + 1}`}</strong>. Describe los cambios realizados.
              </p>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                value={versionDescription}
                onChange={e => setVersionDescription(e.target.value)}
                placeholder="Ej: Actualización de objetivos de reducción de pan. Revisión del diagnóstico de cocina..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmNewVersion}
                disabled={!versionDescription.trim()}
                className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                Crear versión
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;