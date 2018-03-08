const fs = require('fs');

export const GetNamespaces = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(`./src/services/__mockData__/getNamespaces.json`, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve(JSON.parse(data));
      }
    });
  });
};

export const GetServices = (namespace: String) => {
  return new Promise((resolve, reject) => {
    fs.readFile(`./src/services/__mockData__/getServices.json`, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve(JSON.parse(data));
      }
    });
  });
};

export const getGrafanaInfo = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(`./src/services/__mockData__/getGrafanaInfo.json`, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve(JSON.parse(data));
      }
    });
  });
};

export const GetGraphElements = (namespace: String, params: any) => {
  return new Promise((resolve, reject) => {
    fs.readFile(`./src/services/__mockData__/getGraphElements.json`, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve(JSON.parse(data));
      }
    });
  });
};

export const GetServiceDetail = (namespace: String, service: String) => {
  return new Promise((resolve, reject) => {
    fs.readFile(`./src/services/__mockData__/getServiceDetail.json`, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve(JSON.parse(data));
      }
    });
  });
};
