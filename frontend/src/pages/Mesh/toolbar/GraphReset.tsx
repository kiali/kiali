import React from 'react';
import { GraphToolbarActions } from 'actions/GraphToolbarActions';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

type ReduxProps = {
  resetSettings: () => void;
};

type GraphResetProps = ReduxProps & {};

const resetStyle = kialiStyle({
  marginLeft: '0.5rem',
  alignSelf: 'center'
});

const GraphResetComponent: React.FC<GraphResetProps> = (props: GraphResetProps) => {
  const onReset = (): void => {
    props.resetSettings();
  };

  return (
    <Tooltip key="factory_reset_settings" position="bottom" content="Reset to factory settings">
      <Button
        id="graph-factory-reset"
        className={resetStyle}
        variant={ButtonVariant.link}
        onClick={() => onReset()}
        isInline
      >
        <KialiIcon.ResetSettings />
        <span style={{ marginLeft: '5px' }}>Reset</span>
      </Button>
    </Tooltip>
  );
};

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    resetSettings: bindActionCreators(GraphToolbarActions.resetSettings, dispatch)
  };
};

export const GraphReset = connect(null, mapDispatchToProps)(GraphResetComponent);
