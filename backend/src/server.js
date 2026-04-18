import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import multer from "multer";
import FormData from "form-data";

import Lead from "./models/Lead.js";
import Tenant from "./models/Tenant.js";

dotenv.config();

console.log("MONGODB_URI existe:", !!process.env.MONGODB_URI);
console.log("OPENROUTER_API_KEY existe:", !!process.env.OPENROUTER_API_KEY);
console.log("OPENAI_API_KEY existe:", !!process.env.OPENAI_API_KEY);
console.log("ELEVENLABS_API_KEY existe:", !!process.env.ELEVENLABS_API_KEY);

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("Mongo conectado"))
  .catch((err) => console.error("Error conectando Mongo:", err));

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",

  "https://hoy-mismo-assitant.vercel.app",
  "https://hoymismo-assitant.vercel.app",
  "https://tecnologias-hoy-mismo.vercel.app",

  "https://www.tecnologíahoymismo.com",
  "https://tecnologíahoymismo.com",

  "https://www.xn--tecnologahoymismo-kvb.com",
  "https://xn--tecnologahoymismo-kvb.com",

  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.toLowerCase();

      const isAllowed = allowedOrigins.some(
        (allowed) => allowed && normalizedOrigin === allowed.toLowerCase()
      );

      if (isAllowed) {
        return callback(null, true);
      }

      console.error("❌ CORS bloqueado:", origin);
      return callback(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-admin-password",
      "x-tenant-id",
      "x-client-type",
    ],
    credentials: false,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * =========================================
 * UTILIDADES
 * =========================================
 */

function normalizeText(text = "") {
  return text.trim().toLowerCase();
}

function countWords(text = "") {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildSpokenVersion(fullReply = "") {
  const clean = fullReply.replace(/\s+/g, " ").trim();

  if (!clean) return "";

  const words = clean.split(" ");

  if (words.length <= 40) {
    return clean;
  }

  const shortPreview = words.slice(0, 30).join(" ");
  return `${shortPreview}. Te dejé el resto en pantalla para que lo leas con calma.`;
}

function extractPhone(text) {
  const match = text.match(/(?:\+?\d[\d\s\-()]{7,}\d)/);
  if (!match) return null;

  const phone = match[0].replace(/[^\d+]/g, "");
  return phone.length >= 8 ? phone : null;
}

function extractName(text) {
  const patterns = [
    /me llamo\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /soy\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /mi nombre es\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /nombre[:\s]+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1]
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return null;
}

function detectInterest(text) {
  const lower = text.toLowerCase();

  return [
    "cotización",
    "cotizacion",
    "precio",
    "coste",
    "costo",
    "me interesa",
    "información",
    "informacion",
    "quiero una página",
    "quiero una pagina",
    "quiero una web",
    "quiero contratar",
    "contratar",
    "servicio",
    "página web",
    "pagina web",
    "chatbot",
    "automatización",
    "automatizacion",
    "asistente virtual",
    "asistente",
    "ia",
    "demo",
    "agendar",
    "llamada",
    "api",
    "integración",
    "integracion",
    "tienda en línea",
    "tienda online",
    "landing page",
    "sitio web",
    "planes",
    "plan",
    "paquete",
    "comprar",
  ].some((term) => lower.includes(term));
}

function wantsDemo(text) {
  const lower = text.toLowerCase();
  return [
    "demo",
    "agendar",
    "agenda",
    "llamada",
    "reunión",
    "reunion",
    "quiero hablar",
    "quiero una llamada",
    "quiero agendar",
    "quiero una demo",
  ].some((term) => lower.includes(term));
}

function detectOffTopicMessage(message = "") {
  const text = normalizeText(message);

  if (!text) return false;

  const businessKeywords = [
    "hoy mismo",
    "tecnología hoy mismo",
    "tecnologia hoy mismo",
    "precio",
    "cotizacion",
    "cotización",
    "costo",
    "coste",
    "plan",
    "planes",
    "paquete",
    "demo",
    "agendar",
    "llamada",
    "servicio",
    "servicios",
    "contratar",
    "comprar",
    "asistente",
    "ia",
    "chatbot",
    "automatizacion",
    "automatización",
    "soporte",
    "problema",
    "error",
    "falla",
    "fallo",
    "integrar",
    "integración",
    "api",
    "widget",
    "pagina",
    "página",
    "web",
    "landing",
    "tienda online",
    "clientes",
    "ventas",
    "negocio",
    "empresa",
    "whatsapp",
    "contacto",
    "informacion",
    "información",
    "ayuda",
    "instalar",
    "configurar",
    "funciona",
    "como funciona",
    "cómo funciona",
    "para qué sirve",
    "para que sirve",
    "qué hace",
    "que hace",
    "qué es",
    "que es",
  ];

  const obviousOffTopic = [
    "cuentame un chiste",
    "cuéntame un chiste",
    "chiste",
    "quien gano",
    "quién ganó",
    "futbol",
    "fútbol",
    "nba",
    "pelicula",
    "película",
    "serie",
    "anime",
    "videojuego",
    "videojuegos",
    "horoscopo",
    "horóscopo",
    "signo zodiacal",
    "receta",
    "cocina",
    "tarea",
    "matematicas",
    "matemáticas",
    "historia universal",
    "traduce esto",
    "poema",
    "cancion",
    "canción",
    "novia",
    "novio",
    "amor",
    "religion",
    "religión",
    "politica",
    "política",
    "capital de",
    "presidente de",
    "quien descubrio",
    "quién descubrió",
    "cuanto es",
    "cuánto es",
    "bandera de",
    "moneda de",
  ];

  if (obviousOffTopic.some((term) => text.includes(term))) {
    return true;
  }

  const hasBusinessIntent = businessKeywords.some((term) =>
    text.includes(term)
  );

  const veryShortAllowed = [
    "hola",
    "holi",
    "buenas",
    "buenos dias",
    "buenos días",
    "info",
    "informacion",
    "información",
    "precio",
    "costos",
    "coste",
    "costo",
    "demo",
    "ayuda",
  ];

  if (veryShortAllowed.includes(text)) {
    return false;
  }

  if (!hasBusinessIntent && countWords(text) >= 5) {
    return true;
  }

  return false;
}

function getOriginForProvider(req) {
  return (
    req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173"
  );
}

function detectClientType(req) {
  const explicit =
    req.body?.clientType ||
    req.headers["x-client-type"] ||
    req.query?.clientType;

  if (explicit === "mobile" || explicit === "desktop") {
    return explicit;
  }

  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);

  return isMobile ? "mobile" : "desktop";
}

