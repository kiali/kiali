import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import {
  partitionTroubleshootingIssues,
  summarizeTroubleshootingIssues
} from 'pages/Troubleshooting/partitionTroubleshooting';
import { loadTroubleshootingScan } from 'services/AiTroubleshooting';
import { t } from 'utils/I18nUtils';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { cardBodyStyle, cardStyle, iconStyle, linkStyle, statItemStyle, statsContainerStyle } from './OverviewStyles';
import { classes } from 'typestyle';

export const TroubleshootingStats: React.FC = () => {
  const dispatch = useKialiDispatch();
  const error = useKialiSelector(state => state.ai.troubleshooting.error);
  const hiddenSubProblemIds = useKialiSelector(state => state.ai.troubleshooting.hiddenSubProblemIds);
  const issues = useKialiSelector(state => state.ai.troubleshooting.issues);
  const loaded = useKialiSelector(state => state.ai.troubleshooting.loaded);
  const [refreshing, setRefreshing] = React.useState(false);

  const summary = React.useMemo(() => {
    const visible = partitionTroubleshootingIssues(issues, hiddenSubProblemIds).visible;
    return summarizeTroubleshootingIssues(visible);
  }, [hiddenSubProblemIds, issues]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTroubleshootingScan(dispatch);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const isLoading = (!loaded && !error) || refreshing;
  const isError = loaded && !!error;

  return (
    <Card className={cardStyle} data-test="overview-troubleshooting-card">
      <CardHeader>
        <CardTitle>
          {t('Troubleshooting')}
          {!isLoading && !isError && ` (${summary.problems})`}
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <OverviewCardLoadingState message={t('Fetching troubleshooting data')} />
        ) : isError ? (
          <OverviewCardErrorState
            message={t('Troubleshooting problems could not be loaded')}
            onTryAgain={handleRefresh}
          />
        ) : (
          <div className={statsContainerStyle}>
            <div className={statItemStyle} data-test="overview-troubleshooting-critical">
              <span>{summary.critical}</span>
              <KialiIcon.ExclamationCircle />
            </div>
            <div className={statItemStyle} data-test="overview-troubleshooting-warning">
              <span>{summary.warning}</span>
              <KialiIcon.ExclamationTriangle />
            </div>
          </div>
        )}
      </CardBody>
      {!isLoading && !isError && (
        <CardFooter>
          <KialiLink to={`/${Paths.TROUBLESHOOTING}`} dataTest="overview-troubleshooting-view-link">
            <span className={classes(linkStyle)}>
              {t('View Troubleshooting')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
            </span>
          </KialiLink>
        </CardFooter>
      )}
    </Card>
  );
};
