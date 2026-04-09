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

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";

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
      const res = await axios.get(`${API_URL}/leads`, {
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
      await axios.delete(`${API_URL}/leads/${id}`, {
        headers: {
          "x-admin-password": password,
        },
      });

      loadLeads();
    } catch {
      alert("Error al eliminar lead");
    }
  }

  if (!authorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, #fffdf5 0%, #fff9e6 35%, #ffffff 100%)",
          color: "#0f172a",
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
            maxWidth: "430px",
            background: "#ffffff",
            borderRadius: "24px",
            padding: "32px",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.1)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(250, 204, 21, 0.16)",
              color: "#a16207",
              border: "1px solid rgba(250, 204, 21, 0.35)",
              borderRadius: "999px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 800,
              marginBottom: "18px",
            }}
          >
            Acceso administrador
          </div>

          <h2
            style={{
              marginBottom: "10px",
              fontSize: "30px",
              color: "#0f172a",
            }}
          >
            Panel de Leads
          </h2>

          <p style={{ color: "#64748b", lineHeight: 1.7 }}>
            Ingresa la contraseña de administrador para ver, actualizar y
            eliminar leads capturados por el asistente.
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
              padding: "14px 16px",
              borderRadius: "14px",
              marginTop: "18px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={loadLeads}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "14px",
              padding: "14px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #facc15, #f59e0b)",
              border: "none",
              fontWeight: 800,
              color: "#111827",
              cursor: "pointer",
              boxShadow: "0 14px 30px rgba(245, 158, 11, 0.2)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error && (
            <p style={{ color: "#dc2626", marginTop: "12px" }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fffdf5 0%, #fff9e6 35%, #ffffff 100%)",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
        padding: "30px 20px",
      }}
    >
      <div style={{ maxWidth: "1150px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "22px",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(250, 204, 21, 0.16)",
                color: "#a16207",
                border: "1px solid rgba(250, 204, 21, 0.35)",
                borderRadius: "999px",
                padding: "7px 12px",
                fontSize: "13px",
                fontWeight: 800,
                marginBottom: "12px",
              }}
            >
              Administración
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "40px",
                color: "#0f172a",
              }}
            >
              Leads capturados
            </h1>

            <p style={{ color: "#64748b", marginTop: "8px" }}>
              Total: {leads.length}
            </p>
          </div>

          <button
            onClick={loadLeads}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #facc15, #f59e0b)",
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              color: "#111827",
              boxShadow: "0 14px 30px rgba(245, 158, 11, 0.18)",
            }}
          >
            Actualizar
          </button>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {leads.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                borderRadius: "18px",
                padding: "24px",
                color: "#64748b",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
              }}
            >
              No hay leads aún.
            </div>
          ) : (
            leads
              .slice()
              .reverse()
              .map((lead) => (
                <div
                  key={lead.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    padding: "22px",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <strong>Nombre:</strong> {lead.name || "Sin nombre"}
                    </div>

                    <div>
                      <strong>Teléfono:</strong> {lead.phone || "Sin teléfono"}
                    </div>

                    <div>
                      <strong>Interesado:</strong>{" "}
                      <span
                        style={{
                          color: lead.interested ? "#16a34a" : "#dc2626",
                          fontWeight: 700,
                        }}
                      >
                        {lead.interested ? "Sí" : "No"}
                      </span>
                    </div>

                    <div>
                      <strong>Creado:</strong>{" "}
                      {new Date(lead.createdAt).toLocaleString()}
                    </div>

                    <div>
                      <strong>Actualizado:</strong>{" "}
                      {new Date(lead.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <strong>Mensajes:</strong>
                    <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
                      {lead.messages.map((msg, i) => (
                        <div
                          key={i}
                          style={{
                            background: "#f8fafc",
                            border: "1px solid rgba(15, 23, 42, 0.06)",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            color: "#334155",
                          }}
                        >
                          {msg}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteLead(lead.id)}
                    style={{
                      marginTop: "10px",
                      padding: "11px 14px",
                      borderRadius: "12px",
                      border: "none",
                      background: "#ef4444",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
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