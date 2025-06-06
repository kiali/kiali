import * as React from 'react';
import { TestModal } from './TestModal';
import { Button, ButtonVariant } from '@patternfly/react-core';

type TracingDiagnoseProps = {
  cluster: string;
};

export const TracingDiagnose: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);

  return (
    <>
      <div style={{ paddingTop: '0.25em' }}>
        <Button style={{ marginLeft: '5px' }} onClick={() => setIsModalOpen(true)} variant={ButtonVariant.secondary}>
          Test Config
        </Button>
        <TestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} cluster={props.cluster} />
      </div>
    </>
  );
};
