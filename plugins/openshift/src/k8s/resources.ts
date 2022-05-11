import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

// TODO: Use utility when available in the SDK.
export const referenceFor = (group: string, version: string, kind: string) =>
  `${group}~${version}~${kind}`;

const groupVersionKindForObj = (obj: K8sResourceCommon) => {
  const [group, version] = obj.apiVersion.split('/');
  return { group, version, kind: obj.kind };
};

export const referenceForObj = (obj: K8sResourceCommon) => {
  const { group, version, kind } = groupVersionKindForObj(obj);
  return referenceFor(group, version, kind);
};
