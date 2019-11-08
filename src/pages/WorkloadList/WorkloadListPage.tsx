import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import WorkloadListContainer from './WorkloadListComponent';
import * as WorkloadListFilters from './FiltersAndSorts';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <RenderContent>
      <WorkloadListContainer
        currentSortField={FilterHelper.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </RenderContent>
  );
};

export default WorkloadListPage;
