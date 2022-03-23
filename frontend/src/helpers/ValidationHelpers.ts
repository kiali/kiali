// Kubernetes ID validation helper, used to allow mark a warning in the form edition
const k8sRegExpName = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
export const isValidK8SName = (name: string) => {
  return name === '' ? false : name.search(k8sRegExpName) === 0;
};

const regExpRequestHeaders = /^request\.headers\[.*\]$/;
export const isValidRequestHeaderName = (name: string) => {
  return name === '' ? false : name.search(regExpRequestHeaders) === 0;
};
