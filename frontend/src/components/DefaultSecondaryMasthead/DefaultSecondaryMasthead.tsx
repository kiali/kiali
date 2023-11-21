import React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';
import { NamespaceDropdown } from '../NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { PFColors } from 'components/Pf/PfColors';

const titles = ['applications', 'istio', 'istio/new', 'mesh', 'services', 'workloads'];

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
  padding: '10px 20px 10px 20px',
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
  paddingTop: '17px'
});

class DefaultSecondaryMastheadComponent extends React.Component<Props> {
  showTitle() {
    let path = window.location.pathname;
    path = path.substring(path.lastIndexOf('/console') + '/console'.length + 1);
    if (titles.some(t => path.startsWith(t))) {
      let title = path.charAt(0).toUpperCase() + path.slice(1);
      let disabled = false;
      if (path.startsWith('istio/new/')) {
        // 'istio/new/'.length() == 10
        const objectType = path.substring(10);
        title = $t('Create') + ' ' + objectType;
      } else if (path === 'istio') {
        title = $t('Istio Config');
      } else if (path === 'mesh') {
        title = $t('Clusters');
      }
      return {
        title: (
          <>
            <Title headingLevel="h1" size={TitleSizes['3xl']} style={{ margin: '15px 0 11px' }}>
              {title}
            </Title>
            {!this.props.istioAPIEnabled && path.startsWith('istio/new/') && (
              <div>
                <KialiIcon.Warning /> <b>{$t('tip10', 'Istio API is disabled.')}</b>{' '}
                {$t(
                  'tip168',
                  'Be careful when creating the configuration as the Istio config validations are disabled when the Istio API is disabled.'
                )}
              </div>
            )}
          </>
        ),
        disabled: disabled
      };
    }

    return { title: undefined, disabled: false };
  }

  render() {
    const { title, disabled } = this.showTitle();
    return (
      <div className={containerStyle}>
        <div className={flexStyle}>
          <div>{this.props.hideNamespaceSelector === true ? null : <NamespaceDropdown disabled={disabled} />}</div>
          {this.props.rightToolbar && <div className={rightToolbarStyle}>{this.props.rightToolbar}</div>}
        </div>
        <div className={flexStyle}>
          <div>{title}</div>
          {this.props.actionsToolbar && <div className={actionsToolbarStyle}>{this.props.actionsToolbar}</div>}
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

export const DefaultSecondaryMasthead = connect(mapStateToProps)(DefaultSecondaryMastheadComponent);
