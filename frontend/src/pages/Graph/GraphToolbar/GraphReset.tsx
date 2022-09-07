import React from 'react';
import { GraphToolbarActions } from 'actions/GraphToolbarActions';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { defaultIconStyle, KialiIcon } from 'config/KialiIcon';

type ReduxProps = {
  resetSettings: () => void;
};

type GraphResetProps = ReduxProps & {};

type GraphResetState = {};

class GraphReset extends React.Component<GraphResetProps, GraphResetState> {
  onReset = (): void => {
    this.props.resetSettings();
  };

  render() {
    return (
      <Tooltip key="factory_reset_settings" position="bottom" content="Reset to factory settings">
        <Button
          id="graph-factory-reset"
          style={{ paddingLeft: '10px', paddingRight: '0px' }}
          variant={ButtonVariant.link}
          onClick={() => this.onReset()}
        >
          <KialiIcon.ResetSettings className={defaultIconStyle} />
        </Button>
      </Tooltip>
    );
  }
}

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    resetSettings: bindActionCreators(GraphToolbarActions.resetSettings, dispatch)
  };
};

const GraphResetContainer = connect(null, mapDispatchToProps)(GraphReset);

export default GraphResetContainer;
