import * as React from 'react';
import ServiceId from '../../types/ServiceId';

class ServiceMetrics extends React.Component<ServiceId> {
  constructor(props: ServiceId) {
    super(props);
  }

  render() {
    return (
      <div>
        == SERVICE METRICS ({this.props.namespace} / {this.props.service}) ==
      </div>
    );
  }
}

export default ServiceMetrics;
