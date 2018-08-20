import { Pod, Reference, ContainerInfo } from '../../../types/IstioObjects';

export interface PodsGroup {
  commonPrefix: string;
  names: string[];
  commonLabels: { [key: string]: string };
  createdAtStart: number;
  createdAtEnd: number;
  createdBy: Reference[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
  numberOfPods: number;
}

const groupKey = (pod: Pod): string => {
  return JSON.stringify({
    cb: pod.createdBy.map(ref => ref.name).join(','),
    ic: pod.istioContainers ? pod.istioContainers.map(ctnr => ctnr.name + ctnr.image).join(',') : '',
    iic: pod.istioInitContainers ? pod.istioInitContainers.map(ctnr => ctnr.name + ctnr.image).join(',') : ''
  });
};

const commonPrefix = (s1: string, s2: string): string => {
  let i = 0;
  while (i < s1.length && i < s2.length && s1.charAt(i) === s2.charAt(i)) {
    i++;
  }
  return s1.substring(0, i);
};

const mergeInGroup = (group: PodsGroup, pod: Pod) => {
  group.names.push(pod.name);
  // Update common prefix
  group.commonPrefix = commonPrefix(group.commonPrefix, pod.name);
  // Remove any group.commonLabels that is not found in pod
  Object.keys(group.commonLabels).map(key => {
    const val = group.commonLabels[key];
    if (!pod.labels || val !== pod.labels[key]) {
      delete group.commonLabels[key];
    }
  });
  // Update start/end timestamps
  const podTimestamp = new Date(pod.createdAt).getTime();
  if (podTimestamp < group.createdAtStart) {
    group.createdAtStart = podTimestamp;
  } else if (podTimestamp > group.createdAtEnd) {
    group.createdAtEnd = podTimestamp;
  }
  group.numberOfPods++;
};

export const groupPods = (pods: Pod[]): PodsGroup[] => {
  const allGroups = new Map<string, PodsGroup>();
  pods.forEach(pod => {
    const key = groupKey(pod);
    if (allGroups.has(key)) {
      const group = allGroups.get(key)!;
      mergeInGroup(group, pod);
    } else {
      // Make a copy of the labels. This object might be modified later, so do not use the original reference.
      const labels: { [key: string]: string } = {};
      if (pod.labels) {
        Object.keys(pod.labels).map(k => {
          labels[k] = pod.labels![k];
        });
      }
      const timestamp = new Date(pod.createdAt).getTime();
      allGroups.set(key, {
        commonPrefix: pod.name,
        names: [pod.name],
        commonLabels: labels,
        createdAtStart: timestamp,
        createdAtEnd: timestamp,
        createdBy: pod.createdBy,
        istioContainers: pod.istioContainers,
        istioInitContainers: pod.istioInitContainers,
        numberOfPods: 1
      });
    }
  });
  return Array.from(allGroups.values()).sort((a, b) => a.commonPrefix.localeCompare(b.commonPrefix));
};
