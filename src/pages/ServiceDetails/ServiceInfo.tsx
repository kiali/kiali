import * as React from 'react';
import ServiceId from '../../types/ServiceId';

class ServiceInfo extends React.Component<ServiceId> {
  constructor(props: ServiceId) {
    super(props);
  }

  render() {
    return (
      <div>
        == SERVICE INFO ({this.props.namespace} / {this.props.service}) ==
      </div>
    );
  }
}

export default ServiceInfo;
