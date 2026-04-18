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
    allowedHeaders: ["Content-Type", "x-admin-password", "x-tenant-id"],
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

  if (words.length <= 55) {
    return clean;
  }

  const shortPreview = words.slice(0, 48).join(" ");
  return `${shortPreview}. Si quieres, te explico el resto con más detalle.`;
}

function classifyBusinessIntent(message = "") {
  const text = normalizeText(message);

  const businessTerms = [
    "pagina web",
    "página web",
    "web",
    "landing",
    "sitio web",
    "tienda online",
    "tienda en línea",
    "chatbot",
    "chatbots",
    "asistente",
    "ia",
    "inteligencia artificial",
    "automatizacion",
    "automatización",
    "api",
    "apis",
    "integracion",
    "integración",
    "whatsapp",
    "ventas",
    "soporte",
    "demo",
    "cotizacion",
    "cotización",
    "precio",
    "servicio",
    "implementacion",
    "implementación",
    "negocio",
    "empresa",
    "cliente",
    "tecnología hoy mismo",
    "tecnologia hoy mismo",
  ];

  const offTopicPatterns = [
    "capital de",
    "quien gano",
    "quién ganó",
    "pronóstico del clima",
    "clima de hoy",
    "noticias",
    "traduce esto",
    "hazme una tarea",
    "resuelve este ejercicio",
    "dime un chiste",
    "receta",
    "futbol",
    "fútbol",
    "ajedrez",
    "película",
    "pelicula",
    "videojuego",
  ];

  const hasBusinessTerm = businessTerms.some((term) => text.includes(term));
  const hasOffTopicPattern = offTopicPatterns.some((term) =>
    text.includes(term)
  );

  if (hasOffTopicPattern && !hasBusinessTerm) {
    return { isBusinessRelated: false, reason: "off_topic" };
  }

  if (hasBusinessTerm) {
    return { isBusinessRelated: true, reason: "business_match" };
  }

  const genericAllowed = [
    "que hacen",
    "qué hacen",
    "que es",
    "qué es",
    "como funciona",
    "cómo funciona",
    "para que sirve",
    "para qué sirve",
    "quienes son",
    "quiénes son",
    "informacion",
    "información",
    "que manejan",
    "qué manejan",
    "que ofrecen",
    "qué ofrecen",
  ].some((term) => text.includes(term));

  if (genericAllowed) {
    return { isBusinessRelated: true, reason: "generic_business_question" };
  }

  return { isBusinessRelated: false, reason: "not_enough_business_context" };
}

/**
 * =========================================
 * MEMORIA CONVERSACIONAL
 * =========================================
 */

const conversationMemory = new Map();
const MAX_HISTORY_MESSAGES = 8;

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
 * MULTIAGENTE + VOCES
 * =========================================
 */

const AGENT_CONFIG = {
  general: {
    label: "recepción",
    handoff: "Te comunico con recepción.",
    voiceId: process.env.ELEVENLABS_VOICE_GENERAL,
  },
  sales: {
    label: "ventas",
    handoff: "Te comunico con el agente de ventas.",
    voiceId: process.env.ELEVENLABS_VOICE_SALES,
  },
  support: {
    label: "información",
    handoff: "Te comunico con el agente de información.",
    voiceId: process.env.ELEVENLABS_VOICE_SUPPORT,
  },
  scheduling: {
    label: "agenda",
    handoff: "Te comunico con el agente de agenda.",
    voiceId: process.env.ELEVENLABS_VOICE_SCHEDULING,
  },
  onboarding: {
    label: "implementación",
    handoff: "Te comunico con el agente de implementación.",
    voiceId: process.env.ELEVENLABS_VOICE_ONBOARDING,
  },
  retention: {
    label: "seguimiento",
    handoff: "Te comunico con el agente de seguimiento.",
    voiceId: process.env.ELEVENLABS_VOICE_RETENTION,
  },
};

