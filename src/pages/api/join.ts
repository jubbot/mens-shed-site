import type { APIRoute } from "astro";

const TURNSTILE_SECRET = import.meta.env.TURNSTILE_SECRET || "";

async function verifyTurnstile(token: string, ip?: string) {
  if (!TURNSTILE_SECRET || !token) return { success: false, skip: true };
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
  if (ip) body.set("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  return r.json();
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const contentType = request.headers.get("content-type") || "";
    let data: Record<string, string> = {};

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const fd = await request.formData();
      fd.forEach((v, k) => { if (typeof v === "string") data[k] = v; });
    } else if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Unsupported content type" }), { status: 400 });
    }

    // Honeypot
    if (data.website) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 }); // silently succeed
    }

    // Render delay (>= 1500ms)
    const renderedAt = Number(data.renderedAt || 0);
    if (!renderedAt || Date.now() - renderedAt < 1500) {
      return new Response(JSON.stringify({ ok: false, error: "Slow down, please." }), { status: 429 });
    }

    // Required fields
    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, error: "Name and email are required." }), { status: 400 });
    }

    // Turnstile
    const tsToken = data["cf-turnstile-response"] || data["g-recaptcha-response"] || "";
    const verify = await verifyTurnstile(tsToken, clientAddress);
    if (!verify?.success && !verify?.skip) {
      return new Response(JSON.stringify({ ok: false, error: "Verification failed." }), { status: 400 });
    }

    // TODO: Save to your DB / Sanity / email service
    // Example shape:
    const payload = {
      eventId: data.eventId || null,
      eventSlug: data.eventSlug || null,
      eventTitle: data.eventTitle || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      location: data.location || null,
      name, email,
      memberId: (data.memberId || "").trim(),
      createdAt: new Date().toISOString()
    };

    // await saveReservation(payload)
    // await sendConfirmationEmail(payload)

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), { status: 500 });
  }
};
