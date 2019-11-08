import * as React from 'react';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { RenderContent } from '../../components/Nav/Page';
import AppListContainer from './AppListComponent';
import * as AppListFilters from './FiltersAndSorts';

const AppListPage: React.SFC<{}> = () => {
  return (
    <RenderContent>
      <AppListContainer
        currentSortField={FilterHelper.currentSortField(AppListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
      />
    </RenderContent>
  );
};

export default AppListPage;
