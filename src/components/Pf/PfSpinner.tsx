import React from 'react';

type PfSpinnerProps = {
  // none yet
};

const PfSpinner: React.SFC<PfSpinnerProps> = props => {
  // It is more than likely it won't have any children; but it could.
  return <div className="spinner spinner-sm left-spinner">{props.children}</div>;
};

export default PfSpinner;
