import React from 'react';
import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import { style } from 'typestyle';
import { SpinnerIcon } from '@patternfly/react-icons';

type PfSpinnerProps = {
  isLoading: boolean;
};

const spinnerStyle = style({
  position: 'absolute',
  left: 210,
  top: 35,
  animation: 'rotation 1000ms infinite linear'
});

const mapStateToProps = (state: KialiAppState) => ({
  isLoading: state.globalState.loadingCounter > 0
});

export const PfSpinner: React.SFC<PfSpinnerProps> = props => {
  const { isLoading } = props;
  // It is more than likely it won't have any children; but it could.
  // @todo: Patternfly Spinner is not working here
  return isLoading ? <SpinnerIcon className={spinnerStyle} /> : <></>;
};

// hook up to Redux for our State to be mapped to props
const PfSpinnerContainer = connect(
  mapStateToProps,
  null
)(PfSpinner);
export default PfSpinnerContainer;
