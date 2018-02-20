import axios from 'axios';
import { config } from '../config';

export function newRequest(method: string, values: any, queryParams: any, data: any) {
  var endpoint = config().backend.endpoints[method] || null;
  if (endpoint) {
    var url = transformURL(endpoint.path, values);
    return new Promise((resolve, reject) => {
      axios({
        method: endpoint.method.toLowerCase(),
        url: url,
        data: data,
        headers: {},
        params: queryParams,
        auth: auth(config().backend.user, config().backend.password)
      })
        .then(response => {
          resolve(response);
        })
        .catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`[${error.response.status}] ${error.response.statusText}`);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log(`Request send but not response: ${error}`);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log(`Error in Request: ${error.message}`);
          }
          console.error(`[${error.config.method}][${error.config.url}]${error}`);
          reject(new Error(error));
        });
    });
  }
  return new Promise((resolve, reject) => {
    reject(new Error('Endpoint not defined in config file'));
  });
}

function transformURL(url: string, values: any) {
  var newURL = url;
  for (let key of Object.keys(values)) {
    newURL = newURL.replace(new RegExp('<' + key + '>', 'g'), values[key]);
  }
  return newURL;
}

function auth(user: string, pass: string) {
  return {
    username: user,
    password: pass
  };
}
