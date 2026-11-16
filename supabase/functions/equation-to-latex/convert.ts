// Turns an image of an equation (clipped from a PDF) into LaTeX with Claude.
// Kept free of Deno APIs so it can be type-checked and tested on its own.
import type Anthropic from "npm:@anthropic-ai/sdk@1.8.0";

export const MODEL = "claude-opus-5-5";

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
    latex: { type: "string" },
    display: { type: "boolean" },
    legible: { type: "boolean" },
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
  client: Anthropic,
  { image, hint }: { image: string; hint?: string },
): Promise<EquationResult> {
  const text = hint?.trim()
    ? `Transcribe this equation. Text extracted from the PDF at the same spot, which may be garbled or incomplete, use only as a hint: ${hint.trim().slice(0, 2000)}`
    : "Transcribe this equation.";

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: image } },
        { type: "text", text },
      ],
    }],
  });

  if (response.stop_reason === "refusal") {
    throw new ConversionError("The equation couldn't be transcribed.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ConversionError("The equation was too long to transcribe.", 422);
  }
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new ConversionError("No transcription was returned.", 502);
  }
  let result: EquationResult;
  try {
    result = JSON.parse(block.text) as EquationResult;
  } catch {
    throw new ConversionError("The transcription couldn't be read.", 502);
  }
  return { latex: result.latex.trim(), display: result.display, legible: result.legible };
}
