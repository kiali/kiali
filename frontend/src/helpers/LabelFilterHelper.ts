import { AppListItem } from '../types/AppList';
import { WorkloadListItem } from '../types/Workload';
import { ServiceListItem } from '../types/ServiceList';
import { serverConfig } from '../config';

type itemsType = AppListItem | ServiceListItem | WorkloadListItem;

/*
 OR Operation for labels
*/
const orLabelOperation = (labels: { [key: string]: string }, filters: string[]): boolean => {
  const { keyValues, keys } = getKeyAndValues(filters);

  // Get all keys of labels
  const labelKeys = Object.keys(labels);

  // Check presence label
  let filterOkForLabel = labelKeys.filter(label => keys.some(key => label.startsWith(key))).length > 0;

  if (filterOkForLabel) {
    return true;
  }
  // Check key and value
  keyValues.map(filter => {
    const [key, value] = filter.split('=');
    // Check if multiple values
    value.split(',').map(v => {
      if (key in labels && !filterOkForLabel) {
        // Split label values for serviceList Case where we can have multiple values for a label
        filterOkForLabel = labels[key]
          .trim()
          .split(',')
          .some(labelValue => labelValue.trim().startsWith(v.trim()));
      }
      return undefined;
    });
    return undefined;
  });
  return filterOkForLabel;
};

/*
 AND Operation for labels
*/

const andLabelOperation = (labels: { [key: string]: string }, filters: string[]): boolean => {
  // We expect this label is ok for the filters with And Operation
  let filterOkForLabel = true;

  const { keyValues, keys } = getKeyAndValues(filters);

  // Get all keys of labels
  const labelKeys = Object.keys(labels);

  // Start check label presence
  keys.map(k => {
    if (!labelKeys.includes(k) && filterOkForLabel) {
      filterOkForLabel = false;
    }
    return undefined;
  });

  // If label presence is validated we continue checking with key,value
  if (filterOkForLabel) {
    keyValues.map(filter => {
      const [key, value] = filter.split('=');
      if (key in labels && filterOkForLabel) {
        // We need to check if some value of filter match
        value.split(',').map(val => {
          // Split label values for serviceList Case where we can have multiple values for a label
          if (!labels[key].split(',').some(labelVal => labelVal.trim().startsWith(val.trim()))) {
            filterOkForLabel = false;
          }
          return undefined;
        });
      } else {
        // The key is not in the labels so not match AND operation
        filterOkForLabel = false;
      }
      return undefined;
    });
  }

  return filterOkForLabel;
};

const filterLabelByOp = (labels: { [key: string]: string }, filters: string[], op = 'or'): boolean => {
  return op === 'or' ? orLabelOperation(labels, filters) : andLabelOperation(labels, filters);
};

export const filterByLabel = (items: itemsType[], filter: string[], op = 'or'): itemsType[] => {
  return filter.length === 0 ? items : items.filter(item => filterLabelByOp(item.labels, filter, op));
};

const getKeyAndValues = (filters: string[]): { keyValues: string[]; keys: string[] } => {
  // keys => List of filters with only Label Presence
  // keyValues => List of filters with Label and value
  const keys = filters.filter(f => !f.includes('='));
  const keyValues = filters.filter(f => f.includes('='));
  return { keyValues, keys };
};

export const isWaypoint = (labels: { [key: string]: string }): boolean => {
  return (
    labels &&
    serverConfig.istioLabels.ambientWaypointLabel in labels &&
    labels[serverConfig.istioLabels.ambientWaypointLabel] === serverConfig.istioLabels.ambientWaypointLabelValue
  );
};
