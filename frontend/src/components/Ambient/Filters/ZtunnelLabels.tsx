import * as React from 'react';
import { Label, pluralize } from '@patternfly/react-core';

import { ZtunnelItem } from '../../../types/IstioObjects';

export enum ConfigType {
  SERVICE = 'service',
  WORKLOAD = 'workload'
}

type Props = {
  filteredConfig?: ZtunnelItem[];
  type: ConfigType;
};

export const ZtunnelLabels = (p: Props): React.ReactElement => {
  return (
    <>
      <Label color="blue" key={p.type}>
        {`${p.filteredConfig && p.filteredConfig.length} / `}
        {p.filteredConfig && pluralize(p.filteredConfig?.length, p.type)}
      </Label>
    </>
  );
};
