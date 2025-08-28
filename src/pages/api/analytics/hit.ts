import type { APIRoute } from "astro";
import { turso } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!b?.section) return new Response(JSON.stringify({ ok:false }), { status:400 });

    const now = Date.now();
    const ua = request.headers.get("user-agent")?.slice(0,255) ?? null;

    await turso.execute({
      sql: `INSERT INTO hits (ts, section, category, slug, path, sid, ua)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [now, String(b.section), b.category ?? null, b.slug ?? null, b.path ?? null, b.sid ?? null, ua],
    });

    return new Response(JSON.stringify({ ok:true }), { status:200 });
  } catch {
    return new Response(JSON.stringify({ ok:false }), { status:400 });
  }
};
