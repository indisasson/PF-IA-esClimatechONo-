import { tool, agent } from "llamaindex";
import { Ollama } from "@llamaindex/ollama";
import { z } from "zod";
import { empezarChat } from './cli-chat.js'
import {Bdd} from '../../data/Bdd.js'
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
  const bdd = new Bdd();
  const Newsletters = await bdd.getNewsletters();

// ver si así esta bien lalamada la función

    const prompt = `
      Tengo un resumen de una noticia sobre Climatech:
      "${resumenNoticia}"

      Y una lista de newsletters con su título y resumen:
      ${Newsletters.map(n => `- Título: "${n.titulo}", Resumen: ${n.resumen}`).join('\n')}

      Compará el resumen de la noticia con los resúmenes de los newsletters.
      Si alguno trata una temática similar, respondé solo con una lista de los **títulos exactos** de los newsletters relacionados, uno por línea.
      No agregues explicaciones, solo los títulos.
    `;

      const respuesta = await ollamaLLM.complete({
        prompt,
        temperature: 0,
      });

      const relacionados = [];

      const lineas = respuesta.split('\n').map(linea => linea.trim()).filter(Boolean);

      lineas.forEach(tituloRespuesta => {
        const newsletter = Newsletters.find(n => n.titulo.toLowerCase() === tituloRespuesta.toLowerCase());
        if (newsletter) {
          relacionados.push({
            id: newsletter.id,
            link: newsletter.link,
            titulo: newsletter.titulo,
            resumen: newsletter.resumen,
          });
        }
      });

  return relacionados;
}


const extraerTextoDeNoticiaTool = tool({
  name: "extraerTextoDeNoticia",
  description: "Extrae el contenido principal de una noticia desde un link, incluyendo el título y el texto (máximo 3000 caracteres).",
  parameters: z.object({
    url: z.string().describe("El link de la noticia"),
  }),
  execute: async ({ url }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error al descargar la página: ${res.statusText}`);

      const html = await res.text();
      const $ = cheerio.load(html);

      // Título de la noticia
      const titulo = $('title').text().trim() || 'Sin título';

      // Extraer párrafos significativos
      const parrafos = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(texto => texto.length > 30); // Filtrar basura

      if (parrafos.length === 0) throw new Error('No se pudo extraer texto útil');

      const texto = parrafos.join('\n').slice(0, 3000);

      return {
        titulo,
        texto,
        url,
      };
    } catch (e) {
      console.error('Error en extraerTextoDeNoticiaTool:', e.message);

      // Fallback en caso de error: devolver título simple y link
      return {
        titulo: 'No se pudo extraer el título',
        texto: 'No se pudo extraer el contenido de la noticia.',
        url,
      };
    }
  },
});




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
    evaluacion.trim().toLowerCase().startsWith("sí");
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

