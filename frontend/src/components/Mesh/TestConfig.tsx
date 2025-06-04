import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  Grid,
  GridItem,
  Modal,
  ModalVariant,
  TextInput
} from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';

type LogsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const modalStyle = kialiStyle({
  overflowY: 'hidden'
});

export const TestConfig: React.FC<LogsModalProps> = (props: LogsModalProps) => {
  const { t } = useKialiTranslation();

  if (!props.isOpen) {
    return null;
  }

  return (
    <Modal
      className={modalStyle}
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('Test tracing config')}
      actions={[
        <Button key="close" onClick={props.onClose}>
          {t('Close')}
        </Button>,
        <Button variant={ButtonVariant.secondary}>Test values</Button>
      ]}
    >
      <div>
        <Form>
          <Grid hasGutter>
            <GridItem span={12}>
              <FormGroup label="Internal URL" fieldId="internalURL">
                <TextInput id="firstName" value="" />
              </FormGroup>
            </GridItem>
            <GridItem span={12}>
              <FormGroup label="External URL" fieldId="externalURL">
                <TextInput id="externalURL" value="" />
              </FormGroup>
            </GridItem>
            <GridItem span={12}>
              <FormGroup label="Use grpc" fieldId="usegrpc">
                <TextInput id="usegrpc" value="" />
              </FormGroup>
            </GridItem>
            <GridItem span={12}>
              <FormGroup label="namespace selector" fieldId="namespace selector">
                <TextInput id="ns" value="" />
              </FormGroup>
            </GridItem>
          </Grid>
        </Form>
      </div>
    </Modal>
  );
};
