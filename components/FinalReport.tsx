import React, { useRef, useState, useEffect } from 'react';
import { AppState } from '../types';
import { Printer, FileText, CloudUpload, RefreshCw, GitBranch } from 'lucide-react';

declare global {
  interface Window {
    pdfjsLib: any;
    html2pdf: any;
  }
}

interface FinalReportProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onCloudSave?: () => Promise<void>;
  onSaveNewVersion?: () => void;
  isSyncing?: boolean;
}

const HsLogoPrint = () => (
  <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 35 C 5 35, 25 55, 40 55 C 40 55, 30 35, 15 25 C 10 22, 5 35, 5 35 Z" fill="#66cc33" />
      <path d="M15 25 C 15 25, 30 35, 40 55 C 45 45, 25 25, 15 25" fill="#75c05d" /> 
      <path d="M5 50 C 5 50, 25 55, 40 65 C 40 65, 35 55, 30 50 C 20 40, 5 50, 5 50 Z" fill="#009933" />
      <path d="M40 55 C 40 55, 45 75, 42 85 C 42 85, 50 75, 52 55 L 40 55" fill="#4ade80" />
      <path d="M52 55 C 52 55, 55 70, 45 85 C 55 80, 65 65, 60 50 L 52 55" fill="#ff9900" />
      <path d="M52 55 L 60 50 C 60 50, 70 50, 75 35 C 75 35, 65 30, 55 40 C 55 40, 50 45, 52 55" fill="#0033cc" />
      <path d="M75 35 L 85 40 L 75 42" fill="#0033cc" />
  </svg>
);

// Componente para renderizar PDFs
const PdfViewer = ({ fileData }: { fileData: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const renderPdf = async () => {
            if (!containerRef.current || !window.pdfjsLib) return;
            
            // Limpiar contenedor
            containerRef.current.innerHTML = '';

            try {
                // Soportar dataURI
                const loadingTask = window.pdfjsLib.getDocument(fileData);
                const pdf = await loadingTask.promise;

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const scale = 1.5; // Calidad de impresión
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.width = '100%'; // Ajustar al contenedor
                    canvas.style.height = 'auto';
                    canvas.style.marginBottom = '20px';
                    canvas.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

                    if (context) {
                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        await page.render(renderContext).promise;
                        containerRef.current.appendChild(canvas);
                    }
                }
            } catch (error) {
                console.error("Error rendering PDF:", error);
                containerRef.current.innerHTML = '<div class="text-red-500 text-xs p-4">Error visualizando el PDF. Verifique que el archivo es válido.</div>';
            }
        };

        if (fileData && fileData.startsWith('data:application/pdf')) {
            renderPdf();
        }
    }, [fileData]);

    if (!fileData) return null;

    if (fileData.startsWith('data:image')) {
        return <img src={fileData} className="w-full h-auto object-contain border border-slate-200 rounded" alt="Protocolo" />;
    }

    return <div ref={containerRef} className="w-full flex flex-col items-center bg-slate-100 p-4 rounded-xl"></div>;
};

const sanitizeForPdf = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
};

