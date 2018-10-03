import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import { ServiceListFilters } from './FiltersAndSorts';
import { ServiceListItem } from '../../types/ServiceList';

type ServiceListState = {};
type ServiceListProps = {};

class ServiceListPage extends ListPage.Component<ServiceListProps, ServiceListState, ServiceListItem> {
  sortFields() {
    return ServiceListFilters.sortFields;
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Services</Breadcrumb.Item>
        </Breadcrumb>
        <ServiceListComponent
          pageHooks={this}
          pagination={this.currentPagination()}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
          rateInterval={this.currentDuration()}
        />
      </>
    );
  }
}

export default ServiceListPage;
