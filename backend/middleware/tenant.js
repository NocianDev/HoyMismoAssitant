import Tenant from "../src/models/Tenant.js";

export async function requireTenant(req, res, next) {
  const tenantId =
    req.headers["x-tenant-id"] ||
    req.body.tenantId ||
    req.query.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: "Falta tenantId" });
  }

  const tenant = await Tenant.findOne({ apiKey: tenantId });

  if (!tenant) {
    return res.status(404).json({ error: "Tenant no encontrado" });
  }

  req.tenant = tenant;
  next();
}