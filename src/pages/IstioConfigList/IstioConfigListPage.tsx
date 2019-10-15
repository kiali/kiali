import * as React from 'react';
import { Breadcrumb, BreadcrumbItem, Title } from '@patternfly/react-core';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as IstioConfigListFilters from './FiltersAndSorts';
import IstioConfigListContainer from './IstioConfigListComponent';

const IstioConfigListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb style={{ margin: '10px 0px 10px 0px' }}>
        <BreadcrumbItem isActive={true}>
          <Title headingLevel="h4" size="xl">
            Istio Config
          </Title>
        </BreadcrumbItem>
      </Breadcrumb>
      <IstioConfigListContainer
        currentSortField={FilterHelper.currentSortField(IstioConfigListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default IstioConfigListPage;
