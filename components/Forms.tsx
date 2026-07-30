import React, { useRef, useState, useEffect } from 'react';
import { HotelData, Area, AreaMedicion, TeamMember } from '../types';
import { COMMON_PPDA_FUNCTIONS } from '../constants';
import { Building2, MapPin, Users, Utensils, Clock, Trash2, Plus, Upload, CheckCircle2, FileText, ImageIcon, PenTool, Eraser, X, ChevronDown, ChevronUp, CheckSquare, Square, Beef, Leaf, Droplets, Apple, Flame, Egg, Drumstick, Zap, Sprout, Wheat, Cookie } from 'lucide-react';

const CATEGORIAS_PESAJE = ['Desperdicio Buffet', 'Mermas cocina', 'Restos de plato', 'Caducidades/almacén', 'Comedor personal'];

// ── Taxonomía de alimentos para desglose de pesaje ───────────────────────────
export interface CatDef {
  id: string;
  label: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  color: string;       // bg color chip seleccionado
  iconColor: string;   // color del icono
}
export interface CatGroup { label: string; color: string; items: CatDef[] }

export const FOOD_TAXONOMY: CatGroup[] = [
  {
    label: 'Frío',
    color: 'bg-sky-100 text-sky-800 border-sky-200',
    items: [
      { id: 'embutidos',      label: 'Embutidos',      Icon: Beef,      color: 'bg-rose-100 border-rose-400 text-rose-800',  iconColor: '#be185d' },
      { id: 'verduras_frias', label: 'Verduras Frías', Icon: Leaf,      color: 'bg-green-100 border-green-400 text-green-800', iconColor: '#15803d' },
      { id: 'lacteos',        label: 'Lácteos',        Icon: Droplets,  color: 'bg-blue-100 border-blue-400 text-blue-800',   iconColor: '#0369a1' },
      { id: 'frutas',         label: 'Frutas',         Icon: Apple,     color: 'bg-orange-100 border-orange-400 text-orange-700', iconColor: '#ea580c' },
    ],
  },
  {
    label: 'Caliente',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    items: [
      { id: 'elaborados',        label: 'Elaborados',        Icon: Flame,     color: 'bg-amber-100 border-amber-400 text-amber-800',  iconColor: '#d97706' },
      { id: 'huevos',            label: 'Huevos',            Icon: Egg,       color: 'bg-yellow-100 border-yellow-400 text-yellow-800', iconColor: '#ca8a04' },
      { id: 'proteinas',         label: 'Proteínas',         Icon: Drumstick, color: 'bg-red-100 border-red-400 text-red-800',        iconColor: '#dc2626' },
      { id: 'fritos',            label: 'Fritos',            Icon: Zap,       color: 'bg-orange-100 border-orange-400 text-orange-800', iconColor: '#f97316' },
      { id: 'verduras_calientes',label: 'Verduras Calientes',Icon: Sprout,    color: 'bg-emerald-100 border-emerald-400 text-emerald-800', iconColor: '#166534' },
    ],
  },
  {
    label: 'Productos Secos',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    items: [
      { id: 'cereales',          label: 'Cereales',          Icon: Wheat,     color: 'bg-yellow-50 border-yellow-400 text-yellow-800', iconColor: '#92400e' },
      { id: 'panaderia',         label: 'Panes y Bollería',  Icon: Cookie,    color: 'bg-stone-100 border-stone-400 text-stone-800',  iconColor: '#78350f' },
    ],
  },
];
const MODULOS_IA = ['Desayuno', 'Almuerzo', 'Cena', 'Cocina', 'Almacén', 'Room Service'];

// --- STYLES ---
const inputClass = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold text-slate-700 bg-white";
const labelClass = "block text-xs font-black text-slate-500 uppercase tracking-wider";
const sectionClass = "bg-white p-6 rounded-2xl shadow-sm border border-slate-200";

// --- SIGNATURE PAD COMPONENT ---
const SignaturePad = ({ onSave, onClear, initialImage }: { onSave: (data: string) => void, onClear: () => void, initialImage?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Inicializar canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            // Ajustar resolución para pantallas de alta densidad (Retina)
            const ratio = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(ratio, ratio);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
                
                // Cargar imagen inicial si existe
                if (initialImage) {
                    const img = new Image();
                    img.src = initialImage;
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, rect.width, rect.height);
                    };
                }
            }
        }
    }, []); // Ejecutar solo al montar

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) {
             // Evitar scroll en móviles al firmar
             // e.preventDefault(); // Comentado para no bloquear scroll completo de página si se toca fuera
        }
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        if ('touches' in e) e.preventDefault(); // Prevenir scroll solo al arrastrar dentro del canvas
        
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            if (canvas) {
                // Crear un canvas temporal para añadir fondo blanco
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                if (tempCtx) {
                    // Rellenar fondo blanco
                    tempCtx.fillStyle = '#FFFFFF';
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    // Dibujar la firma original encima
                    tempCtx.drawImage(canvas, 0, 0);
                    
                    // Exportar como JPEG comprimido
                    onSave(tempCanvas.toDataURL('image/jpeg', 0.5));
                }
            }
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            // Limpiar usando las dimensiones reales del canvas (escaladas)
            ctx?.clearRect(0, 0, canvas.width, canvas.height); 
            // También resetear path
            ctx?.beginPath();
            onClear();
        }
    };

    return (
        <div className="relative w-full h-full bg-slate-50 rounded-xl overflow-hidden touch-none border border-slate-200">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair block"
                style={{ touchAction: 'none' }} 
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            
            {/* Botón Borrar siempre visible si hay contenido o para permitir correcciones */}
            <div className="absolute top-2 right-2 flex gap-2">
                <button type="button" onClick={handleClear} className="text-[10px] bg-white/80 backdrop-blur text-red-500 px-2 py-1 rounded-full hover:bg-red-50 border border-red-100 shadow-sm flex items-center gap-1 font-bold z-20">
                    <Eraser size={12} /> Borrar
                </button>
            </div>
            
            {/* Indicador visual "Firmar aquí" solo si no hay imagen inicial (y el usuario no ha dibujado aún, aunque controlar eso reactivamente es complejo con canvas, mejor dejarlo sutil) */}
            {!initialImage && !isDrawing && (
                <div className="absolute bottom-2 left-2 pointer-events-none text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                    Espacio para firmar
                </div>
            )}
        </div>
    );
};