export const FinalReport: React.FC<FinalReportProps> = ({ state, setState, onCloudSave, onSaveNewVersion, isSyncing }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const getWeighingPoints = () => {
      if (state.scope === 'corporate') {
          return state.hotels.flatMap(h => (h.areas || []).filter(a => a.tienePuntoPesaje).map(a => ({ ...a, hotelName: h.nombreComercial })));
      }
      return state.areas.filter(a => a.tienePuntoPesaje).map(a => ({ ...a, hotelName: '' }));
  };

  const getSystemDescription = (system: string) => {
      switch (system) {
          case 'Báscula Tradicional':
              return 'Pesaje manual de los residuos utilizando una báscula convencional. El personal de cocina pesa los cubos de desperdicio antes de su eliminación y registra los datos (peso, tipo de residuo, área) en el sistema HS GREEN. Requiere intervención manual para la entrada de datos, permitiendo su posterior análisis y seguimiento en la plataforma.';
          case 'Sistema Informático Efiwaste':
              return 'Sistema inteligente de pesaje que integra una báscula conectada a un terminal táctil. El operario selecciona en pantalla el tipo de residuo y el origen antes de depositarlo. El sistema registra automáticamente el peso y envía los datos a una plataforma en la nube para su análisis en tiempo real, facilitando la identificación de ineficiencias y la toma de decisiones.';
          case 'Sistema Informático Winnow':
              return 'Sistema avanzado basado en Inteligencia Artificial (IA) y visión por computadora. Una cámara situada sobre el cubo de basura identifica automáticamente el tipo de alimento que se está desechando ("Throw & Go"), mientras una báscula registra su peso. El sistema calcula el coste económico del desperdicio y genera informes detallados sin apenas intervención manual del personal.';
          default:
              return 'Sistema de pesaje alternativo con registro de datos para el control y monitorización del desperdicio alimentario.';
      }
  };

  const weighingPoints = getWeighingPoints();

  const handlePrint = () => {
    window.print();
  };


  const today = new Date().toLocaleDateString();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 no-print">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
           <FileText className="text-brand-600" /> Informe Final PPDA
        </h2>
        <div className="flex gap-2 flex-wrap justify-end">
            {onCloudSave && (
                <button
                    onClick={onCloudSave}
                    disabled={isSyncing}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm ${
                        isSyncing
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-brand-600 text-white border-brand-700 hover:bg-brand-700'
                    }`}
                >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                    <span className="hidden sm:inline">{isSyncing ? 'Guardando...' : 'Guardar borrador'}</span>
                </button>
            )}
            {onSaveNewVersion && (
                <button
                    onClick={onSaveNewVersion}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:border-brand-500 hover:text-brand-600 transition-all"
                >
                    <GitBranch size={14} />
                    <span className="hidden sm:inline">Nueva versión</span>
                </button>
            )}
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-sm">
                <Printer size={16} /> Imprimir / PDF
            </button>
        </div>
      </div>

      {/* Report Content */}
      <div id="printable-report" ref={printRef} className="bg-white p-12 pb-24 shadow-2xl print:shadow-none print:p-0 text-slate-900">
        <style dangerouslySetInnerHTML={{__html: `
            #printable-report { overflow: visible !important; }
            .print-page-break { page-break-before: always !important; break-before: page !important; }
            .avoid-page-break { page-break-inside: avoid !important; break-inside: avoid !important; }
            @media print {
                .print-page-break { page-break-before: always !important; break-before: page !important; }
                .avoid-page-break { page-break-inside: avoid !important; break-inside: avoid !important; }
                h1, h2, h3, h4, h5, h6 {
                    page-break-after: avoid !important; break-after: avoid !important;
                    page-break-inside: avoid !important; break-inside: avoid !important;
                }
                tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
                thead { display: table-header-group; }
                p { orphans: 3; widows: 3; }

                /* Encabezado y pie de página propios — se repiten en cada página */
                #print-page-header {
                    display: block !important;
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    height: 10mm;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 15mm;
                    border-bottom: 1px solid #cbd5e1;
                    font-size: 8pt;
                    color: #64748b;
                    background: white;
                    z-index: 9999;
                }
                #print-page-footer {
                    display: block !important;
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    height: 10mm;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 15mm;
                    border-top: 1px solid #cbd5e1;
                    font-size: 8pt;
                    color: #64748b;
                    background: white;
                    z-index: 9999;
                }
                /* Espacio para que el contenido no quede debajo del header/footer */
                #printable-report {
                    padding-top: 14mm !important;
                    padding-bottom: 14mm !important;
                }
            }
            /* Ocultar en pantalla */
            #print-page-header, #print-page-footer { display: none; }
        `}} />

        {/* Encabezado de página — visible solo al imprimir */}
        <div id="print-page-header">
            <span style={{ fontWeight: 700, color: '#1e293b' }}>PPDA · {sanitizeForPdf(state.scope === 'corporate' ? state.society.razonSocial : state.hotelData.nombreComercial)}</span>
            <span>{state.version} · {sanitizeForPdf(state.fechaVisita || state.periodoPlan)}</span>
        </div>

        {/* Pie de página — visible solo al imprimir */}
        <div id="print-page-footer">
            <span>© HS Consulting Group</span>
            <span>Según Ley 1/2025 de prevención de las pérdidas y el desperdicio alimentario</span>
        </div>
        
        {/* Header */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 avoid-page-break">
            <div className="flex items-center gap-4 min-w-0">
                <div className="shrink-0">
                    <HsLogoPrint />
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none break-words">PLAN DE PREVENCIÓN DE LAS PÉRDIDAS</h1>
                    <h2 className="text-lg font-bold text-slate-500 uppercase tracking-widest leading-none mt-1 break-words">Y EL DESPERDICIO ALIMENTARIO</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 break-words">Según Ley 1/2025 de prevención de las pérdidas y desperdicio alimentario</p>
                </div>
            </div>
            <div className="text-right flex flex-col items-end shrink-0 ml-4 max-w-[40%]">
                {state.hotelData.logo && (
                    <img src={state.hotelData.logo} alt="Logo Hotel" className="h-16 object-contain mb-2 max-w-[150px]" />
                )}
                <div className="text-sm font-black text-slate-900 break-words text-right w-full">{sanitizeForPdf(state.scope === 'corporate' ? state.society.razonSocial : state.hotelData.nombreComercial)}</div>
                <div className="text-xs text-slate-500 font-bold uppercase break-words text-right w-full">{sanitizeForPdf(state.scope === 'corporate' ? 'PLAN CORPORATIVO' : state.hotelData.razonSocial)}</div>
                <div className="text-[10px] text-slate-400 mt-1 italic break-words text-right w-full">Fecha de Revisión: {today} • Estado: {state.version}</div>
            </div>
        </header>

        {/* 1. Jerarquía de Prioridades */}
        <section className="mb-8 avoid-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">1. Jerarquía de Prioridades</h3>
            <p className="text-xs text-slate-700 mb-4">
                Conforme al artículo 5 de la Ley 1/2025, todas las actuaciones se rigen por la siguiente jerarquía de prioridades, que debe aplicarse en el orden indicado:
            </p>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden avoid-page-break">
                <table className="w-full text-xs text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '64px' }} />
                        <col style={{ width: '130px' }} />
                        <col />
                    </colgroup>
                    <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                        <tr>
                            <th className="p-3 text-center border-r border-slate-700">NVL</th>
                            <th className="p-3 border-r border-slate-700">Prioridad</th>
                            <th className="p-3">Descripción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Nivel 1 - Prevención */}
                        <tr className="bg-emerald-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-700 border-r border-slate-200">1</td>
                            <td className="p-3 font-black text-emerald-700 border-r border-slate-200">PREVENCIÓN</td>
                            <td className="p-3 text-slate-700">Evitar generación de excedentes: planificación, compras ajustadas, formación.</td>
                        </tr>
                        {/* Nivel 2 - Donación */}
                        <tr className="bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-700 border-r border-slate-200">2</td>
                            <td className="p-3 font-black text-emerald-700 border-r border-slate-200">DONACIÓN</td>
                            <td className="p-3 text-slate-700">Redistribución para consumo humano: Banco de Alimentos, ONG, Too Good To Go.</td>
                        </tr>
                        {/* Nivel 3 - Alim Animal */}
                        <tr className="bg-slate-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-700 border-r border-slate-200">3</td>
                            <td className="p-3 font-black text-slate-700 border-r border-slate-200">ALIM. ANIMAL</td>
                            <td className="p-3 text-slate-700">Destino a fabricación de piensos (marco regulatorio Orden APM 189/2018).</td>
                        </tr>
                        {/* Nivel 4 - Subproductos */}
                        <tr className="bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-700 border-r border-slate-200">4</td>
                            <td className="p-3 font-black text-slate-700 border-r border-slate-200">SUBPRODUCTOS</td>
                            <td className="p-3 text-slate-700">Empleo en otra industria como materia prima (ej. compostaje industrial).</td>
                        </tr>
                        {/* Nivel 5 - Valorización */}
                        <tr className="bg-slate-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-700 border-r border-slate-200">5</td>
                            <td className="p-3 font-black text-slate-700 border-r border-slate-200">VALORIZACIÓN</td>
                            <td className="p-3 text-slate-700">Compostaje in-situ, biogás, valorización energética.</td>
                        </tr>
                        {/* Nivel 6 - Eliminación */}
                        <tr className="bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-3 text-center font-black text-slate-400 border-r border-slate-200">6</td>
                            <td className="p-3 font-black text-slate-400 border-r border-slate-200">ELIMINACIÓN</td>
                            <td className="p-3 text-slate-400 italic">Vertedero (última opción, solo cuando no sea posible otra).</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        {/* 2. Identificación */}
        <section className="mb-8 print-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">
                {state.scope === 'corporate' ? '2. IDENTIFICACIÓN DE LA SOCIEDAD' : '2. Identificación del Centro'}
            </h3>
            
            {state.scope === 'corporate' ? (
                <>
                    <div className="bg-slate-50 border-l-4 border-brand-600 p-6 mb-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2 border-b border-slate-200 pb-4 mb-2">
                                <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest block mb-1">Razón Social (Sociedad Matriz)</span>
                                <span className="font-black text-slate-900 text-2xl uppercase tracking-tight break-words">{sanitizeForPdf(state.society.razonSocial)}</span>
                            </div>
                            <div>
                                <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-1">CIF</span>
                                <span className="font-bold text-slate-800 text-sm break-words">{sanitizeForPdf(state.society.cif)}</span>
                            </div>
                            <div>
                                <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Dirección Fiscal</span>
                                <span className="font-bold text-slate-800 text-sm break-words">{sanitizeForPdf(state.society.direccion)}, {sanitizeForPdf(state.society.municipio)} ({sanitizeForPdf(state.society.provincia)})</span>
                            </div>
                            <div>
                                <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Periodo de Vigencia</span>
                                <span className="font-bold text-slate-800 text-sm break-words">{state.periodoPlan} <span className="text-slate-400 font-normal">(Línea Base: {state.baselineYear})</span></span>
                            </div>
                            <div>
                                <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Alcance</span>
                                <span className="font-bold text-slate-800 text-sm break-words">Corporativo ({state.hotels.length} Centros)</span>
                            </div>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs mb-3 uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                        <span className="bg-slate-900 text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px]">i</span> 
                        Centros Asociados al Plan
                    </h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-[9px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                                <tr>
                                    <th className="p-2 border border-slate-200">Nombre Comercial</th>
                                    <th className="p-2 border border-slate-200">Ubicación</th>
                                    <th className="p-2 border border-slate-200 text-center">Habitaciones</th>
                                    <th className="p-2 border border-slate-200 text-center">Capacidad (Pax)</th>
                                    <th className="p-2 border border-slate-200 text-center">Empleados</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {state.hotels.map((hotel, idx) => (
                                    <tr key={idx} className="bg-white">
                                        <td className="p-2 border border-slate-200 font-bold text-slate-800">{sanitizeForPdf(hotel.nombreComercial)}</td>
                                        <td className="p-2 border border-slate-200 text-slate-600">{sanitizeForPdf(hotel.municipio)} ({sanitizeForPdf(hotel.provincia)})</td>
                                        <td className="p-2 border border-slate-200 text-center text-slate-600">{hotel.numHabitaciones}</td>
                                        <td className="p-2 border border-slate-200 text-center text-slate-600">{hotel.capacidadMax}</td>
                                        <td className="p-2 border border-slate-200 text-center text-slate-600">{hotel.numEmpleados}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs border border-slate-200 p-4 bg-slate-50/50 mb-6">
                    <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Razón Social</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.hotelData.razonSocial)}</span>
                    </div>
                    <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Nombre Comercial</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.hotelData.nombreComercial)}</span>
                    </div>
                    <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Dirección</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.hotelData.direccion)}, {sanitizeForPdf(state.hotelData.municipio)} ({sanitizeForPdf(state.hotelData.provincia)})</span>
                    </div>
                     <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">CIF</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.hotelData.cif)}</span>
                    </div>
                    <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Periodo de Vigencia</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.periodoPlan)} (Línea Base: {sanitizeForPdf(state.baselineYear)})</span>
                    </div>
                    <div>
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Responsable del Plan</span>
                        <span className="font-bold text-slate-900 break-words">{sanitizeForPdf(state.team.find(t => t.id === 'cal')?.nombre || state.consultor || 'No asignado')}</span>
                    </div>
                </div>
            )}

            {/* TABLA DE ÁREAS Y DIMENSIONAMIENTO */}
            {state.scope === 'corporate' ? (
                 <div className="space-y-6">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1">Detalle de Zonas de Generación por Centro</h4>
                    {state.hotels.map((hotel, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden avoid-page-break">
                            <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-black text-slate-800 uppercase">{sanitizeForPdf(hotel.nombreComercial)}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{sanitizeForPdf(hotel.municipio)}</span>
                            </div>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                                    <tr>
                                        <th className="p-2 border-r border-slate-200">Zona</th>
                                        <th className="p-2 border-r border-slate-200">Tipo</th>
                                        <th className="p-2 border-r border-slate-200 text-center">m²</th>
                                        <th className="p-2 border-r border-slate-200 text-center">Pax</th>
                                        <th className="p-2 border-r border-slate-200 text-center">Svcs/Día</th>
                                        <th className="p-2 text-center">Pesaje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {hotel.areas && hotel.areas.length > 0 ? hotel.areas.map(area => (
                                        <tr key={area.id} className="bg-white">
                                            <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{sanitizeForPdf(area.nombre)}</td>
                                            <td className="p-2 border-r border-slate-200 text-slate-600">
                                                {sanitizeForPdf(area.tipoServicio)} {area.esBuffet && <span className="text-[9px] bg-brand-50 text-brand-600 px-1 rounded ml-1 font-bold">BUFFET</span>}
                                            </td>
                                            <td className="p-2 border-r border-slate-200 text-center text-slate-600">{area.superficie}</td>
                                            <td className="p-2 border-r border-slate-200 text-center text-slate-600">{area.capacidad}</td>
                                            <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-800">{area.numServiciosDia}</td>
                                            <td className="p-2 text-center text-[9px]">
                                                {area.tienePuntoPesaje ? (
                                                    <span className="text-brand-600 font-bold">{sanitizeForPdf(area.tipoSistemaPesaje) || 'Sí'}</span>
                                                ) : (
                                                    <span className="text-slate-400">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="p-3 text-center italic text-slate-400 text-[10px]">No se han definido áreas específicas.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ))}
                 </div>
            ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-[9px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                            <tr>
                                <th className="p-2 border border-slate-200">Zona / Punto Generación</th>
                                <th className="p-2 border border-slate-200">Tipo Servicio</th>
                                <th className="p-2 border border-slate-200 text-center">m²</th>
                                <th className="p-2 border border-slate-200 text-center">Pax</th>
                                <th className="p-2 border border-slate-200 text-center">Svcs/Día</th>
                                <th className="p-2 border border-slate-200 text-center">Pesaje</th>
                                <th className="p-2 border border-slate-200">Horario</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {state.areas.length > 0 ? state.areas.map(area => (
                                <tr key={area.id} className="bg-white">
                                    <td className="p-2 border border-slate-200 font-bold text-slate-800">{sanitizeForPdf(area.nombre)}</td>
                                    <td className="p-2 border border-slate-200 text-slate-600">
                                        {sanitizeForPdf(area.tipoServicio)} {area.esBuffet && <span className="text-[9px] bg-brand-50 text-brand-600 px-1 rounded ml-1 font-bold">BUFFET</span>}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center text-slate-600">{area.superficie}</td>
                                    <td className="p-2 border border-slate-200 text-center text-slate-600">{area.capacidad}</td>
                                    <td className="p-2 border border-slate-200 text-center font-bold text-slate-800">{area.numServiciosDia}</td>
                                    <td className="p-2 border border-slate-200 text-center text-[9px]">
                                        {area.tienePuntoPesaje ? (
                                            <span className="text-brand-600 font-bold">{sanitizeForPdf(area.tipoSistemaPesaje) || 'Sí'}</span>
                                        ) : (
                                            <span className="text-slate-400">No</span>
                                        )}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-slate-500 text-[10px]">{sanitizeForPdf(area.horarios)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center italic text-slate-400">No se han definido áreas de generación.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>

        {/* 3. Equipo Responsable */}
        <section className="mb-8 print-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">3. Equipo Responsable</h3>
            <table className="w-full text-xs text-left border-collapse border border-slate-200 mb-6">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                    <tr>
                        <th className="p-2 border border-slate-200">Departamento</th>
                        <th className="p-2 border border-slate-200">Nombre</th>
                        <th className="p-2 border border-slate-200">Cargo</th>
                        <th className="p-2 border border-slate-200">Función PPDA</th>
                        <th className="p-2 border border-slate-200">Contacto</th>
                    </tr>
                </thead>
                <tbody>
                    {state.team.map(member => (
                        <tr key={member.id} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <td className="p-2 border border-slate-200 font-bold bg-white">{sanitizeForPdf(member.departamento)}</td>
                            <td className="p-2 border border-slate-200 bg-white">{sanitizeForPdf(member.nombre)}</td>
                            <td className="p-2 border border-slate-200 bg-white">{sanitizeForPdf(member.cargo)}</td>
                            <td className="p-2 border border-slate-200 italic text-slate-500 bg-white">{sanitizeForPdf(member.funcion)}</td>
                            <td className="p-2 border border-slate-200 text-[9px] bg-white">{sanitizeForPdf(member.email)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* COMPROMISO DE LA DIRECCIÓN (NUEVO BLOQUE) */}
            <div className="bg-slate-50 border-l-4 border-brand-500 p-6 rounded-r-xl avoid-page-break">
                 <h4 className="font-black text-slate-900 text-sm mb-3 uppercase tracking-wide">Compromiso de la Dirección</h4>
                 <p className="text-xs text-slate-700 text-justify leading-relaxed">
                     La Dirección de <span className="font-bold">{sanitizeForPdf(state.hotelData.nombreComercial)}</span> y todo el equipo responsable manifiestan su firme compromiso con la implementación y seguimiento de este Plan de Prevención. Se garantiza la asignación de los recursos necesarios para alcanzar los objetivos y metas de reducción definidos, integrando la cultura de "Desperdicio Cero" en la operativa diaria y promoviendo la mejora continua del sistema.
                 </p>
            </div>
        </section>

        {/* 4. Diagnóstico de Situación */}
        <section className="mb-8 print-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">4. Diagnóstico de Situación</h3>
             <div className="bg-white border border-slate-200">
                 <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-wider border-b border-slate-200" style={{ display: 'table-header-group' }}>
                        <tr>
                            <th className="p-2">Fase / Elemento</th>
                            <th className="p-2 w-24 text-center">Nivel</th>
                            <th className="p-2">Causa Detectada</th>
                            <th className="p-2 w-16 text-center">Prio.</th>
                        </tr>
                    </thead>
                    {/* Agrupación por Etapas para evitar cortes */}
                    {Object.entries(
                        state.diagnosisData.filter(d => d.genera).reduce((acc, item) => {
                            if (!acc[item.etapa]) acc[item.etapa] = [];
                            acc[item.etapa].push(item);
                            return acc;
                        }, {} as Record<string, typeof state.diagnosisData>)
                    ).map(([etapa, items]) => (
                        <tbody key={etapa} className="divide-y divide-slate-100">
                            {/* Cabecera de Etapa Opcional si se quiere reforzar visualmente */}
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <td colSpan={4} className="p-2 font-black text-slate-800 uppercase text-[10px] tracking-widest">
                                    {sanitizeForPdf(etapa)}
                                </td>
                            </tr>
                            {items.map(item => (
                                <tr key={item.id} className={item.prioridad === '1' ? 'bg-red-50' : ''} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                    <td className="p-2 font-bold text-slate-700 pl-4">
                                        {sanitizeForPdf(item.elemento)}
                                    </td>
                                    <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                            item.nivel === 'Alto' ? 'bg-white text-red-700 border-red-200' :
                                            item.nivel === 'Medio' ? 'bg-white text-amber-600 border-amber-200' :
                                            'bg-white text-slate-600 border-slate-200'
                                        }`}>
                                            {item.nivel}
                                        </span>
                                    </td>
                                    <td className="p-2 italic text-slate-600">{sanitizeForPdf(item.causa || '-')}</td>
                                    <td className="p-2 text-center font-black">{item.prioridad}</td>
                                </tr>
                            ))}
                        </tbody>
                    ))}
                    
                    {state.diagnosisData.filter(d => d.genera).length === 0 && (
                         <tbody>
                             <tr>
                                 <td colSpan={4} className="p-4 text-center italic text-slate-400">No se han registrado puntos de generación significativos.</td>
                             </tr>
                         </tbody>
                    )}
                 </table>
             </div>
        </section>

        {/* 5. Plan de Acción (Objetivos SMART) */}
        <section className="mb-8 print-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">5. Plan de Acción (Objetivos SMART)</h3>
            <div className="space-y-6">
                {state.objectives.filter(o => o.selected).map(obj => (
                    // CLASE CRÍTICA: avoid-page-break agrupa todo el bloque (Título + Tabla)
                    <div key={obj.id} className="border border-slate-200 shadow-sm avoid-page-break">
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="bg-brand-600 text-white px-2 py-1 rounded text-[10px] font-black">{obj.codigo}</span>
                                <span className="font-bold text-slate-800 text-sm">{sanitizeForPdf(obj.descripcion)}</span>
                            </div>
                            <div className="flex gap-4 text-xs">
                                <span className="font-bold text-slate-500 uppercase tracking-wider"><span className="text-slate-400">Meta:</span> {sanitizeForPdf(obj.meta)}</span>
                                <span className="font-bold text-slate-500 uppercase tracking-wider"><span className="text-slate-400">Plazo:</span> {obj.plazo ? new Date(obj.plazo).toLocaleDateString() : 'Continuo'}</span>
                            </div>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-xs">
                                <thead style={{ display: 'table-header-group' }}>
                                    <tr className="bg-white text-slate-400 uppercase tracking-widest text-[9px] text-left border-b border-slate-100">
                                        <th className="py-2 px-4 w-20">Ref.</th>
                                        <th className="py-2 px-4">Acción Específica</th>
                                        <th className="py-2 px-4 w-32">Responsable</th>
                                        <th className="py-2 px-4 w-24 text-right">Plazo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {obj.actions.map(action => (
                                        <tr key={action.id}>
                                            <td className="py-2 px-4 text-brand-600 font-bold text-[10px]">{action.codigo}</td>
                                            <td className="py-2 px-4 text-slate-700 font-medium">{sanitizeForPdf(action.descripcion)}</td>
                                            <td className="py-2 px-4 text-slate-500 text-[10px] uppercase font-bold">{sanitizeForPdf(action.responsable)}</td>
                                            <td className="py-2 px-4 text-slate-500 text-right">{action.plazo ? new Date(action.plazo).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    ))}
                                    {obj.actions.length === 0 && (
                                        <tr><td colSpan={4} className="py-3 px-4 text-center italic text-slate-400 text-[10px]">Sin acciones definidas</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        {/* 6. Sistema de Medición y Control */}
        <section className="mb-8 print-page-break avoid-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">6. Sistema de Medición y Control</h3>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 border border-slate-200 p-4 bg-white">
                    <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider border-b border-slate-100 pb-2">Indicadores Clave (KPIs)</h4>
                    <ul className="space-y-2">
                        {state.measurementConfig.kpis.filter(k => k.selected).map(kpi => (
                            <li key={kpi.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                <div className="flex flex-col">
                                    <span className="text-slate-700 font-bold">{sanitizeForPdf(kpi.nombre)}</span>
                                    {kpi.lineaBase && (
                                        <span className="text-[10px] text-slate-500 mt-0.5">Línea Base: <span className="font-bold text-slate-700">{sanitizeForPdf(kpi.lineaBase)}</span></span>
                                    )}
                                </div>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-black">{kpi.frecuencia}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex-1 border border-slate-200 p-4 bg-white">
                    <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider border-b border-slate-100 pb-2">Procesos de Supervisión</h4>
                    <div className="space-y-3 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Informe Dirección:</span>
                            <span className="font-bold text-slate-900">{state.measurementConfig.reporting.frecuencia} ({sanitizeForPdf(state.measurementConfig.reporting.responsable)})</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Revisión Anual:</span>
                            <span className="font-bold text-slate-900">{state.measurementConfig.annualReview.frecuencia} ({sanitizeForPdf(state.measurementConfig.annualReview.responsable)})</span>
                        </div>
                    </div>
                </div>
            </div>

            {weighingPoints.length > 0 && (
                <div className="border border-slate-200 p-4 bg-white avoid-page-break">
                    <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider border-b border-slate-100 pb-2">Puntos de Pesaje y Metodología</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black tracking-wider">
                                <tr>
                                    {state.scope === 'corporate' && <th className="p-2 border-b border-slate-200">Centro</th>}
                                    <th className="p-2 border-b border-slate-200">Zona de Generación</th>
                                    <th className="p-2 border-b border-slate-200">Sistema Empleado</th>
                                    <th className="p-2 border-b border-slate-200">Metodología</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {weighingPoints.map((point, idx) => (
                                    <tr key={`${point.id}-${idx}`} className="bg-white">
                                        {state.scope === 'corporate' && <td className="p-2 font-bold text-slate-800">{sanitizeForPdf(point.hotelName)}</td>}
                                        <td className="p-2 font-bold text-slate-800">{sanitizeForPdf(point.nombre)}</td>
                                        <td className="p-2 text-brand-600 font-bold">{sanitizeForPdf(point.tipoSistemaPesaje || 'Báscula Tradicional')}</td>
                                        <td className="p-2 text-slate-600 text-[10px] leading-relaxed">{getSystemDescription(point.tipoSistemaPesaje || 'Báscula Tradicional')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>

        {/* 7. Documentación Anexa */}
        <section className="mb-8 print-page-break avoid-page-break">
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-4 inline-block rounded-sm">7. Documentación Anexa</h3>
            <div className="border border-slate-200 p-4 bg-white text-xs">
                <p className="mb-2 font-bold text-slate-800">Se adjunta la siguiente documentación como parte integral de este Plan:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li><span className="font-bold text-slate-800">Anexo I:</span> Protocolo de donación y convenios vigentes (documento adjunto).</li>
                    <li><span className="font-bold text-slate-800">Anexo II:</span> Plan de Formación y Sensibilización detallado.</li>
                    <li><span className="font-bold text-slate-800">Anexo III:</span> Procedimiento de Gestión de Desperdicio Alimentario en Buffet.</li>
                    <li><span className="font-bold text-slate-800">Anexo IV:</span> Tabla de Decisión de Reutilización de Excedentes de Buffet Hotelero.</li>
                    <li><span className="font-bold text-slate-800">Anexo V:</span> Protocolo de Donación de Alimentos y Convenios Vigentes (PRO-APPCC-DON-001).</li>
                </ul>
            </div>
        </section>

        {/* 8. Firmas */}
        <section className="mt-16 avoid-page-break print-page-break" style={{ paddingBottom: '40mm' }}>
            <h3 className="text-sm font-black text-white bg-slate-900 px-3 py-1 uppercase tracking-widest mb-8 inline-block rounded-sm">8. Firmas y Compromiso</h3>
            <div className="grid grid-cols-2 gap-20">
                <div className="text-center flex flex-col items-center">
                    {state.directorSignature ? (
                         <img src={state.directorSignature} alt="Firma Dirección" className="h-20 object-contain mb-2 border-b border-slate-300 w-full max-w-[200px]" />
                    ) : (
                         <div className="h-20 border-b border-slate-300 mb-2 w-full"></div>
                    )}
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-1">Por la Dirección</p>
                    <p className="text-[10px] text-slate-500 uppercase">{sanitizeForPdf(state.team.find(t => t.id === 'dir')?.nombre || '')}</p>
                </div>
                <div className="text-center flex flex-col items-center">
                    {state.consultantSignature ? (
                        <img src={state.consultantSignature} alt="Firma Consultor" className="h-20 object-contain mb-2 border-b border-slate-300 w-full max-w-[200px]" />
                    ) : (
                        <div className="h-20 border-b border-slate-300 mb-2 w-full"></div>
                    )}
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-1">Consultor HS Consulting</p>
                    <p className="text-[10px] text-slate-500 uppercase">{sanitizeForPdf(state.consultor)}</p>
                </div>
            </div>
            <div className="mt-8 text-[9px] text-slate-400 text-center uppercase tracking-widest border-t border-slate-100 pt-4">
                {today} • Conforme a Ley 1/2025
            </div>
        </section>

        {/* ANEXO I: Protocolo de Donación — PDF adjunto (si existe) */}
        {state.hotelData.hasDonationProtocol && (
            <>
                <div className="html2pdf__page-break"></div>
                <section className="mb-12 print-page-break">
                    <div className="border-b-2 border-slate-900 pb-4 mb-4 avoid-page-break">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Anexo I</h2>
                        <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Protocolo de Donación y Convenios</h3>
                    </div>
                    {state.hotelData.donationProtocolFile ? (
                        <div className="w-full">
                            <PdfViewer fileData={state.hotelData.donationProtocolFile} />
                        </div>
                    ) : (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center">
                            <p className="text-slate-400 font-bold">Documento no adjuntado en formato digital.</p>
                        </div>
                    )}
                </section>
            </>
        )}

        {/* ANEXO V: Protocolo de Donación de Alimentos — contenido completo */}
        <div className="html2pdf__page-break"></div>
        <section className="print-page-break">
            <div className="border-b-2 border-slate-900 pb-4 mb-4 avoid-page-break">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Anexo V</h2>
                <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Protocolo de Donación de Alimentos y Convenios Vigentes</h3>
            </div>

            <div className="text-xs text-slate-700 space-y-6">

                {/* Cabecera del Documento */}
                <div className="border border-slate-300 rounded-lg overflow-hidden avoid-page-break">
                    <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-200">
                            <tr className="bg-slate-50"><th className="p-3 font-bold text-slate-900 w-1/3 border-r border-slate-200">Código documento</th><td className="p-3 font-mono text-slate-700">PRO-APPCC-DON-001</td></tr>
                            <tr><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Título</th><td className="p-3 text-slate-700">Protocolo de Gestión de Donaciones de Alimentos en Establecimientos Hoteleros</td></tr>
                            <tr className="bg-slate-50"><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Versión</th><td className="p-3 text-slate-700">1.0</td></tr>
                            <tr><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Fecha de emisión</th><td className="p-3 text-slate-700">Marzo 2025</td></tr>
                            <tr className="bg-slate-50"><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Elaborado por</th><td className="p-3 text-slate-700">HS GREEN – División de Medioambiente y Sostenibilidad</td></tr>
                            <tr><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Aprobado por</th>
                                <td className="p-3 text-slate-700">
                                    {sanitizeForPdf(state.team.find(t => t.id === 'dir')?.nombre || 'Director del Establecimiento')} — Director del Establecimiento
                                </td>
                            </tr>
                            <tr className="bg-slate-50"><th className="p-3 font-bold text-slate-900 border-r border-slate-200">Marco normativo</th><td className="p-3 text-slate-700">Ley 1/2025, de 2 de enero (Arts. 5, 6.4.b, 7 y 9); Reglamento (CE) 852/2004; Reglamento (UE) 1169/2011; Directrices CE 2020/C 199/01 sobre donación de alimentos; Guía Orientativa para la Donación de Excedentes Alimentarios en Euskadi (ELIKA / Gobierno Vasco)</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* 1. OBJETO */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">1. Objeto</h4>
                    <p className="mb-2 text-justify">El presente protocolo establece la sistemática para la donación de excedentes alimentarios generados en el establecimiento hotelero, en cumplimiento de la obligación recogida en el artículo 6.4.b) de la Ley 1/2025, que exige a todos los agentes de la cadena alimentaria promover acuerdos o convenios para donar sus excedentes de alimentos a entidades de iniciativa social, organizaciones sin ánimo de lucro o bancos de alimentos.</p>
                    <p className="text-justify">Este protocolo se integra en el Plan de Prevención de Pérdidas y Desperdicio Alimentario (PPDA) del establecimiento y respeta la jerarquía de prioridades del artículo 5 de la Ley 1/2025, situando la donación como segunda prioridad tras la prevención.</p>
                </div>

                {/* 2. ALCANCE */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">2. Alcance</h4>
                    <p className="mb-2 text-justify">Es de aplicación a todos los excedentes alimentarios generados en las áreas de producción y servicio del establecimiento que, tras las actuaciones de prevención (prioridad 1) y reutilización interna mediante tratamiento térmico documentado (Anexo III del PPDA), no hayan sido reintegrados al circuito productivo y mantengan condiciones de aptitud para consumo humano.</p>
                    <p className="mb-1 font-bold text-slate-800">Quedan expresamente excluidos de la donación:</p>
                    <ul className="list-none pl-2 space-y-1 text-slate-600">
                        <li>— Alimentos que hayan superado su fecha de caducidad.</li>
                        <li>— Alimentos cuyo etiquetado sea incorrecto o incompleto conforme al Reglamento (UE) 1169/2011.</li>
                        <li>— Alimentos expuestos en autoservicio sin protección que no sean aptos para consumo humano (Bloques C3, C4 y C5 del Anexo IV del PPDA).</li>
                        <li>— Alimentos que presenten alteración organoléptica, contaminación o rotura de cadena de frío documentada.</li>
                    </ul>
                </div>

                {/* 3. RESPONSABILIDADES */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">3. Responsabilidades</h4>
                    <div className="space-y-2">
                        {[
                            { rol: 'Responsable del PPDA', desc: 'Coordinación general del protocolo de donación, supervisión de registros, comunicación con la entidad receptora y reporte de indicadores de donación a Dirección.' },
                            { rol: 'Jefe de Cocina', desc: 'Evaluación diaria de la aptitud de los excedentes para donación al cierre de cada servicio. Validación de condiciones de seguridad alimentaria.' },
                            { rol: 'Responsable de Donación (si designado)', desc: 'Gestión operativa de la segregación, envasado, etiquetado, conservación temporal y entrega de los alimentos a la entidad receptora.' },
                            { rol: 'Dirección', desc: 'Aprobación y firma del convenio de donación. Asignación de recursos necesarios.' },
                        ].map((r, i) => (
                            <div key={i} className="flex gap-3 border border-slate-200 rounded p-2 bg-slate-50">
                                <span className="font-black text-slate-800 min-w-[180px] shrink-0">{r.rol}</span>
                                <span className="text-slate-600">{r.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. CONTENIDO MÍNIMO DEL CONVENIO */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">4. Contenido Mínimo del Convenio de Donación (Art. 7 Ley 1/2025)</h4>
                    <p className="mb-3 text-justify">El convenio o acuerdo suscrito con la entidad receptora deberá contemplar, como mínimo, los siguientes elementos conforme al artículo 7 de la Ley 1/2025:</p>

                    <p className="font-bold text-slate-800 mb-1">4.1. Condiciones de recogida, transporte y almacenamiento:</p>
                    <ul className="list-none pl-2 space-y-1 text-slate-600 mb-3">
                        <li>— Frecuencia de recogida pactada.</li>
                        <li>— Horario y punto de recogida en el establecimiento.</li>
                        <li>— Requisitos de temperatura durante el transporte: alimentos refrigerados ≤4°C, congelados ≤-18°C, temperatura ambiente para productos no perecederos.</li>
                        <li>— Tipo de vehículo: isotermo o frigorífico según naturaleza del producto.</li>
                        <li>— Condiciones de almacenamiento en destino a cargo de la entidad receptora.</li>
                    </ul>

                    <p className="font-bold text-slate-800 mb-1">4.2. Compromisos de las partes:</p>
                    <p className="font-semibold text-slate-700 mb-1 pl-2">Compromisos del establecimiento donante:</p>
                    <ul className="list-none pl-4 space-y-1 text-slate-600 mb-2">
                        <li>— Garantizar que los alimentos donados cumplen la normativa de seguridad alimentaria vigente (Reg. 852/2004, Reg. 1169/2011).</li>
                        <li>— Realizar la selección de alimentos a donar (la selección corresponde al agente donante, Art. 7.3°).</li>
                        <li>— Envasar e identificar correctamente cada partida donada.</li>
                        <li>— Mantener registro de trazabilidad de cada donación.</li>
                        <li>— No condicionar la donación a contraprestación económica alguna.</li>
                    </ul>
                    <p className="font-semibold text-slate-700 mb-1 pl-2">Compromisos de la entidad receptora:</p>
                    <ul className="list-none pl-4 space-y-1 text-slate-600 mb-3">
                        <li>— Garantizar la trazabilidad mediante sistema de registro de entradas y salidas (Art. 9.a Ley 1/2025).</li>
                        <li>— Mantener correctas prácticas de higiene, instalaciones y equipos adecuados, incluyendo cadena de frío (Art. 9.b).</li>
                        <li>— Destinar los alimentos exclusivamente a personas en situación de vulnerabilidad; queda prohibida su comercialización (Art. 9.d).</li>
                        <li>— Realizar la distribución sin discriminación (Art. 9.c).</li>
                        <li>— Posibilidad de rechazar la donación, debiendo quedar debidamente justificado (Art. 7.4°).</li>
                    </ul>

                    <p className="font-bold text-slate-800 mb-1">4.3. Condiciones de devolución:</p>
                    <p className="text-slate-600 pl-2">En caso de rechazo, el donante decidirá las condiciones de devolución (recogida y transporte) conforme al convenio formalizado (Art. 7.4°).</p>
                </div>

                {/* 5. CRITERIOS DE APTITUD */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">5. Criterios de Aptitud para la Donación</h4>
                    <p className="mb-3 text-justify">Al cierre de cada servicio, el Jefe de Cocina o Responsable de Donación evaluará la aptitud de los alimentos conforme a las Directrices CE 2020/C 199/01 y la Guía HORECA del Gobierno Vasco:</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-wider">
                                <tr>
                                    <th className="p-2 border-r border-slate-700 w-[35%]">Tipo de alimento</th>
                                    <th className="p-2 border-r border-slate-700 w-[15%] text-center">Aptitud</th>
                                    <th className="p-2">Condiciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr className="bg-emerald-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Envasados dentro de fecha de caducidad</td><td className="p-2 border-r border-slate-200 text-center font-black text-emerald-700">APTO</td><td className="p-2 text-slate-600">Sin condiciones adicionales.</td></tr>
                                <tr><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Superada fecha consumo preferente (no caducidad)</td><td className="p-2 border-r border-slate-200 text-center font-black text-amber-600">CONDICIONAL</td><td className="p-2 text-slate-600">Verificar integridad de envase, condiciones de almacenamiento y evaluación organoléptica satisfactoria.</td></tr>
                                <tr className="bg-red-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Superada fecha de caducidad</td><td className="p-2 border-r border-slate-200 text-center font-black text-red-700">NO APTO</td><td className="p-2 text-slate-600">Descarte obligatorio.</td></tr>
                                <tr className="bg-emerald-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Elaborados no expuestos — Bloque A (Anexo IV)</td><td className="p-2 border-r border-slate-200 text-center font-black text-emerald-700">APTO</td><td className="p-2 text-slate-600">≤4°C, envasado hermético, entrega en ≤24h. Etiquetado completo.</td></tr>
                                <tr><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Expuestos con protección integral — Bloque B</td><td className="p-2 border-r border-slate-200 text-center font-black text-amber-600">CONDICIONAL</td><td className="p-2 text-slate-600">Solo si envase íntegro, temperatura controlada y exposición ≤2 horas.</td></tr>
                                <tr className="bg-red-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Expuestos sin protección — Bloque C (C3, C4, C5)</td><td className="p-2 border-r border-slate-200 text-center font-black text-red-700">NO APTO</td><td className="p-2 text-slate-600">Ningún caso. Bloque C1 y C2 solo si transformados térmicamente.</td></tr>
                                <tr className="bg-emerald-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Pan, bollería envasada individualmente sin abrir</td><td className="p-2 border-r border-slate-200 text-center font-black text-emerald-700">APTO</td><td className="p-2 text-slate-600">—</td></tr>
                                <tr><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Pan expuesto sin envase</td><td className="p-2 border-r border-slate-200 text-center font-black text-red-700">NO APTO</td><td className="p-2 text-slate-600">Solo apto si transformado (pan rallado, etc.).</td></tr>
                                <tr className="bg-emerald-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Frutas enteras con piel incomestible intacta</td><td className="p-2 border-r border-slate-200 text-center font-black text-emerald-700">APTO</td><td className="p-2 text-slate-600">Plátano, naranja, piña, etc.</td></tr>
                                <tr className="bg-red-50"><td className="p-2 border-r border-slate-200 font-bold text-slate-800">Frutas cortadas, ensaladas, verduras expuestas</td><td className="p-2 border-r border-slate-200 text-center font-black text-red-700">NO APTO</td><td className="p-2 text-slate-600">—</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 6. PROCEDIMIENTO OPERATIVO */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">6. Procedimiento Operativo de Donación</h4>
                    <div className="space-y-3">
                        {[
                            { paso: 'PASO 1 — Identificación y segregación', desc: 'Al cierre de servicio, el Jefe de Cocina clasifica los excedentes según el Anexo IV. Los aptos para donación se segregan de los destinados a reutilización interna o descarte.' },
                            { paso: 'PASO 2 — Envasado e identificación', desc: 'Los alimentos aptos se envasan herméticamente y se etiquetan con: denominación, peso neto (kg), fecha y hora de elaboración/envasado, temperatura de conservación, alérgenos (Reg. UE 1169/2011), fecha límite de consumo e identificación del lote/servicio.' },
                            { paso: 'PASO 3 — Conservación temporal', desc: 'Almacenamiento en zona señalizada "DONACIÓN — PENDIENTE DE RECOGIDA" a ≤4°C (perecederos) o ≤-18°C (congelados).' },
                            { paso: 'PASO 4 — Entrega y documentación', desc: 'Verificación del recolector autorizado y del vehículo de transporte. Firma del REG-DON-02 por ambas partes (fecha, hora, descripción, cantidad en kg, temperatura de entrega, firmas).' },
                            { paso: 'PASO 5 — Gestión de donación rechazada', desc: 'Documentar motivo en REG-DON-02. Aplicar jerarquía Art. 5: alimentación animal → subproductos → compostaje/biogás → residuo orgánico.' },
                        ].map((p, i) => (
                            <div key={i} className="flex gap-3 border-l-4 border-brand-500 bg-slate-50 p-3 rounded-r">
                                <span className="font-black text-slate-800 min-w-[220px] shrink-0 text-[11px]">{p.paso}</span>
                                <span className="text-slate-600">{p.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 7. REGISTROS */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">7. Registros</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                                <tr>
                                    <th className="p-2 border border-slate-200 w-[28%]">Registro</th>
                                    <th className="p-2 border border-slate-200">Contenido mínimo</th>
                                    <th className="p-2 border border-slate-200 w-[22%]">Responsable / Frecuencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr><td className="p-2 border border-slate-200 font-mono text-[10px]">REG-DON-01 — Registro de Donaciones Realizadas</td><td className="p-2 border border-slate-200">Fecha, descripción del alimento, cantidad (kg), tipo de alimento, hora de entrega, entidad receptora, nombre del receptor, observaciones.</td><td className="p-2 border border-slate-200">Responsable PPDA / Cada donación</td></tr>
                                <tr className="bg-slate-50"><td className="p-2 border border-slate-200 font-mono text-[10px]">REG-DON-02 — Documento de Entrega de Donación</td><td className="p-2 border border-slate-200">Fecha, hora, listado de productos con peso, temperatura de entrega, alérgenos, fecha límite de consumo, firma del entregante, firma del receptor, motivo de rechazo (si aplica).</td><td className="p-2 border border-slate-200">Responsable de Donación / Cada entrega</td></tr>
                                <tr><td className="p-2 border border-slate-200 font-mono text-[10px]">REG-DON-03 — Registro de Convenios Vigentes</td><td className="p-2 border border-slate-200">Entidad receptora, fecha de firma, vigencia, frecuencia de recogida pactada, persona de contacto, teléfono, condiciones especiales.</td><td className="p-2 border border-slate-200">Dirección / Actualización anual</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-slate-500 italic">Todos los registros se conservarán durante un mínimo de 5 años, en soporte físico o digital, y estarán disponibles para inspección de las autoridades competentes.</p>
                </div>

                {/* 8. INDICADORES */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">8. Indicadores de Seguimiento</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-black tracking-wider">
                                <tr><th className="p-2 border border-slate-200 w-[20%]">KPI</th><th className="p-2 border border-slate-200">Descripción</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {[
                                    { kpi: 'KPI-DON-01', desc: 'Kg totales donados / mes.' },
                                    { kpi: 'KPI-DON-02', desc: '% de excedentes aptos efectivamente donados (objetivo: 100%).' },
                                    { kpi: 'KPI-DON-03', desc: 'Número de entregas realizadas / mes.' },
                                    { kpi: 'KPI-DON-04', desc: 'Número de rechazos por parte de la entidad receptora / trimestre.' },
                                    { kpi: 'KPI-DON-05', desc: 'Kg de donación rechazada y destino final aplicado (jerarquía Art. 5).' },
                                ].map((k, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : ''}><td className="p-2 border border-slate-200 font-mono font-bold text-[10px]">{k.kpi}</td><td className="p-2 border border-slate-200">{k.desc}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-slate-500 italic">Los indicadores se reportarán en el informe mensual del PPDA y se revisarán en el Comité de Sostenibilidad trimestral.</p>
                </div>

                {/* 9. ENTIDADES RECEPTORAS */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">9. Entidades Receptoras de Referencia</h4>
                    <ul className="list-none pl-2 space-y-1 text-slate-600">
                        <li>— <span className="font-bold text-slate-800">FESBAL</span> (Federación Española de Bancos de Alimentos) y Banco de Alimentos local de la provincia.</li>
                        <li>— <span className="font-bold text-slate-800">Cruz Roja Española</span> (programa de distribución de alimentos).</li>
                        <li>— <span className="font-bold text-slate-800">Plataformas de redistribución tecnológica:</span> Too Good To Go, Encantado de Comerte, u homólogas habilitadas en la CCAA.</li>
                        <li>— <span className="font-bold text-slate-800">ONGs locales autorizadas:</span> Cáritas, comedores sociales municipales, etc.</li>
                        <li>— <span className="font-bold text-slate-800">Nutrición sin Fronteras / Proyecto "Comparte Comida"</span> (servicio de recogida y distribución a entidades sociales, específico para hostelería).</li>
                    </ul>
                    <div className="mt-3 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r text-slate-600 italic">
                        <span className="font-black text-slate-800 not-italic">Nota:</span> Banco de Alimentos y Cruz Roja aceptan fundamentalmente alimentos envasados del fabricante; la aceptación de platos elaborados queda sujeta a las condiciones de cada banco local. Las plataformas tipo Too Good To Go operan bajo un modelo de venta a precio reducido que no constituye donación en sentido estricto del Art. 6.4.b), aunque contribuye a la reducción de desperdicio conforme al espíritu de la Ley.
                    </div>
                </div>

                {/* 10. BENEFICIOS FISCALES */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">10. Beneficios Fiscales</h4>
                    <p className="text-justify text-slate-600">Conforme a la Ley 49/2002 de régimen fiscal de entidades sin fines lucrativos y de incentivos fiscales al mecenazgo, las donaciones de alimentos a entidades acogidas a dicho régimen pueden generar deducciones en el Impuesto sobre Sociedades. El establecimiento solicitará a la entidad receptora el correspondiente certificado de donación que acredite: identidad del donante y del donatario, fecha y destino de la donación, y valoración económica de los bienes donados.</p>
                </div>

                {/* 11. MEDIDAS CORRECTIVAS */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">11. Medidas Correctivas</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-black tracking-wider" style={{ display: 'table-header-group' }}>
                                <tr>
                                    <th className="p-2 border border-slate-200 w-[25%]">Desviación</th>
                                    <th className="p-2 border border-slate-200">Medida inmediata</th>
                                    <th className="p-2 border border-slate-200">Medida preventiva</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {[
                                    { desv: 'No se realizan donaciones durante ≥30 días con excedentes aptos', inm: 'Revisión del protocolo, contacto urgente con entidad receptora para reactivar recogidas.', prev: 'Evaluar necesidad de segundo convenio con entidad alternativa.' },
                                    { desv: 'Entrega sin registro documental (REG-DON-02)', inm: 'Reconstruir registro con datos disponibles, refuerzo formativo al personal.', prev: 'Simplificar formulario, integrar en sistema digital.' },
                                    { desv: 'Rechazo reiterado por entidad receptora (>3/trimestre)', inm: 'Análisis de causas (calidad, cantidad, horario, tipo de producto).', prev: 'Ajuste del convenio o búsqueda de entidad alternativa.' },
                                    { desv: 'Donación de alimentos no aptos (fuera de fecha, sin etiquetado, rotura cadena frío)', inm: 'Retirada inmediata, comunicación a entidad receptora, evaluación de riesgo.', prev: 'Revisión de criterios de aptitud, formación adicional.' },
                                ].map((m, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : ''}>
                                        <td className="p-2 border border-slate-200 font-bold text-slate-700">{m.desv}</td>
                                        <td className="p-2 border border-slate-200 text-slate-600">{m.inm}</td>
                                        <td className="p-2 border border-slate-200 text-slate-600">{m.prev}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* NOTAS TÉCNICAS */}
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg avoid-page-break">
                    <p className="font-black text-slate-800 text-xs uppercase tracking-wider mb-2">Notas Técnicas — V1.0</p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                        <li>La obligación de promover convenios de donación aplica a establecimientos con superficie {'>'} 1.300 m² o que superen dicho umbral en conjunto bajo un mismo CIF (Art. 6.4.c Ley 1/2025). Se recomienda como buena práctica para todos los establecimientos.</li>
                        <li>Las microempresas (menos de 10 empleados y facturación ≤2M€) quedan excluidas de las obligaciones del artículo 6 (Art. 6.6 Ley 1/2025).</li>
                        <li>Ninguna estipulación contractual puede impedir expresamente la donación de alimentos, siendo nula de pleno derecho cualquier cláusula en tal sentido (Art. 6.3 Ley 1/2025).</li>
                        <li>La no realización de donaciones de excedentes aptos conforme al convenio constituye infracción leve según el régimen sancionador de la Ley 1/2025.</li>
                        <li>El presente protocolo debe revisarse anualmente coincidiendo con la revisión del PPDA, o de forma extraordinaria ante cambios normativos, cambio de entidad receptora o incidencias significativas.</li>
                    </ol>
                </div>

            </div>
        </section>

        {/* ANEXO II: Plan de Formación Detallado */}
        <div className="html2pdf__page-break"></div>
        <section className="print-page-break">
            <div className="border-b-2 border-slate-900 pb-4 mb-4 avoid-page-break">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Anexo II</h2>
                <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Plan de Formación y Sensibilización</h3>
            </div>

            <div className="space-y-8">
                {/* OBJETIVO GENERAL - INDIVISIBLE */}
                <div className="bg-slate-50 p-4 border-l-4 border-brand-500 avoid-page-break">
                    <h4 className="font-bold text-slate-900 text-sm mb-2">Objetivo General</h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                        Capacitar a todo el personal implicado en la cadena alimentaria del establecimiento para identificar, medir y prevenir el desperdicio, fomentando una cultura de sostenibilidad y garantizando el cumplimiento de la Ley 1/2025.
                    </p>
                </div>

                {/* Módulo 1 - INDIVISIBLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden avoid-page-break">
                    <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
                        <h4 className="font-black text-xs uppercase tracking-wider">Módulo 1: Concienciación y Normativa</h4>
                        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded font-bold">45 min</span>
                    </div>
                    <div className="p-4 flex flex-col md:flex-row gap-4 text-xs">
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Destinatarios:</p>
                            <p className="text-slate-600">Todo el personal (Cocina, Sala, Compras, Dirección).</p>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Contenidos:</p>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                                <li>Impacto económico, social y ambiental del desperdicio.</li>
                                <li>Jerarquía de prioridades según Ley 1/2025.</li>
                                <li>Obligaciones legales del establecimiento.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Módulo 2 - INDIVISIBLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden avoid-page-break">
                    <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
                        <h4 className="font-black text-xs uppercase tracking-wider">Módulo 2: Procedimientos Operativos en Cocina</h4>
                        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded font-bold">60 min</span>
                    </div>
                    <div className="p-4 flex flex-col md:flex-row gap-4 text-xs">
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Destinatarios:</p>
                            <p className="text-slate-600">Personal de Cocina, Economato y F&B.</p>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Contenidos:</p>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                                <li>Recepción y almacenamiento (FIFO/FEFO).</li>
                                <li>Técnicas de producción eficiente y regeneración.</li>
                                <li>Aprovechamiento de mermas y subproductos.</li>
                                <li>Segregación correcta de residuos orgánicos.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Módulo 3 - INDIVISIBLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden avoid-page-break">
                    <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
                        <h4 className="font-black text-xs uppercase tracking-wider">Módulo 3: Medición y Registro</h4>
                        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded font-bold">45 min</span>
                    </div>
                    <div className="p-4 flex flex-col md:flex-row gap-4 text-xs">
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Destinatarios:</p>
                            <p className="text-slate-600">Jefes de Partida, Cocina y Responsables de Sala.</p>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 mb-1">Contenidos:</p>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                                <li>Metodología de los "4 Cubos" (Mermas, Elaboración, Buffet, Cliente).</li>
                                <li>Uso de las hojas de registro y herramientas digitales.</li>
                                <li>Interpretación básica de indicadores (KPIs).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                 {/* Evaluación - INDIVISIBLE */}
                 <div className="border border-slate-200 p-4 bg-white text-xs avoid-page-break">
                    <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wide">Metodología y Evaluación</h4>
                    <p className="text-slate-600 mb-2">
                        La formación se impartirá de manera presencial con apoyo de material audiovisual. Se realizará un registro de asistencia firmado por cada empleado.
                    </p>
                    <p className="text-slate-600">
                        <span className="font-bold">Indicador de éxito:</span> El 100% del personal fijo debe haber completado el Módulo 1 en los primeros 3 meses de vigencia del plan.
                    </p>
                </div>
            </div>
        </section>

        {/* ANEXO III: Procedimiento de Gestión de Desperdicio Alimentario en Buffet */}
        <div className="html2pdf__page-break"></div>
        <section className="print-page-break">
            <div className="border-b-2 border-slate-900 pb-4 mb-4 avoid-page-break">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Anexo III</h2>
                <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Procedimiento de Gestión de Desperdicio Alimentario en Buffet</h3>
            </div>
            <div className="text-xs text-slate-700 space-y-6">
                
                {/* Cabecera del Documento */}
                <div className="border border-slate-300 rounded-lg overflow-hidden avoid-page-break">
                    <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-200">
                            <tr className="bg-slate-50">
                                <th className="p-3 font-bold text-slate-900 w-1/3 border-r border-slate-200">Código documento</th>
                                <td className="p-3 font-mono text-slate-700">PRO-APPCC-DA-001</td>
                            </tr>
                            <tr>
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Título</th>
                                <td className="p-3 text-slate-700">Protocolo de Gestión del Desperdicio Alimentario en Establecimientos Hoteleros</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Versión</th>
                                <td className="p-3 text-slate-700">1.0</td>
                            </tr>
                            <tr>
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Fecha de emisión</th>
                                <td className="p-3 text-slate-700">Marzo 2026</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Elaborado por</th>
                                <td className="p-3 text-slate-700">HS GREEN – División de Medioambiente y Sostenibilidad</td>
                            </tr>
                            <tr>
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Aprobado por</th>
                                <td className="p-3 text-slate-700">
                                    {sanitizeForPdf(state.team.find(t => t.id === 'dir')?.nombre || 'Director del Establecimiento')}
                                    {' '}— Director del Establecimiento
                                </td>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="p-3 font-bold text-slate-900 border-r border-slate-200">Marco normativo</th>
                                <td className="p-3 text-slate-700">Ley 1/2025, de 2 de enero, de prevención de las pérdidas y el desperdicio alimentario (BOE núm. 80, 2 abril 2025)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 1. OBJETO */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">1. Objeto</h4>
                    <p className="mb-2 text-justify">
                        El presente protocolo tiene por objeto establecer la sistemática operativa para la prevención y reducción del desperdicio alimentario en los establecimientos hoteleros, con especial atención a la reutilización de excedentes del servicio de buffet mediante tratamiento térmico posterior, integrando dichas actuaciones en el sistema de Análisis de Peligros y Puntos de Control Crítico (APPCC) del establecimiento.
                    </p>
                    <p className="text-justify">
                        Su implementación responde a las obligaciones establecidas en el Artículo 5 (Jerarquía de prioridades) y el Artículo 6.1 de la Ley 1/2025, de 2 de enero, de prevención de las pérdidas y el desperdicio alimentario (BOE núm. 80, de 2 de abril de 2025), que obliga a todos los agentes de la cadena alimentaria a aplicar medidas de prevención y a priorizar la reutilización de los alimentos para consumo humano antes de recurrir a otras vías de valorización o eliminación. Asimismo, se enmarca en el principio de prevención del artículo 4.b) de la misma norma, que exige adoptar medidas orientadas a reducir la cantidad de pérdidas y desperdicio alimentario mediante su reutilización.
                    </p>
                </div>

                {/* 2. ALCANCE */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">2. Alcance</h4>
                    <p className="mb-2">Este protocolo es de aplicación obligatoria a todas las áreas de producción y servicio de alimentos del establecimiento hotelero, con especial incidencia en:</p>
                    <ul className="list-disc pl-5 mb-2 space-y-1">
                        <li>Servicio de buffet: desayuno, almuerzo y cena.</li>
                        <li>Cocina central y cocinas de apoyo (banquetes, room service, personal).</li>
                        <li>Almacenamiento de excedentes generados al cierre de cada servicio.</li>
                        <li>Comida de personal, cuando sea destinataria de los excedentes reutilizados.</li>
                    </ul>
                    <p className="text-justify bg-slate-50 p-3 border-l-4 border-slate-400 rounded-r">
                        Quedan expresamente excluidos del circuito de reutilización para consumo humano los alimentos que hayan estado expuestos directamente al cliente en modalidad de autoservicio sin protección, de conformidad con las limitaciones higiénico-sanitarias del Reglamento (CE) n.º 852/2004 y Guías Sectoriales. Estos productos serán gestionados conforme a la jerarquía del artículo 5 de la Ley 1/2025 (alimentación animal, compostaje u otras vías de valorización).
                    </p>
                </div>

                {/* 3. RESPONSABLE */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">3. Responsable</h4>
                    <p className="mb-2">La aplicación del presente protocolo recae en los siguientes roles del establecimiento:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><span className="font-bold">Responsable del PPDA</span> (Plan de Prevención y Control de Desperdicio Alimentario): coordinación general, supervisión de registros y reporte de indicadores.</li>
                        <li><span className="font-bold">Jefe de cocina:</span> supervisión operativa diaria, validación de condiciones de aceptación de excedentes, autorización de regeneración térmica.</li>
                        <li><span className="font-bold">Cocinero responsable de turno:</span> ejecución del tratamiento térmico, cumplimentación de registros APPCC.</li>
                        <li><span className="font-bold">Jefe de sala / Responsable de buffet:</span> control del tiempo de exposición y comunicación al jefe de cocina al cierre del servicio.</li>
                    </ul>
                </div>

                {/* 4. DESARROLLO */}
                <div>
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-200 pb-1">4. Desarrollo</h4>
                    
                    <div className="mb-4 avoid-page-break">
                        <h5 className="font-bold text-slate-800 mb-2">4.1. Criterios de aceptación de excedentes de buffet para reutilización</h5>
                        <p className="mb-2">Al cierre de cada servicio de buffet, el jefe de cocina evaluará los excedentes disponibles aplicando los siguientes criterios de aceptación para su posible reutilización mediante tratamiento térmico:</p>
                        <ul className="list-disc pl-5 mb-2 space-y-1">
                            <li><span className="font-bold">Temperatura:</span> los alimentos calientes deben haberse mantenido a ≥65°C durante el servicio; los fríos a ≤8°C.</li>
                            <li><span className="font-bold">Tiempo de exposición:</span> máximo 2 horas desde la primera exposición al servicio.</li>
                            <li><span className="font-bold">Estado organoléptico:</span> color, olor y textura correctos; sin evidencia de contaminación cruzada.</li>
                            <li><span className="font-bold">Trazabilidad:</span> identificado el lote, servicio de procedencia y hora de retirada.</li>
                        </ul>
                        <p className="italic text-slate-500">La Tabla de alimentos permitidos se detalla en el Anexo IV.</p>
                    </div>

                    <div className="avoid-page-break">
                        <h5 className="font-bold text-slate-800 mb-2">4.2. Sistemática de reutilización mediante tratamiento térmico</h5>
                        <p className="mb-2">Los excedentes clasificados como aptos serán sometidos, sin excepción, al siguiente proceso antes de su incorporación a una nueva elaboración:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><span className="font-bold">Refrigeración inmediata:</span> enfriamiento rápido hasta ≤4°C en abatidor o baño de agua con hielo (máx. 2 horas desde retirada del buffet).</li>
                            <li><span className="font-bold">Identificación y etiquetado:</span> nombre del producto, fecha/hora de retirada, temperatura de almacenamiento, operario responsable.</li>
                            <li><span className="font-bold">Almacenamiento:</span> en recipiente cerrado e identificado en cámara frigorífica a ≤4°C. Consumo en las 24 horas siguientes.</li>
                            <li><span className="font-bold">Regeneración térmica:</span> alcanzar una temperatura mínima de 75°C en el centro del producto, verificada con termómetro calibrado, antes de incorporar a la nueva elaboración o servir.</li>
                            <li><span className="font-bold">Uso único:</span> los excedentes reutilizados no podrán someterse a un segundo ciclo de reutilización; en caso de sobrante tras el segundo uso, descarte obligatorio.</li>
                        </ul>
                    </div>
                </div>

                {/* 5. REGISTROS */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-200 pb-1">5. Registros</h4>
                    <p className="mb-3">Los registros derivados de este protocolo se integran en el sistema documental del APPCC del establecimiento y son auditables como evidencia de cumplimiento de la Ley 1/2025:</p>
                    
                    <div className="overflow-x-auto mb-3">
                        <table className="w-full text-left border-collapse border border-slate-300">
                            <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                    <th className="p-2 border border-slate-300 font-bold">REGISTRO APPCC</th>
                                    <th className="p-2 border border-slate-300 font-bold">CONTENIDO MÍNIMO</th>
                                    <th className="p-2 border border-slate-300 font-bold">RESPONSABLE / FRECUENCIA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr>
                                    <td className="p-2 border border-slate-300 font-mono text-[10px]">REG-DA-01 — Excedentes de Buffet</td>
                                    <td className="p-2 border border-slate-300">Producto, cantidad (kg), hora cierre buffet, condición organoléptica, decisión (reutilizar/descartar)</td>
                                    <td className="p-2 border border-slate-300">Jefe de cocina / Cada servicio</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-300 font-mono text-[10px]">REG-DA-02 — Control de Tratamiento Térmico Excedentes</td>
                                    <td className="p-2 border border-slate-300">Producto reutilizado, temperatura regeneración (°C), hora, operario, destino final</td>
                                    <td className="p-2 border border-slate-300">Cocinero responsable / Cada lote regenerado</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-300 font-mono text-[10px]">REG-DA-03 — KPI Cuantificación de Desperdicio</td>
                                    <td className="p-2 border border-slate-300">Kg Totales y Relativos por puntos de generación y fecha</td>
                                    <td className="p-2 border border-slate-300">Responsable PPDA / Diario o por servicio</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-justify">
                        Todos los registros se conservarán durante un mínimo de 5 años, en soporte físico o digital, y estarán disponibles para inspección de autoridades competentes. Los datos cuantitativos, alimentarán el sistema de medición del PPDA conforme a la metodología de los 4 focos de desperdicio (Mermas, Elaboración, Buffet, Cliente).
                    </p>
                </div>

                {/* 6. MEDIDAS CORRECTIVAS */}
                <div className="avoid-page-break">
                    <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-200 pb-1">6. Medidas Correctivas</h4>
                    <p className="mb-3">Ante cualquier desviación detectada en la aplicación del protocolo, se aplicarán las medidas correctivas recogidas en la tabla siguiente, debiendo quedar todas documentadas y evaluadas en la revisión periódica del PPDA:</p>
                    
                    <div className="overflow-x-auto mb-3">
                        <table className="w-full text-left border-collapse border border-slate-300">
                            <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                    <th className="p-2 border border-slate-300 font-bold">DESVIACIÓN DETECTADA</th>
                                    <th className="p-2 border border-slate-300 font-bold">MEDIDA CORRECTIVA INMEDIATA</th>
                                    <th className="p-2 border border-slate-300 font-bold">MEDIDA CORRECTIVA PREVENTIVA</th>
                                    <th className="p-2 border border-slate-300 font-bold">RESPONSABLE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr>
                                    <td className="p-2 border border-slate-300 font-bold text-red-600">T° regeneración &lt; 75°C</td>
                                    <td className="p-2 border border-slate-300">Retirar producto, continuar cocción hasta alcanzar T°; si no es posible, descartar</td>
                                    <td className="p-2 border border-slate-300">Revisar equipo de regeneración; formación al personal</td>
                                    <td className="p-2 border border-slate-300">Jefe de cocina</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-300 font-bold text-red-600">Excedente expuesto &gt;2h sin temperatura controlada</td>
                                    <td className="p-2 border border-slate-300">No reutilizar para consumo humano; derivar a compostaje u otro gestor autorizado</td>
                                    <td className="p-2 border border-slate-300">Revisar protocolo de cierre de buffet; ajustar cantidades servidas</td>
                                    <td className="p-2 border border-slate-300">Jefe de sala / Cocina</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-300 font-bold text-red-600">Producto con alteración organoléptica</td>
                                    <td className="p-2 border border-slate-300">Rechazo inmediato; descartar al gestor de residuos orgánicos autorizado</td>
                                    <td className="p-2 border border-slate-300">Revisar temperatura de conservación; evaluar tiempo de exposición</td>
                                    <td className="p-2 border border-slate-300">Jefe de cocina</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-300 font-bold text-red-600">Sobreproducción reiterada (&gt;3 servicios/semana)</td>
                                    <td className="p-2 border border-slate-300">Ajuste inmediato de ratios de producción para el siguiente servicio</td>
                                    <td className="p-2 border border-slate-300">Analizar datos de ocupación y consumo; revisar plan de producción en PPDA</td>
                                    <td className="p-2 border border-slate-300">Responsable PPDA</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-justify bg-slate-50 p-3 border-l-4 border-slate-400 rounded-r">
                        La acumulación de tres o más no conformidades del mismo tipo en un periodo de 30 días dará lugar a la revisión del protocolo y, en su caso, a una acción de mejora del Plan PPDA, en cumplimiento del ciclo de mejora continua del sistema APPCC (principio 5: acciones correctivas) y de la obligación de revisión periódica del artículo 6.4.a) de la Ley 1/2025.
                    </p>
                </div>

            </div>
        </section>

        {/* ANEXO IV: Tabla de Decisión de Reutilización de Excedentes de Buffet Hotelero */}
        <div className="html2pdf__page-break"></div>
        <section className="print-page-break">
            <div className="border-b-2 border-slate-900 pb-4 mb-4 avoid-page-break">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Anexo IV</h2>
                <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Tabla de Decisión de Reutilización de Excedentes de Buffet Hotelero</h3>
            </div>
            <div className="text-[9px] text-slate-700">
                <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left border-collapse border border-slate-300">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="p-2 border border-slate-300 font-bold w-1/5">CATEGORÍA / SITUACIÓN</th>
                                <th className="p-2 border border-slate-300 font-bold w-1/5">ESTADO LEGAL</th>
                                <th className="p-2 border border-slate-300 font-bold w-1/5">CONDICIONES DE ACEPTACIÓN</th>
                                <th className="p-2 border border-slate-300 font-bold w-1/5">TRATAMIENTO REQUERIDO</th>
                                <th className="p-2 border border-slate-300 font-bold w-1/5">DESTINO PERMITIDO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {/* BLOQUE A */}
                            <tr className="bg-emerald-100 text-emerald-900 font-bold">
                                <td colSpan={5} className="p-2 border border-slate-300 uppercase">BLOQUE A — EXCEDENTES DE PRODUCCIÓN NO EXPUESTOS AL CLIENTE | Reutilización para consumo humano: PERMITIDA</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">A1. Elaboraciones calientes (carnes, aves, pescados, huevos cocinados) en timbre caliente / cocina, sin salir al buffet</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Excedente bajo control del operador; trazabilidad higiénica íntegra (Art. 5 Ley 1/2025 + Reg. 852/2004)</span></td>
                                <td className="p-2 border border-slate-300">T° mantenimiento ≥65°C documentada; tiempo total desde elaboración &lt;4h; estado organoléptico correcto; sin contacto con cliente</td>
                                <td className="p-2 border border-slate-300">Regeneración ≥75°C en centro de pieza verificada con termómetro calibrado; consumo en el mismo día</td>
                                <td className="p-2 border border-slate-300 font-bold">Nuevo plato de carta, guiso, relleno, sopa/caldo, comida de personal. USO ÚNICO — no reutilizar por segunda vez</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">A2. Pastas, arroces, legumbres cocidas sin exponer (batch sobrante de producción)</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Excedente de cocina sin exposición al público</span></td>
                                <td className="p-2 border border-slate-300">Enfriamiento rápido ≤4°C en &lt;2h; etiqueta: producto, fecha/hora, operario; consumo en 24h</td>
                                <td className="p-2 border border-slate-300">Regeneración ≥75°C; no recongelar si previamente descongelado (RD 1021/2022 art. 9)</td>
                                <td className="p-2 border border-slate-300">Guisos, sopas, ensaladas templadas (postcoc.), comida de personal</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">A3. Verduras y hortalizas cocinadas sobrantes de producción (no expuestas)</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Bajo cadena de control del establecimiento</span></td>
                                <td className="p-2 border border-slate-300">T° correcta mantenida; sin deterioro organoléptico; etiqueta de trazabilidad</td>
                                <td className="p-2 border border-slate-300">Regeneración ≥75°C; incorporar inmediatamente a nueva elaboración</td>
                                <td className="p-2 border border-slate-300">Cremas, purés, salteados, rellenos, guarniciones, comida de personal</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">A4. Pan/bollería envasados individualmente (film, packaging original) NO abiertos por el cliente</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Protección integral garantizada; inaccesible al cliente (Guía HORECA Gob. Vasco)</span></td>
                                <td className="p-2 border border-slate-300">Envase íntegro sin manipulación; dentro de fecha; sin contaminación exterior</td>
                                <td className="p-2 border border-slate-300">Horneado/tostado si se transforma; secado para pan rallado; fritura para picatostes</td>
                                <td className="p-2 border border-slate-300">Pan rallado, picatostes, torrijas, base de rellenos. CONSUMO DIRECTO si está en fecha</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">A5. Lácteos en envase cerrado no abierto por el cliente (yogures, quesos porción, mantequilla individual)</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Envasado industria; sin contacto ambiental</span></td>
                                <td className="p-2 border border-slate-300">Envase cerrado; T° cadena de frío ≤8°C; dentro de fecha de caducidad/CP</td>
                                <td className="p-2 border border-slate-300">Pasteurización si se elabora producto cocinado (salsas, natillas, etc.)</td>
                                <td className="p-2 border border-slate-300">Consumo directo (si en fecha) o transformación: salsas, postres cocidos, comida personal</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">A6. Frutas enteras con corteza/piel incomestible (plátano, naranja, pomelo, sandía, piña entera)</td>
                                <td className="p-2 border border-slate-300 text-emerald-700 font-bold">✅ APTO<br/><span className="font-normal text-slate-600">Protección natural; corteza preserva inocuidad (Guía HORECA Gob. Vasco)</span></td>
                                <td className="p-2 border border-slate-300">Piel intacta sin cortes ni daños; sin signos de deterioro; conservación correcta</td>
                                <td className="p-2 border border-slate-300">Pasteurización si se transforma en zumo/smoothie; cocción si es compota o mermelada</td>
                                <td className="p-2 border border-slate-300">Consumo directo (pelado en cocina), mermeladas, compotas, smoothies pasteurizados, comida personal</td>
                            </tr>

                            {/* BLOQUE B */}
                            <tr className="bg-amber-100 text-amber-900 font-bold">
                                <td colSpan={5} className="p-2 border border-slate-300 uppercase">BLOQUE B — EXPUESTOS EN BUFFET CON PROTECCIÓN INTEGRAL | Reutilización: CONDICIONADA (evaluar caso a caso)</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">B1. Salsas, cereales, cacao en polvo en dispensadores herméticos cerrados</td>
                                <td className="p-2 border border-slate-300 text-amber-700 font-bold">⚠️ CONDICIONADO<br/><span className="font-normal text-slate-600">Protección funcional si el dispensador es estrictamente hermético</span></td>
                                <td className="p-2 border border-slate-300">Hermeticidad verificada; T° correcta; sin signos de contaminación del equipo</td>
                                <td className="p-2 border border-slate-300">Salsas: regeneración ≥75°C antes de reutilizar. Cereales: solo si se reenvasan herméticamente</td>
                                <td className="p-2 border border-slate-300">Cocina/comida personal si garantías confirmadas. Si duda sobre hermeticidad: DESCARTAR</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">B2. Preparaciones porciones envasadas y expuestas sin abrir (sándwiches film, postres cubiertos)</td>
                                <td className="p-2 border border-slate-300 text-amber-700 font-bold">⚠️ CONDICIONADO<br/><span className="font-normal text-slate-600">Depende de integridad del envase y temperatura durante exposición</span></td>
                                <td className="p-2 border border-slate-300">Envase cerrado íntegro; T° ≤8°C si producto frío; tiempo exposición ≤2h; sin condensación</td>
                                <td className="p-2 border border-slate-300">Regeneración ≥75°C si se incorpora a elaboración caliente</td>
                                <td className="p-2 border border-slate-300">Consumo en jornada o comida personal. Si envase comprometido o T° fuera de rango: DESCARTAR</td>
                            </tr>

                            {/* BLOQUE C */}
                            <tr className="bg-red-100 text-red-900 font-bold">
                                <td colSpan={5} className="p-2 border border-slate-300 uppercase">BLOQUE C — EXPUESTOS EN AUTOSERVICIO SIN PROTECCIÓN | Reutilización consumo humano DIRECTO: PROHIBIDA | EXCEPCIÓN: Transformación con tratamiento térmico documentado</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">C1. Charcutería, embutidos, quesos en tabla, fiambres expuestos en buffet frío</td>
                                <td className="p-2 border border-slate-300 text-red-700 font-bold">❌ NO APTO (directo)<br/><span className="text-amber-600">✅ EXCEPCIÓN con TT:</span><br/><span className="font-normal text-slate-600">Incorporación a elaboración con cocción que garantice inocuidad</span></td>
                                <td className="p-2 border border-slate-300">SOLO si no presenta deterioro organoléptico; se usa como ingrediente de elaboración caliente el mismo día; no se consume tal cual ni al personal sin cocción</td>
                                <td className="p-2 border border-slate-300 font-bold">COCCIÓN ≥75°C en la elaboración final (pizza, quiche, pasta rellena, croquetas). La temperatura del proceso de elaboración es el tratamiento de seguridad</td>
                                <td className="p-2 border border-slate-300">Pizzas, quiches, empanadas, pasta rellena, croquetas, otras elaboraciones con cocción completa</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">C2. Pan, bollería, pastelería expuestos sin envase en cestillos/bandejas abiertas</td>
                                <td className="p-2 border border-slate-300 text-red-700 font-bold">❌ NO APTO (directo)<br/><span className="text-amber-600">✅ EXCEPCIÓN con TT:</span><br/><span className="font-normal text-slate-600">Transformación mediante proceso térmico documentado</span></td>
                                <td className="p-2 border border-slate-300">SOLO si: no presenta contaminación visible; se destina exclusivamente a transformación (no consumo directo); el jefe de cocina valida y documenta la decisión en REG-DA-01</td>
                                <td className="p-2 border border-slate-300">Secado + triturado para pan rallado; fritura ≥170°C para picatostes; horneado para tostadas; cocción en postre (puding, tostada francesa, torrijas)</td>
                                <td className="p-2 border border-slate-300">Pan rallado, picatostes, torrijas, puding de pan, tostada francesa. NUNCA consumo sin transformación previa</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">C3. Carnes, aves, pescados, huevos cocinados expuestos abiertamente en buffet caliente</td>
                                <td className="p-2 border border-slate-300 text-red-700 font-bold">❌ PROHIBIDO<br/><span className="font-normal text-slate-600">Sin excepción de TT: Tratamiento térmico posterior NO rehabilita inocuidad perdida por exposición sin control</span></td>
                                <td className="p-2 border border-slate-300 font-bold text-red-700">DESCARTE OBLIGATORIO.<br/><span className="font-normal text-slate-600">El alimento ya cocinado expuesto en autoservicio caliente no puede ser regenerado de nuevo para consumo. Riesgo acumulado de multiplicación microbiana y contaminación cruzada no mitigable por nuevo TT</span></td>
                                <td className="p-2 border border-slate-300">No aplica tratamiento térmico rehabilitador. Gestionar conforme Art. 5 Ley 1/2025: alimentación animal (si normativa permite) → compostaje → residuo orgánico</td>
                                <td className="p-2 border border-slate-300 font-bold">JERARQUÍA ART. 5 LEY 1/2025:<br/><span className="font-normal text-slate-600">→ Alimentación animal (si CCAA lo permite y producto apto)<br/>→ Compostaje / Biogás (gestor autorizado)<br/>→ Residuo orgánico</span></td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="p-2 border border-slate-300 font-bold">C4. Frutas peladas/cortadas, ensaladas frías, verduras crudas expuestas en buffet frío</td>
                                <td className="p-2 border border-slate-300 text-red-700 font-bold">❌ PROHIBIDO<br/><span className="font-normal text-slate-600">Sin excepción de TT: Alta carga microbiana superficial; producto manipulado por clientes</span></td>
                                <td className="p-2 border border-slate-300 font-bold text-red-700">DESCARTE OBLIGATORIO.<br/><span className="font-normal text-slate-600">La contaminación cruzada por manipulación de clientes y la exposición ambiental prolongada hacen inviable cualquier reutilización para consumo humano, incluso con tratamiento térmico posterior</span></td>
                                <td className="p-2 border border-slate-300">No aplica tratamiento térmico rehabilitador para consumo humano. Gestionar conforme jerarquía Art. 5 Ley 1/2025</td>
                                <td className="p-2 border border-slate-300 font-bold">→ Alimentación animal (si normativa permite)<br/>→ Compostaje / Biogás (gestor autorizado)<br/>→ Residuo orgánico</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="p-2 border border-slate-300 font-bold">C5. Lácteos expuestos sin envase (quesos en tabla, nata en recipiente abierto, mantequilla en bloque)</td>
                                <td className="p-2 border border-slate-300 text-red-700 font-bold">❌ PROHIBIDO<br/><span className="font-normal text-slate-600">Producto perecedero de alto riesgo; sin trazabilidad higiénica tras exposición</span></td>
                                <td className="p-2 border border-slate-300 font-bold text-red-700">DESCARTE OBLIGATORIO. Sin excepción.<br/><span className="font-normal text-slate-600">La exposición ambiental y la posibilidad de contaminación cruzada con utensilios del cliente invalida toda reutilización</span></td>
                                <td className="p-2 border border-slate-300">No aplica tratamiento térmico rehabilitador. Residuo orgánico / compostaje</td>
                                <td className="p-2 border border-slate-300 font-bold">→ Compostaje / Biogás (gestor autorizado)<br/>→ Residuo orgánico</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg avoid-page-break">
                    <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[10px]">Notas Técnicas — v1.2</h4>
                    <ol className="list-decimal pl-4 space-y-1 text-[9px] text-slate-600">
                        <li><span className="font-bold">Fundamento normativo de la tabla:</span> Guía para o 2019 (HOSBEC/Segundo Mundo), Guía HORECA Gobierno Vasco, Art. 5 y 6 Ley 1/2025, Reg. (CE) 852/2004, RD 1021/2022.</li>
                        <li><span className="font-bold">REGLA FUNDAMENTAL:</span> 'Los alimentos no envasados (incluyendo frutas con piel comestible) expuestos para autoservicio NO se pueden reutilizar una vez expuestos' — esta prohibición afecta al consumo humano directo y solo admite las excepciones de TT documentado de C1 y C2.</li>
                        <li><span className="font-bold">La EXCEPCIÓN DE TT (Bloques C1 y C2):</span> aplica exclusivamente cuando el alimento expuesto se convierte en ingrediente de una elaboración con cocción completa (≥75°C en el producto final), NO cuando simplemente se recalienta.</li>
                        <li>Los Bloques C3, C4 y C5 no admiten ninguna excepción de TT: el riesgo acumulado por exposición en autoservicio caliente o la alta carga microbiana superficial de frutas/ensaladas/lácteos no se mitiga con regeneración.</li>
                        <li>La Ley 1/2025 Art. 5 exige aplicar la jerarquía de prioridades DENTRO del marco de seguridad alimentaria vigente: reutilización para consumo humano solo cuando la inocuidad está bajo control del operador (Art. 17 Reg. 178/2002).</li>
                        <li><span className="font-bold">'Uso único' (Bloque A):</span> los excedentes no expuestos reutilizados con TT no pueden someterse a un segundo ciclo; si sobran, gestionar por jerarquía Art. 5.</li>
                    </ol>
                </div>
            </div>
        </section>

      </div>
    </div>
  );
};