import * as React from 'react';
import { ActionGroup, Alert, Button, List, ListItem, TextInput, Title, TitleSizes } from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { IRow, Table, TableVariant, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

interface Props {
  canEdit: boolean;
  labels: { [key: string]: string };
  onChange: (labels: { [key: string]: string }) => void;
  onClose: () => void;
  showAnotationsWizard: boolean;
  type: string;
}

interface State {
  labels: Map<number, [string, string]>;
  validation: string[];
}

const addMoreStyle = kialiStyle({
  marginTop: '0.5rem',
  marginLeft: '1rem'
});

const clearButtonStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const alertStyle = kialiStyle({
  marginTop: '1rem'
});

export class WizardLabels extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { labels: this.convertLabelsToMap(), validation: [] };
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.labels !== this.props.labels && prevProps.showAnotationsWizard !== this.props.showAnotationsWizard) {
      this.onClear();
    }
  }

  convertLabelsToMap = (): Map<number, [string, string]> => {
    const m = new Map();

    Object.keys(this.props.labels ?? {}).forEach((value, index) => m.set(index, [value, this.props.labels[value]]));

    if (m.size === 0) {
      m.set(m.size, ['', '']);
    }
    return m;
  };

  removeLabel = (k: number): void => {
    const labels = new Map<number, [string, string]>();
    const condition = (key: number): boolean => key !== k;
    let index = 0;

    Array.from(this.state.labels.entries())
      .filter(([key, _]) => condition(key))
      .forEach(([_, [key, value]]: [number, [string, string]]) => labels.set(index++, [key, value]));

    this.setState({ labels });
  };

  changeLabel = (value: [string, string], k: number): void => {
    const labels = new Map(this.state.labels);
    labels.set(k, value);
    this.setState({ labels });
  };

  validate = (): boolean => {
    const validation: string[] = [];

    if (
      Array.from(this.state.labels.values())
        .map(k => k[0])
        .some((e, i, arr) => arr.indexOf(e) !== i)
    ) {
      validation.push(t('Duplicate keys found.'));
    }

    if (
      Array.from(this.state.labels.values())
        .map(k => k[0])
        .filter(e => e.length === 0).length > 0
    ) {
      validation.push(t('Empty keys found.'));
    }

    if (
      Array.from(this.state.labels.values())
        .map(k => k[1])
        .filter(e => e.length === 0).length > 0
    ) {
      validation.push(t('Empty values found.'));
    }

    this.setState({ validation });

    return validation.length === 0 ? true : false;
  };

  onChange = (): void => {
    if (this.validate()) {
      const annotates: { [key: string]: string } = {};
      Array.from(this.state.labels.values()).forEach(element => (annotates[element[0]] = element[1]));
      this.props.onChange(annotates);
    }
  };

  onClose = (): void => {
    this.setState({ labels: this.convertLabelsToMap(), validation: [] }, () => this.props.onClose());
  };

  onClear = (): void => {
    this.setState({ labels: this.convertLabelsToMap(), validation: [] });
  };

  generateInput = (): IRow[] => {
    const rows: IRow[] = [];

    Array.from(this.state.labels.entries()).forEach(([index, [key, value]]: [number, [string, string]]) =>
      rows.push(
        this.props.canEdit ? (
          <Tr key={`edit_label_for_${index}`}>
            <Th width={40}>
              <TextInput
                aria-invalid={key === '' || Object.values(this.state.labels).filter(arr => arr[0] === key).length > 1}
                id={`labelInputForKey_${index}`}
                onChange={(_event, newKey) => this.changeLabel([newKey, value], index)}
                placeholder={t('Key')}
                type="text"
                value={key}
              />
            </Th>

            <Th width={40}>
              <TextInput
                aria-invalid={value === ''}
                id={`labelInputForValue_${index}`}
                onChange={(_event, v) => this.changeLabel([key, v], index)}
                placeholder={t('Value')}
                type="text"
                value={value}
              />
            </Th>

            <Th>
              <Button variant="plain" icon={<KialiIcon.Delete />} onClick={() => this.removeLabel(index)} />
            </Th>
          </Tr>
        ) : (
          <Tr key={`view_label_for_${index}`}>
            <Th dataLabel={key}>{key}</Th>
            <Th dataLabel={value}>{value}</Th>
          </Tr>
        )
      )
    );

    return rows;
  };

  addMore = (): void => {
    const labels = new Map(this.state.labels);
    labels.set(labels.size, ['', '']);
    this.setState({ labels });
  };

  render(): React.ReactNode {
    const header = (
      <>
        <Title id="modal-custom-header-label" headingLevel="h1" size={TitleSizes['2xl']}>
          {this.props.type.charAt(0).toUpperCase() + this.props.type.slice(1)}
        </Title>
      </>
    );

    const footer = (
      <ActionGroup>
        {this.props.canEdit && (
          <>
            <Button variant="primary" onClick={this.onChange} data-test={'save-button'}>
              {t('Save')}
            </Button>

            <Button variant="secondary" className={clearButtonStyle} onClick={this.onClear}>
              {t('Clear')}
            </Button>

            <Button variant="link" onClick={this.onClose}>
              {t('Cancel')}
            </Button>
          </>
        )}

        {!this.props.canEdit && (
          <Button variant="primary" onClick={this.onClose}>
            {t('Close')}
          </Button>
        )}
      </ActionGroup>
    );

    return (
      <>
        <Modal
          variant={ModalVariant.large}
          isOpen={this.props.showAnotationsWizard}
          onClose={this.onClose}
          header={header}
          aria-labelledby="modal-custom-header-label"
          aria-describedby="modal-custom-header-description"
          footer={footer}
        >
          <Table variant={TableVariant.compact}>
            <Thead>
              <Tr>
                <Th dataLabel="Key">{t('Key')}</Th>
                <Th dataLabel="Value">{t('Value')}</Th>
                {this.props.canEdit && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>{this.generateInput()}</Tbody>
          </Table>

          {this.props.canEdit && (
            <Button
              variant="link"
              className={addMoreStyle}
              data-test={'add-more'}
              icon={<KialiIcon.AddMore />}
              onClick={() => {
                this.addMore();
              }}
              isInline
            >
              <span style={{ marginLeft: '0.25rem' }}>{t('Add more')}</span>
            </Button>
          )}

          {this.state.validation.length > 0 && (
            <Alert variant="danger" className={alertStyle} isInline isExpandable title={t('An error occurred')}>
              <List isPlain>
                {this.state.validation.map((message, i) => (
                  <ListItem key={`Message_${i}`}>{message}</ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Modal>
      </>
    );
  }
}
