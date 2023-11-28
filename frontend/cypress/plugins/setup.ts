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

export async function checkForOSSMC(tags: string, ossmcUrl: string) {
  if (tags && ossmcUrl == '') {
    console.error(`ERROR: OSSMC_URL is not reachable at ${ossmcUrl}, set it by export CYPRESS_OSSMC_URL`);
    throw new Error(`ERROR: OSSMC_URL is not reachable at ${ossmcUrl}, set it by export CYPRESS_OSSMC_URL`);
  }
}
