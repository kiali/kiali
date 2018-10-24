import * as React from 'react';
import IstioConfigListComponent from './IstioConfigListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import { IstioConfigListFilters } from './FiltersAndSorts';

const IstioConfigListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
      </Breadcrumb>
      <IstioConfigListComponent
        pagination={ListPage.currentPagination()}
        currentSortField={ListPage.currentSortField(IstioConfigListFilters.sortFields)}
        isSortAscending={ListPage.isCurrentSortAscending()}
      />
    </>
  );
};

export default IstioConfigListPage;
