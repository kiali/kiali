import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownToggle,
  DropdownItem,
  InputGroup,
  TextInput,
  ButtonVariant
} from '@patternfly/react-core';
import {ServiceOverview} from "../../../types/ServiceList";
import {getServicePort} from "../../../types/ServiceInfo";
import {style} from "typestyle";

type Props = {
  filterType: string;
  headerOp: string;
  headerName: string;
  headerValue: string;
  hostName: string;
  isValid: boolean;
  onSelectFilterType: (filterType: string) => void;
  onHeaderNameChange: (headerName: string) => void;
  onHeaderValueChange: (headerValue: string) => void;
  onHostNameChange: (hostName: string) => void;
  onPortValueChange: (portValue: string) => void;
  onSelectServiceOp: (serviceOp: string) => void;
  onSelectStatusCodeOp: (statusCodeOp: string) => void;
  onSelectHeaderOp: (headerOp: string) => void;
  onSelectSchemeOp: (schemeOp: string) => void;
  onAddFilter: () => void;
  portValue: string;
  schemeOp: string;
  serviceOp: string;
  statusCodeOp: string;
  subServices: ServiceOverview[];
};

type State = {
  isFilterDropdown: boolean;
  isHeaderDropdown: boolean;
  isSchemeDropdown: boolean;
  isStatusCodeDropdown: boolean;
  isServiceDropdown: boolean;
};

export const REQ_MOD = 'requestHeaderModifier';
export const RESP_MOD = 'responseHeaderModifier';
export const REQ_MIR = 'requestMirror';
export const REQ_RED = 'requestRedirect';
export const URL_REW = 'URLRewrite';
export const EXT_REF = 'extensionRef';

export const HTTP = 'http';
export const HTTPS = 'https';

export const SC301 = '301';
export const SC302 = '302';

const filterOptions: string[] = [REQ_MOD, REQ_RED, REQ_MIR];
const schemeOptions: string[] = [HTTP, HTTPS];
const statusOptions: string[] = [SC301, SC302];

export const SET = 'set';
export const ADD = 'add';
export const REMOVE = 'remove';

const allOptions = {
  [REQ_MOD]: [SET, ADD, REMOVE],
  [RESP_MOD]: [SET, ADD, REMOVE],
};

const serviceStyle = style({
  width: '100%',
});

