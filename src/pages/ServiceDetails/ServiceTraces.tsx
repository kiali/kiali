import * as React from 'react';
import { JaegerIntegration } from '../../components/JaegerIntegration';

interface ServiceTracesProps {
  namespace: string;
  service: string;
  errorTags?: boolean;
}

class ServiceTraces extends React.Component<ServiceTracesProps> {
  render() {
    const serviceSelected = `${this.props.service}.${this.props.namespace}`;
    const tags = this.props.errorTags ? 'error=true' : '';
    return <JaegerIntegration serviceSelected={serviceSelected} tagsValue={tags} disableSelectorNs={true} />;
  }
}

export default ServiceTraces;
