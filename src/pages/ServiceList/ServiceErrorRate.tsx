import * as React from 'react';
import { NA, getRequestErrorsRatio } from '../../utils/Health';
import { RequestHealth } from '../../types/Health';

type ServiceErrorRateProps = {
  requestHealth: RequestHealth;
};

export default class ServiceErrorRate extends React.Component<ServiceErrorRateProps> {
  render() {
    return (
      <>
        <strong>Error Rate: </strong>
        {this.errorRateIndicator()}
      </>
    );
  }

  private errorRateIndicator = () => {
    const ratio = getRequestErrorsRatio(this.props.requestHealth);
    return ratio.status === NA ? 'No requests' : ratio.value.toFixed(2) + '%';
  };
}
