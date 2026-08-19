import { requestUrl } from "obsidian";
import type { CardType, SuggestedLink } from "../types/dashboard";

/**
 * Local-LLM hook for the Knowledge layer: given a freshly captured
 * QuickNote's text, ask a locally running Ollama server to (a) classify it
 * into moc / reading / core, (b) suggest tags, and (c) find similar
 * existing cards via embedding similarity.
 *
 * Nothing here is Obsidian-specific except `requestUrl` (used again to
 * avoid any renderer CORS friction, even though localhost calls are
 * usually fine with plain `fetch` too).
 *
 * Swap `OLLAMA_HOST` / `MODEL` for plugin settings once you add a settings
 * tab; hardcoded here to keep the adapter's contract obvious.
 */

const OLLAMA_HOST = "http://127.0.0.1:11434";
const CHAT_MODEL = "llama3.1";
const EMBED_MODEL = "nomic-embed-text";

export interface QuickNoteAnalysis {
  cardType: CardType;
  tags: string[];
  suggestedLinks: SuggestedLink[];
}

/** Minimal shape of an existing card the similarity search compares against.
 *  In production this comes from a persisted embedding index (see
 *  `buildEmbeddingIndex` below) rather than being recomputed every call. */
export interface ExistingCard {
  id: string;
  title: string;
  filePath: string;
  embedding: number[];
}

export async function analyzeQuickNote(
  content: string,
  existingCards: ExistingCard[]
): Promise<QuickNoteAnalysis> {
  const [classification, embedding] = await Promise.all([
    classify(content),
    embed(content),
  ]);

  const suggestedLinks = rankBySimilarity(embedding, existingCards).slice(0, 3);

  return { ...classification, suggestedLinks };
}

async function classify(content: string): Promise<{ cardType: CardType; tags: string[] }> {
  const prompt = [
    "You are a Zettelkasten assistant. Classify the note below as exactly",
    'one of "moc", "reading", or "core", and suggest up to 5 short topic tags.',
    'Respond ONLY as JSON: {"cardType": "...", "tags": ["..."]}',
    "",
    `Note: """${content}"""`,
  ].join("\n");

  const response = await requestUrl({
    url: `${OLLAMA_HOST}/api/generate`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, prompt, stream: false, format: "json" }),
  });

  const parsed = JSON.parse(response.json.response) as { cardType: CardType; tags: string[] };
  return { cardType: parsed.cardType, tags: parsed.tags ?? [] };
}

async function embed(content: string): Promise<number[]> {
  const response = await requestUrl({
    url: `${OLLAMA_HOST}/api/embeddings`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: content }),
  });

  return response.json.embedding as number[];
}

function rankBySimilarity(target: number[], cards: ExistingCard[]): SuggestedLink[] {
  return cards
    .map((card) => ({
      noteId: card.id,
      noteTitle: card.title,
      filePath: card.filePath,
      similarity: cosineSimilarity(target, card.embedding),
    }))
    .filter((link) => link.similarity > 0.55) // drop weak matches
    .sort((a, b) => b.similarity - a.similarity);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
