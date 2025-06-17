import * as React from 'react';
import { TestTracingModal } from './TestTracingModal';
import { Button, ButtonVariant } from '@patternfly/react-core';

type TracingDiagnoseProps = {
  cluster: string;
  configData: unknown;
};

export const TracingDiagnose: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);

  return (
    <>
      <div style={{ paddingTop: '0.25em' }}>
        <Button style={{ marginLeft: '5px' }} onClick={() => setIsModalOpen(true)} variant={ButtonVariant.secondary}>
          Test Config
        </Button>
        <TestTracingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          cluster={props.cluster}
          configData={props.configData}
        />
      </div>
    </>
  );
};
