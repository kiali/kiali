import React from 'react';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  resetSettings: () => void;
};

type MeshResetProps = ReduxProps;

const resetStyle = kialiStyle({
  marginLeft: '0.5rem',
  alignSelf: 'center'
});

const MeshResetComponent: React.FC<MeshResetProps> = (props: MeshResetProps) => {
  const { t } = useKialiTranslation();

  const onReset = (): void => {
    props.resetSettings();
  };

  return (
    <Tooltip key="factory_reset_settings" position="bottom" content="Reset to factory settings">
      <Button
        id="mesh-factory-reset"
        className={resetStyle}
        variant={ButtonVariant.link}
        onClick={() => onReset()}
        isInline
      >
        <KialiIcon.ResetSettings />
        <span style={{ marginLeft: '5px' }}>{t('Reset')}</span>
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