function routeAgent(message) {
  const text = normalizeText(message);

  if (
    [
      "precio",
      "cotizacion",
      "cotización",
      "contratar",
      "servicio",
      "pagina",
      "página",
      "web",
      "whatsapp",
      "automatizacion",
      "automatización",
      "chatbot",
      "ia",
      "ventas",
      "costo",
      "plan",
      "planes",
      "paquete",
      "cotizar",
      "landing page",
      "tienda online",
      "tienda en línea",
      "pagina web",
      "página web",
    ].some((term) => text.includes(term))
  ) {
    return "sales";
  }

  if (
    [
      "demo",
      "agendar",
      "agenda",
      "reunión",
      "reunion",
      "llamada",
      "cita",
      "horario",
      "disponibilidad",
      "calendario",
    ].some((term) => text.includes(term))
  ) {
    return "scheduling";
  }

  if (
    [
      "como funciona",
      "cómo funciona",
      "qué hace",
      "que hace",
      "qué es",
      "que es",
      "quiénes son",
      "quienes son",
      "qué manejan",
      "que manejan",
      "qué ofrecen",
      "que ofrecen",
      "dudas",
      "ayuda",
      "información",
      "informacion",
      "soporte",
      "pregunta",
      "faq",
      "error",
      "problema",
      "fallo",
      "falla",
      "no funciona",
      "páginas web",
      "paginas web",
      "ias",
      "chatbots",
      "api",
      "apis",
      "automatización",
      "automatizacion",
      "para qué sirve",
      "para que sirve",
    ].some((term) => text.includes(term))
  ) {
    return "support";
  }

  if (
    [
      "activar",
      "instalar",
      "configurar",
      "integración",
      "integracion",
      "implementar",
      "onboarding",
      "conectar",
      "api",
      "crm",
      "widget",
      "embed",
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
      "mantener",
      "cancelar",
      "cancelación",
      "cancelacion",
      "me fui",
      "ya soy cliente",
    ].some((term) => text.includes(term))
  ) {
    return "retention";
  }

  return "general";
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
Las páginas web ayudan a que un negocio tenga presencia profesional, genere confianza, muestre servicios y reciba clientes potenciales. Pueden ser informativas, comerciales o enfocadas en ventas.

Sobre los asistentes con IA:
Los asistentes con IA pueden responder preguntas, calificar clientes, atender dudas frecuentes, apoyar ventas y estar disponibles 24/7. Pueden funcionar por chat o por voz según el proyecto.

Sobre los chatbots:
Los chatbots ayudan a responder de forma automática, guiar al usuario y reducir tiempos de atención. Son útiles para negocios que reciben muchas preguntas repetidas.

Sobre APIs e integraciones:
Las APIs permiten conectar sistemas, automatizar tareas y hacer que distintas herramientas trabajen juntas. Esto ayuda a ahorrar tiempo y evitar procesos manuales.

Sobre este asistente:
Este asistente es una demostración real del tipo de soluciones que desarrolla Tecnología Hoy Mismo. Puede orientar, responder dudas, explicar servicios y detectar interés comercial.

Tono: ${tone}

Reglas:
- nunca digas que eres una IA
- responde claro, humano y profesional
- evita lenguaje técnico innecesario
- ayuda primero y vende cuando sea natural
- explica servicios de forma simple cuando te pregunten qué hacen
- explica con ejemplos cuando te pregunten cómo funciona
- si el usuario pregunta varias cosas, responde por partes y con orden
- si detectas interés, guía a cotización, demo o contacto
- en voz responde natural, clara y suficientemente completa
- resume solo si la respuesta es demasiado larga
`;
}

function buildAgentPrompt(agent, tenant) {
  const base = buildBaseContext(tenant);

  if (agent === "sales") {
    return `
${base}

Eres el AGENTE COMERCIAL.

Objetivos:
- detectar necesidad
- explicar valor
- orientar al servicio correcto
- llevar a cotización, demo o contacto
- pedir nombre y WhatsApp cuando haya interés claro

Estilo:
- directo
- seguro
- comercial
- natural
`;
  }

  if (agent === "support") {
    return `
${base}

Eres el AGENTE DE INFORMACIÓN Y SOPORTE.

Objetivos:
- explicar qué es la empresa
- explicar qué servicios ofrecemos
- explicar cómo funciona cada solución
- explicar para qué sirve cada solución
- resolver dudas generales
- orientar dentro del sitio y del catálogo de servicios

Reglas:
- responde como experto en tecnología para negocios
- usa ejemplos simples y útiles
- no presiones demasiado al usuario
- si pregunta qué hacen, responde de manera completa
- si pregunta cómo funciona, explica con ejemplos reales
- si pregunta para qué sirve, explica el beneficio real para un negocio
- si detectas interés, sugiere siguiente paso

Estilo:
- claro
- profesional
- confiable
- explicativo pero natural
`;
  }

  if (agent === "scheduling") {
    return `
${base}

Eres el AGENTE DE AGENDA.

Objetivos:
- detectar si quiere demo o llamada
- pedir nombre y WhatsApp si faltan
- confirmar intención de agendar

Estilo:
- ejecutivo
- breve
- organizado
`;
  }

  if (agent === "onboarding") {
    return `
${base}

Eres el AGENTE DE IMPLEMENTACIÓN.

Objetivos:
- orientar sobre instalación e integración
- explicar pasos sin abrumar
- dar siguiente paso claro

Estilo:
- técnico pero simple
- ordenado
- resolutivo
`;
  }

  if (agent === "retention") {
    return `
${base}

Eres el AGENTE DE SEGUIMIENTO.

Objetivos:
- atender clientes actuales
- resolver dudas de continuidad, renovación o cancelación
- recuperar interés cuando sea posible

Estilo:
- cercano
- calmado
- profesional
`;
  }

  return `
${base}

Eres el AGENTE GENERAL / RECEPCIÓN.

Objetivos:
- entender la intención inicial
- orientar
- responder breve
- dirigir al siguiente paso correcto

Estilo:
- amable
- natural
- profesional
`;
}

function getStoredAgent(conversationId) {
  const history = getConversationHistory(conversationId);
  const systemMeta = history.findLast?.((m) => m.role === "system_agent_meta");

  if (systemMeta?.content) return systemMeta.content;
  return "general";
}

function setStoredAgent(conversationId, agent) {
  const current = conversationMemory.get(conversationId) || [];
  const filtered = current.filter((m) => m.role !== "system_agent_meta");
  const next = [...filtered, { role: "system_agent_meta", content: agent }].slice(
    -MAX_HISTORY_MESSAGES
  );
  conversationMemory.set(conversationId, next);
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
    "te contacto",
    "whatsapp",
    "demo",
    "cotización",
    "cotizacion",
  ].some((p) => text.includes(p));

  if (words <= 55) return true;
  if (words <= 90 && hasPriorityIntent) return true;

  return false;
}

function buildSpeechPayload({ reply, handoffMessage = "" }) {
  if (handoffMessage) {
    const merged = `${handoffMessage} ${buildSpokenVersion(reply)}`.trim();
    return merged;
  }

  return buildSpokenVersion(reply);
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

async function generateLeadSummary({ messages, origin }) {
  try {
    if (!process.env.OPENROUTER_API_KEY) return "";

    const text = messages.slice(-4).join("\n");

    const prompt = `
Resume este lead en 1 línea.
Incluye qué quiere el cliente y si pidió demo.

Conversación:
${text}
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Resume leads de forma muy breve." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 45,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            origin || process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "HoyMismo Assistant Backend",
        },
        timeout: 12000,
      }
    );

    return response?.data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error(
      "Error generando summary:",
      err.response?.data || err.message
    );
    return "";
  }
}

