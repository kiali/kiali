import * as React from 'react';
import { Port, ServiceEntrySpec } from '../../types/IstioObjects';
import { Button, ButtonVariant, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';
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

export type ServiceEntryState = {
  serviceEntry: ServiceEntrySpec;
  validHosts: boolean;
};

export const initServiceEntry = (): ServiceEntryState => ({
  serviceEntry: {
    location: location[0], // MESH_EXTERNAL
    resolution: resolution[0], // NONE
    ports: []
  },
  validHosts: false,
});

const isValidPort = (p: Port[]) => {
  return p.every(p =>
    p.name.length > 0 && p.number !== undefined && p.protocol.length > 0)
};

export const isServiceEntryValid = (se: ServiceEntryState): boolean => {
  return se.validHosts && se.serviceEntry.ports !== undefined && se.serviceEntry.ports.length > 0
    && isValidPort(se.serviceEntry.ports);
};

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
    const ps = this.state.serviceEntry;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "1"
    // @ts-ignore
    const i = parseInt(eName)
    if (typeof(ps.ports) !== "undefined") {
     if (value.match(/^(\s)*$/)) {
        ps.ports[i].number = undefined
      } else {
        if (value.match(/^(\d+)$/)) {
          ps.ports[i].number = parseInt(value);
        }
      }

    }
    this.setState({
      serviceEntry: ps
    }, () => this.props.onChange(this.state));
  };

  onAddPortName = (value: string, e: FormEvent) => {
    const ps = this.state.serviceEntry;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "1"
    // @ts-ignore
    const i = parseInt(eName)
    if (typeof(ps.ports) !== "undefined") {
      ps.ports[i].name = value;
    }
    this.setState({
      serviceEntry: ps
    }, () => this.props.onChange(this.state));
  };

  onAddPortProtocol = (value: string, e: FormEvent) => {
    const ps = this.state.serviceEntry;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "1"
    // @ts-ignore
    const i = parseInt(eName)
    if (typeof(ps.ports) !== "undefined") {
      ps.ports[i].protocol = value;
    }
    this.setState({
      serviceEntry: ps
    }, () => this.props.onChange(this.state));
  };

  onAddTargetPort = (value: string, e: FormEvent) => {
    const ps = this.state.serviceEntry;
    const eName = e.currentTarget.getAttribute("name") !== null ? e.currentTarget.getAttribute("name") : "1"
    // @ts-ignore
    const i = parseInt(eName)
    if (typeof(ps.ports) !== "undefined") {
      if (value.match(/^(\s)*$/)) {
        ps.ports[i].targetPort = undefined
      } else {
        if (value.match(/^(\d+)$/)) {
          ps.ports[i].targetPort = parseInt(value);
        }
      }
    }
    this.setState({
      serviceEntry: ps
    }, () => this.props.onChange(this.state));
  };

  onAddNewPort = () => {
    const newPort: Port = {
      name: "",
      protocol: "HTTP"
    };
    const newports = this.state.serviceEntry;
    if (typeof(newports.ports) !== "undefined") {
      newports.ports.push(newPort)
    }

    this.setState({
      serviceEntry: newports
    }, () => this.props.onChange(this.state));
  };

  handleDelete = (_: any, index: number) => {
    const state = this.state.serviceEntry
    state.ports?.splice(index, 1);
    this.setState({serviceEntry: state },
               () => this.props.onChange(this.state)
   );
  };

  rows() {
    return (this.state.serviceEntry.ports || [])
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
              validated={isValid(typeof(this.state.serviceEntry.ports) !== "undefined" &&
                typeof(this.state.serviceEntry.ports[i].number) !== "undefined" && !isNaN(Number(this.state.serviceEntry.ports[i].number))
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
              validated={isValid(typeof(this.state.serviceEntry.ports) !== "undefined" && typeof(this.state.serviceEntry.ports[i].name) !== "undefined"
                && this.state.serviceEntry.ports[i].name.length > 0)}
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
              validated={isValid(typeof(this.state.serviceEntry.ports) !== "undefined" &&
                (typeof(this.state.serviceEntry.ports[i].targetPort) === "undefined" ||
                  (typeof(this.state.serviceEntry.ports[i].targetPort) !== "undefined" && !isNaN(Number(this.state.serviceEntry.ports[i].targetPort))))

              )}
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
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>
      </>
    );
  }


}

export default ServiceEntryForm;
