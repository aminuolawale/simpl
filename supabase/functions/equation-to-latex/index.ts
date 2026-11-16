// POST { image: base64 PNG, hint?: string } → { latex, display, legible }
//
// Signed-in users only. Needs the GEMINI_API_KEY secret:
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy equation-to-latex
import { GoogleGenAI } from "npm:@google/genai@3.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { ConversionError, convertEquation } from "./convert.ts";

const MAX_IMAGE_BASE64 = 5_000_000; // ~3.7 MB PNG; clips are far smaller

// Image input items are only in v1beta of the Interactions API (v1 rejects them).
const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY"), apiVersion: "v1beta" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The platform checks the JWT, but the public anon key passes that check
  // too, so make sure there is a signed-in user behind the request.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to convert equations." }, 401);

  let body: { image?: unknown; hint?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const { image, hint } = body;
  if (typeof image !== "string" || !image || image.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/]+=*$/.test(image)) {
    return json({ error: "Expected a base64 PNG image." }, 400);
  }

  try {
    const result = await convertEquation(ai, {
      image,
      hint: typeof hint === "string" ? hint : undefined,
    });
    return json(result);
  } catch (e) {
    if (e instanceof ConversionError) return json({ error: e.message }, e.status);
    // Errors from the Gemini API carry the HTTP status.
    const status = (e as { status?: unknown })?.status;
    if (typeof status === "number") {
      console.error("Gemini API error", status, (e as Error).message);
      if (status === 429) return json({ error: "Too many requests. Try again shortly." }, 429);
      return json({ error: "The equation service is unavailable." }, 502);
    }
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
});
