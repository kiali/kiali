import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import WorkloadListContainer from './WorkloadListComponent';
import * as WorkloadListFilters from './FiltersAndSorts';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
      </Breadcrumb>
      <WorkloadListContainer
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default WorkloadListPage;
