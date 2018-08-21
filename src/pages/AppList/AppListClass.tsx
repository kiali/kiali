import * as React from 'react';
// import { Link } from 'react-router-dom';
import { ListViewIcon, ListViewItem } from 'patternfly-react';
import { IstioLogo } from '../../config';
// import { PfColors } from '../../components/Pf/PfColors';
import { AppList, AppListItem } from '../../types/AppList';

export namespace AppListClass {
  export const getAppItems = (data: AppList): AppListItem[] => {
    let appItems: AppListItem[] = [];
    if (data.applications) {
      data.applications.forEach(app => {
        appItems.push({
          namespace: data.namespace.name,
          name: app.name,
          istioSidecar: app.istioSidecar
        });
      });
    }
    return appItems;
  };

  export const appLink = (namespace: string, app: string): string => {
    return '';
  };

  export const renderAppListItem = (appItem: AppListItem, index: number): React.ReactElement<{}> => {
    let object = appItem;
    let iconName = 'applications';
    let iconType = 'pf';
    const heading = (
      <div className="ServiceList-Heading">
        <div className="ServiceList-IstioLogo">
          {object.istioSidecar && <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />}
        </div>
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
      />
    );
    return content;
    /* TODO enable App details link once the App details page is added
    return (
      <Link
        key={'appItemItem_' + index + '_' + object.namespace + '_' + object.name}
        to={appLink(object.namespace, object.name)}
        style={{ color: PfColors.Black }}
      >
        {content}
      </Link>
    );
    */
  };
}
