import React, { useState, useEffect, useRef } from 'react';
import { AppState, initialHotelData, initialSocietyData, DiagnosisItem, Objective } from './types';
import { INITIAL_OBJECTIVES, INITIAL_DEPARTMENTS, INITIAL_DIAGNOSIS, INITIAL_MEASUREMENT_CONFIG, GOOGLE_SCRIPT_URL } from './constants';
import { planService } from './services/planService';
import { getPhasesForPlan } from './phaseConfig';
import { supabase } from './services/supabase';
import { GeneralForm, AreasForm, TeamForm, SignaturesForm, SocietyForm, HotelListForm, PlanContextForm } from './components/Forms';
import { DiagnosisForm } from './components/DiagnosisForm';
import { ObjectiveSelection } from './components/ObjectiveSelection';
import { MeasurementForm } from './components/MeasurementForm'; 
import { TrackingView } from './components/TrackingView';
import { FinalReport } from './components/FinalReport';
import { VersionHistory } from './components/VersionHistory';
import { RegistrosView } from './components/RegistrosView';
import { pesajesService } from './services/pesajesService';
import { LoginView } from './components/Login';
import { ChevronRight, ChevronLeft, Save, Leaf, LayoutDashboard, Maximize, Minimize, Home, Plus, Trash2, Clock, FileJson, Download, RefreshCw, CloudDownload, CloudUpload, X, LogOut, Database, Link, GitBranch, Users, Briefcase, KeyRound, Eye, EyeOff, FileSpreadsheet, Building2, ScanSearch, Target, Scale, FileText, History, MapPin, CheckSquare } from 'lucide-react';
import { UserManagement } from './components/UserManagement';
import { ClientDashboard } from './components/ClientDashboard';
import { exportStatusXLS } from './utils/exportXLS';

