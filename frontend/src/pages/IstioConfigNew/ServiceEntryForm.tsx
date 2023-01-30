import * as React from 'react';
import { Port, ServiceEntrySpec } from '../../types/IstioObjects';
import { Button, ButtonVariant, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { style} from 'typestyle';
import { PFColors } from '../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { FormEvent } from "react";

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

const headerCells: ICell[] = [
  {
    title: 'Port Number',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Port Name',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Protocol',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Target Port',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noPortsStyle = style({
  marginTop: 15,
  color: PFColors.Red100
});

type Props = {
  serviceEntry: ServiceEntryState;
  onChange: (serviceEntry: ServiceEntryState) => void;
};

type FormPort = {
  number: string;
  name: string;
  protocol: string;
  targetPort: string;
}

export type ServiceEntryState = {
  serviceEntry: ServiceEntrySpec;
  validHosts: boolean;
  formPorts: FormPort[];
};

export const initServiceEntry = (): ServiceEntryState => ({
  serviceEntry: {
    location: location[0], // MESH_EXTERNAL
    resolution: resolution[0], // NONE
    ports: []
  },
  validHosts: false,
  formPorts: Array<FormPort>()
});

const isValidPort = (ports: FormPort[]) => {

  return ports.every((p, i) =>
    isValidName(p.name) && isValidPortNumber(p.number)
      && isValidTargetPort(p.targetPort)
      && noDuplicatePortNames(p.name, i, ports))
};

const noDuplicatePortNames = (name: string, index: number, ports: FormPort[]) => {
  return ports.every((p, i) => i !== index ? p.name !== name : true )
}

export const isServiceEntryValid = (se: ServiceEntryState): boolean => {
  return se.validHosts && se.serviceEntry.ports !== undefined && isValidPort(se.formPorts);
};

const isValidName = (name: string): boolean => {
  return name.length > 0
}

const isValidPortNumber = (portNumber: string): boolean => {
  return portNumber.length > 0 && !isNaN(Number(portNumber))
}

const isValidTargetPort = (targetPort: string): boolean => {
  return targetPort.length === 0 || (targetPort.length > 0 && !isNaN(Number(targetPort)))
}

class ServiceEntryForm extends React.Component<Props, ServiceEntryState> {
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

  onAddHosts = (value: string, _) => {
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

  onAddLocation = (value: string, _) => {
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

  onAddResolution = (value: string, _) => {
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

  onAddPortNumber = (value: string, e: FormEvent) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "0"
    // @ts-ignore
    const i = parseInt(eName)
    formPorts[i].number = value;

    // service entry
    const se = this.checkDefined(i);
    if (!isNaN(parseInt(value)) && se.ports !== undefined) {
      se.ports[i].number = parseInt(value)
    }

    this.setState({
      formPorts: formPorts, serviceEntry: se
    }, () => this.props.onChange(this.state));
  };

  onAddPortName = (value: string, e: FormEvent) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "0"
    // @ts-ignore
    const i = parseInt(eName)
    formPorts[i].name = value;

    // service entry
    const se = this.checkDefined(i);
    if (se.ports !== undefined) {
      se.ports[i].name = value
    }

    this.setState({
      formPorts: formPorts, serviceEntry: se
    }, () => this.props.onChange(this.state));
  };

  onAddPortProtocol = (value: string, e: FormEvent) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "0"
    // @ts-ignore
    const i = parseInt(eName)
    formPorts[i].protocol = value;

    // service entry
    const se = this.checkDefined(i);
    if (se.ports !== undefined) {
      se.ports[i].protocol = value
    }

    this.setState({
      formPorts: formPorts, serviceEntry: se
    }, () => this.props.onChange(this.state));
  };

  onAddTargetPort = (value: string, e: FormEvent) => {
    const formPorts = this.state.formPorts;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "0"
    // @ts-ignore
    const i = parseInt(eName)
    formPorts[i].targetPort = value;

    // service entry
    const se = this.checkDefined(i);
    if (!isNaN(parseInt(value)) && se.ports !== undefined) {
      se.ports[i].targetPort = parseInt(value)
    }

    this.setState({
      formPorts: formPorts, serviceEntry: se
    }, () => this.props.onChange(this.state));
  };

  checkDefined = (index: number) => {
    const se = this.state.serviceEntry
    if (typeof(se.ports) !== "undefined" && typeof(se.ports[index]) === "undefined") {
      const np: Port = {
        name: "",
        protocol: protocols[0],
        number: 0,
      };
      se.ports.splice(index, 0, np)
    }
    return se;
  };

  onAddNewPort = () => {
    const newPort: FormPort = {
      name: "",
      protocol: protocols[0],
      number: "",
      targetPort: ""
    };
    const newports = this.state.formPorts;
    newports.push(newPort)


    this.setState({
      formPorts: newports
    }, () => this.props.onChange(this.state));
  };

  handleDelete = (_: any, index: number) => {
    const state = this.state.formPorts
    state.splice(index, 1);
    const se = this.state.serviceEntry;
    se.ports?.splice(index, 1);

    this.setState({formPorts: state, serviceEntry: se },
      () => this.props.onChange(this.state)
    );
  };

  rows() {
    return (this.state.formPorts || [])
      .map((p, i) => ({
        key: 'portNew'+i,
        cells: [
          <>
            <TextInput
              value={p.number}
              id="addPortNumber"
              aria-describedby="add port number"
              name={i.toString()}
              placeholder="80"
              onChange={this.onAddPortNumber}
              validated={isValid(isValidPortNumber(p.number)
              )}
            />
          </>,
          <>
            <TextInput
              value={p.name}
              id="addPortName"
              aria-describedby="add port name"
              name={i.toString()}
              onChange={this.onAddPortName}
              validated={isValid(isValidName(p.name) && noDuplicatePortNames(p.name, i, this.state.formPorts)) }
            />
          </>,
          <>
            <FormSelect
              value={p.protocol}
              id="addPortProtocol"
              name={i.toString()}
              onChange={this.onAddPortProtocol}
            >
              {protocols.map((option, index) => (
                <FormSelectOption key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </>,
          <>
            <TextInput
              value={p.targetPort}
              id="addTargetPort"
              aria-describedby="add target port"
              name={i.toString()}
              onChange={this.onAddTargetPort}
              validated={isValid(isValidTargetPort(p.targetPort))}
            />
          </>,
          <>
            <Button
              id="deleteBtn"
              variant={ButtonVariant.link}
              icon={<TrashIcon />}
              style={{padding: 0}}
              onClick={(e) => this.handleDelete(e, i)}
            />
          </>
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
                icon={<PlusCircleIcon />}
                style={{padding: 0}}
                onClick={this.onAddNewPort}
              /> Add Port
            </>
          ]
        }
      ]);
  }

  render() {
    return (
      <>
        <FormGroup
          label="Hosts"
          isRequired={true}
          fieldId="hosts"
          helperText="The hosts associated with the ServiceEntry."
          helperTextInvalid="Invalid hosts for this ServiceEntry. Enter one or more hosts separated by comma."
          validated={isValid(this.state.validHosts)}
        >
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
          <Table
            aria-label="Ports"
            cells={headerCells}
            rows={this.rows()}
          >
            <TableHeader />
            <TableBody />
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
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option}/>
            ))}
          </FormSelect>
        </FormGroup>
      </>
    );
  }
}

export default ServiceEntryForm;
