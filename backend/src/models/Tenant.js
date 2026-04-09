import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  adminPassword: { type: String, required: true },

  config: {
    primaryColor: { type: String, default: "#facc15" },
    welcomeMessage: { type: String, default: "Hola 👋 ¿En qué puedo ayudarte?" },
    tone: { type: String, default: "mixto" } // ventas | salud | mixto
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Tenant", tenantSchema);