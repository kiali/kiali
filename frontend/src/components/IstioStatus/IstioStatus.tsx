import * as React from 'react';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { TimeInMilliseconds } from '../../types/Common';
import { ComponentStatus, Status, statusSeverity } from '../../types/IstioStatus';
import { MessageType } from '../../types/NotificationCenter';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { istioStatusSelector, namespaceItemsSelector } from '../../store/Selectors';
import { IstioStatusActions } from '../../actions/IstioStatusActions';
import { connect } from 'react-redux';
import { Content, ContentVariants, Tooltip, TooltipPosition, Label } from '@patternfly/react-core';
import { IstioStatusList } from './IstioStatusList';
import { PFColors } from '../Pf/PfColors';
import { KialiDispatch } from 'types/Redux';
import { connectRefresh } from '../Refresh/connectRefresh';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { isControlPlaneAccessible } from '../../utils/MeshUtils';
import { homeCluster } from '../../config';
import { PFBadge, PFBadges } from '../Pf/PfBadges';

export type ClusterStatusMap = { [cluster: string]: ComponentStatus[] };

type ReduxStateProps = {
  namespaces?: Namespace[];
  statusMap: ClusterStatusMap; // map of clusters to ComponentStatus[]
};

type ReduxDispatchProps = {
  setIstioStatus: (statusMap: ClusterStatusMap) => void;
};

type StatusIcons = {
  ErrorIcon?: React.ComponentClass<SVGIconProps>;
  HealthyIcon?: React.ComponentClass<SVGIconProps>;
  InfoIcon?: React.ComponentClass<SVGIconProps>;
  WarningIcon?: React.ComponentClass<SVGIconProps>;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    icons?: StatusIcons;
    lastRefreshAt: TimeInMilliseconds;
  };

const ValidToColor = {
  'true-true-true': PFColors.Danger,
  'true-true-false': PFColors.Danger,
  'true-false-true': PFColors.Danger,
  'true-false-false': PFColors.Danger,
  'false-true-true': PFColors.Warning,
  'false-true-false': PFColors.Warning,
  'false-false-true': PFColors.Info,
  'false-false-false': PFColors.Success
};

const clusterStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center'
});

export const meshLinkStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  marginTop: '0.75rem',
  $nest: {
    '& > span': {
      marginRight: '0.5rem'
    }
  }
});

const tooltipStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-tooltip__content': {
      backgroundColor: PFColors.BackgroundColor100,
      color: 'var(--pf-t--global--text--color--primary--default)'
    },
    '& .pf-v6-c-tooltip__arrow': {
      backgroundColor: PFColors.BackgroundColor100,
      $nest: {
        '&::before': {
          borderTopColor: PFColors.BackgroundColor100,
          borderBottomColor: PFColors.BackgroundColor100,
          borderLeftColor: PFColors.BackgroundColor100,
          borderRightColor: PFColors.BackgroundColor100
        }
      }
    }
  }
});

