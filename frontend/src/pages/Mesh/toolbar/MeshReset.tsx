import * as React from 'react';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  resetSettings: () => void;
};

type MeshResetProps = ReduxProps;

const MeshResetComponent: React.FC<MeshResetProps> = (props: MeshResetProps) => {
  const { t } = useKialiTranslation();

  const onReset = (): void => {
    props.resetSettings();
  };

  return (
    <Tooltip key="factory_reset_settings" position="bottom" content="Reset to factory settings">
      <Button
        id="mesh-factory-reset"
        icon={<KialiIcon.ResetSettings />}
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
    resetSettings: bindActionCreators(MeshToolbarActions.resetSettings, dispatch)
  };
};

export const MeshReset = connect(null, mapDispatchToProps)(MeshResetComponent);
