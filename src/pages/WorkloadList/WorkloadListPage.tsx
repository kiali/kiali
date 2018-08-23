import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import WorkloadListComponent from './WorkloadListComponent';
import { defaultRateInterval, perPageOptions } from '../ServiceList/ServiceListComponent';
import { WorkloadListFilters } from './FiltersAndSorts';

type WorkloadListState = {};

type WorkloadListProps = {
  // none yet
};

export interface SortField {
  id: string;
  title: string;
  isNumeric: boolean;
  param: string;
}

class WorkloadListPage extends ListPage.Component<WorkloadListProps, WorkloadListState> {
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

  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort', [WorkloadListFilters.sortFields[0].param]);
    return (
      WorkloadListFilters.sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || WorkloadListFilters.sortFields[0]
    );
  }

  currentRateInterval() {
    return parseInt(this.getQueryParam('rate', [defaultRateInterval.toString(10)])[0], 10);
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
        </Breadcrumb>
        <WorkloadListComponent
          onError={this.handleError}
          pagination={this.currentPagination()}
          onParamChange={this.onParamChange}
          queryParam={this.getQueryParam}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
          rateInterval={this.currentRateInterval()}
        />
      </>
    );
  }
}

export default WorkloadListPage;
