import * as React from 'react';
import { Card, CardBody, CardHeader, Title, TitleSizes } from '@patternfly/react-core';
import { Workload, SpireManagedIdentityMatch } from '../../types/Workload';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { App } from '../../types/App';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type SpireProps = {
  object?: Workload | ServiceDetailsInfo | App;
  objectType: 'workload' | 'service' | 'app';
};

const resourceListStyle = kialiStyle({
  display: 'flex',
  $nest: {
    '& > ul': {
      width: '100%',
      listStyleType: 'none'
    },
    '& > ul > li': {
      display: 'flex',
      $nest: {
        '& span': {
          minWidth: '125px',
          fontWeight: 700
        }
      }
    }
  }
});

const codeStyle = kialiStyle({
  fontSize: '0.9em',
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
  padding: '0.125rem 0.25rem',
  borderRadius: '0.125rem',
  fontFamily: 'monospace'
});

const renderListItem = (label: string, value: React.ReactNode, key?: string): React.ReactNode => (
  <li key={key}>
    <span>{t(label)}</span>
    <div style={{ display: 'inline-block' }}>{value}</div>
  </li>
);

const renderBasicSpireInfo = (
  statusMessage: string,
  managedIdentityMatches?: SpireManagedIdentityMatch[]
): React.ReactNode => {
  const matchItems: React.ReactNode[] = [];

  if (managedIdentityMatches && managedIdentityMatches.length > 0) {
    // Loop over all matches and display each one (order is preserved from backend)
    managedIdentityMatches.forEach((match, index) => {
      matchItems.push(renderListItem(match.matchType, <code className={codeStyle}>{match.matchValue}</code>, 'match'));
      // Add spacing between matches, but not after the last one
      if (index < managedIdentityMatches.length - 1) {
        matchItems.push(<li key={`spacer-${index}`} style={{ marginTop: '0.25rem' }} />);
      }
    });
  }

  return (
    <>
      {renderListItem('Status', t(statusMessage), 'status_message')}
      <li key="divider" style={{ marginTop: '0.5rem' }} />
      {matchItems}
    </>
  );
};

export const Spire: React.FC<SpireProps> = (props: SpireProps) => {
  if (props.objectType === 'workload') {
    const workload = props.object as Workload | undefined;
    if (!workload || !workload?.spireInfo?.isSpireManaged) {
      return null;
    }

    return (
      <Card isCompact={true} id="SpireCard">
        <CardHeader>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {t('SPIRE')}
          </Title>
        </CardHeader>
        <CardBody>
          <div className={resourceListStyle}>
            <ul>
              {renderBasicSpireInfo(
                'This workload is using SPIRE (SPIFFE Runtime Environment) for identity management.',
                workload.spireInfo?.managedIdentityMatches
              )}
            </ul>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (props.objectType === 'service') {
    const serviceDetails = props.object as ServiceDetailsInfo | undefined;
    const hasSpireWorkload = serviceDetails?.workloads?.some(w => w.spireInfo?.isSpireManaged);
    if (!hasSpireWorkload) {
      return null;
    }

    return (
      <Card isCompact={true} id="SpireCard">
        <CardHeader>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {t('SPIRE')}
          </Title>
        </CardHeader>
        <CardBody>
          <div className={resourceListStyle}>
            <ul>{renderBasicSpireInfo('This service has workloads that are using SPIRE')}</ul>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (props.objectType === 'app') {
    const app = props.object as App | undefined;
    const hasSpireWorkload = app?.workloads?.some(w => w.spireInfo?.isSpireManaged);
    if (!hasSpireWorkload) {
      return null;
    }

    return (
      <Card isCompact={true} id="SpireCard">
        <CardHeader>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {t('SPIRE')}
          </Title>
        </CardHeader>
        <CardBody>
          <div className={resourceListStyle}>
            <ul>{renderBasicSpireInfo('This application has workloads that are using SPIRE')}</ul>
          </div>
        </CardBody>
      </Card>
    );
  }

  return null;
};
