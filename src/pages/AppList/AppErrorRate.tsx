import * as React from 'react';
import { NA, getRequestErrorsRatio, RequestHealth } from '../../types/Health';

type AppErrorRateProps = {
  requestHealth: RequestHealth;
};

export default class AppErrorRate extends React.Component<AppErrorRateProps> {
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
