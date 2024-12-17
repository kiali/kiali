import * as React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';
import { NamespaceDropdown } from '../Dropdown/NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { PFColors } from 'components/Pf/PfColors';
import { kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { WIZARD_TITLES } from 'components/IstioWizards/WizardActions';

const titles = ['applications', 'istio', 'istio/new', 'namespaces', 'mesh', 'services', 'workloads'];

type ReduxProps = {
  istioAPIEnabled: boolean;
};

type Props = ReduxProps & {
  actionsToolbar?: JSX.Element;
  hideNamespaceSelector?: boolean;
  rightToolbar?: JSX.Element;
  showClusterSelector?: boolean;
};

const containerStyle = kialiStyle({
  padding: '0.625rem 1.25rem 0.625rem 1.25rem',
  backgroundColor: PFColors.BackgroundColor100,
  borderBottom: `1px solid ${PFColors.BorderColor100}`
});

const flexStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = kialiStyle({
  marginLeft: 'auto'
});

const actionsToolbarStyle = kialiStyle({
  marginLeft: 'auto',
  paddingTop: '1.25rem'
});

const DefaultSecondaryMastheadComponent: React.FC<Props> = (props: Props) => {
  const showTitle = (): { disabled: boolean; title: React.ReactNode } => {
    let path = window.location.pathname;

    path = path.substring(path.lastIndexOf('/console') + '/console'.length + 1);

    if (titles.some(t => path.startsWith(t))) {
      let title = `${path.charAt(0).toUpperCase()}${path.slice(1)}`;

      let disabled = false;

      if (path.startsWith('istio/new/')) {
        const objectType = kindToStringIncludeK8s(path.substring(10), path.substring(path.lastIndexOf('/') + 1));
        title = `Create ${objectType}`;
      } else if (path.includes('wizard')) {
        const objectType = WIZARD_TITLES[path.substring(path.lastIndexOf('/') + 1)];
        title = `Create ${objectType}`;
      } else if (path === 'istio') {
        title = 'Istio Config';
      } else if (path === 'mesh') {
        title = 'Clusters';
      }

      return {
        title: (
          <>
            <Title headingLevel="h1" size={TitleSizes['3xl']} style={{ margin: '1rem 0 0.5rem' }}>
              {title}
            </Title>

            {!props.istioAPIEnabled && path.startsWith('istio/new/') && (
              <div>
                <KialiIcon.Warning /> <b>Istio API is disabled.</b> Be careful when creating the configuration as the
                Istio config validations are disabled when the Istio API is disabled.
              </div>
            )}
          </>
        ),
        disabled: disabled
      };
    }

    return { title: undefined, disabled: false };
  };

  const { title, disabled } = showTitle();

  return (
    <div className={containerStyle}>
      <div className={flexStyle}>
        <div>{props.hideNamespaceSelector === true ? null : <NamespaceDropdown disabled={disabled} />}</div>

        {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
      </div>

      <div className={flexStyle}>
        <div>{title}</div>

        {props.actionsToolbar && <div className={actionsToolbarStyle}>{props.actionsToolbar}</div>}
      </div>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

export const DefaultSecondaryMasthead = connect(mapStateToProps)(DefaultSecondaryMastheadComponent);
