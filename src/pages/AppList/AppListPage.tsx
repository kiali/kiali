import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import AppListContainer from './AppListComponent';
import * as AppListFilters from './FiltersAndSorts';
import { Breadcrumb, BreadcrumbItem, Title } from '@patternfly/react-core';

const AppListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb style={{ margin: '10px 0px 10px 0px' }}>
        <BreadcrumbItem isActive={true}>
          <Title headingLevel="h4" size="xl">
            Applications
          </Title>
        </BreadcrumbItem>
      </Breadcrumb>
      <AppListContainer
        currentSortField={FilterHelper.currentSortField(AppListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default AppListPage;
