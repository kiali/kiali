import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';
import * as MessageCenter from '../../utils/MessageCenter';
import { Breadcrumb } from 'patternfly-react';

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
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Services</Breadcrumb.Item>
        </Breadcrumb>
        <ServiceListComponent onError={this.handleError} />
      </>
    );
  }
}

export default ServiceListPage;
