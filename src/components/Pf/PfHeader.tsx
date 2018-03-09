import React from 'react';

type PfHeaderProps = {
  // none yet
};

const PfHeader: React.SFC<PfHeaderProps> = props => {
  return <div className="page-header">{props.children}</div>;
};

export default PfHeader;
