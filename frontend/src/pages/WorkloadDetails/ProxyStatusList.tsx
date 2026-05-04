import * as React from 'react';
import { isProxyStatusComponentSynced, isProxyStatusSynced, ProxyStatus } from '../../types/Health';
import { Stack, StackItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  status?: ProxyStatus;
};

const tooltipContentStyle = kialiStyle({
  $nest: {
    '& [class*="pf-v6-c-content"]': {
      color: 'inherit'
    }
  }
});

const titleStyle = kialiStyle({
  fontSize: '1.1rem',
  fontWeight: 'bold'
});

const statusStyle = kialiStyle({
  fontSize: '70%'
});

export const ProxyStatusList: React.FC<Props> = (props: Props) => {
  const statusList = (): React.ReactNode[] => {
    if (!props.status) {
      return [];
    }

    return [
      { c: 'CDS', s: props.status.CDS },
      { c: 'EDS', s: props.status.EDS },
      { c: 'LDS', s: props.status.LDS },
      { c: 'RDS', s: props.status.RDS }
    ].map((value: { c: string; s: string }, i: number) => {
      if (!isProxyStatusComponentSynced(value.s)) {
        const status = value.s ? value.s : '-';
        return (
          <StackItem key={`proxy-status-${i}`} className={statusStyle}>
            {`${value.c}: ${status}`}
          </StackItem>
        );
      } else {
        return null;
      }
    });
  };

  if (props.status && !isProxyStatusSynced(props.status)) {
    return (
      <Stack className={tooltipContentStyle}>
        <StackItem className={titleStyle}>Istio Proxy Status</StackItem>
        {statusList()}
      </Stack>
    );
  } else {
    return null;
  }
};
