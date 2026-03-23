
import { GoogleGenAI } from "@google/genai";
import { HotelData, Area, Objective, TeamMember } from '../types';

const SYSTEM_INSTRUCTION = `
1. Perfil y Rol del Modelo
Actúa como un Consultor Senior Experto en Estrategia de Sostenibilidad Alimentaria y Auditor de Calidad. Tu objetivo es transformar datos brutos de inventario, procesos y mermas en un Plan de Reducción de Desperdicio Alimentario (PPDA) que cumpla con los estándares de la Ley de Prevención de las Pérdidas y el Desperdicio Alimentario.

2. Conocimiento Específico Obligatorio
Jerarquía de Prioridades: Prioriza acciones: 1. Consumo humano, 2. Transformación, 3. Alimentación animal, 4. Compostaje.
Normativa: Aplica criterios APPCC.
Calculo de Indicadores: Usa métricas de ratio de desperdicio.

3. Control de Estilo y Formato
Tono: Profesional, ejecutivo, analítico.
Salida: JSON Estructurado.
`;

export const getAiRecommendation = async (
  hotel: HotelData,
  areas: Area[],
  currentObjectives: Objective[]
): Promise<{ recommendedIds: string[], generalAdvice: string, specificActions: Record<string, string> }> => {

  try {
    // Correct initialization with named parameter apiKey
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Construct prompt context
    const context = `
      Analiza el siguiente hotel para recomendar objetivos del Plan de Desperdicio Alimentario:
      
      Hotel: ${hotel.nombreComercial} (${hotel.categoria})
      Habitaciones: ${hotel.numHabitaciones}, Capacidad: ${hotel.capacidadMax} pax.
      Áreas de Restauración: ${areas.map(a => `${a.nombre} (${a.esBuffet ? 'Buffet' : 'Carta'})`).join(', ')}.
      
      Lista de Objetivos Disponibles (IDs): ${currentObjectives.map(o => `${o.id}: ${o.descripcion}`).join('; ')}.
      
      Devuelve un JSON con:
      1. "recommendedIds": Array de strings con los IDs de los objetivos más críticos para este perfil de hotel.
      2. "generalAdvice": Un párrafo de análisis ejecutivo sobre dónde enfocar los esfuerzos.
      3. "specificActions": Un objeto donde la clave es el ID del objetivo y el valor es una "Observación Técnica" concreta y accionable para poner en el plan.
    `;

    // Fix: Using 'gemini-3-flash-preview' for text-based analysis tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: context,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json'
      }
    });

    // Fix: Access response.text directly (not a method call)
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Error calling Gemini:", error);
    // Fallback if AI fails or no key
    return {
      recommendedIds: ['1', '5', '10'], // Generic default
      generalAdvice: "No se pudo conectar con el consultor AI. Se han seleccionado objetivos estándar.",
      specificActions: {}
    };
  }
};
