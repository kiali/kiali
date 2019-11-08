import * as React from 'react';
import ServiceListContainer from '../../pages/ServiceList/ServiceListComponent';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import * as ServiceListFilters from './FiltersAndSorts';

const ServiceListPage: React.SFC<{}> = () => {
  return (
    <RenderContent>
      <ServiceListContainer
        currentSortField={FilterHelper.currentSortField(ServiceListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </RenderContent>
  );
};

export default ServiceListPage;
