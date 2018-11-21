import * as React from 'react';
import { NA, getRequestErrorsStatus, RequestHealth } from '../../types/Health';

type ErrorRateProps = {
  requestHealth: RequestHealth;
};

export default class ErrorRate extends React.Component<ErrorRateProps> {
  render() {
    return (
      <>
        <strong>Error Rate: </strong>
        {this.errorRateIndicator()}
      </>
    );
  }

  private errorRateIndicator = () => {
    const ratio = getRequestErrorsStatus(this.props.requestHealth.errorRatio);
    return ratio.status === NA ? 'No requests' : ratio.value.toFixed(2) + '%';
  };
}