async function handleBusinessActions({
  tenant,
  conversationId,
  message,
  reply,
  selectedAgent,
  name,
  phone,
  interested,
  requestedDemo,
  origin,
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
        origin,
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
          selectedAgent,
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
      selectedAgent,
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
 * OPENROUTER HELPERS
 * =========================================
 */

async function openRouterChatCompletion({
  model = "openai/gpt-4o-mini",
  messages,
  temperature = 0.45,
  origin,
}) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages,
      temperature,
      max_tokens: 180,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          origin || process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "HoyMismo Assistant Backend",
      },
      timeout: 15000,
    }
  );

  return response?.data?.choices?.[0]?.message?.content?.trim() || "";
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
Espera términos de negocio y tecnología como:
Tecnología Hoy Mismo, páginas web, landing page, tienda online, chatbot, chatbots,
asistente virtual, inteligencia artificial, IA, automatización, API, APIs,
integración, WhatsApp, cotización, demo, implementación, soporte, ventas.
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
      timeout: 30000,
    }
  );

  return response?.data?.text?.trim() || "";
}

/**
 * =========================================
 * ELEVENLABS HELPERS
 * =========================================
 */

function getVoiceIdForAgent(agent) {
  return (
    AGENT_CONFIG[agent]?.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_GENERAL
  );
}

async function synthesizeWithElevenLabs(text, agent = "general") {
  const voiceId = getVoiceIdForAgent(agent);
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
      timeout: 25000,
    }
  );

  return response.data;
}

