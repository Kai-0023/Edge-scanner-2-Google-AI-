import { createWorker } from "tesseract.js";

export interface SlipSuggestions {
  american_odds: number | null;
  stake: number | null;
  selection: string | null;
}

export interface ExtractSlipResult {
  suggestions: SlipSuggestions;
  text_preview: string;
  requires_confirmation: boolean;
  storage: string;
}

export function parseSlipText(text: string): SlipSuggestions {
  const normalized = text.replace(/\s+/g, " ");

  // Match American odds like +125, -110, -250, +300
  const oddsMatch = normalized.match(/(?<!\d)([+-]\d{2,4})(?!\d)/);

  // Match stake like $20, $15.50, $ 100.00
  const stakeMatch = normalized.match(/\$\s*(\d+(?:\.\d{1,2})?)/);

  return {
    american_odds: oddsMatch ? parseInt(oddsMatch[1], 10) : null,
    stake: stakeMatch ? parseFloat(stakeMatch[1]) : null,
    selection: null,
  };
}

export async function extractBetSlipFromImage(imageFile: File): Promise<ExtractSlipResult> {
  if (imageFile.size > 5 * 1024 * 1024) {
    throw new Error("Use an image smaller than 5 MB.");
  }

  let text = "";
  try {
    const worker = await createWorker("eng");
    const ret = await worker.recognize(imageFile);
    text = ret.data.text;
    await worker.terminate();
  } catch (err: any) {
    throw new Error("Local OCR could not process this image. You can enter the fields manually.");
  }

  return {
    suggestions: parseSlipText(text),
    text_preview: text.slice(0, 1000),
    requires_confirmation: true,
    storage: "The image and OCR text are not saved. Only fields you confirm can be tracked locally.",
  };
}
