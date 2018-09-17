import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import WorkloadListComponent from './WorkloadListComponent';
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
  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort') || [WorkloadListFilters.sortFields[0].param];
    return (
      WorkloadListFilters.sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || WorkloadListFilters.sortFields[0]
    );
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
        </Breadcrumb>
        <WorkloadListComponent
          pagination={this.currentPagination()}
          pageHooks={this}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
          rateInterval={this.currentRateInterval()}
        />
      </>
    );
  }
}

export default WorkloadListPage;