function shouldSpeakReply(reply = "", channel = "chat", handoffMessage = "") {
  if (channel !== "voice") return false;

  const text = normalizeText(reply);
  const words = countWords(reply);

  if (handoffMessage) return true;

  const hardNoPhrases = [
    "te dejo la información",
    "te comparto la información",
    "aquí tienes la información",
    "lee la información",
    "revísala abajo",
    "revisa el detalle",
  ];

  if (hardNoPhrases.some((p) => text.includes(p))) return false;

  const hasPriorityIntent = [
    "hola",
    "claro",
    "perfecto",
    "con gusto",
    "te explico",
    "te ayudo",
    "podemos agendar",
    "te paso",
    "demo",
    "cotización",
    "cotizacion",
    "precio",
    "whatsapp",
  ].some((p) => text.includes(p));

  if (words <= 34) return true;
  if (words <= 55 && hasPriorityIntent) return true;

  return false;
}

function buildSpeechPayload({ reply, handoffMessage = "" }) {
  if (handoffMessage) {
    return `${handoffMessage} ${buildSpokenVersion(reply)}`.trim();
  }

  return buildSpokenVersion(reply);
}

function buildOffTopicReply() {
  return "Prefiero enfocarme en Tecnología Hoy Mismo. Puedo ayudarte con páginas web, IA, chatbots, APIs, automatización, precios o demos.";
}

/**
 * =========================================
 * MEMORIA CONVERSACIONAL
 * =========================================
 */

const conversationMemory = new Map();
const MAX_HISTORY_MESSAGES = 12;

function getConversationHistory(conversationId) {
  return conversationMemory.get(conversationId) || [];
}

