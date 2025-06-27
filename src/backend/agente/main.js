import { tool, agent } from "llamaindex";
import { Ollama } from "@llamaindex/ollama";
import { z } from "zod";
import { empezarChat } from './cli-chat.js'
//import { Estudiantes } from "./lib/estudiantes.js";

// Configuración
const DEBUG = true;

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

Respondé solo con "Sí" o "No", sin dar una explicacion
`.trim();

const ollamaLLM = new Ollama({
    model: "qwen:7b",
    temperature: 0.75,
    timeout: 2 * 60 * 1000, // Timeout de 2 minutos
});


// TODO: Implementar la Tool para buscar por nombre
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';


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
    description: "Evalúa si el texto de una noticia está relacionado con Climatech",
    parameters: z.object({
      texto: z.string().describe("El contenido textual de la noticia"),
    }),
    execute: async ({ texto }) => {
      const respuesta = await ollamaLLM.complete({
        prompt: `${systemPrompt}\n\nNoticia:\n${texto}\n\n¿Está relacionada con Climatech?`,
      });
      return respuesta;
    },
  });
  


// Configuración del agente
const elAgente = agent({
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
empezarChat(elAgente, mensajeBienvenida);