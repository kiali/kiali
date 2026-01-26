import * as React from 'react';
import { MAX_PORT, MIN_PORT, Port, ServiceEntrySpec } from '../../types/IstioObjects';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput
} from '@patternfly/react-core';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import { ThProps, IRow } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { KialiIcon } from 'config/KialiIcon';
import { SimpleTable } from 'components/Table/SimpleTable';

const MESH_EXTERNAL = 'MESH_EXTERNAL';
const MESH_INTERNAL = 'MESH_INTERNAL';

const location = [MESH_EXTERNAL, MESH_INTERNAL];

const NONE = 'NONE';
const STATIC = 'STATIC';
const DNS = 'DNS';

const resolution = [NONE, STATIC, DNS];

const protocols = ['HTTP', 'HTTPS', 'GRPC', 'HTTP2', 'MONGO', 'TCP', 'TLS'];

const columns: ThProps[] = [
  {
    title: 'Port Number',
    width: 20
  },
  {
    title: 'Port Name',
    width: 20
  },
  {
    title: 'Protocol',
    width: 20
  },
  {
    title: 'Target Port',
    width: 20
  },
  {
    title: ''
  }
];

const noPortsStyle = kialiStyle({
  marginTop: '1rem',
  color: PFColors.Red500
});

const addPortsStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginTop: '0.25rem'
});

type Props = {
  onChange: (serviceEntry: ServiceEntryState) => void;
  serviceEntry: ServiceEntryState;
};

type FormPort = {
  name: string;
  number: string;
  protocol: string;
  targetPort: string;
};

type FormPortState = FormPort & {
  isProtocolSelectOpen: boolean;
};

export type ServiceEntryState = {
  formPorts: FormPort[];
  serviceEntry: ServiceEntrySpec;
  validHosts: boolean;
};

type ServiceEntryFormState = Omit<ServiceEntryState, 'formPorts'> & {
  formPorts: FormPortState[];
  isLocationSelectOpen: boolean;
  isResolutionSelectOpen: boolean;
};

export const initServiceEntry = (): ServiceEntryState => ({
  formPorts: Array<FormPort>(),
  serviceEntry: {
    location: location[0], // MESH_EXTERNAL
    resolution: resolution[0], // NONE
    ports: []
  },
  validHosts: false
});

const initFormState = (): ServiceEntryFormState => ({
  formPorts: Array<FormPortState>(),
  isLocationSelectOpen: false,
  isResolutionSelectOpen: false,
  serviceEntry: {
    location: location[0],
    resolution: resolution[0],
    ports: []
  },
  validHosts: false
});

const isValidPort = (ports: FormPort[]): boolean => {
  return ports.every(
    (p, i) =>
      isValidName(p.name) &&
      isValidPortNumber(p.number) &&
      isValidTargetPort(p.targetPort) &&
      noDuplicatePortNames(p.name, i, ports)
  );
};

const noDuplicatePortNames = (name: string, index: number, ports: FormPort[]): boolean => {
  return ports.every((p, i) => (i !== index ? p.name !== name : true));
};

export const isServiceEntryValid = (se: ServiceEntryState): boolean => {
  return (
    se.validHosts &&
    se.serviceEntry.ports !== undefined &&
    se.serviceEntry.ports.length !== 0 &&
    isValidPort(se.formPorts)
  );
};

const isValidName = (name: string): boolean => {
  return name.length > 0;
};

const isValidPortNumber = (portNumber: string): boolean => {
  return (
    portNumber.length > 0 &&
    !isNaN(Number(portNumber)) &&
    Number(portNumber) >= MIN_PORT &&
    Number(portNumber) <= MAX_PORT
  );
};

const isValidTargetPort = (targetPort: string): boolean => {
  return targetPort.length === 0 || isValidPortNumber(targetPort);
};

export class ServiceEntryForm extends React.Component<Props, ServiceEntryFormState> {
  constructor(props: Props) {
    super(props);
    this.state = initFormState();
  }

  private getFormState = (): ServiceEntryState => {
    const { isLocationSelectOpen, isResolutionSelectOpen, formPorts, ...rest } = this.state;
    return {
      ...rest,
      formPorts: formPorts.map(({ isProtocolSelectOpen, ...port }) => port)
    };
  };

  areValidHosts = (hosts: string[]): boolean => {
    if (hosts.length === 0) {
      return false;
    }

    let isValid = true;

    for (let i = 0; i < hosts.length; i++) {
      if (!isGatewayHostValid(hosts[i])) {
        isValid = false;
        break;
      }
    }

    return isValid;
  };

