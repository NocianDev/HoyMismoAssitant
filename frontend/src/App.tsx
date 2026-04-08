import { BrowserRouter, Routes, Route } from "react-router-dom";
import AssistantWidget from "./components/AssistantWidget";
import LeadsPanel from "./components/LeadsPanel";

function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #18204a 0%, #0a0f2c 45%, #050816 100%)",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "80px 20px",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>
          Tecnología Hoy Mismo
        </h1>

        <p
          style={{
            fontSize: "20px",
            lineHeight: 1.7,
            color: "#cbd5e1",
            maxWidth: "760px",
          }}
        >
          Demo del asistente virtual. Puedes abrir el widget flotante, escribir,
          hablar por micrófono y capturar leads automáticamente.
        </p>
      </div>

      <AssistantWidget
        title="HoyMismo Assistant 🤖"
        welcomeMessage="Hola 👋 ¿En qué puedo ayudarte hoy?"
        primaryColor="#facc15"
        apiUrl="http://localhost:3000/chat"
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