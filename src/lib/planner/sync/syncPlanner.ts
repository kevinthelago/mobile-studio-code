// Pure helpers for the reconcile-on-connect flow: build a manifest from a file map,
// decide which remote files to pull, and assemble the remote map for reconcile.
// (The async transport + persistence wiring live in the coordinator.)

import { hashContent } from './canonical';
import type { FileMap } from './reconcile';

/** relpath → canonical-content hash. */
export type SyncManifest = Record<string, string>;

export function mapToManifest(map: FileMap): SyncManifest {
  const out: SyncManifest = {};
  for (const [path, content] of Object.entries(map)) out[path] = hashContent(content);
  return out;
}

/**
 * Paths whose REMOTE hash differs from our LOCAL content — the files we must pull to
 * reconcile. When the hashes match, remote content already equals local, so there's
 * nothing to fetch. (Base isn't needed here: it's stored locally and fed straight to
 * reconcile.)
 */
export function pathsToPull(localMap: FileMap, remoteManifest: SyncManifest): string[] {
  const need: string[] = [];
  for (const [path, rhash] of Object.entries(remoteManifest)) {
    const lhash = path in localMap ? hashContent(localMap[path]) : undefined;
    if (lhash !== rhash) need.push(path);
  }
  return need.sort();
}

/**
 * Assemble the remote file map for reconcile: pulled content for the changed paths,
 * local content for paths whose hash already matched. Only manifest paths exist on the
 * remote — paths absent from the manifest are simply absent (reconcile treats absence
 * as "no change", honoring local-only deletions).
 */
export function assembleRemoteMap(
  localMap: FileMap, remoteManifest: SyncManifest, pulled: FileMap,
): FileMap {
  const remote: FileMap = {};
  for (const path of Object.keys(remoteManifest)) {
    if (path in pulled) remote[path] = pulled[path];
    else if (path in localMap) remote[path] = localMap[path]; // hash matched ⇒ same content
  }
  return remote;
}
