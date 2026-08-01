import { json, appVersion } from "../server.mjs";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, { version: appVersion });
}
