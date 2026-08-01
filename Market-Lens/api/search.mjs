import { json, searchNote } from "../server.mjs";

export const config = { maxDuration: 60 };

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  return searchNote(req, res);
}
