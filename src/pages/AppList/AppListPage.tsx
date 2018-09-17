import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import AppListComponent from './AppListComponent';
import { AppListFilters } from './FiltersAndSorts';

type AppListState = {};

type AppListProps = {
  // none yet
};

export interface SortField {
  id: string;
  title: string;
  isNumeric: boolean;
  param: string;
}

class AppListPage extends ListPage.Component<AppListProps, AppListState> {
  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort') || [AppListFilters.sortFields[0].param];
    return (
      AppListFilters.sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || AppListFilters.sortFields[0]
    );
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Applications</Breadcrumb.Item>
        </Breadcrumb>
        <AppListComponent
          pagination={this.currentPagination()}
          pageHooks={this}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
          rateInterval={this.currentRateInterval()}
        />
      </>
    );
  }
}

export default AppListPage;
