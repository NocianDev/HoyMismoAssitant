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

  // Vercel
  "https://hoy-mismo-assitant.vercel.app",
  "https://hoymismo-assitant.vercel.app",
  "https://tecnologias-hoy-mismo.vercel.app",

  // Dominio con acento (visual)
  "https://www.tecnologíahoymismo.com",
  "https://tecnologíahoymismo.com",

  // Dominio real (punycode)
  "https://www.xn--tecnologahoymismo-kvb.com",
  "https://xn--tecnologahoymismo-kvb.com",

  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, health checks, etc.)
      if (!origin) return callback(null, true);

      // 🔥 NORMALIZAR (esto es lo importante)
      const normalizedOrigin = origin.toLowerCase();

      const isAllowed = allowedOrigins.some((allowed) =>
        allowed && normalizedOrigin === allowed.toLowerCase()
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

  if (words.length <= 26) {
    return clean;
  }

  const shortPreview = words.slice(0, 16).join(" ");
  return `${shortPreview}. Te dejé el resto en pantalla para que lo leas con calma.`;
}

/**
 * =========================================
 * MEMORIA CONVERSACIONAL
 * =========================================
 */

const conversationMemory = new Map();
const MAX_HISTORY_MESSAGES = 6;

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
    label: "soporte",
    handoff: "Te comunico con el agente de soporte.",
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
Empresa: ${tenant?.name || "Empresa de tecnología"}

Servicios:
- páginas web
- automatización
- chatbots
- asistentes virtuales con IA

Tono: ${tone}

Reglas:
- nunca digas que eres una IA
- responde claro, humano y profesional
- evita lenguaje técnico innecesario
- ayuda primero y vende cuando sea natural
- en voz, responde breve
- si la respuesta es larga, resume y di que el resto está en pantalla
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

Eres el AGENTE DE SOPORTE.

Objetivos:
- resolver dudas
- orientar sin presionar
- explicar de forma simple y útil

Estilo:
- claro
- profesional
- práctico
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
    "si quieres",
    "podemos agendar",
    "te contacto",
    "te paso",
    "escríbenos",
    "whatsapp",
    "demo",
    "cotización",
    "cotizacion",
  ].some((p) => text.includes(p));

  if (words <= 22) return true;
  if (words <= 38 && hasPriorityIntent) return true;

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

async function generateLeadSummary({ messages }) {
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
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "HoyMismo Assistant Backend",
        },
        timeout: 15000,
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
  temperature = 0.7,
}) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages,
      temperature,
      max_tokens: 90,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "HoyMismo Assistant Backend",
      },
      timeout: 25000,
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

  formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  formData.append("language", "es");

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
      timeout: 30000,
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
- en voice responde breve
- evita preguntas genéricas
- si falta contexto, pide solo el dato clave
- si la respuesta es larga, resume
`,
    },
    ...history,
    { role: "user", content: message },
  ];

  const reply = await openRouterChatCompletion({
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    messages,
    temperature: 0.6,
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

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    if (!conversationId) {
      return res.status(400).json({ error: "Falta conversationId" });
    }

    const previousAgent = getStoredAgent(conversationId);
    const selectedAgent = routeAgent(message);

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
    });

    const handoffMessage =
      previousAgent !== selectedAgent
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