import * as React from 'react';
import { ConfigurationTesterModal } from './ConfigurationTesterModal';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { useKialiTranslation } from '../../utils/I18nUtils';

type TracingDiagnoseProps = {
  cluster: string;
  configData: unknown;
};

export const TracingDiagnose: React.FC<TracingDiagnoseProps> = (props: TracingDiagnoseProps) => {
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const { t } = useKialiTranslation();

  return (
    <>
      <div style={{ marginLeft: 'auto' }}>
        <Button style={{ marginLeft: '5px' }} onClick={() => setIsModalOpen(true)} variant={ButtonVariant.secondary}>
          {t('Configuration Tester')}
        </Button>
        <ConfigurationTesterModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          cluster={props.cluster}
          configData={props.configData}
        />
      </div>
    </>
  );
};
