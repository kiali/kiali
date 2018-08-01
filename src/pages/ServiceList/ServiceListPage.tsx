import * as React from 'react';
import ServiceListComponent, { defaultRateInterval, perPageOptions, sortFields } from './ServiceListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';

type ServiceListState = {};

type ServiceListProps = {
  // none yet
};

class ServiceListPage extends ListPage.Component<ServiceListProps, ServiceListState> {
  currentPagination() {
    return {
      page: parseInt(this.getQueryParam('page', ['1'])[0], 10),
      perPage: parseInt(this.getQueryParam('perPage', [perPageOptions[1].toString(10)])[0], 10),
      perPageOptions: [5, 10, 15]
    };
  }

  isCurrentSortAscending() {
    return this.getQueryParam('direction', ['asc'])[0] === 'asc' ? true : false;
  }

  currentRateInterval() {
    return parseInt(this.getQueryParam('rate', [defaultRateInterval.toString(10)])[0], 10);
  }

  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort', [sortFields[0].param]);
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
          onError={this.handleError}
          onParamChange={this.onParamChange}
          onParamDelete={this.onParamDelete}
          queryParam={this.getQueryParam}
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
