import React from 'react';
import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';

type PfSpinnerProps = {
  isLoading: boolean;
};

const mapStateToProps = (state: KialiAppState) => ({
  isLoading: state.globalState.isLoading
});
export const PfSpinner: React.SFC<PfSpinnerProps> = props => {
  const { isLoading } = props;
  // It is more than likely it won't have any children; but it could.
  // @todo: Patternfly Spinner is not working here
  return isLoading ? <div className="spinner spinner-sm left-spinner">{props.children} </div> : null;
};

// hook up to Redux for our State to be mapped to props
const PfSpinnerContainer = connect(mapStateToProps, null)(PfSpinner);
export default PfSpinnerContainer;