class K8sFilterBuilder extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isFilterDropdown: false,
      isHeaderDropdown: false,
      isSchemeDropdown: false,
      isStatusCodeDropdown: false,
      isServiceDropdown: false,
    };
  }

  onFilterTypeToggle = () => {
    this.setState({
      isFilterDropdown: !this.state.isFilterDropdown
    });
  };

  onHeaderOpToggle = () => {
    this.setState({
      isHeaderDropdown: !this.state.isHeaderDropdown
    });
  };

  onSchemeOpToggle = () => {
    this.setState({
      isSchemeDropdown: !this.state.isSchemeDropdown
    });
  };

  onStatusCodeOpToggle = () => {
    this.setState({
      isStatusCodeDropdown: !this.state.isStatusCodeDropdown
    });
  };

  onServiceOpToggle = () => {
    this.setState({
      isServiceDropdown: !this.state.isServiceDropdown
    });
  };

  render() {
    const renderFilterOptions: string[] = allOptions[this.props.filterType]
    return (
      <InputGroup>
        <Dropdown
          toggle={
            <DropdownToggle onToggle={this.onFilterTypeToggle} data-test={'filtering-type-toggle'}>
              {this.props.filterType}
            </DropdownToggle>
          }
          isOpen={this.state.isFilterDropdown}
          dropdownItems={filterOptions.map((mode, index) => (
            <DropdownItem
              key={mode + '_' + index}
              value={mode}
              component="button"
              onClick={() => {
                this.props.onSelectFilterType(mode);
                this.onFilterTypeToggle();
              }}
              data-test={'filtering-type-' + mode}
            >
              {mode}
            </DropdownItem>
          ))}
        />
        {(this.props.filterType === REQ_MOD || this.props.filterType === RESP_MOD) && (
          <Dropdown
            toggle={
              <DropdownToggle onToggle={this.onHeaderOpToggle} data-test={'header-type-toggle'}>
                {this.props.headerOp}
              </DropdownToggle>
            }
            isOpen={this.state.isHeaderDropdown}
            dropdownItems={renderFilterOptions.map((op, index) => (
              <DropdownItem
                key={op + '_' + index}
                value={op}
                component="button"
                onClick={() => {
                  this.props.onSelectHeaderOp(op);
                  this.onHeaderOpToggle();
                }}
                data-test={'header-type-' + op}
              >
                {op}
              </DropdownItem>
            ))}
          />
        )}
        {(this.props.filterType === REQ_MOD || this.props.filterType === RESP_MOD) && (
          <TextInput
            id="header-name-id"
            value={this.props.headerName}
            onChange={this.props.onHeaderNameChange}
            placeholder="Header name..."
          />
        )}
        {(this.props.filterType === REQ_MOD || this.props.filterType === RESP_MOD) && this.props.headerOp !== REMOVE && (
          <TextInput
            id="header-value-id"
            value={this.props.headerValue}
            onChange={this.props.onHeaderValueChange}
            placeholder="Header Value..."
          />
        )}
        {(this.props.filterType === REQ_RED) && (
          <Dropdown
            toggle={
              <DropdownToggle onToggle={this.onSchemeOpToggle} data-test={'scheme-toggle'}>
                {this.props.schemeOp}
              </DropdownToggle>
            }
            isOpen={this.state.isSchemeDropdown}
            dropdownItems={schemeOptions.map((op, index) => (
              <DropdownItem
                key={op + '_' + index}
                value={op}
                component="button"
                onClick={() => {
                  this.props.onSelectSchemeOp(op);
                  this.onSchemeOpToggle();
                }}
                data-test={'scheme-' + op}
              >
                {op}
              </DropdownItem>
            ))}
          />
        )}
        {(this.props.filterType === REQ_RED) && (
          <TextInput
            id="hostname"
            value={this.props.hostName}
            onChange={this.props.onHostNameChange}
            placeholder="Hostname..."
          />
        )}
        {(this.props.filterType === REQ_RED) && (
          <TextInput
            id="portValue"
            value={this.props.portValue}
            onChange={this.props.onPortValueChange}
            placeholder="Port..."
          />
        )}
        {(this.props.filterType === REQ_RED) && (
          <Dropdown
            toggle={
              <DropdownToggle onToggle={this.onStatusCodeOpToggle} data-test={'status-code'}>
                {this.props.statusCodeOp}
              </DropdownToggle>
            }
            isOpen={this.state.isStatusCodeDropdown}
            dropdownItems={statusOptions.map((op, index) => (
              <DropdownItem
                key={op + '_' + index}
                value={op}
                component="button"
                onClick={() => {
                  this.props.onSelectStatusCodeOp(op);
                  this.onStatusCodeOpToggle();
                }}
                data-test={'status-code-' + op}
              >
                {op}
              </DropdownItem>
            ))}
          />
        )}
        {(this.props.filterType === REQ_MIR) && (
          <Dropdown
            className={serviceStyle}
            toggle={
              <DropdownToggle onToggle={this.onServiceOpToggle} data-test={'service'}>
                {this.props.serviceOp}
              </DropdownToggle>
            }
            isOpen={this.state.isServiceDropdown}
            dropdownItems={this.props.subServices.map((so, index) => (
              <DropdownItem
                key={so.name + '_' + index}
                value={so.name + ':' + getServicePort(so.ports)}
                component="button"
                onClick={() => {
                  this.props.onSelectServiceOp(so.name + ':' + getServicePort(so.ports));
                  this.onServiceOpToggle();
                }}
                data-test={'service-' + so.name}
              >
                {so.name + ':' + getServicePort(so.ports)}
              </DropdownItem>
            ))}
          />
        )}
        <Button
          variant={ButtonVariant.secondary}
          isDisabled={!this.props.isValid}
          onClick={this.props.onAddFilter}
          data-test="add-Filter"
        >
          Add Filter
        </Button>
      </InputGroup>
    );
  }
}

export default K8sFilterBuilder;
