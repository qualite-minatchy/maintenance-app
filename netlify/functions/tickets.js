const { getStore } = require("@netlify/blobs");

const STORE_KEY = "tickets_data";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function ok(body, status) {
  return { statusCode: status || 200, headers: CORS, body: JSON.stringify(body) };
}
function err(msg, status) {
  return { statusCode: status || 500, headers: CORS, body: JSON.stringify({ error: msg }) };
}
function pad(n) { return String(n).padStart(2, "0"); }

exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // getStore DOIT être appelé ici, à l'intérieur du handler
  let store;
  try {
    store = getStore("maintenance");
  } catch (e) {
    console.error("getStore error:", e.message);
    return err("Stockage non disponible : " + e.message, 503);
  }

  try {
    // ── GET ──
    if (event.httpMethod === "GET") {
      const raw = await store.get(STORE_KEY);
      if (!raw) return ok([]);
      const data = JSON.parse(raw);
      return ok(data.tickets || []);
    }

    // ── POST ──
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const raw  = await store.get(STORE_KEY);
      const data = raw ? JSON.parse(raw) : { tickets: [], nextId: 1 };

      const now  = new Date();
      const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

      const ticket = {
        id:      data.nextId,
        name:    body.name    || "",
        dept:    body.dept    || "",
        site:    body.site    || "",
        equip:   body.equip   || "",
        loc:     body.loc     || "",
        type:    body.type    || "",
        urgency: body.urgency || "normale",
        desc:    body.desc    || "",
        status:  "open",
        date,
      };

      data.tickets.push(ticket);
      data.nextId += 1;
      await store.set(STORE_KEY, JSON.stringify(data));
      return ok(ticket, 201);
    }

    // ── PUT ──
    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const id   = parseInt(body.id, 10);
      const raw  = await store.get(STORE_KEY);
      if (!raw) return err("Aucune donnée", 404);

      const data = JSON.parse(raw);
      const idx  = data.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return err("Ticket introuvable", 404);

      data.tickets[idx] = Object.assign({}, data.tickets[idx], body);
      await store.set(STORE_KEY, JSON.stringify(data));
      return ok(data.tickets[idx]);
    }

    // ── DELETE ──
    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const id   = parseInt(body.id, 10);
      const raw  = await store.get(STORE_KEY);
      if (!raw) return ok({ success: true });

      const data = JSON.parse(raw);
      data.tickets = data.tickets.filter((t) => t.id !== id);
      await store.set(STORE_KEY, JSON.stringify(data));
      return ok({ success: true });
    }

    return err("Méthode non autorisée", 405);

  } catch (e) {
    console.error("Handler error:", e.message, e.stack);
    return err("Erreur interne : " + e.message, 500);
  }
};
