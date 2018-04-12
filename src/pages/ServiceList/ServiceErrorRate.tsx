import * as React from 'react';
import { ServiceItem } from '../../types/ServiceListComponent';
import { Icon } from 'patternfly-react';

const WARNING_THRESHOLD = 0.0;
const ERROR_THRESHOLD = 0.2;

type ServiceErrorRateProps = {
  service: ServiceItem;
};

export default class ServiceErrorRate extends React.Component<ServiceErrorRateProps> {
  render() {
    return (
      <>
        <strong>Error rate: </strong>
        {this.errorRateIndicator()}
        <Icon style={{ paddingLeft: '0.5em' }} type="pf" name={this.errorRateIconName()} />
      </>
    );
  }

  private errorRateIndicator = () => {
    return this.props.service.request_count > 0
      ? (this.props.service.error_rate * 100).toFixed(2) + '%'
      : '(No requests)';
  };

  private errorRateIconName = () => {
    if (this.props.service.error_rate > ERROR_THRESHOLD) {
      return 'error-circle-o';
    } else if (this.props.service.error_rate > WARNING_THRESHOLD) {
      return 'warning-triangle-o';
    }

    return 'ok';
  };
}
