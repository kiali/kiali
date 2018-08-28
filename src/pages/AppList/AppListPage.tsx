import * as React from 'react';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import AppListComponent from './AppListComponent';
import { defaultRateInterval, perPageOptions } from '../ServiceList/ServiceListComponent';
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
  currentPagination() {
    return {
      page: parseInt(this.getQueryParam('page', ['1'])[0], 10),
      perPage: parseInt(this.getQueryParam('perPage', [perPageOptions[1].toString(10)])[0], 10),
      perPageOptions: [5, 10, 15]
    };
  }

  isCurrentSortAscending() {
    return this.getQueryParam('direction', ['asc'])[0] === 'asc';
  }

  currentRateInterval() {
    return parseInt(this.getQueryParam('rate', [defaultRateInterval.toString(10)])[0], 10);
  }

  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort', [AppListFilters.sortFields[0].param]);
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
          onError={this.handleError}
          pagination={this.currentPagination()}
          onParamChange={this.onParamChange}
          queryParam={this.getQueryParam}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
          rateInterval={this.currentRateInterval()}
        />
      </>
    );
  }
}

export default AppListPage;
