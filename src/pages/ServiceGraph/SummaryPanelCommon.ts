import { SummaryPanelPropType } from '../../types/Graph';
import { Health, healthNotAvailable } from '../../types/Health';

export const shouldRefreshData = (prevProps: SummaryPanelPropType, nextProps: SummaryPanelPropType) => {
  return (
    // Verify the time of the last request
    prevProps.queryTime !== nextProps.queryTime ||
    // Check if going from no data to data
    (!prevProps.data.summaryTarget && nextProps.data.summaryTarget) ||
    // Check if the target changed
    prevProps.data.summaryTarget !== nextProps.data.summaryTarget
  );
};

type HealthState = {
  health?: Health;
  healthLoading: boolean;
};

export const updateHealth = (summaryTarget: any, stateSetter: (hs: HealthState) => void) => {
  const healthPromise = summaryTarget.data('healthPromise');
  if (healthPromise) {
    stateSetter({ health: undefined, healthLoading: true });
    healthPromise
      .then(h => stateSetter({ health: h, healthLoading: false }))
      .catch(err => stateSetter({ health: healthNotAvailable(), healthLoading: false }));
  } else {
    stateSetter({ health: undefined, healthLoading: false });
  }
};

export const nodeData = (node: any) => {
  return {
    namespace: node.data('namespace'),
    app: node.data('app'),
    version: node.data('version'),
    workload: node.data('workload')
  };
};
