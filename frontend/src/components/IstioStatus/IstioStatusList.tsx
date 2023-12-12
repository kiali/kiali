import * as React from 'react';
import { List, Text, TextContent, TextVariants } from '@patternfly/react-core';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { IstioComponentStatus } from './IstioComponentStatus';
import { PFColors } from '../Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  status: ComponentStatus[];
};

const listStyle = kialiStyle({
  paddingLeft: 0,
  marginTop: 0,
  marginLeft: 0
});

export const IstioStatusList: React.FC<Props> = (props: Props) => {
  const nonhealthyComponents = (): ComponentStatus[] => {
    return props.status.filter((c: ComponentStatus) => c.status !== Status.Healthy);
  };

  const coreComponentsStatus = (): ComponentStatus[] => {
    return nonhealthyComponents().filter((s: ComponentStatus) => s.is_core);
  };

  const addonComponentsStatus = (): ComponentStatus[] => {
    return nonhealthyComponents().filter((s: ComponentStatus) => !s.is_core);
  };

  const renderComponentList = (): React.ReactNode => {
    const groups = {
      core: coreComponentsStatus,
      addon: addonComponentsStatus
    };

    // return ['core', 'addon'].map((group: string) => {
    //   return (
    //     <div key={`status-${group}`}>
    //       {groups[group]().map((status: ComponentStatus) => {
    //         return <IstioComponentStatus key={`status-${group}-${status.name}`} componentStatus={status} />;
    //       })}
    //     </div>
    //   );
    // });

    console.log(groups);

    return (
      <div key={`status`}>
        <IstioComponentStatus
          key={`status-test`}
          componentStatus={{ name: 'test-1', is_core: true, status: Status.Healthy }}
        />
        <IstioComponentStatus
          key={`status-test`}
          componentStatus={{ name: 'test-2', is_core: true, status: Status.NotFound }}
        />
        <IstioComponentStatus
          key={`status-test`}
          componentStatus={{ name: 'test-3', is_core: true, status: Status.NotReady }}
        />
        <IstioComponentStatus
          key={`status-test`}
          componentStatus={{ name: 'test-4', is_core: true, status: Status.Unreachable }}
        />
        <IstioComponentStatus
          key={`status-test`}
          componentStatus={{ name: 'test-5', is_core: true, status: Status.Unhealthy }}
        />
      </div>
    );
  };

  return (
    <TextContent style={{ color: PFColors.White }}>
      <Text component={TextVariants.h4}>Istio Components Status</Text>

      <List id="istio-status" aria-label="Istio Component List" className={listStyle}>
        {renderComponentList()}
      </List>
    </TextContent>
  );
};
