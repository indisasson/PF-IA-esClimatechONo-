import {supabase} from '../../../data/supabaseClient.js'
import { tool, agent } from "llamaindex";
import { Ollama } from "@llamaindex/ollama";
import { z } from "zod";
import { empezarChat } from './cli-chat.js'
//revisar la conexion con base de datos y porque no aparece la respuesta de que si hay algun newsletter relacionado  

// Configuración
const DEBUG = false;

// Instancia de la clase Estudiantes
//const estudiantes = new Estudiantes();
//estudiantes.cargarEstudiantesDesdeJson();

// System prompt básico
const systemPrompt = `
Sos un asistente que analiza noticias para detectar si están relacionadas con Climatech.
Climatech incluye tecnologías que ayudan a combatir el cambio climático, como energías renovables, eficiencia energética, captura de carbono, movilidad sostenible, etc.

Tu tarea es:
- Leer la noticia que se encuentra en el texto o el link proporcionado.
- Determinar si el contenido tiene relación con Climatech.

Respondé solo con "Sí" o "No". Si la respuesta es "Sí" genera un breve resmen de la noticia. Si la respuesta es "No" decí cual es el tema principal de la noticia.
Si la noticia es climatech y hay resumenes de newsletter que coinciden en tematica, listá los titulos de los newsletter relacionados (que se almacenan en la base de datos). 
`.trim();

const ollamaLLM = new Ollama({
  model: "qwen3:1.7b",
  temperature: 0.75,
    timeout: 2 * 60 * 1000, // Timeout de 2 minutos
});


// TODO: Implementar la Tool para buscar por nombre
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Función para buscar newsletters relacionados en Supabase
async function buscarNewslettersRelacionados(resumenNoticia) {
  // Paso 1: traer los newsletters y sus resúmenes de la DB
  const { data: newsletters, error } = await supabase
    .from('newsletters')
    .select('id, titulo, resumen')  // asumimos que hay campo resumen
    .limit(20);

  if (error) {
    console.error('Error al traer newsletters:', error);
    return [];
  }

  if (!newsletters || newsletters.length === 0) return [];

  // Paso 2: crear un prompt para que LLM compare el resumen de la noticia con cada resumen de newsletter
  // Acá mandamos todo junto para que el LLM decida qué newsletters están relacionados

  const prompt = `
Tengo un resumen de noticia sobre Climatech y una lista de newsletters con sus resúmenes.
Dime cuáles newsletters están relacionados con esta noticia (temas similares).

Resumen noticia:
"""${resumenNoticia}"""

Lista de newsletters:
${newsletters.map((nl, i) => `${i+1}. ${nl.titulo}: ${nl.resumen}`).join('\n')}

Devuelveme solo los números y títulos de los newsletters relacionados.
`;

  const respuesta = await ollamaLLM.complete({
    prompt,
    temperature: 0,
  });

  // Ejemplo: respuesta = "1. Newsletter A\n3. Newsletter C"
  // Parsear respuesta para obtener newsletters relacionados

  const relacionados = [];
  const lineas = respuesta.split('\n').map(l => l.trim()).filter(Boolean);
  for (const linea of lineas) {
    // Extraer índice o título
    const match = linea.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
      const idx = parseInt(match[1], 10) -1;
      if (newsletters[idx]) {
        relacionados.push(newsletters[idx]);
      }
    } else {
      // Si no es formato esperado, intentar buscar por título en la lista
      const found = newsletters.find(nl => linea.includes(nl.titulo));
      if (found) relacionados.push(found);
    }
  }

  return relacionados;
}



const extraerTextoDeNoticiaTool = tool({
  name: "extraerTextoDeNoticia",
  description: "Descarga y extrae el contenido principal de una noticia desde un link",
  parameters: z.object({
    url: z.string().describe("El link de la noticia"),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extracta todos los párrafos del artículo (puede afinarse más)
    const texto = $('p').map((_, el) => $(el).text()).get().join('\n');
    return texto.slice(0, 3000); // Límite razonable para entrada del LLM
  },
});

const evaluarNoticiaTool = tool({
  name: "evaluarNoticiaClimatech",
  description: "Evalúa si el texto de una noticia está relacionado con Climatech y busca newsletters relacionados",
  parameters: z.object({
    texto: z.string().describe("El contenido textual de la noticia"),
    url: z.string().optional().describe("URL de la noticia para buscar newsletters"),
  }),
  execute: async ({ texto, url }) => {
    // Evaluar si es Climatech
    const evaluacion = await ollamaLLM.complete({
      prompt: `${systemPrompt}\n\nNoticia:\n${texto}\n\n¿Está relacionada con Climatech?`,
    });
    const esClimatech = evaluacion.toLowerCase().includes("sí");

    if (esClimatech) {
      // Buscar newsletters relacionados solo si tenemos url
      let newslettersRelacionados = [];
      if (url) {
        newslettersRelacionados = await buscarNewslettersRelacionados(url);

        const resumen = await ollamaLLM.complete({
          prompt: `Leé el siguiente texto de una noticia y escribí un resumen claro en no más de 5 líneas:\n\n${texto}`,
        });
  
        if (newslettersRelacionados.length > 0) {
          const titulos = newslettersRelacionados.map(nl => `- ${nl.titulo}`).join('\n');
          return `✅ Es una noticia sobre Climatech.\n\n📝 Resumen:\n${resumen}\n\n📧 Newsletters relacionados:\n${titulos}`;
        } else {
          return `✅ Es una noticia sobre Climatech.\n\n📝 Resumen:\n${resumen}\n\n⚠️ No se encontraron newsletters relacionados en la base de datos.`;
        }
      }

      

    } else {
      // No es Climatech, no buscar newsletters
      return `❌ No es una noticia sobre Climatech. Tema principal: ${await ollamaLLM.complete({
        prompt: `Leé el siguiente texto de una noticia y decí cual es su tema principal:\n\n${texto}`
      })}`;
    }
  },
});

      
 

// Configuración del agente
const elagente = agent({
    tools: [extraerTextoDeNoticiaTool, evaluarNoticiaTool],
    llm: ollamaLLM,
    verbose: DEBUG,
    systemPrompt: systemPrompt,
});

// Mensaje de bienvenida
const mensajeBienvenida = `
🌱 Soy un asistente que analiza noticias.
Pegá el link de una noticia y te digo si trata sobre Climatech o no.
Escribí 'exit' para salir.
`;

// Iniciar el chat
empezarChat(elagente, mensajeBienvenida);