export const IstioStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  const { namespaces, setIstioStatus, lastRefreshAt } = props;

  const fetchStatus = React.useCallback((): void => {
    API.getIstioStatus()
      .then(response => {
        const statusMap: ClusterStatusMap = {};

        response.data.forEach(status => {
          if (!statusMap[status.cluster]) {
            statusMap[status.cluster] = [];
          }
          statusMap[status.cluster].push(status);
        });

        setIstioStatus(statusMap);
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = namespaces && namespaces.length < 1;

        if (informative) {
          addError(t('Istio deployment status disabled.'), error, true, MessageType.INFO);
        } else {
          addError(t('Error fetching Istio deployment status.'), error);
        }
      });
  }, [namespaces, setIstioStatus, t]);

  React.useEffect(() => {
    // retrieve status for all clusters
    fetchStatus();
  }, [pathname, lastRefreshAt, fetchStatus]);

  const getSeverity = (components: ComponentStatus[]): number =>
    Math.max(
      ...components.map(
        cs =>
          statusSeverity[cs.status] +
          (cs.isCore && statusSeverity[cs.status] !== statusSeverity[Status.Healthy] ? 10 : 0)
      )
    ); // non health core component has much higher severity

  const sortedClusters = Object.keys(props.statusMap).sort((a, b) => {
    const worstA = getSeverity(props.statusMap[a]);
    const worstB = getSeverity(props.statusMap[b]);
    return worstB - worstA;
  });

  const tooltipContent = (): React.ReactNode => {
    return (
      <Content>
        <Content component={ContentVariants.h4}>{t('Cluster Status')}</Content>
        {sortedClusters.map(cl => (
          <React.Fragment key={cl}>
            <div className={clusterStyle}>
              <PFBadge badge={PFBadges.Cluster} size="sm" />
              {cl}
              {cl === homeCluster?.name && (
                <span style={{ marginLeft: '0.25rem' }}>
                  <KialiIcon.Star />
                </span>
              )}
            </div>
            <IstioStatusList status={props.statusMap[cl] || []} cluster={cl} />
          </React.Fragment>
        ))}
        {!pathname.endsWith('/mesh') && isControlPlaneAccessible() && (
          <div className={meshLinkStyle}>
            <span>{t('More info at')}</span>
            <Link to="/mesh">{t('Mesh page')}</Link>
          </div>
        )}
      </Content>
    );
  };

  const tooltipColor = (): string => {
    let coreUnhealthy = false;
    let addonUnhealthy = false;
    let notReady = false;
    const values = Object.values(props.statusMap).flat();

    Object.keys(values ?? {}).forEach((compKey: string) => {
      const { status, isCore } = values[compKey];
      const isNotReady: boolean = status === Status.NotReady;
      const isUnhealthy: boolean = status !== Status.Healthy && !isNotReady;

      if (isCore) {
        coreUnhealthy = coreUnhealthy || isUnhealthy;
      } else {
        addonUnhealthy = addonUnhealthy || isUnhealthy;
      }

      notReady = notReady || isNotReady;
    });

    return ValidToColor[`${coreUnhealthy}-${addonUnhealthy}-${notReady}`];
  };

  const healthyComponents = (): boolean => {
    const values = Object.values(props.statusMap).flat();
    return values.reduce((healthy: boolean, compStatus: ComponentStatus) => {
      return healthy && compStatus.status === Status.Healthy;
    }, true);
  };

  const tooltipPosition = TooltipPosition.top;

  let status: 'info' | 'danger' | 'warning' | 'success' | 'custom' | undefined = 'success';
  let dataTest = 'istio-status-success';
  if (!healthyComponents()) {
    const iconColor = tooltipColor();
    status = 'info';
    dataTest = 'istio-status';

    if (iconColor === PFColors.Danger) {
      status = 'danger';
      dataTest = `${dataTest}-danger`;
    } else if (iconColor === PFColors.Warning) {
      status = 'warning';
      dataTest = `${dataTest}-warning`;
    } else if (iconColor === PFColors.Info) {
      status = 'success';
      dataTest = `${dataTest}-info`;
    } else if (iconColor === PFColors.Success) {
      status = 'success';
      dataTest = `${dataTest}-success`;
    }
  }

  return (
    <Tooltip
      data-test="component-status-tooltip"
      position={tooltipPosition}
      enableFlip={true}
      content={tooltipContent()}
      className={tooltipStyle}
      maxWidth="25rem"
    >
      <>
        {homeCluster?.name && (
          <Label data-test={dataTest} status={status}>
            {homeCluster?.name}
          </Label>
        )}
      </>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  namespaces: namespaceItemsSelector(state),
  statusMap: istioStatusSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setIstioStatus: (statusMap: ClusterStatusMap) => {
    dispatch(IstioStatusActions.setinfo(statusMap));
  }
});

export const IstioStatus = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(IstioStatusComponent));
