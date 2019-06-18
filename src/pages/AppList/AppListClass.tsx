import * as React from 'react';
import { Link } from 'react-router-dom';
import { ListViewIcon, ListViewItem } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';
import { AppList, AppListItem } from '../../types/AppList';
import * as API from '../../services/Api';
import ItemDescription from './ItemDescription';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: data.namespace.name,
      name: app.name,
      istioSidecar: app.istioSidecar,
      healthPromise: API.getAppHealth(data.namespace.name, app.name, rateInterval, app.istioSidecar)
    }));
  }
  return [];
};

export const appLink = (namespace: string, app: string): string => {
  return `/namespaces/${namespace}/applications/${app}`;
};

export const renderAppListItem = (appItem: AppListItem, index: number): React.ReactElement<{}> => {
  const object = appItem;
  const iconName = 'applications';
  const iconType = 'pf';
  const heading = (
    <div className="ServiceList-Heading">
      <div className="ServiceList-Title">
        {object.name}
        <small>{object.namespace}</small>
      </div>
    </div>
  );
  const content = (
    <ListViewItem
      leftContent={<ListViewIcon type={iconType} name={iconName} />}
      key={'appItemItemView_' + index + '_' + object.namespace + '_' + object.name}
      heading={heading}
      // Prettier makes irrelevant line-breaking clashing with tslint
      // prettier-ignore
      description={<ItemDescription item={appItem} />}
    />
  );
  return (
    <Link
      key={'appItemItem_' + index + '_' + object.namespace + '_' + object.name}
      to={appLink(object.namespace, object.name)}
      style={{ color: PfColors.Black }}
    >
      {content}
    </Link>
  );
};
