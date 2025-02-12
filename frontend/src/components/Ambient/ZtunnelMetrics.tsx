import * as React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';

export const ZtunnelMetrics: React.FC = () => {
  return (
    <>
      <div>
        <Title headingLevel="h5" size={TitleSizes.lg} data-test="enrolled-data-title">
          Ztunnel metrics
        </Title>
      </div>
    </>
  );
};
