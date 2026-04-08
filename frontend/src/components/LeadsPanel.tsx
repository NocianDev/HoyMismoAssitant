import { useState } from "react";
import axios from "axios";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  interested: boolean;
  messages: string[];
  createdAt: string;
  updatedAt: string;
};

export default function LeadsPanel() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadLeads() {
    setLoading(true);
    setError("");

    try {
      const res = await axios.get("http://localhost:3000/leads", {
        headers: {
          "x-admin-password": password,
        },
      });

      setLeads(res.data);
      setAuthorized(true);
    } catch {
      setError("Contraseña incorrecta o no se pudieron cargar los leads.");
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteLead(id: string) {
    try {
      await axios.delete(`http://localhost:3000/leads/${id}`, {
        headers: {
          "x-admin-password": password,
        },
      });

      loadLeads();
    } catch {
      alert("Error al eliminar lead");
    }
  }

  // 🔐 LOGIN
  if (!authorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, #18204a 0%, #0a0f2c 45%, #050816 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "rgba(17, 24, 39, 0.95)",
            borderRadius: "20px",
            padding: "30px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <h2 style={{ marginBottom: "10px" }}>Panel de Leads</h2>

          <p style={{ color: "#cbd5e1" }}>
            Ingresa la contraseña de administrador
          </p>

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadLeads();
            }}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              marginTop: "10px",
              border: "none",
            }}
          />

          <button
            onClick={loadLeads}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "14px",
              padding: "14px",
              borderRadius: "12px",
              background: "#facc15",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error && (
            <p style={{ color: "#f87171", marginTop: "10px" }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  // 📊 PANEL
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #18204a 0%, #0a0f2c 45%, #050816 100%)",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "30px 20px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Leads capturados</h1>
            <p style={{ color: "#cbd5e1" }}>Total: {leads.length}</p>
          </div>

          <button
            onClick={loadLeads}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              background: "#facc15",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Actualizar
          </button>
        </div>

        {/* LISTA */}
        <div style={{ display: "grid", gap: "16px" }}>
          {leads.length === 0 ? (
            <div>No hay leads aún.</div>
          ) : (
            leads
              .slice()
              .reverse()
              .map((lead) => (
                <div
                  key={lead.id}
                  style={{
                    background: "#111827",
                    borderRadius: "16px",
                    padding: "20px",
                  }}
                >
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Nombre:</strong>{" "}
                    {lead.name || "Sin nombre"}
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>Teléfono:</strong>{" "}
                    {lead.phone || "Sin teléfono"}
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>Interesado:</strong>{" "}
                    <span
                      style={{
                        color: lead.interested ? "#4ade80" : "#f87171",
                      }}
                    >
                      {lead.interested ? "Sí" : "No"}
                    </span>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>Mensajes:</strong>
                    {lead.messages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#1f2937",
                          marginTop: "5px",
                          padding: "8px",
                          borderRadius: "8px",
                        }}
                      >
                        {msg}
                      </div>
                    ))}
                  </div>

                  {/* 🔥 BOTÓN ELIMINAR */}
                  <button
                    onClick={() => deleteLead(lead.id)}
                    style={{
                      marginTop: "10px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#ef4444",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Eliminar lead
                  </button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}