import {
  PlanBundle,
  PlanProject,
  BUNDLE_SCHEMA,
  PlanFileKey,
  PLAN_FILE_KEYS,
} from './types';
import { fnv1a } from './hash';

/** Planner core version embedded in every bundle. */
export const CORE_VERSION = '0.9.75';

/**
 * Serialize a PlanProject into a PlanBundle ready for wire transfer.
 * Recomputes all file hashes at export time so the receiver can validate
 * integrity without trusting the stored hash values.
 */
export function serializeBundle(
  source: 'mobile' | 'desktop',
  project: PlanProject,
  exportedAt: number,
): PlanBundle {
  const files: PlanProject['files'] = {};
  for (const key of PLAN_FILE_KEYS) {
    const entry = project.files[key];
    if (entry) {
      files[key] = { ...entry, hash: fnv1a(entry.content) };
    }
  }
  return {
    bundleSchema: BUNDLE_SCHEMA,
    source,
    exportedAt,
    coreVersion: CORE_VERSION,
    project: { ...project, files },
  };
}

/**
 * Deserialize and validate a PlanBundle received from the wire.
 * Throws if:
 * - bundleSchema is unknown
 * - any file hash does not match computed hash (integrity violation)
 * On success returns the PlanProject with only known PLAN_FILE_KEYS retained.
 */
export function deserializeBundle(bundle: PlanBundle): PlanProject {
  if (bundle.bundleSchema !== BUNDLE_SCHEMA) {
    throw new Error(
      `Unsupported PlanBundle schema "${bundle.bundleSchema}" (expected "${BUNDLE_SCHEMA}")`,
    );
  }
  const project = bundle.project;
  // Validate + filter to known file keys only (ignore future unknown keys
  // from a newer sender so forward-compat is graceful)
  const files: PlanProject['files'] = {};
  for (const key of PLAN_FILE_KEYS) {
    const entry = project.files[key as PlanFileKey];
    if (!entry) continue;
    const computed = fnv1a(entry.content);
    if (entry.hash !== computed) {
      throw new Error(
        `Hash mismatch for "${key}": stored=${entry.hash} computed=${computed}`,
      );
    }
    files[key as PlanFileKey] = entry;
  }
  return { ...project, files };
}

/** Convenience: serialize then immediately deserialize. Use in tests to
 *  verify round-trip fidelity without touching the network. */
export function roundTripBundle(
  source: 'mobile' | 'desktop',
  project: PlanProject,
  exportedAt: number,
): PlanProject {
  return deserializeBundle(serializeBundle(source, project, exportedAt));
}
