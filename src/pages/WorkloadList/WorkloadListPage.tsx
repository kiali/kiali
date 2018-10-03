import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import WorkloadListComponent from './WorkloadListComponent';
import { WorkloadListFilters } from './FiltersAndSorts';
import { WorkloadListItem } from '../../types/Workload';

type WorkloadListState = {};
type WorkloadListProps = {};

class WorkloadListPage extends ListPage.Component<WorkloadListProps, WorkloadListState, WorkloadListItem> {
  sortFields() {
    return WorkloadListFilters.sortFields;
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
        </Breadcrumb>
        <WorkloadListComponent
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

export default WorkloadListPage;
