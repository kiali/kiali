import { Namespace } from '@kiali/core';

/**
 * This function is a helper to return a Namespace object given a namesoace string
 * @param {string} namespace The namespace name
 */
export const namespaceFromString = (namespace: string): Namespace => ({ name: namespace });

/**
 * This function is a helper to return an array of Namespace object given a namespaces strings separate by ',''
 * @param {string} namespaces The namespaces names separate by ','
 */
export const namespacesFromString = (namespaces: string) => {
  return namespaces.split(',').map(name => namespaceFromString(name));
};

/**
 * This function is a helper to return a string of namespaces separte by ',' given an array ob Namespace object
 * @param {Namespace[]} namespaces The namespaces aray
 */
export const namespacesToString = (namespaces: Namespace[]) => namespaces.map(namespace => namespace.name).join(',');