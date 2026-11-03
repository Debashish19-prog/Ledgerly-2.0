import { HttpError } from "../utils/http.js";

export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That already exists" });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
