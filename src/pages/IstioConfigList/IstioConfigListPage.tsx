import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import * as IstioConfigListFilters from './FiltersAndSorts';
import IstioConfigListContainer from './IstioConfigListComponent';

const IstioConfigListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
      </Breadcrumb>
      <IstioConfigListContainer
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(IstioConfigListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default IstioConfigListPage;