// --- SOCIETY FORM ---
interface SocietyFormProps {
  data: {
    razonSocial: string;
    cif: string;
    direccion: string;
    codigoPostal: string;
    municipio: string;
    provincia: string;
  };
  onChange: (data: any) => void;
}

export const SocietyForm: React.FC<SocietyFormProps> = ({ data, onChange }) => {
  const handleChange = (field: string, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
          <Building2 className="text-brand-600" size={20} />
          <h3 className="text-lg font-black text-slate-800">Datos de la Sociedad (Corporativo)</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Razón Social</label>
          <input type="text" value={data.razonSocial} onChange={(e) => handleChange('razonSocial', e.target.value)} className={inputClass} placeholder="Grupo Hotelero S.A." />
        </div>
        <div>
          <label className={labelClass}>CIF</label>
          <input type="text" value={data.cif} onChange={(e) => handleChange('cif', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Dirección Fiscal</label>
          <input type="text" value={data.direccion} onChange={(e) => handleChange('direccion', e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-4">
           <div className="col-span-1">
              <label className={labelClass}>CP</label>
              <input type="text" value={data.codigoPostal} onChange={(e) => handleChange('codigoPostal', e.target.value)} className={inputClass} />
           </div>
           <div className="col-span-2">
              <label className={labelClass}>Municipio</label>
              <input type="text" value={data.municipio} onChange={(e) => handleChange('municipio', e.target.value)} className={inputClass} />
           </div>
        </div>
        <div>
           <label className={labelClass}>Provincia</label>
           <input type="text" value={data.provincia} onChange={(e) => handleChange('provincia', e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
};

// --- HOTEL LIST FORM (CORPORATE) ---
interface HotelListFormProps {
  hotels: HotelData[];
  setHotels: (hotels: HotelData[]) => void;
}

export const HotelListForm: React.FC<HotelListFormProps> = ({ hotels, setHotels }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Estado temporal para el hotel que se está añadiendo/editando
  const [tempHotel, setTempHotel] = useState<HotelData>({
      razonSocial: '', nombreComercial: '', cif: '', categoria: '', direccion: '', codigoPostal: '', municipio: '', provincia: '',
      numHabitaciones: 0, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0, superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '',
      areas: [], team: []
  });

  const handleSave = () => {
    if (!tempHotel.nombreComercial) return alert("El nombre comercial es obligatorio");
    
    if (editingIndex !== null) {
        const newHotels = [...hotels];
        newHotels[editingIndex] = tempHotel;
        setHotels(newHotels);
        setEditingIndex(null);
    } else {
        setHotels([...hotels, tempHotel]);
    }
    setIsAdding(false);
    setTempHotel({
        razonSocial: '', nombreComercial: '', cif: '', categoria: '', direccion: '', codigoPostal: '', municipio: '', provincia: '',
        numHabitaciones: 0, capacidadMax: 0, numEmpleados: 0, numEmpleadosFB: 0, superficieRestauracion: 0, logo: '', hasDonationProtocol: false, donationProtocolFile: '',
        areas: [], team: []
    });
  };

  const handleEdit = (index: number) => {
      setTempHotel({ ...hotels[index], areas: hotels[index].areas || [], team: hotels[index].team || [] });
      setEditingIndex(index);
      setIsAdding(true);
  };

  const handleDelete = (index: number) => {
      if (confirm("¿Eliminar este hotel?")) {
          setHotels(hotels.filter((_, i) => i !== index));
      }
  };

  const handleCancel = () => {
      setIsAdding(false);
      setEditingIndex(null);
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">Hoteles del Grupo ({hotels.length})</h3>
            {!isAdding && (
                <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors">
                    <Plus size={16} /> Añadir Hotel
                </button>
            )}
        </div>

        {isAdding && (
            <div className="bg-slate-50 p-6 rounded-xl border border-brand-200 shadow-lg animate-in fade-in zoom-in-95">
                {/* CABECERA CON NOMBRE + BOTONES ARRIBA */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-brand-100">
                    <h4 className="text-lg font-bold text-brand-800">
                        {editingIndex !== null
                            ? tempHotel.nombreComercial || 'Editar Hotel'
                            : 'Nuevo Hotel'}
                    </h4>
                    <div className="flex gap-2">
                        <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-slate-500 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                        <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition-colors">Guardar Hotel</button>
                    </div>
                </div>

                {/* DATOS GENERALES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b border-slate-200 pb-6">
                    <div>
                        <label className={labelClass}>Nombre Comercial</label>
                        <input type="text" value={tempHotel.nombreComercial} onChange={e => setTempHotel({...tempHotel, nombreComercial: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Categoría</label>
                        <input type="text" value={tempHotel.categoria} onChange={e => setTempHotel({...tempHotel, categoria: e.target.value})} className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Dirección</label>
                        <input type="text" value={tempHotel.direccion} onChange={e => setTempHotel({...tempHotel, direccion: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Municipio</label>
                        <input type="text" value={tempHotel.municipio} onChange={e => setTempHotel({...tempHotel, municipio: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Provincia</label>
                        <input type="text" value={tempHotel.provincia} onChange={e => setTempHotel({...tempHotel, provincia: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Nº Habitaciones</label>
                        <input type="number" value={tempHotel.numHabitaciones} onChange={e => setTempHotel({...tempHotel, numHabitaciones: parseInt(e.target.value) || 0})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Capacidad Max (pax)</label>
                        <input type="number" value={tempHotel.capacidadMax} onChange={e => setTempHotel({...tempHotel, capacidadMax: parseInt(e.target.value) || 0})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Total Empleados</label>
                        <input type="number" value={tempHotel.numEmpleados} onChange={e => setTempHotel({...tempHotel, numEmpleados: parseInt(e.target.value) || 0})} className={inputClass} />
                    </div>
                </div>

                {/* ZONAS DE DESPERDICIO ESPECÍFICAS */}
                <div className="mb-6">
                    <h5 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Utensils size={16} /> Zonas de Desperdicio ({tempHotel.areas?.length || 0})
                    </h5>
                    <AreasForm
                        areas={tempHotel.areas || []}
                        setAreas={(newAreas) => setTempHotel({ ...tempHotel, areas: newAreas })}
                    />
                </div>

                {/* EQUIPO RESPONSABLE DEL HOTEL */}
                <div className="mb-6">
                    <h5 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Users size={16} /> Equipo Responsable PPDA ({tempHotel.team?.length || 0})
                    </h5>
                    <TeamForm
                        team={tempHotel.team || []}
                        setTeam={(newTeam) => setTempHotel({ ...tempHotel, team: newTeam })}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button onClick={handleCancel} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700">Guardar Hotel</button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotels.map((hotel, idx) => {
              const isCurrentlyEditing = isAdding && editingIndex === idx;
              return (
                <div key={idx} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all relative group ${isCurrentlyEditing ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-black text-lg">
                            {hotel.nombreComercial.charAt(0)}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => isCurrentlyEditing ? handleCancel() : handleEdit(idx)} className={`p-1.5 rounded transition-colors ${isCurrentlyEditing ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                                <PenTool size={14}/>
                            </button>
                            <button onClick={() => handleDelete(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    <h4
                        className={`font-bold truncate cursor-pointer transition-colors ${isCurrentlyEditing ? 'text-brand-700' : 'text-slate-800 hover:text-brand-600'}`}
                        onClick={() => isCurrentlyEditing ? handleCancel() : handleEdit(idx)}
                        title={isCurrentlyEditing ? 'Cerrar panel de edición' : 'Abrir para editar'}
                    >{hotel.nombreComercial}</h4>
                    <p className="text-xs text-slate-500 mb-2">{hotel.municipio}, {hotel.provincia}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded mb-2">
                        <span>{hotel.numHabitaciones} Habs</span>
                        <span>•</span>
                        <span>{hotel.capacidadMax} Pax</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-1 rounded inline-block">
                            {hotel.areas?.length || 0} Zonas
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded inline-block flex items-center gap-1">
                            <Users size={10} /> {hotel.team?.length || 0} Responsables
                        </div>
                    </div>
                </div>
              );
            })}
        </div>
    </div>
  );
};

// --- PLAN CONTEXT FORM ---
interface PlanContextFormProps {
  baselineYear: string;
  setBaselineYear: (year: string) => void;
  periodoPlan: string;
  setPeriodoPlan: (period: string) => void;
  fechaVisita: string;
  setFechaVisita: (date: string) => void;
  consultor: string;
  setConsultor: (consultor: string) => void;
  consultorOptions?: { email: string; full_name: string }[];
}

export const PlanContextForm: React.FC<PlanContextFormProps> = ({
  baselineYear, setBaselineYear, periodoPlan, setPeriodoPlan, fechaVisita, setFechaVisita, consultor, setConsultor, consultorOptions
}) => {
  return (
    <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Clock className="text-brand-600" size={20} />
            <h3 className="text-lg font-black text-slate-800">Contexto del Plan</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className={labelClass}>Año Línea Base</label>
                <input type="text" value={baselineYear} onChange={(e) => setBaselineYear(e.target.value)} className={inputClass} />
             </div>
             <div>
                <label className={labelClass}>Periodo Plan</label>
                <input type="text" value={periodoPlan} onChange={(e) => setPeriodoPlan(e.target.value)} className={inputClass} />
             </div>
             <div>
                <label className={labelClass}>Fecha Inicio/Visita</label>
                <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} className={inputClass} />
             </div>
             <div>
                <label className={labelClass}>Consultor Responsable</label>
                {consultorOptions && consultorOptions.length > 0 ? (
                  <select value={consultor} onChange={(e) => setConsultor(e.target.value)} className={inputClass}>
                    <option value="">— Seleccionar consultor —</option>
                    {consultorOptions.map(c => (
                      <option key={c.email} value={c.email}>{c.full_name || c.email}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={consultor} onChange={(e) => setConsultor(e.target.value)} className={inputClass} />
                )}
             </div>
        </div>
    </div>
  );
};

// --- GENERAL FORM ---
interface GeneralFormProps {
  data: HotelData;
  onChange: (data: HotelData) => void;
  baselineYear: string;
  setBaselineYear: (year: string) => void;
  periodoPlan: string;
  setPeriodoPlan: (period: string) => void;
  fechaVisita: string;
  setFechaVisita: (date: string) => void;
  consultor: string;
  setConsultor: (consultor: string) => void;
  consultorOptions?: { email: string; full_name: string }[];
}

export const GeneralForm: React.FC<GeneralFormProps> = ({
  data, onChange, baselineYear, setBaselineYear, periodoPlan, setPeriodoPlan, fechaVisita, setFechaVisita, consultor, setConsultor, consultorOptions
}) => {
  const protocolInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof HotelData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleProtocolUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        handleChange('donationProtocolFile', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 300;

          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          handleChange('logo', compressedBase64);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
                <Building2 className="text-brand-600" size={20} />
                <h3 className="text-lg font-black text-slate-800">Datos del Establecimiento</h3>
            </div>
            
            {/* Logo Upload Button Mini */}
            <div onClick={() => logoInputRef.current?.click()} className="cursor-pointer flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors">
                <ImageIcon size={14} />
                {data.logo ? "Cambiar Logo" : "Subir Logo"}
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
            </div>
        </div>
        
        {data.logo && (
            <div className="mb-4 flex justify-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                <img src={data.logo} alt="Hotel Logo" className="h-16 object-contain" />
            </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Razón Social</label>
            <input type="text" value={data.razonSocial} onChange={(e) => handleChange('razonSocial', e.target.value)} className={inputClass} placeholder="Empresa S.L." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>Nombre Comercial</label>
                <input type="text" value={data.nombreComercial} onChange={(e) => handleChange('nombreComercial', e.target.value)} className={inputClass} placeholder="Hotel Ejemplo" />
            </div>
            <div>
                <label className={labelClass}>Categoría</label>
                <input type="text" value={data.categoria} onChange={(e) => handleChange('categoria', e.target.value)} className={inputClass} placeholder="4 Estrellas" />
            </div>
          </div>
          <div>
            <label className={labelClass}>CIF</label>
            <input type="text" value={data.cif} onChange={(e) => handleChange('cif', e.target.value)} className={inputClass} />
          </div>
          <div>
             <label className={labelClass}>Consultor Responsable</label>
             {consultorOptions && consultorOptions.length > 0 ? (
               <select value={consultor} onChange={(e) => setConsultor(e.target.value)} className={inputClass}>
                 <option value="">— Seleccionar consultor —</option>
                 {consultorOptions.map(c => (
                   <option key={c.email} value={c.email}>{c.full_name || c.email}</option>
                 ))}
               </select>
             ) : (
               <input type="text" value={consultor} onChange={(e) => setConsultor(e.target.value)} className={inputClass} />
             )}
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <MapPin className="text-brand-600" size={20} />
            <h3 className="text-lg font-black text-slate-800">Ubicación y Alcance</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Dirección</label>
            <input type="text" value={data.direccion} onChange={(e) => handleChange('direccion', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-1">
                <label className={labelClass}>CP</label>
                <input type="text" value={data.codigoPostal} onChange={(e) => handleChange('codigoPostal', e.target.value)} className={inputClass} />
             </div>
             <div className="col-span-2">
                <label className={labelClass}>Municipio</label>
                <input type="text" value={data.municipio} onChange={(e) => handleChange('municipio', e.target.value)} className={inputClass} />
             </div>
          </div>
          <div>
             <label className={labelClass}>Provincia</label>
             <input type="text" value={data.provincia} onChange={(e) => handleChange('provincia', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
             <div>
                <label className={labelClass}>Año Línea Base</label>
                <input type="text" value={baselineYear} onChange={(e) => setBaselineYear(e.target.value)} className={inputClass} />
             </div>
             <div>
                <label className={labelClass}>Periodo Plan</label>
                <input type="text" value={periodoPlan} onChange={(e) => setPeriodoPlan(e.target.value)} className={inputClass} />
             </div>
          </div>
        </div>
      </div>

      <div className={`${sectionClass} md:col-span-2`}>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Users className="text-brand-600" size={20} />
            <h3 className="text-lg font-black text-slate-800">Dimensionamiento y Donación</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
                <label className={labelClass}>Nº Habitaciones</label>
                <input type="number" value={data.numHabitaciones} onChange={(e) => handleChange('numHabitaciones', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Capacidad Max (pax)</label>
                <input type="number" value={data.capacidadMax} onChange={(e) => handleChange('capacidadMax', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Total Empleados</label>
                <input type="number" value={data.numEmpleados} onChange={(e) => handleChange('numEmpleados', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Empleados F&B</label>
                <input type="number" value={data.numEmpleadosFB} onChange={(e) => handleChange('numEmpleadosFB', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="flex items-center gap-4">
              <input 
                 type="checkbox" 
                 id="hasProtocol"
                 checked={data.hasDonationProtocol} 
                 onChange={(e) => handleChange('hasDonationProtocol', e.target.checked)}
                 className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-300 bg-white"
              />
              <label htmlFor="hasProtocol" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                 ¿Dispone de convenio/protocolo de donación activo?
              </label>
           </div>

           <div>
               {data.hasDonationProtocol && (
                   <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => protocolInputRef.current?.click()}>
                       <input 
                            type="file" 
                            ref={protocolInputRef} 
                            onChange={handleProtocolUpload} 
                            accept="application/pdf,image/*" 
                            className="hidden" 
                       />
                       <div className="flex flex-col items-center text-slate-500">
                          {data.donationProtocolFile ? (
                             <>
                                <CheckCircle2 className="text-green-500 mb-1" size={24} />
                                <span className="text-xs font-bold text-green-700">Protocolo adjuntado</span>
                                <span className="text-[9px] uppercase font-black text-slate-400 mt-1">Clic para cambiar (PDF/Img)</span>
                             </>
                          ) : (
                             <>
                                <Upload className="mb-1" size={20} />
                                <span className="text-xs font-bold">Adjuntar Protocolo (PDF/Img)</span>
                             </>
                          )}
                          <p className="text-[8px] text-slate-400 mt-1.5 italic text-center">* Se adjuntará como Anexo I</p>
                       </div>
                   </div>
               )}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- AREAS FORM ---
interface AreasFormProps {
  areas: Area[];
  setAreas: (areas: Area[]) => void;
}

export const AreasForm: React.FC<AreasFormProps> = ({ areas, setAreas }) => {
  const [expanded,   setExpanded]   = useState<Set<string>>(() => new Set(areas.map(a => a.id)));
  const [draggedId,  setDraggedId]  = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const toggleExpanded = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const from = areas.findIndex(a => a.id === draggedId);
    const to   = areas.findIndex(a => a.id === targetId);
    const next = [...areas];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setAreas(next);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  const addArea = () => {
    const newArea: Area = {
      id: Date.now().toString(),
      nombre: '',
      superficie: 0,
      capacidad: 0,
      numServiciosDia: 0,
      tipoServicio: '',
      esBuffet: false,
      horarios: '',
      tienePuntoPesaje: false,
      tipoSistemaPesaje: ''
    };
    setAreas([...areas, newArea]);
    setExpanded(prev => new Set([...prev, newArea.id]));
  };

  const updateArea = (id: string, field: keyof Area, value: any) => {
    setAreas(areas.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeArea = (id: string) => {
    setAreas(areas.filter(a => a.id !== id));
    setExpanded(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  // Badge de color por sistema de pesaje
  const sistemaBadge = (tipo: string | undefined) => {
    if (!tipo) return null;
    const cfg =
      tipo === 'Báscula Tradicional'          ? { label: 'Báscula',  cls: 'bg-sky-50 text-sky-700 border-sky-200' } :
      tipo.includes('Winnow')                 ? { label: 'Winnow',   cls: 'bg-violet-50 text-violet-700 border-violet-200' } :
      tipo.includes('Efiwaste')               ? { label: 'Efiwaste', cls: 'bg-violet-50 text-violet-700 border-violet-200' } :
      tipo.includes('P1')                     ? { label: 'P1',       cls: 'bg-amber-50 text-amber-700 border-amber-200' } :
      tipo.includes('P3')                     ? { label: 'P3',       cls: 'bg-teal-50 text-teal-700 border-teal-200' } :
      tipo === 'Otros'                        ? { label: 'Otros',    cls: 'bg-slate-100 text-slate-500 border-slate-200' } : null;
    if (!cfg) return null;
    return (
      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className={sectionClass}>
       <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
             <Utensils className="text-brand-600" size={20} />
             <h3 className="text-lg font-black text-slate-800">Puntos de Generación de Desperdicio</h3>
          </div>
          <button onClick={addArea} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-brand-100 transition-colors">
             <Plus size={14} /> Añadir Zona
          </button>
       </div>

       <div className="space-y-4">
         {areas.length === 0 && (
            <div className="text-center py-8 text-slate-400 italic text-sm border border-dashed border-slate-200 rounded-xl">
               No hay zonas registradas. Añade puntos de venta (Restaurantes, Bares, Cocinas...).
            </div>
         )}
         {areas.map((area, index) => {
           const isOpen    = expanded.has(area.id);
           const isDragged = draggedId  === area.id;
           const isOver    = dragOverId === area.id;
           return (
           <div
             key={area.id}
             draggable
             onDragStart={() => handleDragStart(area.id)}
             onDragOver={e  => handleDragOver(e, area.id)}
             onDrop={() => handleDrop(area.id)}
             onDragEnd={handleDragEnd}
             className="rounded-xl border bg-white shadow-sm overflow-hidden transition-all"
             style={{
               borderColor:  isOver   ? '#1a3d2b' : '#e2e8f0',
               borderWidth:  isOver   ? 2         : 1,
               opacity:      isDragged ? 0.4       : 1,
               boxShadow:    isOver   ? '0 0 0 3px rgba(26,61,43,0.12)' : undefined,
               cursor: 'grab',
             }}
           >

              {/* ── CABECERA (siempre visible, clickable) ── */}
              <div
                className="flex items-center gap-3 px-4 py-3 select-none group"
                style={{ backgroundColor: isOpen ? '#f8fafc' : '#fff', cursor: 'grab' }}
                onClick={() => toggleExpanded(area.id)}
              >
                {/* Handle de arrastre */}
                <span className="text-slate-300 hover:text-slate-500 flex-shrink-0 cursor-grab" title="Arrastrar para reordenar">
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                    <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                    <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                  </svg>
                </span>
                {/* Número */}
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>

                {/* Nombre editable — clic no propaga al toggle */}
                <input
                  type="text"
                  value={area.nombre}
                  onChange={e => updateArea(area.id, 'nombre', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Nombre de la zona…"
                  className="flex-1 min-w-0 text-sm font-bold text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-300 focus:ring-0 p-0"
                />

                {/* Badges de estado */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {area.tienePuntoPesaje && area.tipoSistemaPesaje && sistemaBadge(area.tipoSistemaPesaje)}
                  {area.tienePuntoPesaje && (
                    <span className="text-[9px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
                      ✓ Pesaje
                    </span>
                  )}
                  {area.tipoServicio && (
                    <span className="hidden sm:inline text-[9px] text-slate-400 font-medium truncate max-w-[120px]">
                      {area.tipoServicio}
                    </span>
                  )}
                </div>

                {/* Chevron + borrar */}
                <ChevronDown
                  size={16}
                  className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
                <button
                  onClick={e => { e.stopPropagation(); removeArea(area.id); }}
                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* ── CUERPO (colapsable) ── */}
              <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[1400px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">

                  {/* Fila de configuración básica */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2">
                    <div className="md:col-span-3">
                      <label className={labelClass}>Tipo de Servicio</label>
                      <input type="text" value={area.tipoServicio} onChange={(e) => updateArea(area.id, 'tipoServicio', e.target.value)} className={inputClass} placeholder="Ej: Desayuno buffet..." />
                    </div>
                    <div className="md:col-span-2 flex items-end pb-0.5">
                      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50 w-full">
                        <input type="checkbox" checked={area.tienePuntoPesaje || false} onChange={(e) => updateArea(area.id, 'tienePuntoPesaje', e.target.checked)} className="w-4 h-4 text-brand-600 rounded" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase whitespace-nowrap">Punto de Pesaje</span>
                      </div>
                    </div>
                    {area.tienePuntoPesaje ? (
                      <>
                        <div className="md:col-span-3">
                          <label className={labelClass}>Sistema de Pesaje</label>
                          <select value={area.tipoSistemaPesaje || ''} onChange={(e) => updateArea(area.id, 'tipoSistemaPesaje', e.target.value)} className={inputClass}>
                            <option value="">Seleccionar...</option>
                            <option value="Báscula Tradicional">Báscula Tradicional</option>
                            <option value="Sistema Informático Winnow">IA — Winnow</option>
                            <option value="Sistema Informático Efiwaste">IA — Efiwaste</option>
                            <option value="Campañas de pesaje estacional (P1)">Campañas (P1)</option>
                            <option value="Estimación volumétrica — Cubo calibrado (P3)">Cubo calibrado (P3)</option>
                            <option value="Otros">Otros</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass + ' whitespace-nowrap'}>Frecuencia</label>
                          <input type="text" value={area.medicion?.frecuencia || ''} onChange={e => updateArea(area.id, 'medicion', { ...(area.medicion||{}), frecuencia: e.target.value })} className={inputClass} placeholder="Diaria" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass + ' whitespace-nowrap'}>Responsable</label>
                          <input type="text" value={area.medicion?.responsable || ''} onChange={e => updateArea(area.id, 'medicion', { ...(area.medicion||{}), responsable: e.target.value })} className={inputClass} placeholder="Jefe Cocina" />
                        </div>
                      </>
                    ) : (
                      <div className="md:col-span-7" />
                    )}
                  </div>

              {/* ── Panel de configuración de metodología por zona ── */}
              {area.tienePuntoPesaje && area.tipoSistemaPesaje && (
                <div className="mt-3">
                  {(() => {
                    const med: AreaMedicion = area.medicion || {};
                    const upd = (patch: Partial<AreaMedicion>) =>
                      updateArea(area.id, 'medicion', { ...med, ...patch });
                    const isBascula = area.tipoSistemaPesaje === 'Báscula Tradicional';
                    const isIA = area.tipoSistemaPesaje?.startsWith('Sistema Informático') || area.tipoSistemaPesaje?.includes('Winnow') || area.tipoSistemaPesaje?.includes('Efiwaste');
                    const isP1 = area.tipoSistemaPesaje?.includes('P1');
                    const isP3 = area.tipoSistemaPesaje?.includes('P3');

                    const panelColor = isBascula ? 'border-sky-200 bg-sky-50/40' : isIA ? 'border-violet-200 bg-violet-50/40' : isP1 ? 'border-amber-200 bg-amber-50/40' : isP3 ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-slate-50';

                    return (
                      <div className={`rounded-xl border p-4 space-y-3 ${panelColor}`}>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          Configuración — {area.tipoSistemaPesaje}
                        </p>

                        {/* RELATIVIZACIÓN + COSTE — en la misma fila */}
                        {(isBascula || isP1 || isP3) && (
                          <div className="bg-white rounded-lg border border-slate-200 p-3">
                            <div className="flex items-start gap-4 flex-wrap">
                              {/* Relativizar */}
                              <div className="flex-1 min-w-0">
                                <span className={labelClass + ' block mb-2'}>Relativizar los kg por</span>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { val: 'estancia', label: 'Estancia',  sub: 'hab. ocupadas/noche' },
                                    { val: 'comensal', label: 'Comensal',  sub: 'cubiertos servidos'  },
                                    { val: 'ambos',    label: 'Ambos',     sub: 'estancia + comensal' },
                                  ].map(({ val, label, sub }) => {
                                    const sel = med.relativizarPor === val;
                                    return (
                                      <button key={val} type="button"
                                        onClick={() => upd({ relativizarPor: val as any })}
                                        className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all ${
                                          sel ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                        }`}>
                                        <span className="text-[11px] font-bold">{label}</span>
                                        <span className="text-[9px] opacity-70">{sub}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {med.relativizarPor && (
                                  <p className="text-[9px] text-slate-400 mt-1.5">
                                    {med.relativizarPor === 'estancia' && 'El módulo de registros pedirá las habitaciones ocupadas cada día.'}
                                    {med.relativizarPor === 'comensal' && 'El módulo de registros pedirá los comensales servidos por servicio.'}
                                    {med.relativizarPor === 'ambos'    && 'El módulo de registros pedirá habitaciones ocupadas y comensales.'}
                                  </p>
                                )}
                              </div>
                              {/* Coste €/kg */}
                              <div className="w-32 flex-shrink-0">
                                <span className={labelClass + ' block mb-2'}>Coste (€/kg)</span>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">€</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={area.costePorKg ?? ''}
                                    onChange={(e) => updateArea(area.id, 'costePorKg', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    className={inputClass + ' pl-6'}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* BÁSCULA */}
                        {isBascula && (
                          <>
                            {/* ── Selector visual de tipología de alimentos ── */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className={labelClass}>Tipología de alimentos a pesar</span>
                                <div className="flex gap-2">
                                  <button type="button"
                                    onClick={() => {
                                      const all = FOOD_TAXONOMY.flatMap(g => g.items.map(i => i.id));
                                      updateArea(area.id, 'categoriasAlimentos', all);
                                    }}
                                    className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                                    Todas
                                  </button>
                                  <button type="button"
                                    onClick={() => updateArea(area.id, 'categoriasAlimentos', [])}
                                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                                    Ninguna
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 mb-4">
                                Selecciona los tipos de alimento que el personal deberá pesar en esta zona. Solo aparecerán los marcados en la pantalla de registro.
                              </p>
                              <div className="space-y-4">
                                {FOOD_TAXONOMY.map(group => {
                                  const activeCats = area.categoriasAlimentos || [];
                                  const groupIds = group.items.map(i => i.id);
                                  const allSel = groupIds.every(id => activeCats.includes(id));
                                  return (
                                    <div key={group.label}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${group.color}`}>
                                          {group.label}
                                        </span>
                                        <button type="button"
                                          onClick={() => {
                                            const cur = area.categoriasAlimentos || [];
                                            const next = allSel
                                              ? cur.filter(id => !groupIds.includes(id))
                                              : [...new Set([...cur, ...groupIds])];
                                            updateArea(area.id, 'categoriasAlimentos', next);
                                          }}
                                          className="text-[9px] text-slate-400 hover:text-slate-600 font-medium">
                                          {allSel ? 'Quitar todas' : 'Añadir todas'}
                                        </button>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {group.items.map(item => {
                                          const sel = activeCats.includes(item.id);
                                          const { Icon } = item;
                                          return (
                                            <button key={item.id} type="button"
                                              onClick={() => {
                                                const cur = area.categoriasAlimentos || [];
                                                updateArea(area.id, 'categoriasAlimentos',
                                                  sel ? cur.filter(id => id !== item.id) : [...cur, item.id]
                                                );
                                              }}
                                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                                sel ? item.color + ' border-2' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                              }`}>
                                              <Icon size={13} style={{ color: sel ? item.iconColor : '#94a3b8' }} />
                                              {item.label}
                                              {sel && <span className="ml-0.5 text-[10px]">✓</span>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {(area.categoriasAlimentos?.length ?? 0) > 0 && (
                                <p className="text-[10px] text-brand-600 font-semibold mt-3">
                                  {area.categoriasAlimentos!.length} categoría{area.categoriasAlimentos!.length !== 1 ? 's' : ''} seleccionada{area.categoriasAlimentos!.length !== 1 ? 's' : ''} — el registro mostrará desglose por tipología
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {/* SISTEMA IA — sin configuración adicional */}
                        {isIA && (
                          <p className="text-[10px] text-violet-600 font-medium bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                            Sistema de reconocimiento automático mediante inteligencia artificial (Winnow / Efiwaste u otro).
                          </p>
                        )}

                        {/* P1 CAMPAÑAS */}
                        {isP1 && (
                          <>
                            <p className="text-[10px] text-slate-500 font-medium">Fundamento: Guía ITH 2023 · WRAP (2015) · Guía HORECA Gobierno Vasco</p>
                            {/* Fila 1: periodo y duración */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block">
                                <span className={labelClass}>Fecha inicio campaña</span>
                                <input type="date" value={med.fechaInicioCampana || ''} onChange={e => upd({ fechaInicioCampana: e.target.value })} className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Fecha fin campaña</span>
                                <input type="date" value={med.fechaFinCampana || ''} onChange={e => upd({ fechaFinCampana: e.target.value })} className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Duración de la campaña</span>
                                <select value={med.duracionCampana || ''} onChange={e => upd({ duracionCampana: e.target.value })} className={inputClass}>
                                  <option value="">Seleccionar...</option>
                                  <option value="3-5 días">3-5 días</option>
                                  <option value="1 semana">1 semana</option>
                                  <option value="2 semanas">2 semanas</option>
                                </select>
                              </label>
                            </div>
                            {/* Fila 2: resultados */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block">
                                <span className={labelClass}>Resultado promedio (kg/día)</span>
                                <input type="text" value={med.kgDiaCampana || ''} onChange={e => upd({ kgDiaCampana: e.target.value })}
                                  placeholder="Ej: 12,5" className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Comensales campaña (total)</span>
                                <input type="text" value={med.comensalesCampana || ''} onChange={e => upd({ comensalesCampana: e.target.value })}
                                  placeholder="Ej: 1.240" className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Ratio kg/comensal</span>
                                {(() => {
                                  const kgDia = parseFloat((med.kgDiaCampana || '').replace(',', '.'));
                                  const durMap: Record<string, number> = { '3-5 días': 4, '1 semana': 7, '2 semanas': 14 };
                                  const dias = durMap[med.duracionCampana || ''] ?? NaN;
                                  const com = parseFloat((med.comensalesCampana || '').replace(/\./g, '').replace(',', '.'));
                                  const ratio = (!isNaN(kgDia) && !isNaN(dias) && com > 0) ? (kgDia * dias / com).toFixed(3) : null;
                                  return ratio
                                    ? <div className="mt-1 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-sm">{ratio} kg/comensal</div>
                                    : <input type="text" disabled placeholder="Auto-calculado" className={inputClass + ' opacity-50 cursor-not-allowed'} />;
                                })()}
                              </label>
                            </div>
                            {/* Fila 3: incertidumbre */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block">
                                <span className={labelClass}>Factor de incertidumbre (%)</span>
                                <input type="text" value={med.incertidumbre || ''} onChange={e => upd({ incertidumbre: e.target.value })}
                                  placeholder="Ej: ±15%" className={inputClass} />
                              </label>
                            </div>
                          </>
                        )}

                        {/* P3 CUBO CALIBRADO */}
                        {isP3 && (
                          <>
                            <p className="text-[10px] text-slate-500 font-medium">Fundamento: Guía ITH 2023 · Metodología 4 cubos · Guía HOSBEC 2019</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block">
                                <span className={labelClass}>Volumen de cubos (L)</span>
                                <input type="text" value={med.volumenCubo || ''} onChange={e => upd({ volumenCubo: e.target.value })}
                                  placeholder="Ej: 10L y 20L" className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Factor densidad (Kg/L)</span>
                                <input type="text" value={med.factorDensidad || ''} onChange={e => upd({ factorDensidad: e.target.value })}
                                  placeholder="Ej: 0,45 Kg/L" className={inputClass} />
                              </label>
                              <label className="block">
                                <span className={labelClass}>Incertidumbre declarada</span>
                                <input type="text" value={med.incertidumbre || ''} onChange={e => upd({ incertidumbre: e.target.value })}
                                  placeholder="Ej: ±15-20%" className={inputClass} />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

                </div>{/* fin cuerpo colapsable inner */}
              </div>{/* fin transición colapsable */}
           </div>
           );
         })}
       </div>
    </div>
  );
};

// --- TEAM FORM ---
interface TeamFormProps {
  team: TeamMember[];
  setTeam: (team: TeamMember[]) => void;
}

export const TeamForm: React.FC<TeamFormProps> = ({ team, setTeam }) => {
  const addMember = () => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      departamento: '',
      nombre: '',
      cargo: '',
      email: '',
      telefono: '',
      funcion: COMMON_PPDA_FUNCTIONS[0]
    };
    setTeam([...team, newMember]);
  };

  const removeMember = (id: string) => {
    setTeam(team.filter(t => t.id !== id));
  };

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    setTeam(team.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  return (
    <div className={sectionClass}>
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
                <Users className="text-brand-600" size={20} />
                <h3 className="text-lg font-black text-slate-800">Equipo Responsable del Plan</h3>
            </div>
            <button onClick={addMember} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-brand-100 transition-colors">
                <Plus size={14} /> Añadir Miembro
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[9px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-2 w-1/5">Departamento</th>
                <th className="p-2 w-1/5">Nombre</th>
                <th className="p-2 w-1/5">Cargo</th>
                <th className="p-2 w-1/5">Email</th>
                <th className="p-2 w-1/5">Función PPDA</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {team.map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={member.departamento} 
                      onChange={(e) => updateMember(member.id, 'departamento', e.target.value)}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs font-bold text-slate-700 transition-all placeholder:font-normal"
                      placeholder="Dpto."
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={member.nombre} 
                      onChange={(e) => updateMember(member.id, 'nombre', e.target.value)}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs font-bold text-slate-700 transition-all placeholder:font-normal"
                      placeholder="Nombre"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={member.cargo} 
                      onChange={(e) => updateMember(member.id, 'cargo', e.target.value)}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs font-medium text-slate-600 transition-all placeholder:font-normal"
                      placeholder="Cargo"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={member.email} 
                      onChange={(e) => updateMember(member.id, 'email', e.target.value)}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs font-medium text-slate-600 transition-all placeholder:font-normal"
                      placeholder="Email"
                    />
                  </td>
                  <td className="p-2">
                    <select 
                      value={member.funcion} 
                      onChange={(e) => updateMember(member.id, 'funcion', e.target.value)}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 rounded px-2 py-1.5 text-xs font-medium text-slate-600 transition-all cursor-pointer"
                    >
                        {COMMON_PPDA_FUNCTIONS.map(func => (
                            <option key={func} value={func}>{func}</option>
                        ))}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => removeMember(member.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50">
                        <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.length === 0 && (
            <div className="text-center py-8 text-slate-400 italic text-sm border border-dashed border-slate-200 rounded-xl mt-2">
               No hay miembros en el equipo. Añade responsables para el plan.
            </div>
          )}
        </div>
    </div>
  );
};

// --- SIGNATURES FORM ---
interface SignaturesFormProps {
  consultantSignature?: string;
  setConsultantSignature: (sig: string) => void;
  directorSignature?: string;
  setDirectorSignature: (sig: string) => void;
}

export const SignaturesForm: React.FC<SignaturesFormProps> = ({ 
  consultantSignature, setConsultantSignature, directorSignature, setDirectorSignature 
}) => {
  const consultorInputRef = useRef<HTMLInputElement>(null);
  const directorInputRef = useRef<HTMLInputElement>(null);
  
  const [directorMode, setDirectorMode] = useState<'upload' | 'draw'>('draw');
  const [consultorMode, setConsultorMode] = useState<'upload' | 'draw'>('draw');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, setFunc: (val: string) => void) => {
     const file = e.target.files?.[0];
     if (file) {
       const reader = new FileReader();
       reader.onloadend = () => {
         setFunc(reader.result as string);
       };
       reader.readAsDataURL(file);
     }
  };

  return (
    <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-2">
            <FileText className="text-brand-600" size={20} />
            <h3 className="text-lg font-black text-slate-800">Firmas y Validación</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Firma Dirección */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                   <label className={labelClass}>Firma Dirección</label>
                   <div className="flex bg-slate-100 rounded-lg p-0.5">
                       <button onClick={() => setDirectorMode('upload')} className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${directorMode === 'upload' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}>Subir</button>
                       <button onClick={() => setDirectorMode('draw')} className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${directorMode === 'draw' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}>Firmar</button>
                   </div>
                </div>
                
                <div className="h-40 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden relative">
                    {directorMode === 'upload' ? (
                        <div 
                            onClick={() => directorInputRef.current?.click()}
                            className="h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all bg-white"
                        >
                            {directorSignature ? (
                                <div className="relative h-full w-full p-2 flex items-center justify-center">
                                    <img src={directorSignature} alt="Firma Dirección" className="h-full w-auto object-contain" />
                                    <button onClick={(e) => { e.stopPropagation(); setDirectorSignature(''); }} className="absolute top-2 right-2 text-red-500 bg-red-50 p-1 rounded-full z-10 hover:bg-red-100"><X size={14}/></button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <Upload className="mx-auto mb-2" size={24} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Subir Firma</span>
                                </div>
                            )}
                            <input type="file" ref={directorInputRef} onChange={(e) => handleUpload(e, setDirectorSignature)} accept="image/*" className="hidden" />
                        </div>
                    ) : (
                        <SignaturePad 
                            onSave={setDirectorSignature} 
                            onClear={() => setDirectorSignature('')} 
                            initialImage={directorSignature} 
                        />
                    )}
                </div>
            </div>

            {/* Firma Consultor */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                   <label className={labelClass}>Firma Consultor</label>
                   <div className="flex bg-slate-100 rounded-lg p-0.5">
                       <button onClick={() => setConsultorMode('upload')} className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${consultorMode === 'upload' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}>Subir</button>
                       <button onClick={() => setConsultorMode('draw')} className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${consultorMode === 'draw' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}>Firmar</button>
                   </div>
                </div>

                <div className="h-40 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden relative">
                    {consultorMode === 'upload' ? (
                        <div 
                            onClick={() => consultorInputRef.current?.click()}
                            className="h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all bg-white"
                        >
                            {consultantSignature ? (
                                <div className="relative h-full w-full p-2 flex items-center justify-center">
                                    <img src={consultantSignature} alt="Firma Consultor" className="h-full w-auto object-contain" />
                                    <button onClick={(e) => { e.stopPropagation(); setConsultantSignature(''); }} className="absolute top-2 right-2 text-red-500 bg-red-50 p-1 rounded-full z-10 hover:bg-red-100"><X size={14}/></button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <Upload className="mx-auto mb-2" size={24} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Subir Firma</span>
                                </div>
                            )}
                            <input type="file" ref={consultorInputRef} onChange={(e) => handleUpload(e, setConsultantSignature)} accept="image/*" className="hidden" />
                        </div>
                    ) : (
                        <SignaturePad 
                            onSave={setConsultantSignature} 
                            onClear={() => setConsultantSignature('')} 
                            initialImage={consultantSignature} 
                        />
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};