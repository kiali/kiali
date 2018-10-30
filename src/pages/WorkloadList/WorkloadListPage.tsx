import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import WorkloadListComponent from './WorkloadListComponent';
import { WorkloadListFilters } from './FiltersAndSorts';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
      </Breadcrumb>
      <WorkloadListComponent
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
        rateInterval={ListPagesHelper.currentDuration()}
      />
    </>
  );
};

export default WorkloadListPage;
