import React from 'react';
import { Spinner } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { KialiAppState } from '../store/Store';

type PfSpinnerProps = {
  isLoading?: boolean;
};

const mapStateToProps = (state: KialiAppState) => ({
  isLoading: state.globalState.loadingCounter > 0
});

export const PfSpinner: React.SFC<PfSpinnerProps> = props => {
  const { isLoading } = props;
  // It is more than likely it won't have any children; but it could.
  return isLoading ? <Spinner id="loading_kiali_spinner" size={'lg'} /> : <></>;
};

// hook up to Redux for our State to be mapped to props
const PfSpinnerContainer = connect(
  mapStateToProps,
  null
)(PfSpinner);
export default PfSpinnerContainer;
