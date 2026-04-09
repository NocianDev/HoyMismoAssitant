import { useEffect, useRef, useState } from "react";
import axios from "axios";

type Message = {
  role: "user" | "bot";
  text: string;
};

type Props = {
  title?: string;
  welcomeMessage?: string;
  apiUrl?: string;
  primaryColor?: string;
};

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function getOrCreateConversationId() {
  const existing = localStorage.getItem("assistant_conversation_id");
  if (existing) return existing;

  const newId =
    Date.now().toString() + "-" + Math.random().toString(36).slice(2, 10);

  localStorage.setItem("assistant_conversation_id", newId);
  return newId;
}

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";

export default function AssistantWidget({
  title = "HoyMismo Assistant",
  welcomeMessage = "Hola 👋 ¿En qué puedo ayudarte hoy?",
  apiUrl = `${API_URL}/chat`,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const conversationIdRef = useRef<string>(getOrCreateConversationId());

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  function speakText(text: string) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(customMessage?: string) {
    const messageToSend = (customMessage ?? input).trim();
    if (!messageToSend || isSending) return;

    const userMessage: Message = {
      role: "user",
      text: messageToSend,
    };

    const newMessages: Message[] = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsSending(true);

    try {
      const res = await axios.post(apiUrl, {
        message: messageToSend,
        conversationId: conversationIdRef.current,
      });

      const replyText =
        res.data?.reply || "Hubo un problema al generar la respuesta.";

      const botMessage: Message = {
        role: "bot",
        text: replyText,
      };

      setMessages([...newMessages, botMessage]);
      speakText(replyText);
    } catch (error: any) {
      console.error("Error conectando con el asistente:", {
        apiUrl,
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });

      const backendMessage =
        error?.response?.data?.error ||
        "Hubo un problema al conectar con el asistente.";

      const errorMessage: Message = {
        role: "bot",
        text: backendMessage,
      };

      setMessages([...newMessages, errorMessage]);
      speakText(errorMessage.text);
    } finally {
      setIsSending(false);
    }
  }

  function startListening() {
    if (!recognitionRef.current || isListening) return;
    window.speechSynthesis.cancel();
    recognitionRef.current.start();
  }

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            right: isMobile ? "12px" : "18px",
            left: isMobile ? "12px" : "auto",
            bottom: isMobile ? "84px" : "92px",
            width: isMobile ? "auto" : "390px",
            height: isMobile ? "72vh" : "650px",
            maxHeight: "calc(100vh - 110px)",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            borderRadius: "28px",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg, #facc15, #f59e0b)",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 800,
              borderBottom: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: isMobile ? "15px" : "17px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#3f3f46",
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                {isListening ? "Escuchando..." : "En línea"}
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#111827",
                fontSize: "22px",
                cursor: "pointer",
                marginLeft: "10px",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? "12px" : "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background:
                "linear-gradient(180deg, rgba(255,252,240,1) 0%, rgba(255,255,255,1) 100%)",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #facc15, #f59e0b)"
                        : "#f8fafc",
                    color: "#0f172a",
                    padding: isMobile ? "11px 13px" : "12px 14px",
                    borderRadius: "18px",
                    maxWidth: isMobile ? "88%" : "82%",
                    fontSize: isMobile ? "14px" : "15px",
                    lineHeight: 1.6,
                    boxShadow:
                      msg.role === "user"
                        ? "0 10px 24px rgba(245, 158, 11, 0.22)"
                        : "0 10px 24px rgba(15, 23, 42, 0.06)",
                    wordBreak: "break-word",
                    border:
                      msg.role === "user"
                        ? "none"
                        : "1px solid rgba(15, 23, 42, 0.06)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isSending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#f8fafc",
                    color: "#334155",
                    padding: "12px 14px",
                    borderRadius: "18px",
                    fontSize: "14px",
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                  }}
                >
                  Escribiendo...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div
            style={{
              padding: "12px",
              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
              background: "rgba(255,255,255,0.95)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                width: "100%",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Escribe o habla..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: isMobile ? "12px 12px" : "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  outline: "none",
                  fontSize: isMobile ? "14px" : "15px",
                  background: "#f8fafc",
                  color: "#0f172a",
                }}
              />

              <button
                onClick={startListening}
                title="Hablar"
                style={{
                  padding: isMobile ? "12px 11px" : "12px 13px",
                  background: isListening ? "#ef4444" : "#e2e8f0",
                  color: isListening ? "white" : "#334155",
                  border: "none",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontSize: isMobile ? "15px" : "17px",
                  minWidth: isMobile ? "44px" : "48px",
                  flexShrink: 0,
                }}
              >
                🎤
              </button>

              <button
                onClick={() => sendMessage()}
                disabled={isSending}
                style={{
                  padding: isMobile ? "12px 12px" : "12px 14px",
                  background: "linear-gradient(135deg, #facc15, #f59e0b)",
                  color: "#111827",
                  border: "none",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: isMobile ? "13px" : "14px",
                  minWidth: isMobile ? "64px" : "78px",
                  opacity: isSending ? 0.7 : 1,
                  flexShrink: 0,
                  boxShadow: "0 10px 24px rgba(245, 158, 11, 0.22)",
                }}
              >
                {isSending ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          right: "16px",
          bottom: "16px",
          width: isMobile ? "58px" : "62px",
          height: isMobile ? "58px" : "62px",
          borderRadius: "999px",
          border: "none",
          background: "linear-gradient(135deg, #facc15, #f59e0b)",
          color: "#111827",
          fontSize: isMobile ? "24px" : "26px",
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 20px 40px rgba(245, 158, 11, 0.28)",
          zIndex: 60,
        }}
        title="Abrir asistente"
      >
        💬
      </button>
    </>
  );
}