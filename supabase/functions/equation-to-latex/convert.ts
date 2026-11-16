// Turns an image of an equation (clipped from a PDF) into LaTeX with Gemini.
// Kept free of Deno APIs so it can be type-checked and tested on its own.
import type { GoogleGenAI } from "npm:@google/genai@3.3.0";

export const MODEL = "gemini-4-hydrogen";

export interface EquationResult {
  /** LaTeX for KaTeX, without surrounding $ or \[ \] delimiters. */
  latex: string;
  /** True for a standalone, displayed equation; false for inline math. */
  display: boolean;
  /** False when the image is too unclear, or isn't math, to transcribe with confidence. */
  legible: boolean;
}

export class ConversionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const SCHEMA = {
  type: "object",
  properties: {
    latex: { type: "string", description: "The expression in LaTeX, without math delimiters." },
    display: { type: "boolean", description: "True for a standalone displayed equation." },
    legible: { type: "boolean", description: "False if the image is unclear, cut off, or not math." },
  },
  required: ["latex", "display", "legible"],
  additionalProperties: false,
};

const SYSTEM = `You transcribe images of mathematical notation, clipped from PDFs, into LaTeX that KaTeX can render.

- Reproduce exactly what is shown: same symbols, sub- and superscripts, and structure. Do not simplify, correct or complete it.
- Return only the expression: no $, $$, \\[ \\] or equation environments. For several aligned lines, use \\begin{aligned} ... \\end{aligned}.
- Drop equation numbers such as "(3.2)" at the edge of the clip.
- Use standard commands KaTeX supports (\\frac, \\sum, \\mathbb, \\operatorname, ...), not packages it lacks.
- Set display to true when the clip is a standalone displayed equation, false for math that sits within a line of text.
- Set legible to false if the image is cut off, too blurry to read with confidence, or not mathematical notation; still give your best transcription.`;

export async function convertEquation(
  ai: GoogleGenAI,
  { image, hint }: { image: string; hint?: string },
): Promise<EquationResult> {
  const text = hint?.trim()
    ? `Transcribe this equation. Text extracted from the PDF at the same spot, which may be garbled or incomplete, use only as a hint: ${hint.trim().slice(0, 2000)}`
    : "Transcribe this equation.";

  const interaction = await ai.interactions.create({
    model: MODEL,
    system_instruction: SYSTEM,
    input: [
      { type: "text", text },
      { type: "image", data: image, mime_type: "image/png" },
    ],
    response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
    generation_config: { thinking_level: "low", max_output_tokens: 8000 },
    store: false, // nothing to continue later; don't keep the clip server-side
  });

  if (interaction.status !== "completed") {
    console.error("Gemini interaction not completed:", interaction.status);
    throw new ConversionError(
      interaction.status === "incomplete"
        ? "The equation was too long to transcribe."
        : "The equation couldn't be transcribed.",
      422,
    );
  }
  const raw = interaction.output_text;
  if (!raw) throw new ConversionError("No transcription was returned.", 502);
  let result: EquationResult;
  try {
    result = JSON.parse(raw) as EquationResult;
  } catch {
    throw new ConversionError("The transcription couldn't be read.", 502);
  }
  if (typeof result.latex !== "string") throw new ConversionError("The transcription couldn't be read.", 502);
  return { latex: result.latex.trim(), display: !!result.display, legible: !!result.legible };
}
