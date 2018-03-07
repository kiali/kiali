import * as React from 'react';

function SummaryPanel() {
  const panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  return (
    <div className="panel panel-default" style={panelStyle}>
      <div className="panel-heading">
        <h3 className="panel-title">Service summary</h3>
      </div>
      <div className="panel-body">
        <em>Summary details</em>
      </div>
    </div>
  );
}

export default SummaryPanel;
