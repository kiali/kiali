import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import WorkloadListContainer from './WorkloadListComponent';
import * as WorkloadListFilters from './FiltersAndSorts';
import { Breadcrumb, BreadcrumbItem, Title } from '@patternfly/react-core';

const WorkloadListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb style={{ margin: '10px 0px 10px 0px' }}>
        <BreadcrumbItem isActive={true}>
          <Title headingLevel="h4" size="xl">
            Workloads
          </Title>
        </BreadcrumbItem>
      </Breadcrumb>
      <WorkloadListContainer
        currentSortField={FilterHelper.currentSortField(WorkloadListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default WorkloadListPage;
