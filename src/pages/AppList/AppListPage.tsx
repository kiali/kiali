import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import AppListContainer from './AppListComponent';
import * as AppListFilters from './FiltersAndSorts';

const AppListPage: React.SFC<{}> = () => {
  return (
    <>
      <Breadcrumb title={true}>
        <Breadcrumb.Item active={true}>Applications</Breadcrumb.Item>
      </Breadcrumb>
      <AppListContainer
        pagination={ListPagesHelper.currentPagination()}
        currentSortField={ListPagesHelper.currentSortField(AppListFilters.sortFields)}
        isSortAscending={ListPagesHelper.isCurrentSortAscending()}
      />
    </>
  );
};

export default AppListPage;
