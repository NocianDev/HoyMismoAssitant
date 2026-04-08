import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const LEADS_FILE = "leads.json";

app.get("/", (req, res) => {
  res.send("Backend OK");
});

function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];

  try {
    const content = fs.readFileSync(LEADS_FILE, "utf-8");
    return JSON.parse(content || "[]");
  } catch {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
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
    "ia",
  ].some((term) => lower.includes(term));
}

function createOrUpdateLead(data) {
  const { conversationId, message, name, phone, interested } = data;
  const leads = readLeads();

  let leadIndex = leads.findIndex(
    (lead) => lead.conversationId === conversationId
  );

  if (leadIndex === -1) {
    const newLead = {
      id: Date.now().toString(),
      conversationId,
      name: name || null,
      phone: phone || null,
      interested: !!interested,
      messages: [message],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    leads.push(newLead);
    writeLeads(leads);
    return newLead;
  }

  const currentLead = leads[leadIndex];
  const currentMessages = Array.isArray(currentLead.messages)
    ? currentLead.messages
    : [];

  const messageAlreadyExists = currentMessages.includes(message);

  leads[leadIndex] = {
    ...currentLead,
    name: name || currentLead.name,
    phone: phone || currentLead.phone,
    interested: interested || currentLead.interested,
    messages: messageAlreadyExists
      ? currentMessages
      : [...currentMessages, message],
    updatedAt: new Date().toISOString(),
  };

  writeLeads(leads);
  return leads[leadIndex];
}

const systemPrompt = `
Eres un asesor comercial y recepcionista de una empresa de tecnología.

Tu objetivo es atender clientes, generar confianza y guiarlos a contratar.

Servicios:
- páginas web profesionales
- chatbots
- automatización
- asistentes virtuales con IA
- soluciones digitales

Reglas:
- nunca digas que eres una IA
- responde corto, natural y profesional
- habla como parte del equipo real
- si detectas interés comercial, pide nombre y WhatsApp o teléfono de forma natural
- si ya te dieron nombre o teléfono, sigue guiando la conversación
- evita respuestas largas
- busca llevar la conversación a una cotización

Ejemplos:
- "Claro 👌 te puedo ayudar con eso. ¿Buscas algo informativo o una solución más completa?"
- "Sí, manejamos ese tipo de proyectos. Para orientarte mejor, ¿me compartes tu nombre y tu WhatsApp?"
- "Perfecto, gracias. Ahora cuéntame un poco qué necesitas y te ayudo a aterrizarlo."
`;

app.post("/chat", async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    if (!conversationId) {
      return res.status(400).json({ error: "Falta conversationId" });
    }

    const phone = extractPhone(message);
    const name = extractName(message);
    const interested = detectInterest(message);

    if (phone || name || interested) {
      createOrUpdateLead({
        conversationId,
        message,
        name,
        phone,
        interested,
      });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply =
      response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content
        ? response.data.choices[0].message.content
        : "Hubo un problema al generar la respuesta.";

    res.json({ reply });
  } catch (error) {
    console.error("Error en /chat:", error.response?.data || error.message);
    res.status(500).json({ error: "Error en IA" });
  }
});

app.get("/leads", (req, res) => {
  const password = req.headers["x-admin-password"];

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const leads = readLeads();
    res.json(leads);
  } catch {
    res.status(500).json({ error: "No se pudieron leer los leads" });
  }
});

app.delete("/leads/:id", (req, res) => {
  const password = req.headers["x-admin-password"];

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const id = req.params.id;
  let leads = readLeads();
  leads = leads.filter((lead) => lead.id !== id);
  writeLeads(leads);

  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `Servidor corriendo en http://localhost:${process.env.PORT || 3000}`
  );
});