function appendConversationMessage(conversationId, role, content) {
  const current = conversationMemory.get(conversationId) || [];
  const next = [...current, { role, content }].slice(-MAX_HISTORY_MESSAGES);
  conversationMemory.set(conversationId, next);
}

function clearConversationHistory(conversationId) {
  conversationMemory.delete(conversationId);
}

function getStoredAgent(conversationId) {
  const history = getConversationHistory(conversationId);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "system_agent_meta") {
      return history[i].content || "general";
    }
  }
  return "general";
}

function setStoredAgent(conversationId, agentId) {
  const current = conversationMemory.get(conversationId) || [];
  const filtered = current.filter((m) => m.role !== "system_agent_meta");
  const next = [...filtered, { role: "system_agent_meta", content: agentId }].slice(
    -MAX_HISTORY_MESSAGES
  );

  conversationMemory.set(conversationId, next);
}

/**
 * =========================================
 * TENANT
 * =========================================
 */

async function requireTenant(req, res, next) {
  try {
    const tenantId =
      req.headers["x-tenant-id"] ||
      req.body?.tenantId ||
      req.query?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Falta tenantId" });
    }

    const tenant = await Tenant.findOne({ apiKey: tenantId });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant no encontrado" });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error("Error en requireTenant:", error.message);
    return res.status(500).json({ error: "Error validando tenant" });
  }
}

/**
 * =========================================
 * AGENTES HOYMISMO
 * =========================================
 */

const AGENT_CONFIG = {
  general: {
    id: "general",
    name: "Recepción",
    color: "#facc15",
    voiceId: process.env.ELEVENLABS_VOICE_GENERAL,
    handoff: "Te comunico con recepción.",
    prompt: `
Eres el asistente general de Tecnología Hoy Mismo.
Tu función es recibir, orientar y ayudar con dudas generales sobre los servicios.
No te salgas a conversaciones irrelevantes.
Si el usuario se desvía del negocio, corrígelo breve y vuelve al enfoque.
`,
  },
  sales: {
    id: "sales",
    name: "Ventas",
    color: "#22c55e",
    voiceId: process.env.ELEVENLABS_VOICE_SALES,
    handoff: "Te comunico con el agente de ventas.",
    prompt: `
Eres el agente comercial de Tecnología Hoy Mismo.
Tu función es ventas consultivas.
Debes explicar valor, resolver dudas comerciales y llevar hacia cotización, demo o contacto.
No te desvíes a temas ajenos al negocio.
`,
  },
  support: {
    id: "support",
    name: "Información",
    color: "#3b82f6",
    voiceId: process.env.ELEVENLABS_VOICE_SUPPORT,
    handoff: "Te comunico con el agente de información.",
    prompt: `
Eres el agente de información y soporte de Tecnología Hoy Mismo.
Explicas qué es la empresa, qué hace, para qué sirve cada servicio y cómo funciona.
Debes responder claro, útil y sin tecnicismos innecesarios.
No te apartes del negocio.
`,
  },
  scheduling: {
    id: "scheduling",
    name: "Agenda",
    color: "#a855f7",
    voiceId: process.env.ELEVENLABS_VOICE_SCHEDULING,
    handoff: "Te comunico con el agente de agenda.",
    prompt: `
Eres el agente de agenda de Tecnología Hoy Mismo.
Tu función es ayudar a agendar llamadas, demos y dar el siguiente paso.
Sé breve, clara y organizada.
`,
  },
  onboarding: {
    id: "onboarding",
    name: "Implementación",
    color: "#f97316",
    voiceId: process.env.ELEVENLABS_VOICE_ONBOARDING,
    handoff: "Te comunico con el agente de implementación.",
    prompt: `
Eres el agente de implementación de Tecnología Hoy Mismo.
Tu función es orientar sobre instalación, integración, widgets, APIs y configuración.
Explica pasos sin abrumar.
`,
  },
  retention: {
    id: "retention",
    name: "Seguimiento",
    color: "#ef4444",
    voiceId: process.env.ELEVENLABS_VOICE_RETENTION,
    handoff: "Te comunico con el agente de seguimiento.",
    prompt: `
Eres el agente de seguimiento de Tecnología Hoy Mismo.
Atiendes clientes actuales, continuidad, renovación o dudas de seguimiento.
Mantén foco total en el negocio.
`,
  },
};

