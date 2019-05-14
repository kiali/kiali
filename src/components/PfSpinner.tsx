import React from 'react';
import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import { Spinner } from 'patternfly-react';
import { style } from 'typestyle';

type PfSpinnerProps = {
  isLoading: boolean;
};

const spinnerStyle = style({
  position: 'absolute',
  left: 240,
  top: 25
});

const mapStateToProps = (state: KialiAppState) => ({
  isLoading: state.globalState.loadingCounter > 0
});

export const PfSpinner: React.SFC<PfSpinnerProps> = props => {
  const { isLoading } = props;
  // It is more than likely it won't have any children; but it could.
  // @todo: Patternfly Spinner is not working here
  return <Spinner className={spinnerStyle} loading={isLoading} inverse={true} />;
};

// hook up to Redux for our State to be mapped to props
const PfSpinnerContainer = connect(
  mapStateToProps,
  null
)(PfSpinner);
export default PfSpinnerContainer;
