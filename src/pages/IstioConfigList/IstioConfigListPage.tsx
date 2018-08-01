import * as React from 'react';
import IstioConfigListComponent, { sortFields } from './IstioConfigListComponent';
import { Breadcrumb } from 'patternfly-react';
import { ListPage } from '../../components/ListPage/ListPage';
import { perPageOptions } from '../ServiceList/ServiceListComponent';

type IstioConfigListState = {};

type IstioConfigListProps = {
  // none yet
};

class IstioConfigListPage extends ListPage.Component<IstioConfigListProps, IstioConfigListState> {
  currentPagination() {
    return {
      page: parseInt(this.getQueryParam('page', ['1'])[0], 10),
      perPage: parseInt(this.getQueryParam('perPage', [perPageOptions[1].toString(10)])[0], 10),
      perPageOptions: [5, 10, 15]
    };
  }

  isCurrentSortAscending() {
    return this.getQueryParam('direction', ['asc'])[0] === 'asc' ? true : false;
  }

  currentSortField() {
    const queriedSortedField = this.getQueryParam('sort', [sortFields[0].param]);
    return (
      sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || sortFields[0]
    );
  }

  render() {
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
        </Breadcrumb>
        <IstioConfigListComponent
          onError={this.handleError}
          onParamChange={this.onParamChange}
          onParamDelete={this.onParamDelete}
          queryParam={this.getQueryParam}
          pagination={this.currentPagination()}
          currentSortField={this.currentSortField()}
          isSortAscending={this.isCurrentSortAscending()}
        />
      </>
    );
  }
}

export default IstioConfigListPage;
