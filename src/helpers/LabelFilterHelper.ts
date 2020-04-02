import { AppListItem } from '../types/AppList';
import { WorkloadListItem } from '../types/Workload';
import { ServiceListItem } from '../types/ServiceList';

type itemsType = AppListItem | ServiceListItem | WorkloadListItem;

export const filterByLabel = (items: itemsType[], filter: string[]): itemsType[] => {
  let result: itemsType[] = [];
  filter.map(filter => {
    if (filter.includes(':')) {
      const values = filter.split(':');
      // Check Values
      values[1]
        .split(',')
        .map(
          val =>
            (result = result.concat(
              items.filter(
                item =>
                  values[0] in item.labels &&
                  item.labels[values[0].trim()]
                    .split(',')
                    .some(appVal => appVal.trim().startsWith(val.trim()) && !result.includes(item))
              )
            ))
        );
    } else {
      // Check if has Label
      result = result.concat(
        items.filter(item =>
          Object.keys(item.labels).some(key => key.startsWith(filter.trim()) && !result.includes(item))
        )
      );
    }
    return null;
  });

  return filter.length > 0 ? result : items;
};
