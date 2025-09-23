import * as React from 'react';
import { DisconnectedIcon } from '@patternfly/react-icons';
import { Tooltip, Label } from '@patternfly/react-core';
import { serverConfig } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

const labelTextStyle = kialiStyle({
  color: PFColors.Blue400
});

export const OfflineStatus: React.FC = () => {
  const date = new Date(serverConfig.runConfig!.timestamp!);
  let content = `You are running Kiali offline. Some features may be degraded or unavailable in this mode. This is a snapshot of your environment.`;
  if (serverConfig.runConfig?.timestamp !== undefined) {
    // Trim '.' to add snapshot time/date.
    content = content.substring(0, content.length - 1);
    content += ` taken at ${date.toLocaleTimeString()} on ${date.toLocaleDateString()}.`;
  }
  return (
    <Tooltip content={content}>
      <Label color="grey" icon={<DisconnectedIcon color={PFColors.Blue400} data-test="offline-status" />}>
        <span className={labelTextStyle}>offline</span>
      </Label>
    </Tooltip>
  );
};
