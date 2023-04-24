import { Label, Stack, StackItem, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import Labels from 'components/Label/Labels';
import { PFBadge } from 'components/Pf/PfBadges';
import LocalTime from 'components/Time/LocalTime';
import { ValidationObjectSummary } from 'components/Validations/ValidationObjectSummary';
import { IstioTypes } from 'components/VirtualList/Config';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { IstioConfigDetails } from 'types/IstioConfigDetails';
import {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  ValidationTypes,
  WorkloadReference
} from 'types/IstioObjects';
import { style } from 'typestyle';
import { getIstioObject, getReconciliationCondition } from 'utils/IstioConfigUtils';
import IstioConfigHelp from './IstioConfigHelp';
import IstioConfigReferences from './IstioConfigReferences';
import IstioConfigValidationReferences from './IstioConfigValidationReferences';
import IstioStatusMessageList from './IstioStatusMessageList';
import { KioskElement } from '../../../components/Kiosk/KioskElement';
import { PFColors } from '../../../components/Pf/PfColors';
import { GetIstioObjectUrl } from '../../../components/Link/IstioObjectLink';

interface IstioConfigOverviewProps {
  istioObjectDetails: IstioConfigDetails;
  cluster: string;
  istioValidations?: ObjectValidation;
  namespace: string;
  statusMessages: ValidationMessage[];
  objectReferences: ObjectReference[];
  serviceReferences: ServiceReference[];
  workloadReferences: WorkloadReference[];
  helpMessages?: HelpMessage[];
  selectedLine?: string;
  kiosk: string;
  istioAPIEnabled: boolean;
}

const iconStyle = style({
  margin: '0 0 0 0',
  padding: '0 0 0 0',
  display: 'inline-block',
  verticalAlign: '2px !important'
});

const infoStyle = style({
  margin: '0px 0px 2px 10px',
  verticalAlign: '-5px !important'
});

const warnStyle = style({
  margin: '0px 0px 2px 0px',
  verticalAlign: '-3px !important'
});

const healthIconStyle = style({
  marginLeft: '10px',
  verticalAlign: '-1px !important'
});

const resourceListStyle = style({
  margin: '0px 0 11px 0',
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

class IstioConfigOverview extends React.Component<IstioConfigOverviewProps> {
  configurationHasWarnings = (): boolean | undefined => {
    return this.props.istioValidations?.checks.some(check => {
      return check.severity === ValidationTypes.Warning;
    });
  };

  render() {
    const istioObject = getIstioObject(this.props.istioObjectDetails);

    const resourceProperties = (
      <div key="properties-list" className={resourceListStyle}>
        <ul style={{ listStyleType: 'none' }}>
          {istioObject && istioObject.metadata.creationTimestamp && (
            <li>
              <span>Created</span>
              <div style={{ display: 'inline-block' }}>
                <LocalTime time={istioObject.metadata.creationTimestamp} />
              </div>
            </li>
          )}
          {istioObject && istioObject.metadata.resourceVersion && (
            <li>
              <span>Version</span>
              {istioObject.metadata.resourceVersion}
            </li>
          )}
        </ul>
      </div>
    );

    let urlInKiali = '';
    if (istioObject !== undefined && istioObject.metadata.namespace !== undefined && istioObject.kind !== undefined) {
      // here a "/console" is required as external link is used
      urlInKiali =
        '/console' +
        GetIstioObjectUrl(
          istioObject.metadata.name,
          istioObject.metadata.namespace,
          this.props.cluster,
          istioObject.kind.toLowerCase()
        );
    }

    return (
      <Stack hasGutter={true}>
        <StackItem>
          <Title headingLevel="h3" size={TitleSizes.xl}>
            Overview
          </Title>
        </StackItem>
        <StackItem>
          {istioObject && istioObject.kind && (
            <>
              <div className={iconStyle}>
                <PFBadge badge={IstioTypes[istioObject.kind?.toLowerCase()].badge} position={TooltipPosition.top} />
              </div>
              {istioObject?.metadata.name}
              <Tooltip
                position={TooltipPosition.right}
                content={<div style={{ textAlign: 'left' }}>{resourceProperties}</div>}
              >
                <KialiIcon.Info className={infoStyle} />
              </Tooltip>
              {this.props.istioValidations &&
                (!this.props.statusMessages || this.props.statusMessages.length === 0) &&
                (!this.props.istioValidations.checks || this.props.istioValidations.checks.length === 0) && (
                  <span className={healthIconStyle}>
                    <ValidationObjectSummary
                      id={'config-validation'}
                      validations={[this.props.istioValidations]}
                      reconciledCondition={getReconciliationCondition(this.props.istioObjectDetails)}
                    />
                  </span>
                )}
            </>
          )}
        </StackItem>

        {istioObject?.metadata.labels && (
          <StackItem>
            <Labels tooltipMessage="Labels defined on this resource" labels={istioObject?.metadata.labels}></Labels>
          </StackItem>
        )}

        {((this.props.statusMessages && this.props.statusMessages.length > 0) ||
          (this.props.istioValidations &&
            this.props.istioValidations.checks &&
            this.props.istioValidations.checks.length > 0)) && (
          <StackItem>
            <IstioStatusMessageList messages={this.props.statusMessages} checks={this.props.istioValidations?.checks} />
          </StackItem>
        )}

        {this.props.istioValidations?.references && (
          <StackItem>
            <IstioConfigValidationReferences
              objectReferences={this.props.istioValidations.references}
              cluster={this.props.cluster}
            />
          </StackItem>
        )}

        {this.props.istioValidations?.valid && !this.configurationHasWarnings() && (
          <StackItem>
            <IstioConfigReferences
              objectReferences={this.props.objectReferences}
              serviceReferences={this.props.serviceReferences}
              workloadReferences={this.props.workloadReferences}
              isValid={this.props.istioValidations?.valid}
              cluster={this.props.cluster}
            />
          </StackItem>
        )}

        {this.props.helpMessages && this.props.helpMessages.length > 0 && (
          <StackItem>
            <IstioConfigHelp
              helpMessages={this.props.helpMessages}
              selectedLine={this.props.selectedLine}
            ></IstioConfigHelp>
          </StackItem>
        )}
        {!this.props.istioAPIEnabled && (
          <StackItem>
            <KialiIcon.Warning className={warnStyle} /> <b>Istio API is disabled.</b> Be careful when editing the
            configuration as the Istio config validations are disabled when the Istio API is disabled.
          </StackItem>
        )}
        <KioskElement>
          <StackItem>
            <Tooltip
              content={
                'This is a Read only view of the YAML including Validations. It is possible to edit directly in Kiali '
              }
              position={TooltipPosition.top}
            >
              <Label color="green" isCompact>
                Read only mode
              </Label>
            </Tooltip>
            <a
              href={urlInKiali}
              style={{ marginLeft: '5px', fontSize: '85%', color: PFColors.ActiveText }}
              target="_blank"
              rel="noreferrer"
            >
              Edit in Kiali
            </a>
          </StackItem>
        </KioskElement>
      </Stack>
    );
  }
}

export default IstioConfigOverview;