interface CloudPlan {
  hotel: string;
  data: AppState;
  date: string;
  sheetIdName?: string; // Para borrado: guarda el nombre exacto que tiene la hoja en Columna A
  version?: string;
  planId: string; // Nuevo identificador único
  consultor?: string | null;
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

// MATRIZ DE TRAZABILIDAD — corregida según phaseConfig.tsx y constants.ts
// Fase 1 Compras (OE1,OE2,OE3) | Fase 2 Producción (OE4,OE5) | Fase 3 Servicio (OE6,OE7,OE8,OE9)
// Fase 4 Medición (OE10,OE11)  | Fase 5 Formación (OE12)      | Fase 6 Valorización (OE13,OE14)
const FULL_TRACEABILITY_MAP: Record<string, string[]> = {
  // DIRECCIÓN Y ESTRATEGIA
  'd00_1': ['13'],          // convenios donación        → OE13 (Convenio donación)
  'd00_2': ['12'],          // APPCC                     → OE12 (Formación)
  'd00_3': ['12'],          // responsable PPDA          → OE12
  'd00_4': ['11'],          // política documentada      → OE11 (Indicadores/KPIs)
  // COMPRAS Y ALMACENAMIENTO — Fase 1
  'd1':    ['2'],           // caducidades               → OE2 (Almacén)
  'd2':    ['2'],           // deterioro almacenamiento  → OE2
  'd3':    ['1'],           // exceso stock              → OE1 (Compras)
  'd4':    ['1'],           // rechazos recepción        → OE1
  'd5':    ['2'],           // FIFO/FEFO                 → OE2
  // PREPARACIÓN Y PRODUCCIÓN — Fase 2
  'd6':    ['5'],           // mermas preparación        → OE5 (Cocina)
  'd7':    ['5'],           // partes comestibles        → OE5
  'd8':    ['5'],           // errores cocción           → OE5
  'd9':    ['5'],           // mise en place             → OE5
  'd10':   ['5', '12'],     // errores por formación     → OE5 + OE12
  'd10_1': ['4', '5'],      // estandarización recetas   → OE4 (Carta) + OE5
  'd10_2': ['5'],           // aprovechamiento subprod.  → OE5
  // SERVICIO — Fase 3
  'd11':   ['7'],           // restos platos             → OE7 (Platos clientes)
  'd13':   ['7'],           // pan/guarniciones          → OE7
  'd14':   ['7'],           // room service devuelto     → OE7
  'd14_1': ['4', '7'],      // opciones raciones         → OE4 + OE7
  'd14_2': ['8'],           // doggy bag                 → OE8 (Envases llevar)
  'd15':   ['6'],           // buffet expuesto           → OE6 (Buffet)
  'd16':   ['6'],           // buffet reserva            → OE6
  'd18':   ['6'],           // showcooking               → OE6
  'd19':   ['6'],           // snack bar                 → OE6
  'd19_1': ['6'],           // producción escalonada     → OE6
  // MEDICIÓN Y CONTROL — Fase 4
  'd20':   ['10'],          // sistema pesaje            → OE10 (Medición)
  'd21':   ['10', '13'],    // registro donados          → OE10 + OE13
  'd22':   ['11'],          // indicadores               → OE11 (KPIs)
  'd23':   ['11'],          // auditorías                → OE11
  // FORMACIÓN — Fase 5
  'd24':   ['12'],          // formación cocina          → OE12 (Formación)
  'd25':   ['12'],          // formación sala            → OE12
  'd26':   ['12'],          // campañas sensibilización  → OE12
  'd27':   ['11'],          // comunicación interna      → OE11
  // VALORIZACIÓN — Fase 6
  'd28':   ['14'],          // gestor orgánico           → OE14 (Valorización)
  'd29':   ['14'],          // compostaje                → OE14
  'd30':   ['13'],          // plataformas redistribución→ OE13
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
  const [currentUserHotel, setCurrentUserHotel] = useState<string>('');
  const [view, setView] = useState<'dashboard' | 'wizard' | 'users' | 'registros'>('dashboard');

  // Estado para la vista de registros
  const [registrosPlanId,   setRegistrosPlanId]   = useState<string>('');
  const [registrosHotel,    setRegistrosHotel]    = useState<string>('');
  const [registrosPlanData, setRegistrosPlanData] = useState<any>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [changePwdStatus, setChangePwdStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Pesajes cargados desde Supabase para el plan activo (Resultados de Medición)
  const [pesajesDB, setPesajesDB] = useState<any[]>([]);

  // Cloud Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudPlans, setCloudPlans] = useState<CloudPlan[]>([]);
  const [cloudFilter, setCloudFilter] = useState('');
  const [cloudConsultorFilter, setCloudConsultorFilter] = useState('');

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

  // Cambios sin guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedPlanId = React.useRef<string>('');

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Marcar cambios sin guardar cuando cambia el contenido del plan (no step ni flags de UI)
  const prevStateRef = React.useRef<string>('');
  useEffect(() => {
    if (view !== 'wizard') return;
    const { step, isAiLoading, aiAdvice, ...content } = state;
    const serialized = JSON.stringify(content);
    if (prevStateRef.current && prevStateRef.current !== serialized) {
      setHasUnsavedChanges(true);
    }
    prevStateRef.current = serialized;
  }, [state, view]);

  // ── Guardia de consistencia (solo DEV) ──────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const phases = getPhasesForPlan('');          // PHASES estándar
    const objIds   = new Set(INITIAL_OBJECTIVES.map(o => o.id));
    const phaseIds = new Set(phases.flatMap(p => p.objectiveIds));
    const mapIds   = new Set(Object.values(FULL_TRACEABILITY_MAP).flat());
    mapIds.forEach(id => {
      if (!objIds.has(id))
        console.error(`⚠️ [PPDA] TRACEABILITY_MAP id:'${id}' no existe en INITIAL_OBJECTIVES`);
    });
    phaseIds.forEach(id => {
      if (!objIds.has(id))
        console.error(`⚠️ [PPDA] phaseConfig id:'${id}' no existe en INITIAL_OBJECTIVES`);
    });
    INITIAL_OBJECTIVES.forEach(o => {
      if (!phaseIds.has(o.id))
        console.warn(`⚠️ [PPDA] ${o.codigo} (id:${o.id}) sin fase asignada en phaseConfig`);
    });
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

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

  // --- EXPORT XLS (Admin only) ---
  const handleExportXLS = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const allPlans = await planService.getAll();
      exportStatusXLS(allPlans);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error al exportar. Inténtalo de nuevo.');
    } finally {
      setIsExporting(false);
    }
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
      const saveTimestamp = new Date().toISOString();
      const dataToSave: AppState = {
        ...state,
        version: state.version || 'V1',
        originalHotelName: identifier.trim(),
        planId: currentPlanId,
        lastModified: saveTimestamp,
      };
      await planService.saveDraft(dataToSave, saveTimestamp);
      setState(s => ({ ...s, planId: currentPlanId, originalHotelName: identifier.trim() }));
      setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
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
        consultor: p.consultor,
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
        planId: crypto.randomUUID()
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

  // --- CARGAR PESAJES DESDE SUPABASE cuando hay planId y se llega al paso 5 ---
  useEffect(() => {
    if (!state.planId || state.step !== 6) return;
    pesajesService.fetchByPlan(state.planId)
      .then(rows => setPesajesDB(rows))
      .catch(e => console.warn('No se pudieron cargar pesajes:', e.message));
  }, [state.planId, state.step]);

  // --- EFFECTS FOR AUTO-OBJECTIVES ---
  useEffect(() => {
    if (view === 'dashboard') return; 

    const recommendedObjectiveIds = new Set<string>();
    state.diagnosisData.forEach(item => {
       const shouldTrigger = item.genera && item.prioridad === '1';
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
          // Si ya era auto-propuesto, respetar la selección que el usuario eligió manualmente.
          // Solo forzar selected:true la primera vez que se convierte en auto-propuesto.
          if (obj.isAutoProposed) {
            return { ...obj, isAutoProposed: true };
          }
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
  const goToTracking = () => setState(s => ({ ...s, step: 5 }));

  const stepNames = ["ID", "Zonas", "Diagnóstico", "Estrategia", "Seguimiento", "KPI's y Medición", "Informe", "Historial de Versiones"];

  // LOGIN PROTECTION
  if (!currentUser) {
      return <LoginView onLoginSuccess={async (email) => {
        setCurrentUser(email);
        const { data } = await supabase.from('profiles').select('role, hotel_nombre').eq('email', email).single();
        const role = data?.role || 'consultor';
        setCurrentUserRole(role);
        setCurrentUserHotel(data?.hotel_nombre || '');
        // Si es operador, cargar plan INTELIER y redirigir a registros
        if (role === 'operador' && data?.hotel_nombre) {
          const { data: planRow } = await supabase.from('plans').select('data').eq('plan_id', 'INTELIER-HOTELES-SL').single();
          if (planRow) {
            setRegistrosPlanId('INTELIER-HOTELES-SL');
            setRegistrosHotel(data.hotel_nombre);
            setRegistrosPlanData(planRow.data);
            setView('registros');
          }
        }
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

  // RENDER: OPERADOR — solo registro de pesajes de su hotel
  if (currentUserRole === 'operador') {
    if (!registrosPlanData || !currentUserHotel) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        </div>
      );
    }
    return (
      <RegistrosView
        planId="INTELIER-HOTELES-SL"
        hotelNombre={currentUserHotel}
        planData={registrosPlanData}
        currentUser={currentUser!}
        onBack={() => {}}
        onLogout={handleLogout}
      />
    );
  }

  // RENDER: CLIENTE (viewer) — solo ve sus planes asignados
  if (currentUserRole === 'viewer') {
    if (view === 'wizard' || view === 'registros') {
      // fall through al render correspondiente
    } else {
      return (
        <ClientDashboard
          currentUser={currentUser}
          onOpenPlan={(data) => {
            setState(s => ({ ...s, ...data, step: 1 }));
            setView('wizard');
          }}
          onOpenRegistros={(data, planId, hotelNombre) => {
            setRegistrosPlanId(planId);
            setRegistrosHotel(hotelNombre);
            setRegistrosPlanData(data);
            setView('registros');
          }}
          onLogout={handleLogout}
        />
      );
    }
  }

  // RENDER: REGISTROS VIEW
  if (view === 'registros') {
    return (
      <RegistrosView
        planId={registrosPlanId}
        hotelNombre={registrosHotel}
        planData={registrosPlanData}
        currentUser={currentUser || ''}
        onBack={() => setView('dashboard')}
      />
    );
  }

  // RENDER: USER MANAGEMENT VIEW (admin only)
  if (view === 'users') {
    return <UserManagement onBack={() => setView('dashboard')} />;
  }

  // RENDER: DASHBOARD VIEW
  if (view === 'dashboard') {
    return (
      <>
        <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col">

          {/* ── Header corporativo ── */}
          <header className="bg-header shadow-lg flex-shrink-0 no-print">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-white leading-none tracking-tight">Creación de Planes de Desperdicio PPDA</h1>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/15 text-white/80 tracking-wide whitespace-nowrap">Ley 1/2025</span>
                  </div>
                  <p className="text-xs text-header-muted mt-1 tracking-wide">Plan de Prevención y Reducción del Desperdicio Alimentario</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block mr-2">
                  <span className="block text-[9px] font-semibold uppercase text-header-muted tracking-wider">{currentUserRole}</span>
                  <span className="block text-xs font-semibold text-white">{currentUser}</span>
                </div>
                {currentUserRole === 'admin' && (
                  <>
                    <button onClick={handleExportXLS} disabled={isExporting}
                      className="p-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors"
                      title="Exportar resumen XLS">
                      {isExporting ? <RefreshCw size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />}
                    </button>
                    <button onClick={() => setView('users')}
                      className="p-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors"
                      title="Gestión de usuarios">
                      <Users size={17} />
                    </button>
                  </>
                )}
                <button onClick={() => { setShowChangePassword(true); setChangePwdStatus(null); setNewPassword(''); setConfirmPassword(''); }}
                  className="p-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors"
                  title="Cambiar contraseña">
                  <KeyRound size={17} />
                </button>
                <button onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors text-xs font-medium">
                  <LogOut size={15} /> Salir
                </button>
              </div>
            </div>
          </header>

          {/* ── Contenido dashboard ── */}
          <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            {/* Logo */}
            <div className="mb-12">
              <HsGreenLogoDashboard />
            </div>

            {/* Tarjetas de acción */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
              {/* BIBLIOTECA DE PLANES */}
              <button
                onClick={() => handleFetchCloudPlans(true)}
                disabled={isSyncing}
                className="group bg-white border border-slate-200 rounded-xl p-7 text-left hover:border-header hover:shadow-lg transition-all flex flex-col gap-4"
              >
                <div className="w-12 h-12 bg-header/10 rounded-xl flex items-center justify-center group-hover:bg-header/20 transition-colors">
                  {isSyncing ? <RefreshCw size={22} className="animate-spin text-header" /> : <Database size={22} className="text-header" />}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800 mb-1 group-hover:text-header transition-colors">Biblioteca de Planes</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">Accede a los planes guardados en la base de datos corporativa.</p>
                </div>
              </button>

              {/* NUEVO PLAN */}
              <button
                onClick={createNewPlan}
                className="group bg-white border border-slate-200 rounded-xl p-7 text-left hover:border-brand-500 hover:shadow-lg transition-all flex flex-col gap-4"
              >
                <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <Plus size={22} className="text-brand-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800 mb-1 group-hover:text-brand-700 transition-colors">Nuevo Plan</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">Iniciar un nuevo PPDA desde cero para un establecimiento.</p>
                </div>
              </button>
            </div>
          </main>

            {/* ── Biblioteca de Planes (modal) ── */}
            {showCloudModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">

                  {/* Header corporativo */}
                  <div className="bg-header px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <Database size={20} className="text-white/70" />
                      <div>
                        <h3 className="text-base font-semibold text-white leading-none">Biblioteca de Planes</h3>
                        <p className="text-xs text-white/60 mt-0.5">{cloudPlans.length} planes disponibles</p>
                      </div>
                    </div>
                    <button onClick={() => setShowCloudModal(false)}
                      className="p-1.5 text-white/60 hover:text-white hover:bg-header-light rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Barra de filtros */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Buscar por nombre de hotel o sociedad..."
                        value={cloudFilter}
                        onChange={(e) => setCloudFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                      <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <select
                      value={cloudConsultorFilter}
                      onChange={(e) => setCloudConsultorFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 min-w-[180px]"
                    >
                      <option value="">Todos los consultores</option>
                      {Array.from(new Set(cloudPlans.map(p => p.consultor).filter(Boolean))).sort().map(c => (
                        <option key={c as string} value={c as string}>{(c as string).split('@')[0]}</option>
                      ))}
                    </select>
                    {(cloudFilter || cloudConsultorFilter) && (
                      <button onClick={() => { setCloudFilter(''); setCloudConsultorFilter(''); }}
                        className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors whitespace-nowrap">
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  {/* Cabecera de tabla */}
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-3 flex-shrink-0">
                    <span className="col-span-5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Plan</span>
                    <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Consultor</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Modificado</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Acciones</span>
                  </div>

                  {/* Lista de planes */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {cloudPlans.length === 0 ? (
                      <div className="text-center py-16 text-slate-400">
                        <Database size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No hay planes en la biblioteca.</p>
                      </div>
                    ) : (() => {
                      const filteredPlans = cloudPlans
                        .filter(plan => {
                          const fl = cloudFilter.toLowerCase();
                          const nameMatch = !cloudFilter || plan.hotel.toLowerCase().includes(fl);
                          const chainMatch = !cloudFilter || (
                            plan.data?.society?.razonSocial?.toLowerCase().includes(fl) ||
                            plan.data?.hotelData?.razonSocial?.toLowerCase().includes(fl) || false
                          );
                          const consultorMatch = !cloudConsultorFilter || plan.consultor === cloudConsultorFilter;
                          return (nameMatch || chainMatch) && consultorMatch;
                        })
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      if (filteredPlans.length === 0) return (
                        <div className="text-center py-16 text-slate-400">
                          <p className="text-sm font-medium">Sin resultados para los filtros aplicados.</p>
                        </div>
                      );

                      return filteredPlans.map((plan, idx) => {
                        const isBroken = !plan.data;
                        const isCorp = plan.data?.scope === 'corporate';
                        const society = plan.data?.society?.razonSocial || plan.data?.hotelData?.razonSocial;
                        const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                        const consultor = plan.consultor ? plan.consultor.split('@')[0] : '—';

                        return (
                          <div key={idx}
                            onClick={() => !isBroken && importCloudPlan(plan)}
                            className={`px-5 py-3 grid grid-cols-12 gap-3 items-center transition-colors ${
                              isBroken ? 'bg-red-50 cursor-default' : 'hover:bg-brand-50/40 cursor-pointer group'
                            }`}
                          >
                            {/* Col: nombre + badges */}
                            <div className="col-span-5 flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                isBroken ? 'bg-red-100 text-red-500' : isCorp ? 'bg-header/10 text-header' : 'bg-brand-100 text-brand-700'
                              }`}>
                                {isBroken ? '!' : plan.hotel.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-sm font-semibold truncate ${isBroken ? 'text-red-700' : 'text-slate-800 group-hover:text-header'}`}>
                                    {plan.hotel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                    isBroken ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                                  }`}>{isBroken ? 'DAÑADO' : (plan.version || 'V1')}</span>
                                  {isCorp && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-header/10 text-header uppercase tracking-wide">Corporativo</span>}
                                  {society && !isCorp && <span className="text-[9px] text-slate-400 truncate">{society}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Col: consultor */}
                            <div className="col-span-3 min-w-0">
                              <span className="text-xs text-slate-500 truncate block">{consultor}</span>
                            </div>

                            {/* Col: fecha */}
                            <div className="col-span-2">
                              <span className="text-xs text-slate-400">{fmtDate(plan.date)}</span>
                            </div>

                            {/* Col: acciones */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {plan.data && currentUserRole !== 'viewer' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAssignModal(plan.planId); }}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    planAssignedMap[plan.planId]
                                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                      : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'
                                  }`}
                                  title="Asignar a cliente">
                                  <Users size={15} />
                                </button>
                              )}
                              {currentUserRole !== 'viewer' && (
                                <button
                                  onClick={(e) => handleCloudDelete(plan.planId, e)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar">
                                  <Trash2 size={15} />
                                </button>
                              )}
                              {!isBroken && (
                                <div className="p-1.5 text-slate-300 group-hover:text-header transition-colors">
                                  <ChevronRight size={16} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                    <p className="text-[10px] text-slate-400">
                      {cloudFilter || cloudConsultorFilter
                        ? `Mostrando planes filtrados de ${cloudPlans.length} totales`
                        : `${cloudPlans.length} planes en la biblioteca · Haz clic en un plan para abrirlo`}
                    </p>
                  </div>

                </div>
              </div>
            )}

        </div>{/* min-h-screen dashboard */}

        {/* Change Password Modal */}
        {showChangePassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <KeyRound size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg leading-none">Cambiar contraseña</p>
                    <p className="text-amber-100 text-xs mt-1">{currentUser}</p>
                  </div>
                </div>
                <button onClick={() => setShowChangePassword(false)} className="text-white/70 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {changePwdStatus && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium ${changePwdStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {changePwdStatus.msg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (newPassword.length < 8) { setChangePwdStatus({ type: 'error', msg: 'La contraseña debe tener al menos 8 caracteres.' }); return; }
                    if (newPassword !== confirmPassword) { setChangePwdStatus({ type: 'error', msg: 'Las contraseñas no coinciden.' }); return; }
                    setChangePwdLoading(true);
                    const { error } = await supabase.auth.updateUser({ password: newPassword });
                    setChangePwdLoading(false);
                    if (error) { setChangePwdStatus({ type: 'error', msg: error.message }); }
                    else { setChangePwdStatus({ type: 'success', msg: '¡Contraseña actualizada correctamente!' }); setNewPassword(''); setConfirmPassword(''); setTimeout(() => setShowChangePassword(false), 1800); }
                  }}
                  disabled={changePwdLoading || !newPassword || !confirmPassword}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-colors"
                >
                  {changePwdLoading ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // RENDER: WIZARD VIEW
  const STEP_CONFIG = [
    { num: 1, label: 'Identificación',        Icon: Building2,      section: null       },
    { num: 2, label: 'Zonas y P. Generación', Icon: MapPin,         section: null       },
    { num: 3, label: 'Diagnóstico',           Icon: ScanSearch,     section: null       },
    { num: 4, label: 'Estrategia',            Icon: Target,         section: null       },
    { num: 5, label: 'Seguimiento Objetivos', Icon: LayoutDashboard,section: null       },
    { num: 6, label: "KPI's y Medición",      Icon: Scale,          section: 'Resultados' },
    { num: 7, label: 'Informe',               Icon: FileText,       section: null       },
    { num: 8, label: 'Historial de Versiones',Icon: History,        section: 'Historial'  },
  ];
  const planLabel = state.scope === 'corporate'
    ? (state.society?.razonSocial || 'Nuevo Plan')
    : (state.hotelData?.nombreComercial || 'Nuevo Plan');

  return (
  <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col selection:bg-brand-100">

    {/* ── Header corporativo wizard ── */}
    <header className="bg-header shadow-md sticky top-0 z-30 no-print flex-shrink-0">
      <div className="px-6 h-20 flex items-center justify-between gap-4">
        {/* Izquierda: back + logo + plan */}
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => setView('dashboard')}
            className="p-2 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors flex-shrink-0"
            title="Volver a inicio">
            <Home size={18} />
          </button>
          <div className="w-px h-6 bg-white/20 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white leading-none truncate">{planLabel}</h1>
              <span className="text-[9px] bg-white/15 text-white/80 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 flex-shrink-0">
                <GitBranch size={9}/> {state.version || 'V0'}
              </span>
            </div>
            <p className="text-xs text-header-muted mt-1 tracking-wide">Creación de Planes de Desperdicio PPDA · <span className="text-white/50">Ley 1/2025</span></p>
          </div>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <>
            {/* Indicador cambios sin guardar */}
            {hasUnsavedChanges && !isSyncing && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Sin guardar
              </span>
            )}
            <button onClick={handleCloudSave} disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSyncing
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : hasUnsavedChanges
                  ? 'bg-amber-400 text-amber-900 hover:bg-amber-300 shadow-sm font-semibold'
                  : 'bg-white text-header hover:bg-white/90 shadow-sm'
              }`}>
              {isSyncing ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{isSyncing ? 'Guardando...' : 'Guardar'}</span>
            </button>
            {currentUserRole !== 'viewer' && (
              <button onClick={handleSaveNewVersion} disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/15 hover:bg-white/25 transition-all border border-white/25">
                <GitBranch size={13} />
                <span>Nueva versión</span>
              </button>
            )}
          </>
          {state.step < 6 && (
            <button onClick={goToTracking}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-all text-xs font-medium border border-white/20">
              <LayoutDashboard size={13} /> Seguimiento
            </button>
          )}
          <button onClick={toggleFullScreen}
            className="p-1.5 text-header-muted hover:text-white hover:bg-header-light rounded-lg transition-colors">
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>
    </header>

    {/* ── Layout: sidebar + contenido ── */}
    <div className="flex flex-1 overflow-hidden">

      {/* Sidebar navegación */}
      <aside className="w-52 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col no-print overflow-y-auto">
        <nav className="flex-1 py-3">
          {(() => {
            const visibleSteps = STEP_CONFIG.filter(({ num }) => !(state.scope === 'corporate' && num === 2));
            return visibleSteps.map(({ num, label, Icon, section }, idx) => {
            const displayNum = idx + 1;
            const isActive = state.step === num;
            return (
              <React.Fragment key={num}>
                {section && (
                  <div className="mx-4 mt-3 mb-1 border-t border-slate-100 pt-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                      {section}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setState(s => ({ ...s, step: num }))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all relative group ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-600 rounded-r" />
                  )}
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-colors ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>{displayNum}</span>
                  <span className={`text-xs font-medium truncate ${isActive ? 'font-semibold' : ''}`}>{label}</span>
                </button>
              </React.Fragment>
            );
          });
          })()}
        </nav>
        {/* Footer sidebar: user info */}
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 truncate">{currentUser}</p>
          <button onClick={() => setView('dashboard')}
            className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
            <Home size={11} /> Inicio
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 pb-24">
        {state.step === 1 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Identificación y Alcance</h2>
                {/* Scope toggle: solo visible para admin/consultor; los viewers ven el alcance en modo solo lectura */}
                {currentUserRole !== 'viewer' ? (
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
                ) : (
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    {state.scope === 'corporate' ? 'Corporativo' : 'Individual'}
                  </span>
                )}
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
            <DiagnosisForm
              data={state.diagnosisData}
              onChange={(d) => setState(s => ({ ...s, diagnosisData: d }))}
              scope={state.scope}
              hotels={state.hotels}
            />
          </div>
        )}

        {state.step === 4 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estrategia SMART</h2>
            </header>
            <ObjectiveSelection objectives={state.objectives} setObjectives={(o) => setState(s => ({ ...s, objectives: o }))} phases={getPhasesForPlan(state.planId)} />
          </div>
        )}

        {state.step === 5 && (
           <div className="space-y-6">
              <TrackingView objectives={state.objectives} setObjectives={(o) => setState(s => ({ ...s, objectives: o }))} currentYear={state.currentTrackingYear} setCurrentYear={(y) => setState(s => ({...s, currentTrackingYear: y}))} phases={getPhasesForPlan(state.planId)} />
           </div>
        )}

        {state.step === 6 && (
          <div className="space-y-6">
            <header className="border-b border-slate-200 pb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">KPI's y Medición</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Definición de KPIs y procedimientos de control.</p>
            </header>
            <MeasurementForm
              config={state.measurementConfig}
              setConfig={(c) => setState(s => ({ ...s, measurementConfig: c }))}
              registros={pesajesDB}
              areas={state.areas}
              hotels={state.hotels}
              scope={state.scope}
            />
          </div>
        )}

        {state.step === 7 && (
            <FinalReport
                state={state}
                setState={setState}
                onCloudSave={handleCloudSave}
                onSaveNewVersion={currentUserRole !== 'viewer' ? handleSaveNewVersion : undefined}
                isSyncing={isSyncing}
            />
        )}

        {state.step === 8 && (
          <div className="space-y-6">
            <VersionHistory planId={state.planId} />
          </div>
        )}
        </div>{/* max-w-5xl */}
      </main>
    </div>{/* flex sidebar+main */}

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