import * as API from 'services/Api';

import { DurationInSeconds } from 'types/Common';
import { NamespaceHealth } from 'types/Health';
import { addDanger } from 'utils/AlertUtils';

// Keep aligned with Namespaces page chunking to avoid long URIs / backend overload.
const MAX_NAMESPACES_PER_CALL = 100;

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const healthFetchErrorMessage = (
  chunk: string[],
  chunkIndex: number,
  totalChunks: number,
  cluster: string | undefined,
  error: unknown
): string => {
  const namespaceList = chunk.join(',');
  const clusterName = cluster ?? 'default';

  if (totalChunks === 1) {
    const namespaceContext =
      chunk.length === 1 ? `namespace ${namespaceList}` : `${chunk.length} namespaces: ${namespaceList}`;
    return `Failed to fetch namespace health for cluster ${clusterName} (${namespaceContext}): ${errorMessage(error)}`;
  }

  return `Failed to fetch namespace health chunk ${chunkIndex + 1}/${totalChunks} for cluster ${clusterName} (${
    chunk.length
  } namespaces: ${namespaceList}): ${errorMessage(error)}`;
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
  const healthPromises = namespaceChunks.map(async (chunk, index) => {
    const namespaceList = chunk.join(',');

    try {
      return await API.getClustersHealth(namespaceList, duration, cluster);
    } catch (error) {
      const message = healthFetchErrorMessage(chunk, index, namespaceChunks.length, cluster, error);
      addDanger(message);
      return new Map<string, NamespaceHealth>();
    }
  });
  const chunkedResults = await Promise.all(healthPromises);

  // Merge all chunk maps into a single map
  const merged = new Map<string, NamespaceHealth>();
  chunkedResults.forEach(result => {
    result.forEach((value, key) => merged.set(key, value));
  });

  return merged;
};
