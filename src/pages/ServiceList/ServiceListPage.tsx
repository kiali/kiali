import * as React from 'react';
import ServiceListComponent, { sortFields } from './ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';

type ServiceListState = {};

type ServiceListProps = {
  // none yet
};

class ServiceListPage extends ListPage.Component<ServiceListProps, ServiceListState> {
  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort') || [sortFields[0].param];
    return (
      sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || sortFields[0]
    );
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
          rateInterval={this.currentRateInterval()}
        />
      </>
    );
  }
}

export default ServiceListPage;
