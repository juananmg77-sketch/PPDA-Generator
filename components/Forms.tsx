import React, { useRef, useState, useEffect } from 'react';
import { HotelData, Area, TeamMember } from '../types';
import { COMMON_PPDA_FUNCTIONS } from '../constants';
import { Building2, MapPin, Users, Utensils, Clock, Trash2, Plus, Upload, CheckCircle2, FileText, ImageIcon, PenTool, Eraser, X } from 'lucide-react';

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
      areas: [] // Inicializar áreas vacías
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
        areas: []
    });
  };

  const handleEdit = (index: number) => {
      setTempHotel({ ...hotels[index], areas: hotels[index].areas || [] });
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
                <h4 className="text-lg font-bold text-brand-800 mb-4">{editingIndex !== null ? 'Editar Hotel' : 'Nuevo Hotel'}</h4>
                
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

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button onClick={handleCancel} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700">Guardar Hotel</button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotels.map((hotel, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-black text-lg">
                            {hotel.nombreComercial.charAt(0)}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(idx)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"><PenTool size={14}/></button>
                            <button onClick={() => handleDelete(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    <h4 className="font-bold text-slate-800 truncate">{hotel.nombreComercial}</h4>
                    <p className="text-xs text-slate-500 mb-2">{hotel.municipio}, {hotel.provincia}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded mb-2">
                        <span>{hotel.numHabitaciones} Habs</span>
                        <span>•</span>
                        <span>{hotel.capacidadMax} Pax</span>
                    </div>
                    <div className="text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-1 rounded inline-block">
                        {hotel.areas?.length || 0} Zonas Definidas
                    </div>
                </div>
            ))}
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
  };

  const updateArea = (id: string, field: keyof Area, value: any) => {
    setAreas(areas.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeArea = (id: string) => {
    setAreas(areas.filter(a => a.id !== id));
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
         {areas.map((area, index) => (
           <div key={area.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all relative group">
              <div className="md:col-span-2">
                 <label className={labelClass}>Zona</label>
                 <input type="text" value={area.nombre} onChange={(e) => updateArea(area.id, 'nombre', e.target.value)} className={inputClass} placeholder="Ej: Buffet" />
              </div>
              <div className="md:col-span-2">
                 <label className={labelClass}>Tipo Servicio</label>
                 <input type="text" value={area.tipoServicio} onChange={(e) => updateArea(area.id, 'tipoServicio', e.target.value)} className={inputClass} placeholder="Desayuno..." />
              </div>
              <div className="md:col-span-1">
                 <label className={labelClass}>m²</label>
                 <input type="number" value={area.superficie} onChange={(e) => updateArea(area.id, 'superficie', parseFloat(e.target.value) || 0)} className={inputClass} />
              </div>
              <div className="md:col-span-1">
                 <label className={labelClass}>Pax</label>
                 <input type="number" value={area.capacidad} onChange={(e) => updateArea(area.id, 'capacidad', parseInt(e.target.value) || 0)} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                 <label className={labelClass}>Servicios/día</label>
                 <input type="number" value={area.numServiciosDia} onChange={(e) => updateArea(area.id, 'numServiciosDia', parseFloat(e.target.value) || 0)} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                 <label className={labelClass}>Horario</label>
                 <div className="relative">
                    <Clock size={14} className="absolute top-2.5 right-2 text-slate-400" />
                    <input type="text" value={area.horarios} onChange={(e) => updateArea(area.id, 'horarios', e.target.value)} className={inputClass} placeholder="08:00 - 11:00" />
                 </div>
              </div>
              <div className="md:col-span-2 flex items-end gap-2 pb-1">
                 <div className="flex-1 flex items-center gap-2 h-10 px-2 rounded-md border border-slate-200 bg-white">
                    <input type="checkbox" checked={area.esBuffet} onChange={(e) => updateArea(area.id, 'esBuffet', e.target.checked)} className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Es Buffet</span>
                 </div>
              </div>
              <div className="md:col-span-2 flex items-end gap-2 pb-1">
                 <div className="flex-1 flex items-center gap-2 h-10 px-2 rounded-md border border-slate-200 bg-white">
                    <input type="checkbox" checked={area.tienePuntoPesaje || false} onChange={(e) => updateArea(area.id, 'tienePuntoPesaje', e.target.checked)} className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Punto Pesaje</span>
                 </div>
              </div>
              {area.tienePuntoPesaje && (
                  <div className="md:col-span-3">
                     <label className={labelClass}>Sistema de Pesaje</label>
                     <select 
                        value={area.tipoSistemaPesaje || ''} 
                        onChange={(e) => updateArea(area.id, 'tipoSistemaPesaje', e.target.value)} 
                        className={inputClass}
                     >
                        <option value="">Seleccionar sistema...</option>
                        <option value="Báscula Tradicional">Báscula Tradicional</option>
                        <option value="Sistema Informático Efiwaste">Sistema Informático Efiwaste</option>
                        <option value="Sistema Informático Winnow">Sistema Informático Winnow</option>
                        <option value="Otros">Otros</option>
                     </select>
                  </div>
              )}
              <div className="md:col-span-1 flex items-end justify-end pb-1">
                 <button onClick={() => removeArea(area.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                 </button>
              </div>
           </div>
         ))}
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