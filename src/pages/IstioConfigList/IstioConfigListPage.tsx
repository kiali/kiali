import * as React from 'react';
import IstioConfigListComponent from '../../containers/IstioConfigListComponentContainer';
import { Breadcrumb } from 'patternfly-react';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { IstioConfigListFilters } from './FiltersAndSorts';

const IstioConfigListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
      </Breadcrumb>
      <IstioConfigListComponent
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(IstioConfigListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default IstioConfigListPage;
