import * as React from 'react';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY } from 'types/Health';
import { MeshHealthIndicator } from './MeshHealthIndicator';
import { MeshResourceType, switchMeshResourceType } from 'types/Mesh';
import { NamespaceStatus } from 'types/NamespaceInfo';
import { Paths } from 'config';
import { useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  name: string;
  status: NamespaceStatus;
  type: MeshResourceType;
};

export const ResourceHealthStatus: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const targetPage = switchMeshResourceType(props.type, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
  const name = props.name;
  const status = props.status;

  const nbItems =
    status.inError.length +
    status.inWarning.length +
    status.inSuccess.length +
    status.notAvailable.length +
    status.inNotReady.length;

  let text: string;

  switch (targetPage) {
    case Paths.APPLICATIONS:
      text = t('{{count}} application', {
        count: nbItems,
        defaultValueOne: '{{count}} application',
        defaultValueOther: '{{count}} applications'
      });
      break;
    case Paths.SERVICES:
      text = t('{{count}} service', {
        count: nbItems,
        defaultValueOne: '{{count}} service',
        defaultValueOther: '{{count}} services'
      });
      break;
    case Paths.WORKLOADS:
      text = t('{{count}} workload', {
        count: nbItems,
        defaultValueOne: '{{count}} workload',
        defaultValueOther: '{{count}} workloads'
      });
      break;
  }

  return (
    <>
      <div style={{ textAlign: 'left' }}>
        <span>
          <div style={{ display: 'inline-block', width: '125px' }} data-test={`overview-type-${props.type}`}>
            {text}
          </div>

          <div style={{ display: 'inline-block' }}>
            {status.inNotReady.length > 0 && (
              <MeshHealthIndicator
                id={`${name}-not-ready`}
                namespace={name}
                status={NOT_READY}
                items={status.inNotReady}
                targetPage={targetPage}
              />
            )}

            {status.inError.length > 0 && (
              <MeshHealthIndicator
                id={`${name}-failure`}
                namespace={name}
                status={FAILURE}
                items={status.inError}
                targetPage={targetPage}
              />
            )}

            {status.inWarning.length > 0 && (
              <MeshHealthIndicator
                id={`${name}-degraded`}
                namespace={name}
                status={DEGRADED}
                items={status.inWarning}
                targetPage={targetPage}
              />
            )}

            {status.inSuccess.length > 0 && (
              <MeshHealthIndicator
                id={`${name}-healthy`}
                namespace={name}
                status={HEALTHY}
                items={status.inSuccess}
                targetPage={targetPage}
              />
            )}

            {nbItems === status.notAvailable.length && (
              <div style={{ display: 'inline-block', marginLeft: '0.5rem' }}>N/A</div>
            )}
          </div>
        </span>
      </div>
    </>
  );
};