function getAgentConfig(agentId = "general") {
  return AGENT_CONFIG[agentId] || AGENT_CONFIG.general;
}

function getVoiceIdForAgent(agentId = "general") {
  return (
    getAgentConfig(agentId)?.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_GENERAL
  );
}

function buildBaseContext(tenant) {
  const tone = tenant?.config?.tone || "mixto";

  return `
Empresa: Tecnología Hoy Mismo

Qué es:
Tecnología Hoy Mismo es una empresa enfocada en desarrollo tecnológico para negocios. Ayuda a empresas a mejorar su presencia digital, automatizar procesos y atender clientes con herramientas modernas.

Qué hacemos:
- Desarrollo de páginas web profesionales
- Landing pages para campañas y captación de clientes
- Sitios corporativos para negocios y empresas
- Tiendas online o catálogos digitales
- Asistentes con inteligencia artificial para chat o voz
- Chatbots para atención automática
- Automatización de respuestas, seguimiento y captación de leads
- Integraciones y desarrollo de APIs
- Soluciones personalizadas según las necesidades del cliente

Cómo funciona:
- Primero se identifica qué necesita el negocio
- Después se propone una solución adecuada
- Se desarrolla la herramienta o sistema
- Se implementa para que ayude a vender, atender o automatizar
- Si aplica, se integra con WhatsApp, formularios, CRM, APIs u otros procesos internos

Sobre las páginas web:
Las páginas web ayudan a que un negocio tenga presencia profesional, genere confianza, muestre servicios y reciba clientes potenciales.

Sobre los asistentes con IA:
Los asistentes con IA pueden responder preguntas, calificar clientes, atender dudas frecuentes, apoyar ventas y estar disponibles 24/7.

Sobre los chatbots:
Los chatbots ayudan a responder de forma automática, guiar al usuario y reducir tiempos de atención.

Sobre APIs e integraciones:
Las APIs permiten conectar sistemas, automatizar tareas y hacer que distintas herramientas trabajen juntas.

Sobre este asistente:
Este asistente es una demostración real del tipo de soluciones que desarrolla Tecnología Hoy Mismo. Puede orientar, responder dudas, explicar servicios y detectar interés comercial.

Tono: ${tone}

Reglas globales:
- nunca digas que eres una IA
- responde claro, humano y profesional
- evita lenguaje técnico innecesario
- ayuda primero y vende cuando sea natural
- mantente enfocada en el negocio
- evita responder sobre cultura general o temas irrelevantes
- si el usuario se desvía, corrige breve y vuelve al enfoque
- en voz responde más breve
`;
}

function buildAgentPrompt(agentId, tenant) {
  const agent = getAgentConfig(agentId);
  const base = buildBaseContext(tenant);

  return `
${base}

AGENTE ACTUAL:
- id: ${agent.id}
- nombre: ${agent.name}

INSTRUCCIONES DEL AGENTE:
${agent.prompt}

INSTRUCCIONES OPERATIVAS:
- mantén coherencia con tu rol
- responde como parte real del equipo
- si el mensaje trata sobre un tema ajeno al negocio, no lo desarrolles
- si el usuario pregunta qué hace la empresa, responde completo
- si pregunta cómo funciona, explícalo por pasos
- si pregunta para qué sirve, explica beneficios reales para un negocio
- si detectas interés comercial, avanza a cotización, demo o contacto
- evita respuestas innecesariamente largas
`;
}

/**
 * =========================================
 * ROUTING
 * =========================================
 */

