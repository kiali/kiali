import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import { ServiceListFilters } from './FiltersAndSorts';

const ServiceListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Services</Breadcrumb.Item>
      </Breadcrumb>
      <ServiceListComponent
        pagination={ListPage.currentPagination()}
        currentSortField={ListPage.currentSortField(ServiceListFilters.sortFields)}
        isSortAscending={ListPage.isCurrentSortAscending()}
        rateInterval={ListPage.currentDuration()}
      />
    </>
  );
};

export default ServiceListPage;
