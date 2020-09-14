import * as React from 'react';
import { List, Text, TextContent, TextVariants } from '@patternfly/react-core';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import IstioComponentStatus from './IstioComponentStatus';
import { PfColors } from '../Pf/PfColors';

type Props = {
  status: ComponentStatus[];
};

class IstioStatusList extends React.Component<Props> {
  nonhealthyComponents = () => {
    return this.props.status.filter((c: ComponentStatus) => c.status !== Status.Healthy);
  };

  coreComponentsStatus = () => {
    return this.nonhealthyComponents().filter((s: ComponentStatus) => s.is_core);
  };

  addonComponentsStatus = () => {
    return this.nonhealthyComponents().filter((s: ComponentStatus) => !s.is_core);
  };

  renderComponentList = () => {
    const groups = {
      core: this.coreComponentsStatus,
      addon: this.addonComponentsStatus
    };

    return ['core', 'addon'].map((group: string) => {
      return (
        <React.Fragment key={'status-' + group}>
          {groups[group]().map(status => {
            return <IstioComponentStatus key={`status-${group}-${status.name}`} componentStatus={status} />;
          })}
        </React.Fragment>
      );
    });
  };

  render() {
    return (
      <TextContent style={{ color: PfColors.White }}>
        <Text component={TextVariants.h4}>Istio Components Status</Text>
        <List id="istio-status" aria-label="Istio Component List">
          {this.renderComponentList()}
        </List>
      </TextContent>
    );
  }
}

export default IstioStatusList;