  onAddHosts = (_event: React.FormEvent, value: string): void => {
    const hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());

    this.setState(
      prevState => ({
        serviceEntry: { ...prevState.serviceEntry, hosts },
        validHosts: this.areValidHosts(hosts)
      }),
      () => this.props.onChange(this.getFormState())
    );
  };

  onAddLocation = (_event: React.FormEvent | undefined, value: string): void => {
    this.setState(
      prevState => ({
        isLocationSelectOpen: false,
        serviceEntry: { ...prevState.serviceEntry, location: value }
      }),
      () => this.props.onChange(this.getFormState())
    );
  };

  onAddResolution = (_event: React.FormEvent | undefined, value: string): void => {
    this.setState(
      prevState => ({
        isResolutionSelectOpen: false,
        serviceEntry: { ...prevState.serviceEntry, resolution: value }
      }),
      () => this.props.onChange(this.getFormState())
    );
  };

  onAddPortProtocol = (index: number, value: string): void => {
    const formPorts = [...this.state.formPorts];
    formPorts[index] = { ...formPorts[index], protocol: value, isProtocolSelectOpen: false };

    const se = this.checkDefined(index);
    if (se.ports !== undefined) {
      se.ports[index].protocol = value;
    }

    this.setState({ formPorts, serviceEntry: se }, () => this.props.onChange(this.getFormState()));
  };

  onAddPortNumber = (event: React.FormEvent, value: string): void => {
    const formPorts = [...this.state.formPorts];
    const eName = event.currentTarget.getAttribute('name') !== null ? event.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i] = { ...formPorts[i], number: value };

    // service entry
    const se = this.checkDefined(i);

    if (!isNaN(parseInt(value)) && se.ports !== undefined) {
      se.ports[i].number = parseInt(value);
    }

    this.setState(
      {
        formPorts: formPorts,
        serviceEntry: se
      },
      () => this.props.onChange(this.getFormState())
    );
  };

  onAddPortName = (event: React.FormEvent, value: string): void => {
    const formPorts = [...this.state.formPorts];
    const eName = event.currentTarget.getAttribute('name') !== null ? event.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i] = { ...formPorts[i], name: value };

    // service entry
    const se = this.checkDefined(i);

    if (se.ports !== undefined) {
      se.ports[i].name = value;
    }

    this.setState(
      {
        formPorts: formPorts,
        serviceEntry: se
      },
      () => this.props.onChange(this.getFormState())
    );
  };

  onAddTargetPort = (event: React.FormEvent, value: string): void => {
    const formPorts = [...this.state.formPorts];
    const eName = event.currentTarget.getAttribute('name') !== null ? event.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i] = { ...formPorts[i], targetPort: value };

    // service entry
    const se = this.checkDefined(i);

    if (!isNaN(parseInt(value)) && se.ports !== undefined) {
      se.ports[i].targetPort = parseInt(value);
    }

    this.setState(
      {
        formPorts: formPorts,
        serviceEntry: se
      },
      () => this.props.onChange(this.getFormState())
    );
  };

  checkDefined = (index: number): ServiceEntrySpec => {
    const se = this.state.serviceEntry;

    if (typeof se.ports !== 'undefined' && typeof se.ports[index] === 'undefined') {
      const np: Port = {
        name: '',
        protocol: protocols[0],
        number: 0
      };
      se.ports.splice(index, 0, np);
    }

    return se;
  };

  onAddNewPort = (): void => {
    const newPort: FormPortState = {
      isProtocolSelectOpen: false,
      name: '',
      number: '',
      protocol: protocols[0],
      targetPort: ''
    };

    this.setState(
      prevState => ({
        formPorts: [...prevState.formPorts, newPort]
      }),
      () => this.props.onChange(this.getFormState())
    );
  };

  handleDelete = (_event: React.MouseEvent, index: number): void => {
    const formPorts = [...this.state.formPorts];
    formPorts.splice(index, 1);

    const ports = this.state.serviceEntry.ports ? [...this.state.serviceEntry.ports] : [];
    ports.splice(index, 1);

    this.setState(
      prevState => ({
        formPorts,
        serviceEntry: { ...prevState.serviceEntry, ports }
      }),
      () => this.props.onChange(this.getFormState())
    );
  };

  rows = (): IRow[] => {
    return (this.state.formPorts ?? []).map((p, i) => ({
      key: `portNew_${i}`,
      cells: [
        <TextInput
          value={p.number}
          id={`addPortNumber_${i}`}
          aria-describedby="add port number"
          name={i.toString()}
          placeholder="80"
          onChange={this.onAddPortNumber}
          validated={isValid(isValidPortNumber(p.number))}
        />,

        <TextInput
          value={p.name}
          id={`addPortName_${i}`}
          aria-describedby="add port name"
          name={i.toString()}
          onChange={this.onAddPortName}
          validated={isValid(isValidName(p.name) && noDuplicatePortNames(p.name, i, this.state.formPorts))}
        />,

        <Select
          id={`addPortProtocol_${i}`}
          isOpen={p.isProtocolSelectOpen}
          selected={p.protocol}
          onSelect={(_event, value) => this.onAddPortProtocol(i, value as string)}
          onOpenChange={isOpen => {
            const formPorts = [...this.state.formPorts];
            formPorts[i] = { ...formPorts[i], isProtocolSelectOpen: isOpen };
            this.setState({ formPorts });
          }}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              id={`addPortProtocol_${i}-toggle`}
              ref={toggleRef}
              onClick={() => {
                const formPorts = [...this.state.formPorts];
                formPorts[i] = { ...formPorts[i], isProtocolSelectOpen: !formPorts[i].isProtocolSelectOpen };
                this.setState({ formPorts });
              }}
              isExpanded={p.isProtocolSelectOpen}
              isFullWidth
            >
              {p.protocol}
            </MenuToggle>
          )}
          aria-label="Protocol Select"
        >
          <SelectList>
            {protocols.map((option, index) => (
              <SelectOption key={`p_${index}`} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>
        </Select>,

        <TextInput
          value={p.targetPort}
          id={`addTargetPort_${i}`}
          aria-describedby="add target port"
          name={i.toString()}
          onChange={this.onAddTargetPort}
          validated={isValid(isValidTargetPort(p.targetPort))}
        />,

        <Button
          id={`deleteBtn_${i}`}
          variant={ButtonVariant.link}
          icon={<KialiIcon.Trash />}
          style={{ padding: 0 }}
          onClick={e => this.handleDelete(e, i)}
        />
      ]
    }));
  };

  render(): React.ReactNode {
    return (
      <>
        <FormGroup label="Hosts" isRequired={true} fieldId="hosts">
          <TextInput
            value={this.state.serviceEntry.hosts?.join(',')}
            isRequired={true}
            type="text"
            id="hosts"
            aria-describedby="hosts"
            name="hosts"
            onChange={this.onAddHosts}
            validated={isValid(this.state.validHosts)}
          />

          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isValid(this.state.validHosts)
                  ? 'The hosts associated with the ServiceEntry.'
                  : 'Invalid hosts for this ServiceEntry. Enter one or more hosts separated by comma.'}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup label="Location" isRequired={true} fieldId="location">
          <Select
            id="location"
            isOpen={this.state.isLocationSelectOpen}
            selected={this.state.serviceEntry.location}
            onSelect={(_event, value) => this.onAddLocation(_event, value as string)}
            onOpenChange={isLocationSelectOpen => this.setState({ isLocationSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="location-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isLocationSelectOpen: !this.state.isLocationSelectOpen })}
                isExpanded={this.state.isLocationSelectOpen}
                isFullWidth
              >
                {this.state.serviceEntry.location}
              </MenuToggle>
            )}
            aria-label="Location Select"
          >
            <SelectList>
              {location.map((option, index) => (
                <SelectOption key={`p_${index}`} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>

        <FormGroup label="Ports" fieldId="ports" isRequired={true}>
          <SimpleTable label="Ports" columns={columns} rows={this.rows()} />

          <Button
            id="addPortBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.AddMore />}
            className={addPortsStyle}
            onClick={this.onAddNewPort}
          >
            Add Port
          </Button>

          {(!this.state.serviceEntry.ports || this.state.serviceEntry.ports.length === 0) && (
            <div className={noPortsStyle}>ServiceEntry has no Ports defined</div>
          )}
        </FormGroup>

        <FormGroup label="Resolution" isRequired={true} fieldId="resolution">
          <Select
            id="resolution"
            isOpen={this.state.isResolutionSelectOpen}
            selected={this.state.serviceEntry.resolution}
            onSelect={(_event, value) => this.onAddResolution(_event, value as string)}
            onOpenChange={isResolutionSelectOpen => this.setState({ isResolutionSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="resolution-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isResolutionSelectOpen: !this.state.isResolutionSelectOpen })}
                isExpanded={this.state.isResolutionSelectOpen}
                isFullWidth
              >
                {this.state.serviceEntry.resolution}
              </MenuToggle>
            )}
            aria-label="Resolution Select"
          >
            <SelectList>
              {resolution.map((option, index) => (
                <SelectOption key={`p_${index}`} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>
      </>
    );
  }
}
