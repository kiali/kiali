/*
  This file contains helper functions for the *setup* of cypress itself.
  It contains shared functionality used by the cypress config files.
*/
import get from 'axios';
import https from 'https';

export const getAuthStrategy = async (url: string): Promise<any> => {
  try {
    const resp = await get(`${url}/api/auth/info`, {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    return resp.data.strategy;
  } catch (err) {
    let errMessage = `ERROR: ${err}.`;
    if (err.config && err.config.url) {
      errMessage += ` Kiali API is not reachable at ${JSON.stringify(err.config.url)}`;
    }
    console.error(errMessage);

    throw new Error(errMessage);
  }
};
