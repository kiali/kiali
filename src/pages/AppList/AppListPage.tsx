import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import AppListContainer from './AppListComponent';
import * as AppListFilters from './FiltersAndSorts';

const AppListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Applications</Breadcrumb.Item>
      </Breadcrumb>
      <AppListContainer
        currentSortField={FilterHelper.currentSortField(AppListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default AppListPage;
