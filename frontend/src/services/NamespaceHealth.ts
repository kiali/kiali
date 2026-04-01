import * as API from 'services/Api';

import { DurationInSeconds } from 'types/Common';
import { NamespaceHealth } from 'types/Health';

// Keep aligned with Namespaces page chunking to avoid long URIs / backend overload.
const MAX_NAMESPACES_PER_CALL = 100;

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Fetches namespace health for a single cluster, chunking namespace lists to avoid long URIs.
 * When cluster is undefined, this fetches health for the "default" cluster (single-cluster mode).
 * When duration is omitted, the server default rate interval is used (omit `rateInterval` query param).
 */
export const fetchClusterNamespacesHealth = async (
  namespaces: string[],
  cluster?: string,
  duration?: DurationInSeconds
): Promise<Map<string, NamespaceHealth>> => {
  if (namespaces.length === 0) {
    return new Map<string, NamespaceHealth>();
  }

  const namespaceChunks = chunkArray(namespaces, MAX_NAMESPACES_PER_CALL);
  const healthPromises = namespaceChunks.map(chunk => API.getClustersHealth(chunk.join(','), duration, cluster));
  const chunkedResults = await Promise.all(healthPromises);

  // Merge all chunk maps into a single map
  const merged = new Map<string, NamespaceHealth>();
  chunkedResults.forEach(result => {
    result.forEach((value, key) => merged.set(key, value));
  });

  return merged;
};
