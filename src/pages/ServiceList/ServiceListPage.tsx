import * as React from 'react';
import ServiceListContainer from '../../pages/ServiceList/ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import * as ServiceListFilters from './FiltersAndSorts';

const ServiceListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Services</Breadcrumb.Item>
      </Breadcrumb>
      <ServiceListContainer
        currentSortField={FilterHelper.currentSortField(ServiceListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default ServiceListPage;
