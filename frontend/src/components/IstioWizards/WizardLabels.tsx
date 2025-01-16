import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  List,
  ListItem,
  Modal,
  ModalVariant,
  TextInput,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { IRow, Table, TableVariant, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

interface Props {
  labels: { [key: string]: string };
  canEdit: boolean;
  type: string;
  onChange: (labels: { [key: string]: string }) => void;
  onClose: () => void;
  showAnotationsWizard: boolean;
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
  marginTop: '1rem',
})

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

    Object.keys(this.props.labels ?? {}).map((value, index) => m.set(index, [value, this.props.labels[value]]));

    // should be empty line
    if (m.size === 0) {
      m.set(m.size, ['', '']);
    }
    return m;
  };

  removeLabel = (k: number): void => {
    const labels = new Map<number, [string, string]>();
    const condition = (key: number) => key !== k;
    let index = 0;

    Array.from(this.state.labels.entries())
      .filter(([key, _]) => condition(key))
      .map(([_, [key, value]]: [number, [string, string]]) => labels.set(index++, [key, value]));

    this.setState({ labels });
  };

  changeLabel = (value: [string, string], k: number): void => {
    const labels = this.state.labels;
    labels.set(k, value);
    this.setState({ labels });
  };

  validate = (): boolean => {
    const validation: string[] = [];

    // Check if duplicate keys
    if (
      Array.from(this.state.labels.values())
        .map(k => k[0])
        .some((e, i, arr) => arr.indexOf(e) !== i)
    ) {
      validation.push('Duplicate keys found.');
    }

    // Check if empty keys
    if (
      Array.from(this.state.labels.values())
        .map(k => k[0])
        .filter(e => e.length === 0).length > 0
    ) {
      validation.push('Empty keys found.');
    }

    // Check if empty values
    if (
      Array.from(this.state.labels.values())
        .map(k => k[1])
        .filter(e => e.length === 0).length > 0
    ) {
      validation.push('Empty values found.');
    }

    this.setState({ validation });

    return validation.length === 0 ? true : false;
  };

  onChange = (): void => {
    if (this.validate()) {
      const annotates: { [key: string]: string } = {};
      Array.from(this.state.labels.values()).map(element => (annotates[element[0]] = element[1]));
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

    Array.from(this.state.labels.entries()).map(([index, [key, value]]: [number, [string, string]]) =>
      rows.push(
        this.props.canEdit ? (
          <Tr key={`edit_label_for_${index}`}>
            <Th width={40}>
              <TextInput
                aria-invalid={key === '' || Object.values(this.state.labels).filter(arr => arr[0] === key).length > 1}
                id={`labelInputForKey_${index}`}
                onChange={(_event, newKey) => this.changeLabel([newKey, value], index)}
                placeholder="Key"
                type="text"
                value={key}
              />
            </Th>

            <Th width={40}>
              <TextInput
                aria-invalid={value === ''}
                id={`labelInputForValue_${index}`}
                onChange={(_event, v) => this.changeLabel([key, v], index)}
                placeholder="Value"
                type="text"
                value={value}
              />
            </Th>

            <Th>
              <Button variant="plain" icon={<KialiIcon.Delete />} onClick={() => this.removeLabel(index)} />
            </Th>
          </Tr>
        ) : (
          <Tr>
            <Th dataLabel={key}>{key}</Th>
            <Th dataLabel={value}>{value}</Th>
          </Tr>
        )
      )
    );

    return rows;
  };

  addMore = (): void => {
    const labels = this.state.labels;
    labels.set(labels.size, ['', '']);
    this.setState({ labels });
  };

  render() {
    const header = (
      <>
        <Title id="modal-custom-header-label" headingLevel="h1" size={TitleSizes['2xl']}>
          {this.props.canEdit ? 'Edit ' : 'View '}
          {this.props.type}
        </Title>
      </>
    );

    const footer = (
      <ActionGroup>
        <Button variant="primary" isDisabled={!this.props.canEdit} onClick={this.onChange} data-test={'save-button'}>
          {t('Save')}
        </Button>

        {this.props.canEdit && (
          <Button variant="secondary" className={clearButtonStyle} onClick={this.onClear}>
            {t('Clear')}
          </Button>
        )}

        <Button variant="link" onClick={this.onClose}>
          {t('Cancel')}
        </Button>
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
                <Th dataLabel="Key">Key</Th>
                <Th dataLabel="Value">Value</Th>
                {this.props.canEdit && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>{this.generateInput()}</Tbody>
          </Table>

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
            <span style={{ marginLeft: '0.25rem' }}>Add more</span>
          </Button>

          {this.state.validation.length > 0 && (
            <Alert variant="danger" className={alertStyle} isInline isExpandable title="An error occurred">
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
