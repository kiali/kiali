import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';
import * as MessageCenter from '../../utils/MessageCenter';

type ServiceListState = {};

type ServiceListProps = {
  // none yet
};

class ServiceListPage extends React.Component<ServiceListProps, ServiceListState> {
  handleError = (error: string) => {
    MessageCenter.add(error);
  };

  render() {
    return (
      <>
        <h2>Services</h2>
        <ServiceListComponent onError={this.handleError} />
      </>
    );
  }
}

export default ServiceListPage;
