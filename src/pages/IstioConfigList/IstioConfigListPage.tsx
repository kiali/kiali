import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as IstioConfigListFilters from './FiltersAndSorts';
import IstioConfigListContainer from './IstioConfigListComponent';

const IstioConfigListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
      </Breadcrumb>
      <IstioConfigListContainer
        currentSortField={FilterHelper.currentSortField(IstioConfigListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default IstioConfigListPage;
