import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import WorkloadListContainer from './WorkloadListComponent';
import * as WorkloadListFilters from './FiltersAndSorts';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Workloads</Breadcrumb.Item>
      </Breadcrumb>
      <WorkloadListContainer
        currentSortField={FilterHelper.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default WorkloadListPage;
