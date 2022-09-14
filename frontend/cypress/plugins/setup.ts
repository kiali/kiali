/*
  This file contains helper functions for the *setup* of cypress itself.
  It contains shared functionality used by the cypress config files.
*/
import get from 'axios';

export async function getAuthStrategy(url: string) {
  try {
    const resp = await get(url + '/api/auth/info');
    return resp.data.strategy;
  } catch (err) {
    console.error(`ERROR: Kiali API is not reachable at ${JSON.stringify(err.config.url)}`);
    throw new Error(`Kiali API is not reachable at ${JSON.stringify(err.config.url)}`);
  }
}
