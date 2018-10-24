import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import WorkloadListComponent from './WorkloadListComponent';
import { WorkloadListFilters } from './FiltersAndSorts';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
      </Breadcrumb>
      <WorkloadListComponent
        pagination={ListPage.currentPagination()}
        currentSortField={ListPage.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={ListPage.isCurrentSortAscending()}
        rateInterval={ListPage.currentDuration()}
      />
    </>
  );
};

export default WorkloadListPage;
