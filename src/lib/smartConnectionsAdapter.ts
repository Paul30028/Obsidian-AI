import type { App, TFile } from "obsidian";
import type { SuggestedLink } from "../types/dashboard";

/**
 * Optional integration with the community plugin "Smart Connections"
 * (brianpetro/obsidian-smart-connections, plugin id "smart-connections").
 *
 * Why this exists: Smart Connections already maintains a local embedding
 * index over the whole vault ("Smart Environment" / `env.smart_sources`).
 * If the user has it installed, we should reuse that index for the
 * QuickCapture "related cards" suggestion instead of re-embedding notes
 * ourselves — it's zero extra config for the user and avoids maintaining
 * a duplicate index (see the `ExistingCard[]` TODO in `ollamaAdapter.ts`).
 *
 * IMPORTANT — this is a best-effort integration against an UNDOCUMENTED,
 * internal API. Smart Connections does not publish a stable third-party
 * plugin API. What's used below (`env.smart_sources.lookup()` /
 * `.search()`) was confirmed by reading the underlying jsbrains source
 * (brianpetro/jsbrains, smart-sources/smart_sources.js) as of writing —
 * both methods are marked deprecated there in favor of a newer
 * `env.smart_sources.actions` registry, so a future Smart Connections
 * release can silently change or remove this shape.
 *
 * Because of that fragility, every call here is wrapped defensively:
 * any missing property or thrown error just returns `null`, which the
 * caller (DashboardView.tsx) treats as "not available" and falls back to
 * `ollamaAdapter.ts`'s own embedding-based ranking. This file must never
 * throw past its own boundary.
 */

const PLUGIN_ID = "smart-connections";
const MIN_SIMILARITY = 0.55; // matches ollamaAdapter.ts's own threshold

/** Loosely-typed view of the parts of Smart Connections' internal
 *  `SmartEnv` singleton this adapter tries to use. Everything is optional
 *  because we cannot rely on any of it actually being there. */
interface SmartSourcesLookupResult {
  path?: string;
  file_path?: string;
  item?: { path?: string; file_path?: string };
  score?: number;
  similarity?: number;
}

interface SmartSourcesCollection {
  lookup?: (params: Record<string, unknown>) => Promise<SmartSourcesLookupResult[]> | SmartSourcesLookupResult[];
  search?: (params: Record<string, unknown>) => Promise<SmartSourcesLookupResult[]> | SmartSourcesLookupResult[];
}

interface SmartConnectionsPluginInstance {
  env?: { smart_sources?: SmartSourcesCollection };
  smart_env?: { smart_sources?: SmartSourcesCollection };
}

export function isSmartConnectionsAvailable(app: App): boolean {
  try {
    const plugins = (app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins;
    return plugins.enabledPlugins.has(PLUGIN_ID);
  } catch {
    return false;
  }
}

/**
 * Returns related notes for `content` using Smart Connections' own index,
 * or `null` if the plugin isn't installed/enabled, or its internal API
 * doesn't match what we expect. Never throws.
 */
export async function findRelatedViaSmartConnections(
  app: App,
  content: string,
  limit: number
): Promise<SuggestedLink[] | null> {
  try {
    if (!isSmartConnectionsAvailable(app)) return null;

    const plugin = (app as unknown as { plugins: { plugins: Record<string, SmartConnectionsPluginInstance> } })
      .plugins.plugins[PLUGIN_ID];
    const smartSources = plugin?.env?.smart_sources ?? plugin?.smart_env?.smart_sources;
    if (!smartSources) return null;

    const raw = await (smartSources.lookup
      ? smartSources.lookup({ query: content, k: limit, limit })
      : smartSources.search?.({ keywords: [content], limit }));
    if (!raw || !Array.isArray(raw)) return null;

    return raw
      .map((entry) => resolveLink(app, entry))
      .filter((link): link is SuggestedLink => link !== null && link.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.error("[AKC Dashboard] Smart Connections lookup failed, falling back to local embedding", err);
    return null;
  }
}

function resolveLink(app: App, entry: SmartSourcesLookupResult): SuggestedLink | null {
  const path = entry.path ?? entry.file_path ?? entry.item?.path ?? entry.item?.file_path;
  const similarity = entry.score ?? entry.similarity;
  if (!path || typeof similarity !== "number") return null;

  const file = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!file) return null;

  return {
    noteId: path,
    noteTitle: file.basename,
    filePath: path,
    similarity,
  };
}
