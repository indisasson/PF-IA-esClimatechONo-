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
- Respondé solo con "Sí" o "No". Si la respuesta es "Sí" genera un breve resmen de la noticia. Si la respuesta es "No" decí cual es el tema principal de la noticia.
- Si es Climatech, comparo los resumenes de la base de dsatos sobre los newsletetr almacenados. Si las tematicas coinciden con la noticia ingresada, devolves los titulos de los newsletter de la base de datos que se relacionan con la noticia relacionada
`.trim();


const ollamaLLM = new Ollama({
  model: "qwen3:1.7b",
  temperature: 0.75,
    timeout: 2 * 60 * 1000, // Timeout de 2 minutos
});




// TODO: Implementar la Tool para buscar por nombre
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';


async function buscarNewslettersRelacionados(resumenNoticia) {
  // 1. Traer los newsletters de la base de datos
  const { data: Newsletter, error } = await supabase
    .from('Newsletter')
    .select('id, titulo, resumen')
    .limit(20);


  if (error) {
    console.error('Error al traer Newsletter:', error);
    return [];
  }
  if (!Newsletter || Newsletter.length === 0) return [];


// 2. Crear el prompt para el LLM
const prompt = `
Tengo un resumen de noticia sobre Climatech y una lista de newsletters con sus resúmenes.
Dime SOLO los números de los newsletters que están relacionados con esta noticia (temas similares).
NO inventes títulos ni temas, solo responde con los números separados por coma.

Resumen noticia:
"${resumenNoticia}"

Lista de newsletters:
${Newsletter.map((nl, i) => `${i+1}. ${nl.titulo}: ${nl.resumen}`).join('\n')}

IMPORTANTE: Devuélveme SOLO los números de los newsletters relacionados, separados por coma. Ejemplo: 1, 3, 5
`;

// 3. Consultar al LLM
const respuesta = await ollamaLLM.complete({
  prompt,
  temperature: 0,
});

// 4. Parsear SOLO los números de la respuesta
const relacionados = [];
const numeros = respuesta.match(/\d+/g);
if (numeros) {
  numeros.forEach(num => {
    const idx = parseInt(num, 10) - 1;
    if (Newsletter[idx]) relacionados.push(Newsletter[idx]);
  });
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
    try {
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      const texto = $('p').map((_, el) => $(el).text()).get().join('\n');
      if (!texto.trim()) throw new Error('No se pudo extraer texto');
      return texto.slice(0, 3000);
    } catch (e) {
      // Si falla, devolver el título del link como fallback
      const titulo = url.split('/').pop().replace(/[-_]/g, ' ');
      return titulo;
    }
  },
});


// ...existing code...
const evaluarNoticiaTool = tool({
  name: "evaluarNoticiaClimatech",
  description: "Evalúa si el texto de una noticia está relacionado con Climatech y busca newsletters relacionados",
  parameters: z.object({
    texto: z.string().describe("El contenido textual de la noticia"),
    url: z.string().optional().describe("URL de la noticia para buscar newsletters"),
  }),
  execute: async ({ texto }) => {
    // 1. Evaluar si es Climatech
    const evaluacion = await ollamaLLM.complete({
      prompt: `${systemPrompt}\n\nNoticia:\n${texto}\n\n¿Está relacionada con Climatech?`,
    });
    const esClimatech = eval
    
    
    
    
    
    
    uacion.trim().toLowerCase().startsWith("sí");


    if (esClimatech) {
      // 2. Generar resumen de la noticia
      const resumen = await ollamaLLM.complete({
        prompt: `Leé el siguiente texto de una noticia y escribí un resumen claro en no más de 5 líneas:\n\n${texto}`,
      });


      // 3. Buscar newsletters relacionados usando el resumen
      const newslettersRelacionados = await buscarNewslettersRelacionados(resumen);


      if (newslettersRelacionados.length > 0) {
        const titulos = newslettersRelacionados.map(nl => `- ${nl.titulo}`).join('\n');
        return `✅ Es una noticia sobre Climatech.\n\n📝 Resumen:\n${resumen}\n\n📧 Newsletters relacionados:\n${titulos}`;
      } else {
        return `✅ Es una noticia sobre Climatech.\n\n📝 Resumen:\n${resumen}\n\n⚠️ No hay ningún newsletter con su misma temática.`;
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

