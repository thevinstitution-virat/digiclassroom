/**
 * `searchLibrary`: the one read path into the library for the tutor, the Virat Evaluator and Practest.
 *
 * Hub search first. Only a mechanism failure (hub unreachable, timed out, 5xx) is covered by the direct read-only
 * reader, and the answer then says `degraded: true` (docs/known-issues/silently-degrading-fallbacks.md). Wrong
 * credentials, hub search switched off and refused requests are configuration or caller errors: they throw,
 * because a fallback would hide them for as long as the direct reader happened to work.
 */
import { directDepsFromEnv, directSearch, rememberScope, type DirectDeps } from './direct-reader';
import { HubError, LibraryNotConfigured, hubConfigFromEnv, hubSearch, type HubConfig, type HubSearchRequest, type HubSearchResponse } from './hub-client';

/** Reads the flag each time, so a deploy-time change needs no restart of long-lived workers. */
export const libraryHubEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.LIBRARY_HUB_ENABLED === 'true';

/** Old markdown/PDF ingestion lanes answer 410 when this is on (the hub is then the only writer). */
export const legacyIngestionDisabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.LEGACY_INGESTION_DISABLED === 'true';

export interface SearchDeps {
  cfg?: HubConfig;
  fetchImpl?: typeof fetch;
  /** Direct reader; `null` switches the fallback off. Default: from the environment, when it is configured. */
  direct?: (() => Promise<DirectDeps>) | null;
  warn?: (message: string) => void;
}

export async function searchLibrary(req: HubSearchRequest, deps: SearchDeps = {}): Promise<HubSearchResponse> {
  const cfg = deps.cfg ?? hubConfigFromEnv();
  const warn = deps.warn ?? ((m: string) => console.warn(`[library] ${m}`));
  try {
    const res = await hubSearch(cfg, req, deps.fetchImpl);
    rememberScope(req, res);
    return res;
  } catch (err) {
    if (!(err instanceof HubError) || err.failure !== 'unreachable') throw err;
    const direct = deps.direct === undefined ? () => directDepsFromEnv() : deps.direct;
    if (!direct) throw err;
    let readers: DirectDeps;
    try {
      readers = await direct();
    } catch (cfgErr) {
      // The fallback is not set up here: report the hub's failure, which is the real one.
      if (cfgErr instanceof LibraryNotConfigured) throw err;
      throw cfgErr;
    }
    warn(`hub search failed (${err.message}); answering from the direct reader`);
    return directSearch(req, readers);
  }
}
