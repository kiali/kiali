import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import AppListComponent from './AppListComponent';
import { AppListFilters } from './FiltersAndSorts';

const AppListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Applications</Breadcrumb.Item>
      </Breadcrumb>
      <AppListComponent
        pagination={ListPage.currentPagination()}
        currentSortField={ListPage.currentSortField(AppListFilters.sortFields)}
        isSortAscending={ListPage.isCurrentSortAscending()}
        rateInterval={ListPage.currentDuration()}
      />
    </>
  );
};

export default AppListPage;
