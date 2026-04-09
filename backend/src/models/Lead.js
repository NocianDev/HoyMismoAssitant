import mongoose from "mongoose";

const leadSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  conversationId: { type: String, required: true },

  name: String,
  phone: String,
  interested: Boolean,

  messages: [String],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Lead", leadSchema);