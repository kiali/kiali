import * as React from 'react';
import { Port, ServiceEntrySpec } from '../../types/IstioObjects';
import { Button, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';
import { PFColors } from '../../components/Pf/PfColors';
import { isValid } from 'utils/Common';

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
  addNewPortNumber: string;
  addNewPortName: string;
  addNewPortProtocol: string;
  addNewTargetPort: string;
};

export const initServiceEntry = (): ServiceEntryState => ({
  serviceEntry: {
    location: location[0], // MESH_EXTERNAL
    resolution: resolution[0] // NONE
  },
  validHosts: false,
  addNewPortNumber: '80',
  addNewPortName: '',
  addNewPortProtocol: protocols[0],
  addNewTargetPort: ''
});

export const isServiceEntryValid = (se: ServiceEntryState): boolean => {
  return se.validHosts && se.serviceEntry.ports !== undefined && se.serviceEntry.ports.length > 0;
};

class ServiceEntryForm extends React.Component<Props, ServiceEntryState> {
  constructor(props: Props) {
    super(props);
    this.state = initServiceEntry();
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Port',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.setState(
          prevState => {
            prevState.serviceEntry.ports?.splice(rowIndex, 1);
            return {
              serviceEntry: prevState.serviceEntry
            };
          },
          () => this.props.onChange(this.state)
        );
      }
    };
    if (this.state.serviceEntry.ports && rowIndex < this.state.serviceEntry.ports.length) {
      return [removeAction];
    }
    return [];
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

  isValidPort = () => {
    const validPortNumber = this.state.addNewPortNumber.length > 0 && !isNaN(Number(this.state.addNewPortNumber));
    const validPortName = this.state.addNewPortName.length > 0;
    const validTargetPort =
      this.state.addNewTargetPort.length === 0 ||
      (this.state.addNewTargetPort.length > 0 && !isNaN(Number(this.state.addNewTargetPort)));
    return validPortNumber && validPortName && validTargetPort;
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

  onAddPortNumber = (value: string, _) => {
    this.setState({
      addNewPortNumber: value
    });
  };

  onAddPortName = (value: string, _) => {
    this.setState({
      addNewPortName: value
    });
  };

  onAddPortProtocol = (value: string, _) => {
    this.setState({
      addNewPortProtocol: value
    });
  };

  onAddTargetPort = (value: string, _) => {
    this.setState({
      addNewTargetPort: value
    });
  };

  onAddNewPort = () => {
    // @ts-ignore
    this.setState(
      prevState => {
        const newPort: Port = {
          number: +this.state.addNewPortNumber,
          name: this.state.addNewPortName,
          protocol: this.state.addNewPortProtocol
        };
        if (this.state.addNewTargetPort.length > 0) {
          newPort.targetPort = +this.state.addNewTargetPort;
        }
        if (!prevState.serviceEntry.ports) {
          prevState.serviceEntry.ports = [];
        }
        prevState.serviceEntry.ports.push(newPort);
        return {
          serviceEntry: prevState.serviceEntry,
          addNewPortNumber: '80',
          addNewPortName: '',
          addNewPortProtocol: protocols[0],
          addNewTargetPort: ''
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  rows() {
    return (this.state.serviceEntry.ports || [])
      .map((p, i) => ({
        key: 'port_' + i,
        cells: [<>{p.number}</>, <>{p.name}</>, <>{p.protocol}</>, <>{p.targetPort}</>, '']
      }))
      .concat([
        {
          key: 'portNew',
          cells: [
            <>
              <TextInput
                value={this.state.addNewPortNumber}
                id="addPortNumber"
                aria-describedby="add port number"
                name="addPortNumber"
                onChange={this.onAddPortNumber}
                validated={isValid(this.state.addNewPortNumber.length > 0 && !isNaN(Number(this.state.addNewPortNumber)))}
              />
            </>,
            <>
              <TextInput
                value={this.state.addNewPortName}
                id="addPortName"
                aria-describedby="add port name"
                name="addPortName"
                onChange={this.onAddPortName}
                validated={isValid(this.state.addNewPortName.length > 0)}
              />
            </>,
            <>
              <FormSelect
                value={this.state.addNewPortProtocol}
                id="addPortProtocol"
                name="addPortProtocol"
                onChange={this.onAddPortProtocol}
              >
                {protocols.map((option, index) => (
                  <FormSelectOption key={'p' + index} value={option} label={option} />
                ))}
              </FormSelect>
            </>,
            <>
              <TextInput
                value={this.state.addNewTargetPort}
                id="addTargetPort"
                aria-describedby="add target port"
                name="addTargetPort"
                onChange={this.onAddTargetPort}
                validated={isValid(
                  this.state.addNewTargetPort.length === 0 ||
                  (this.state.addNewTargetPort.length > 0 && !isNaN(Number(this.state.addNewTargetPort))))
                }
              />
            </>,
            <>
              <Button
                id="addServerBtn"
                variant="link"
                icon={<PlusCircleIcon />}
                isDisabled={!this.isValidPort()}
                onClick={this.onAddNewPort}
              />
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
        <FormGroup label="Ports" fieldId="ports">
          <Table
            aria-label="Ports"
            cells={headerCells}
            rows={this.rows()}
            // @ts-ignore
            actionResolver={this.actionResolver}
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
