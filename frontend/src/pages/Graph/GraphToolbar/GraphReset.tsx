import * as React from 'react';
import { GraphToolbarActions } from 'actions/GraphToolbarActions';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  resetSettings: () => void;
};

type GraphResetProps = ReduxProps & {};

const GraphResetComponent: React.FC<GraphResetProps> = (props: GraphResetProps) => {
  const { t } = useKialiTranslation();

  const onReset = (): void => {
    props.resetSettings();
  };

  return (
    <Tooltip key="factory_reset_settings" position="bottom" content="Reset to factory settings">
      <Button
        icon={<KialiIcon.ResetSettings />}
        id="graph-factory-reset"
        variant={ButtonVariant.link}
        onClick={() => onReset()}
      >
        <span>{t('Reset')}</span>
      </Button>
    </Tooltip>
  );
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxProps => {
  return {
    resetSettings: bindActionCreators(GraphToolbarActions.resetSettings, dispatch)
  };
};

export const GraphReset = connect(null, mapDispatchToProps)(GraphResetComponent);
