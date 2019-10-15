import * as React from 'react';
import ServiceListContainer from '../../pages/ServiceList/ServiceListComponent';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as ServiceListFilters from './FiltersAndSorts';
import { Breadcrumb, BreadcrumbItem, Title } from '@patternfly/react-core';

const ServiceListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb style={{ margin: '10px 0px 10px 0px' }}>
        <BreadcrumbItem isActive={true}>
          <Title headingLevel="h4" size="xl">
            Services
          </Title>
        </BreadcrumbItem>
      </Breadcrumb>
      <ServiceListContainer
        currentSortField={FilterHelper.currentSortField(ServiceListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default ServiceListPage;
