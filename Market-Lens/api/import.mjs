import { json, importNote } from "../server.mjs";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  return importNote(req, res);
}