function detectIntentBucket(message = "") {
  const text = normalizeText(message);

  if (
    [
      "precio",
      "cotizacion",
      "cotización",
      "comprar",
      "contratar",
      "servicio",
      "planes",
      "plan",
      "paquete",
      "costo",
      "coste",
      "demo",
      "agendar",
      "ventas",
      "llamada",
      "me interesa",
      "cotizar",
    ].some((term) => text.includes(term))
  ) {
    return "sales";
  }

  if (
    [
      "soporte",
      "problema",
      "error",
      "falla",
      "fallo",
      "no funciona",
      "cómo funciona",
      "como funciona",
      "ayuda",
      "duda",
      "pregunta",
      "explícame",
      "explicame",
      "configurar",
      "integrar",
      "instalar",
      "api",
      "widget",
      "conectar",
      "qué es",
      "que es",
      "qué hace",
      "que hace",
      "para qué sirve",
      "para que sirve",
      "información",
      "informacion",
    ].some((term) => text.includes(term))
  ) {
    return "support";
  }

  if (
    [
      "agenda",
      "agendar",
      "llamada",
      "reunión",
      "reunion",
      "demo",
      "cita",
      "horario",
      "disponibilidad",
    ].some((term) => text.includes(term))
  ) {
    return "scheduling";
  }

  if (
    [
      "integración",
      "integracion",
      "instalar",
      "configurar",
      "implementar",
      "crm",
      "widget",
      "api",
      "embed",
      "conectar",
    ].some((term) => text.includes(term))
  ) {
    return "onboarding";
  }

  if (
    [
      "seguimiento",
      "renovar",
      "renovación",
      "renovacion",
      "continuar",
      "cancelar",
      "cancelación",
      "cancelacion",
      "ya soy cliente",
    ].some((term) => text.includes(term))
  ) {
    return "retention";
  }

  return "general";
}

function pickAgentForIntent(intent, currentAgentId) {
  if (intent === "sales") {
    return currentAgentId === "sales" ? currentAgentId : "sales";
  }

  if (intent === "support") {
    return currentAgentId === "support" ? currentAgentId : "support";
  }

  if (intent === "scheduling") {
    return currentAgentId === "scheduling" ? currentAgentId : "scheduling";
  }

  if (intent === "onboarding") {
    return currentAgentId === "onboarding" ? currentAgentId : "onboarding";
  }

  if (intent === "retention") {
    return currentAgentId === "retention" ? currentAgentId : "retention";
  }

  return currentAgentId || "general";
}

function routeAgent({ message, currentAgentId = "general" }) {
  const intent = detectIntentBucket(message);
  const nextAgentId = pickAgentForIntent(intent, currentAgentId);

  return {
    intent,
    nextAgentId,
  };
}

function buildHandoffMessage(previousAgentId, nextAgentId) {
  if (!previousAgentId || previousAgentId === nextAgentId) {
    return "";
  }

  const nextAgent = getAgentConfig(nextAgentId);
  return nextAgent.handoff || "";
}

/**
 * =========================================
 * PROVIDERS
 * =========================================
 */

async function openRouterChatCompletion({
  model,
  messages,
  temperature = 0.55,
  origin,
}) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages,
      temperature,
      max_tokens: 140,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": origin,
        "X-Title": "HoyMismo Assistant Backend",
      },
      timeout: 25000,
    }
  );

  return response?.data?.choices?.[0]?.message?.content?.trim() || "";
}

function extractOpenAIOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const texts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        texts.push(part.text.trim());
      }
    }
  }

  return texts.join("\n").trim();
}

