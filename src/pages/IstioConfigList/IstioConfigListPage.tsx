import * as React from 'react';
import IstioConfigListComponent from './IstioConfigListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import { IstioConfigListFilters } from './FiltersAndSorts';
import { IstioConfigItem } from '../../types/IstioConfigList';

type IstioConfigListState = {};
type IstioConfigListProps = {};

class IstioConfigListPage extends ListPage.Component<IstioConfigListProps, IstioConfigListState, IstioConfigItem> {
  sortFields() {
    return IstioConfigListFilters.sortFields;
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
        </Breadcrumb>
        <IstioConfigListComponent
          pageHooks={this}
          pagination={this.currentPagination()}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
        />
      </>
    );
  }
}

export default IstioConfigListPage;
