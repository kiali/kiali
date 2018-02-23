import * as React from 'react';
import { Paginator } from 'patternfly-react';

type ServicePaginationProps = {};

const demoPagination = { page: 1, perPage: 10, perPageOptions: [5, 10, 15] };
const demoMessages = {
  firstPage: 'First Page',
  previousPage: 'Previous Page',
  currentPage: 'Current Page'
};

class ServicePagination extends React.Component<ServicePaginationProps> {
  constructor(props: ServicePaginationProps) {
    super(props);
    this.onPageSet = this.onPageSet.bind(this);
    this.onPageSelect = this.onPageSelect.bind(this);
  }

  onPageSet(e: any) {
    console.log('onPageSet ' + e);
  }

  onPageSelect(e: any) {
    console.log('onPageSelect ' + e);
  }

  render() {
    return (
      <div>
        <Paginator
          viewType="list"
          pagination={demoPagination}
          itemCount={75}
          onPageSet={this.onPageSet}
          onPerPageSelect={this.onPageSelect}
          messages={demoMessages}
        />
      </div>
    );
  }
}

export default ServicePagination;