async function openAIResponsesText({
  model,
  systemPrompt,
  history,
  userMessage,
}) {
  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: systemPrompt }],
    },
    ...history.map((m) => {
      if (m.role === "assistant") {
        return {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Respuesta previa del asistente:\n${m.content}`,
            },
          ],
        };
      }

      return {
        role: "user",
        content: [{ type: "input_text", text: m.content }],
      };
    }),
    {
      role: "user",
      content: [{ type: "input_text", text: userMessage }],
    },
  ];

  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model,
      input,
      max_output_tokens: 140,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 25000,
    }
  );

  const text = extractOpenAIOutputText(response.data);
  return text || "";
}

async function transcribeAudioWithOpenAI(file) {
  const formData = new FormData();

  formData.append("file", file.buffer, {
    filename: file.originalname || "audio.webm",
    contentType: file.mimetype || "audio/webm",
  });

  formData.append(
    "model",
    process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe"
  );
  formData.append(
    "prompt",
    `Transcribe con precisión en español de México.
Espera términos como Tecnología Hoy Mismo, páginas web, landing page, tienda online, chatbot, IA, automatización, APIs, integración, WhatsApp, cotización y demo.
No recortes preguntas largas y conserva nombres propios.`
  );

  const response = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    formData,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 45000,
    }
  );

  return response?.data?.text?.trim() || "";
}

async function synthesizeWithElevenLabs(text, agentId = "general") {
  const voiceId = getVoiceIdForAgent(agentId);
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!voiceId || !apiKey) {
    throw new Error("Falta configurar ElevenLabs");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(
    url,
    {
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
        speed: 1.0,
      },
    },
    {
      responseType: "arraybuffer",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      timeout: 30000,
    }
  );

  return response.data;
}

async function generateAIReply({
  tenant,
  agentId,
  message,
  conversationId,
  channel = "chat",
  req,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Falta configurar OPENAI_API_KEY");
  }

  const systemPrompt = `${buildAgentPrompt(agentId, tenant)}

Canal actual: ${channel}

Instrucciones del canal:
- en voice responde breve pero útil
- si falta contexto, pide solo lo importante
- si el mensaje es claro, avanza sin rodeos
- mantén linealidad con el negocio
`;

  const history = getConversationHistory(conversationId).filter(
    (m) => m.role !== "system_agent_meta"
  );

  const normalizedHistory = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const clientType = detectClientType(req);
  const origin = getOriginForProvider(req);

  const openAIModel = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const openRouterModel =
    process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  if (clientType === "mobile") {
    const text = await openAIResponsesText({
      model: openAIModel,
      systemPrompt,
      history: normalizedHistory,
      userMessage: message,
    });

    return {
      reply: text || "Hubo un problema al generar la respuesta.",
      providerUsed: "openai-mobile",
    };
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY no configurada");
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...normalizedHistory,
      { role: "user", content: message },
    ];

    const text = await openRouterChatCompletion({
      model: openRouterModel,
      messages,
      temperature: 0.55,
      origin,
    });

    if (!text) {
      throw new Error("OpenRouter respondió vacío");
    }

    return {
      reply: text,
      providerUsed: "openrouter-desktop",
    };
  } catch (error) {
    console.error("Fallback a OpenAI:", error.response?.data || error.message);

    const text = await openAIResponsesText({
      model: openAIModel,
      systemPrompt,
      history: normalizedHistory,
      userMessage: message,
    });

    return {
      reply: text || "Hubo un problema al generar la respuesta.",
      providerUsed: "openai-fallback",
    };
  }
}

/**
 * =========================================
 * LEADS / ACCIONES
 * =========================================
 */

async function getExistingLead(tenant, conversationId) {
  return Lead.findOne({
    tenantId: tenant.apiKey,
    conversationId,
  });
}

async function triggerWebhookIfNeeded(tenant, payload) {
  const webhookUrl =
    tenant?.config?.webhookUrl || process.env.DEFAULT_WEBHOOK_URL;

  if (!webhookUrl) return { sent: false };

  try {
    await axios.post(webhookUrl, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return { sent: true };
  } catch (error) {
    console.error("Error enviando webhook:", error.message);
    return { sent: false, error: error.message };
  }
}

async function generateLeadSummary({ messages }) {
  try {
    if (!process.env.OPENAI_API_KEY) return "";

    const text = messages.slice(-4).join("\n");

    const systemPrompt = "Resume leads de forma muy breve en una sola línea.";
    const userPrompt = `Resume este lead en 1 línea. Incluye qué quiere el cliente y si pidió demo.\n\nConversación:\n${text}`;

    const summary = await openAIResponsesText({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      systemPrompt,
      history: [],
      userMessage: userPrompt,
    });

    return summary || "";
  } catch (err) {
    console.error("Error generando summary:", err.response?.data || err.message);
    return "";
  }
}

async function handleBusinessActions({
  tenant,
  conversationId,
  message,
  reply,
  selectedAgentId,
  name,
  phone,
  interested,
  requestedDemo,
}) {
  const existingLead = await getExistingLead(tenant, conversationId);

  const finalName = name || existingLead?.name || null;
  const finalPhone = phone || existingLead?.phone || null;
  const finalInterested =
    typeof interested === "boolean"
      ? interested || Boolean(existingLead?.interested)
      : Boolean(existingLead?.interested);

  const finalRequestedDemo =
    Boolean(requestedDemo) || Boolean(existingLead?.requestedDemo);

  const shouldSave =
    Boolean(finalName) ||
    Boolean(finalPhone) ||
    Boolean(finalInterested) ||
    Boolean(finalRequestedDemo);

  if (shouldSave) {
    const updatedMessages = [
      ...(existingLead?.messages || []),
      `USER: ${message}`,
      `BOT: ${reply}`,
    ];

    let summary = existingLead?.summary || "";

    const shouldRefreshSummary =
      finalRequestedDemo || (finalInterested && finalPhone);

    if (shouldRefreshSummary) {
      summary = await generateLeadSummary({
        messages: updatedMessages,
      });
    }

    await Lead.updateOne(
      { tenantId: tenant.apiKey, conversationId },
      {
        $setOnInsert: {
          tenantId: tenant.apiKey,
          conversationId,
          createdAt: new Date(),
        },
        $set: {
          name: finalName,
          phone: finalPhone,
          interested: finalInterested,
          requestedDemo: finalRequestedDemo,
          selectedAgent: selectedAgentId,
          summary,
          updatedAt: new Date(),
        },
        $push: {
          messages: {
            $each: [`USER: ${message}`, `BOT: ${reply}`],
          },
        },
      },
      { upsert: true }
    );
  }

  let webhookResult = { sent: false };

  if (finalRequestedDemo || (finalInterested && finalPhone)) {
    webhookResult = await triggerWebhookIfNeeded(tenant, {
      type: finalRequestedDemo ? "demo_request" : "qualified_lead",
      tenantId: tenant.apiKey,
      conversationId,
      selectedAgent: selectedAgentId,
      name: finalName,
      phone: finalPhone,
      message,
      reply,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    leadSaved: shouldSave,
    webhookSent: webhookResult.sent,
    mergedLead: {
      name: finalName,
      phone: finalPhone,
      interested: finalInterested,
      requestedDemo: finalRequestedDemo,
    },
  };
}

/**
 * =========================================
 * AUDIO
 * =========================================
 */

app.post(
  "/voice/transcribe",
  upload.single("audio"),
  requireTenant,
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res
          .status(500)
          .json({ error: "Falta configurar OPENAI_API_KEY" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No se envió audio" });
      }

      const transcript = await transcribeAudioWithOpenAI(req.file);

      if (!transcript) {
        return res
          .status(422)
          .json({ error: "No se pudo transcribir el audio" });
      }

      return res.json({ transcript });
    } catch (error) {
      console.error(
        "Error en /voice/transcribe:",
        error.response?.data || error.message
      );
      return res.status(500).json({ error: "Error transcribiendo audio" });
    }
  }
);

app.post("/voice/speak", requireTenant, async (req, res) => {
  try {
    const { text, agentId = "general" } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Texto vacío" });
    }

    const audioBuffer = await synthesizeWithElevenLabs(text, agentId);

    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(audioBuffer);
  } catch (error) {
    console.error(
      "Error en /voice/speak:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Error generando voz" });
  }
});

/**
 * =========================================
 * CHAT
 * =========================================
 */

app.post("/chat", requireTenant, async (req, res) => {
  try {
    const {
      message,
      conversationId,
      channel = "chat",
      agentId: requestedAgentId,
    } = req.body;

    const tenant = req.tenant;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    if (!conversationId) {
      return res.status(400).json({ error: "Falta conversationId" });
    }

    const previousAgentId =
      requestedAgentId && AGENT_CONFIG[requestedAgentId]
        ? requestedAgentId
        : getStoredAgent(conversationId);

    const isOffTopic = detectOffTopicMessage(message);

    if (isOffTopic) {
      const currentAgent = getAgentConfig(previousAgentId);
      const reply = buildOffTopicReply();
      const speak = shouldSpeakReply(reply, channel, "");

      appendConversationMessage(conversationId, "user", message);
      appendConversationMessage(conversationId, "assistant", reply);
      setStoredAgent(conversationId, previousAgentId);

      return res.json({
        reply,
        ttsEnabled: speak,
        ttsText: speak ? reply : "",
        switched: false,
        handoffMessage: "",
        previousAgentId,
        previousAgentName: currentAgent.name,
        agentId: previousAgentId,
        agentName: currentAgent.name,
        agentColor: currentAgent.color,
        voiceAgent: previousAgentId,
        detectedIntent: "offtopic",
        providerUsed: "offtopic-guard",
        clientType: detectClientType(req),
        actions: {
          leadSaved: false,
          webhookSent: false,
          mergedLead: {
            name: null,
            phone: null,
            interested: false,
            requestedDemo: false,
          },
        },
        memorySize: getConversationHistory(conversationId).length,
      });
    }

    const routing = routeAgent({
      message,
      currentAgentId: previousAgentId,
    });

    const selectedAgentId = routing.nextAgentId;
    const previousAgent = getAgentConfig(previousAgentId);
    const selectedAgent = getAgentConfig(selectedAgentId);

    const switched = previousAgentId !== selectedAgentId;
    const handoffMessage = switched
      ? buildHandoffMessage(previousAgentId, selectedAgentId)
      : "";

    const name = extractName(message);
    const phone = extractPhone(message);
    const interested = detectInterest(message);
    const requestedDemo = wantsDemo(message);

    const ai = await generateAIReply({
      tenant,
      agentId: selectedAgentId,
      message,
      conversationId,
      channel,
      req,
    });

    const rawReply = ai.reply || "Hubo un problema al generar la respuesta.";

    const reply = handoffMessage
      ? `${handoffMessage} ${rawReply}`.trim()
      : rawReply;

    appendConversationMessage(conversationId, "user", message);
    appendConversationMessage(conversationId, "assistant", reply);
    setStoredAgent(conversationId, selectedAgentId);

    const actions = await handleBusinessActions({
      tenant,
      conversationId,
      message,
      reply,
      selectedAgentId,
      name,
      phone,
      interested,
      requestedDemo,
    });

    const speak = shouldSpeakReply(rawReply, channel, handoffMessage);
    const spokenText = speak
      ? buildSpeechPayload({ reply: rawReply, handoffMessage })
      : "";

    return res.json({
      reply,
      ttsEnabled: speak,
      ttsText: spokenText,

      switched,
      handoffMessage,

      previousAgentId,
      previousAgentName: previousAgent.name,

      agentId: selectedAgentId,
      agentName: selectedAgent.name,
      agentColor: selectedAgent.color,
      voiceAgent: selectedAgentId,

      detectedIntent: routing.intent,
      providerUsed: ai.providerUsed,
      clientType: detectClientType(req),

      actions,
      memorySize: getConversationHistory(conversationId).length,
    });
  } catch (error) {
    console.error("Error en /chat:", error.response?.data || error.message);
    return res.status(500).json({ error: "Error en IA" });
  }
});

app.post("/chat/reset", requireTenant, async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Falta conversationId" });
    }

    clearConversationHistory(conversationId);

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error en /chat/reset:", error.message);
    return res
      .status(500)
      .json({ error: "No se pudo reiniciar la conversación" });
  }
});

/**
 * =========================================
 * LEADS
 * =========================================
 */

app.get("/leads", requireTenant, async (req, res) => {
  try {
    const password = req.headers["x-admin-password"];

    if (password !== req.tenant.adminPassword) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const leads = await Lead.find({
      tenantId: req.tenant.apiKey,
    }).sort({ createdAt: -1 });

    return res.json(leads);
  } catch (error) {
    console.error("Error en /leads:", error.message);
    return res.status(500).json({ error: "No se pudieron leer los leads" });
  }
});

app.delete("/leads/:id", requireTenant, async (req, res) => {
  try {
    const password = req.headers["x-admin-password"];

    if (password !== req.tenant.adminPassword) {
      return res.status(401).json({ error: "No autorizado" });
    }

    await Lead.deleteOne({
      _id: req.params.id,
      tenantId: req.tenant.apiKey,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando lead:", error.message);
    return res.status(500).json({ error: "No se pudo eliminar el lead" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});