/**
 * =========================================
 * MODELO IA
 * =========================================
 */

async function generateAIReply({
  tenant,
  selectedAgent,
  message,
  conversationId,
  channel = "chat",
  origin,
}) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Falta configurar OPENROUTER_API_KEY");
  }

  const systemPrompt = buildAgentPrompt(selectedAgent, tenant);
  const history = getConversationHistory(conversationId).filter(
    (m) => m.role !== "system_agent_meta"
  );

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}

Canal actual: ${channel}

Instrucciones:
- si el canal es voice, responde natural, clara y suficientemente completa
- no cortes explicaciones importantes por ser demasiado breve
- si el usuario pregunta por servicios, explica con orden y ejemplos simples
- si preguntan para qué sirve algo, explica utilidad real para un negocio
- si preguntan cómo funciona algo, explícalo paso a paso
- si el tema no tiene relación con la empresa o sus servicios, responde brevemente que solo puedes ayudar sobre Tecnología Hoy Mismo y sus soluciones
- evita preguntas genéricas
- si falta contexto, pide solo el dato clave
- si preguntan por varias soluciones, contesta por partes
- mantén linealidad con el negocio y evita desviarte a temas ajenos
`,
    },
    ...history,
    { role: "user", content: message },
  ];

  const reply = await openRouterChatCompletion({
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    messages,
    temperature: 0.45,
    origin,
  });

  return reply || "Hubo un problema al generar la respuesta.";
}

/**
 * =========================================
 * AUDIO / CELULAR
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
    const { text, agent = "general" } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Texto vacío" });
    }

    const audioBuffer = await synthesizeWithElevenLabs(text, agent);

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
 * RUTAS
 * =========================================
 */

app.post("/chat", requireTenant, async (req, res) => {
  try {
    const { message, conversationId, channel = "chat" } = req.body;
    const tenant = req.tenant;
    const origin = req.headers.origin;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    if (!conversationId) {
      return res.status(400).json({ error: "Falta conversationId" });
    }

    const intentCheck = classifyBusinessIntent(message);

    if (!intentCheck.isBusinessRelated) {
      const reply =
        "Puedo ayudarte con dudas sobre Tecnología Hoy Mismo, como páginas web, asistentes con IA, chatbots, automatización, APIs e integraciones. Si quieres, dime qué servicio te interesa y te lo explico.";

      appendConversationMessage(conversationId, "user", message);
      appendConversationMessage(conversationId, "assistant", reply);
      setStoredAgent(conversationId, "general");

      const speak = channel === "voice";
      const spokenText = speak ? buildSpokenVersion(reply) : "";

      return res.json({
        reply,
        ttsEnabled: speak,
        ttsText: spokenText,
        agent: "general",
        voiceAgent: "general",
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

    const previousAgent = getStoredAgent(conversationId);
    const routedAgent = routeAgent(message);

    const selectedAgent =
      intentCheck.reason === "generic_business_question"
        ? previousAgent || "general"
        : routedAgent;

    const name = extractName(message);
    const phone = extractPhone(message);
    const interested = detectInterest(message);
    const requestedDemo = wantsDemo(message);

    const rawReply = await generateAIReply({
      tenant,
      selectedAgent,
      message,
      conversationId,
      channel,
      origin,
    });

    const handoffMessage =
      previousAgent !== selectedAgent &&
      intentCheck.reason !== "generic_business_question"
        ? AGENT_CONFIG[selectedAgent]?.handoff || ""
        : "";

    const reply = handoffMessage
      ? `${handoffMessage} ${rawReply}`.trim()
      : rawReply;

    appendConversationMessage(conversationId, "user", message);
    appendConversationMessage(conversationId, "assistant", reply);
    setStoredAgent(conversationId, selectedAgent);

    const actions = await handleBusinessActions({
      tenant,
      conversationId,
      message,
      reply,
      selectedAgent,
      name,
      phone,
      interested,
      requestedDemo,
      origin,
    });

    const speak = shouldSpeakReply(rawReply, channel, handoffMessage);
    const spokenText = speak
      ? buildSpeechPayload({ reply: rawReply, handoffMessage })
      : "";

    return res.json({
      reply,
      ttsEnabled: speak,
      ttsText: spokenText,
      agent: selectedAgent,
      voiceAgent: selectedAgent,
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