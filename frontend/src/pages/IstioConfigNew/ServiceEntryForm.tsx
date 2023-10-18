import * as React from 'react';
import { MAX_PORT, MIN_PORT, Port, ServiceEntrySpec } from '../../types/IstioObjects';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput
} from '@patternfly/react-core';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import { Table, Thead, Tbody, Tr, Th, Td, ThProps, IRow, IRowCell } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { FormEvent } from 'react';
import { KialiIcon } from 'config/KialiIcon';

export const SERVICE_ENTRY = 'ServiceEntry';
export const SERVICE_ENTRIES = 'serviceentries';

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
  color: PFColors.Red100
});

type Props = {
  onChange: (serviceEntry: ServiceEntryState) => void;
  serviceEntry: ServiceEntryState;
};

type FormPort = {
  number: string;
  name: string;
  protocol: string;
  targetPort: string;
};

export type ServiceEntryState = {
  formPorts: FormPort[];
  serviceEntry: ServiceEntrySpec;
  validHosts: boolean;
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

const isValidPort = (ports: FormPort[]) => {
  return ports.every(
    (p, i) =>
      isValidName(p.name) &&
      isValidPortNumber(p.number) &&
      isValidTargetPort(p.targetPort) &&
      noDuplicatePortNames(p.name, i, ports)
  );
};

const noDuplicatePortNames = (name: string, index: number, ports: FormPort[]) => {
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

export class ServiceEntryForm extends React.Component<Props, ServiceEntryState> {
  constructor(props: Props) {
    super(props);
    this.state = initServiceEntry();
  }

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

  onAddHosts = (_event, value: string) => {
    const hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());

    this.setState(
      prevState => {
        prevState.serviceEntry.hosts = hosts;
        return {
          serviceEntry: prevState.serviceEntry,
          validHosts: this.areValidHosts(hosts)
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onAddLocation = (_event, value: string) => {
    this.setState(
      prevState => {
        prevState.serviceEntry.location = value;
        return {
          serviceEntry: prevState.serviceEntry
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onAddResolution = (_event, value: string) => {
    this.setState(
      prevState => {
        prevState.serviceEntry.resolution = value;
        return {
          serviceEntry: prevState.serviceEntry
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onAddPortNumber = (e: FormEvent, value: string) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute('name') !== null ? e.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i].number = value;

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
      () => this.props.onChange(this.state)
    );
  };

  onAddPortName = (e: FormEvent, value: string) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute('name') !== null ? e.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i].name = value;

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
      () => this.props.onChange(this.state)
    );
  };

  onAddPortProtocol = (e: FormEvent, value: string) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute('name') !== null ? e.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i].protocol = value;

    // service entry
    const se = this.checkDefined(i);

    if (se.ports !== undefined) {
      se.ports[i].protocol = value;
    }

    this.setState(
      {
        formPorts: formPorts,
        serviceEntry: se
      },
      () => this.props.onChange(this.state)
    );
  };

  onAddTargetPort = (e: FormEvent, value: string) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute('name') !== null ? e.currentTarget.getAttribute('name') : '0';
    const i = parseInt(eName!);
    formPorts[i].targetPort = value;

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
      () => this.props.onChange(this.state)
    );
  };

  checkDefined = (index: number) => {
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

  onAddNewPort = () => {
    const newPort: FormPort = {
      name: '',
      protocol: protocols[0],
      number: '',
      targetPort: ''
    };

    const newports = this.state.formPorts;
    newports.push(newPort);

    this.setState(
      {
        formPorts: newports
      },
      () => this.props.onChange(this.state)
    );
  };

  handleDelete = (_: any, index: number) => {
    const state = this.state.formPorts;
    state.splice(index, 1);
    const se = this.state.serviceEntry;
    se.ports?.splice(index, 1);

    this.setState({ formPorts: state, serviceEntry: se }, () => this.props.onChange(this.state));
  };

  rows = (): IRow[] => {
    return (this.state.formPorts || [])
      .map((p, i) => ({
        key: 'portNew' + i,
        cells: [
          <TextInput
            value={p.number}
            id={'addPortNumber' + i}
            aria-describedby="add port number"
            name={i.toString()}
            placeholder="80"
            onChange={this.onAddPortNumber}
            validated={isValid(isValidPortNumber(p.number))}
          />,
          <TextInput
            value={p.name}
            id={'addPortName' + i}
            aria-describedby="add port name"
            name={i.toString()}
            onChange={this.onAddPortName}
            validated={isValid(isValidName(p.name) && noDuplicatePortNames(p.name, i, this.state.formPorts))}
          />,
          <FormSelect
            value={p.protocol}
            id={'addPortProtocol' + i}
            name={i.toString()}
            onChange={this.onAddPortProtocol}
          >
            {protocols.map((option, index) => (
              <FormSelectOption key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>,
          <TextInput
            value={p.targetPort}
            id={'addTargetPort' + i}
            aria-describedby="add target port"
            name={i.toString()}
            onChange={this.onAddTargetPort}
            validated={isValid(isValidTargetPort(p.targetPort))}
          />,
          <Button
            id={'deleteBtn' + i}
            variant={ButtonVariant.link}
            icon={<KialiIcon.Trash />}
            style={{ padding: 0 }}
            onClick={e => this.handleDelete(e, i)}
          />
        ]
      }))
      .concat([
        {
          key: 'portNew',
          cells: [
            <>
              <Button
                id="addServerBtn"
                variant={ButtonVariant.link}
                icon={<KialiIcon.AddMore />}
                style={{ padding: 0 }}
                onClick={this.onAddNewPort}
              >
                {' '}
                Add Port
              </Button>
            </>
          ]
        }
      ]);
  };

  render() {
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
          <FormSelect
            value={this.state.serviceEntry.location}
            id="location"
            name="location"
            onChange={this.onAddLocation}
          >
            {location.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Ports" fieldId="ports" isRequired={true}>
          <Table aria-label="Ports">
            <Thead>
              <Tr>
                {columns.map((column, index) => (
                  <Th key={`column_${index}`} dataLabel={column.title} width={column.width}>
                    {column.title}
                  </Th>
                ))}
              </Tr>
            </Thead>

            <Tbody>
              {this.rows().map((row, index) => (
                <Tr key={row.key ?? `row_${index}`}>
                  {(row.cells as IRowCell[])?.map((cell, index) => (
                    <Td key={`cell_${index}`} dataLabel={columns[index].title}>
                      {cell}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>

          {(!this.state.serviceEntry.ports || this.state.serviceEntry.ports.length === 0) && (
            <div className={noPortsStyle}>ServiceEntry has no Ports defined</div>
          )}
        </FormGroup>

        <FormGroup label="Resolution" isRequired={true} fieldId="resolution">
          <FormSelect
            value={this.state.serviceEntry.resolution}
            id="resolution"
            name="resolution"
            onChange={this.onAddResolution}
          >
            {resolution.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>
      </>
    );
  }
}
