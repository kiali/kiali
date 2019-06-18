import * as React from 'react';
import ServiceListContainer from '../../pages/ServiceList/ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import * as ServiceListFilters from './FiltersAndSorts';

const ServiceListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Services</Breadcrumb.Item>
      </Breadcrumb>
      <ServiceListContainer
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(ServiceListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default ServiceListPage;
