import { BrowserRouter, Routes, Route } from "react-router-dom";
import AssistantWidget from "./components/AssistantWidget";
import LeadsPanel from "./components/LeadsPanel";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";

function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fffdf5 0%, #fff9e6 35%, #ffffff 100%)",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1150px",
          margin: "0 auto",
          padding: "88px 20px 120px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(250, 204, 21, 0.16)",
            color: "#a16207",
            border: "1px solid rgba(250, 204, 21, 0.35)",
            borderRadius: "999px",
            padding: "8px 14px",
            fontSize: "14px",
            fontWeight: 700,
            marginBottom: "22px",
          }}
        >
          Asistente comercial 24/7
        </div>

        <h1
          style={{
            fontSize: "clamp(42px, 7vw, 72px)",
            lineHeight: 1,
            marginBottom: "18px",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            background: "linear-gradient(90deg, #facc15, #f59e0b, #111827)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            maxWidth: "900px",
          }}
        >
          Tecnología Hoy Mismo
        </h1>

        <p
          style={{
            fontSize: "clamp(18px, 2.2vw, 22px)",
            lineHeight: 1.8,
            color: "#475569",
            maxWidth: "780px",
            marginBottom: "34px",
          }}
        >
          Demo del asistente virtual con atención automática, captura de leads y
          experiencia conversacional por texto y voz, todo con una imagen más
          clara, moderna y alineada a la marca.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: "18px",
              padding: "16px 18px",
              minWidth: "210px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                marginBottom: "6px",
                fontWeight: 700,
              }}
            >
              Atención
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              Disponible 24/7
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: "18px",
              padding: "16px 18px",
              minWidth: "210px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                marginBottom: "6px",
                fontWeight: 700,
              }}
            >
              Captura
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              Leads automáticos
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: "18px",
              padding: "16px 18px",
              minWidth: "210px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                marginBottom: "6px",
                fontWeight: 700,
              }}
            >
              Integración
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              Chat + voz
            </div>
          </div>
        </div>
      </div>

      <AssistantWidget
        title="HoyMismo Assistant"
        welcomeMessage="Hola 👋 Bienvenido a Tecnología Hoy Mismo. ¿En qué puedo ayudarte hoy?"
        primaryColor="#facc15"
        apiUrl={`${API_URL}/chat`}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<LeadsPanel />} />
      </Routes>
    </BrowserRouter>
  );
}