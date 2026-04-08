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

export default function AssistantWidget({
  title = "HoyMismo Assistant 🤖",
  welcomeMessage = "Hola 👋 ¿En qué puedo ayudarte hoy?",
  apiUrl = "http://localhost:3000/chat",
  primaryColor = "#facc15",
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
  }, [messages, isSending]);

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
    } catch {
      const errorMessage: Message = {
        role: "bot",
        text: "Hubo un problema al conectar con el asistente.",
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
            right: isMobile ? "12px" : "16px",
            left: isMobile ? "12px" : "auto",
            bottom: isMobile ? "84px" : "88px",
            width: isMobile ? "auto" : "380px",
            height: isMobile ? "70vh" : "620px",
            maxHeight: "calc(100vh - 100px)",
            background: "rgba(10, 15, 44, 0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              background: primaryColor,
              color: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 700,
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
                  color: "#222",
                  marginTop: 4,
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
                color: "#111",
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
              padding: isMobile ? "12px" : "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background:
                "linear-gradient(180deg, rgba(8,12,34,1) 0%, rgba(5,8,22,1) 100%)",
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
                      msg.role === "user" ? primaryColor : "rgba(68, 77, 127, 0.96)",
                    color: msg.role === "user" ? "#111" : "#fff",
                    padding: isMobile ? "11px 13px" : "12px 14px",
                    borderRadius: "16px",
                    maxWidth: isMobile ? "88%" : "82%",
                    fontSize: isMobile ? "14px" : "15px",
                    lineHeight: 1.5,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                    wordBreak: "break-word",
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
                    background: "rgba(68, 77, 127, 0.96)",
                    color: "#fff",
                    padding: "12px 14px",
                    borderRadius: "16px",
                    fontSize: "14px",
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
              borderTop: "1px solid rgba(255,255,255,0.08)",
              background: "#121936",
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
                  border: "none",
                  outline: "none",
                  fontSize: isMobile ? "14px" : "15px",
                  background: "#f8fafc",
                  color: "#111",
                }}
              />

              <button
                onClick={startListening}
                title="Hablar"
                style={{
                  padding: isMobile ? "12px 11px" : "12px 13px",
                  background: isListening ? "#ef4444" : "#334155",
                  color: "white",
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
                  background: primaryColor,
                  color: "#111",
                  border: "none",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: isMobile ? "13px" : "14px",
                  minWidth: isMobile ? "64px" : "72px",
                  opacity: isSending ? 0.7 : 1,
                  flexShrink: 0,
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
          width: isMobile ? "58px" : "60px",
          height: isMobile ? "58px" : "60px",
          borderRadius: "999px",
          border: "none",
          background: primaryColor,
          color: "#111",
          fontSize: isMobile ? "24px" : "26px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
          zIndex: 60,
        }}
        title="Abrir asistente"
      >
        💬
      </button>
    </>
  );
}