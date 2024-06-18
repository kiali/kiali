import * as React from 'react';
import {
  Button,
  InputGroup,
  TextInput,
  ButtonVariant,
  InputGroupItem,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggleElement,
  MenuToggle
} from '@patternfly/react-core';
import { ServiceOverview } from '../../../types/ServiceList';
import { getServicePort } from '../../../types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';

type K8sFilterBuilderProps = {
  filterType: string;
  headerName: string;
  headerOp: string;
  headerValue: string;
  hostName: string;
  isValid: boolean;
  onAddFilter: () => void;
  onHeaderNameChange: (headerName: string) => void;
  onHeaderValueChange: (headerValue: string) => void;
  onHostNameChange: (hostName: string) => void;
  onPortValueChange: (portValue: string) => void;
  onSelectFilterType: (filterType: string) => void;
  onSelectHeaderOp: (headerOp: string) => void;
  onSelectSchemeOp: (schemeOp: string) => void;
  onSelectServiceOp: (serviceOp: string) => void;
  onSelectStatusCodeOp: (statusCodeOp: string) => void;
  portValue: string;
  protocol: string;
  schemeOp: string;
  serviceOp: string;
  statusCodeOp: string;
  subServices: ServiceOverview[];
};

export const REQ_MOD = 'requestHeaderModifier';
export const RESP_MOD = 'responseHeaderModifier';
export const REQ_MIR = 'requestMirror';
export const REQ_RED = 'requestRedirect';
export const URL_REW = 'URLRewrite';
export const EXT_REF = 'extensionRef';

export const HTTP = 'HTTP';
export const GRPC = 'GRPC';
export const HTTPS = 'https';

export const SC301 = '301';
export const SC302 = '302';

const filterOptions = {
  [HTTP]: [REQ_MOD, RESP_MOD, REQ_RED, REQ_MIR],
  [GRPC]: [REQ_MOD, RESP_MOD, REQ_MIR]
};
const schemeOptions: string[] = [HTTP, HTTPS];
const statusOptions: string[] = [SC301, SC302];

export const SET = 'set';
export const ADD = 'add';
export const REMOVE = 'remove';

const allOptions = {
  [REQ_MOD]: [SET, ADD, REMOVE],
  [RESP_MOD]: [SET, ADD, REMOVE]
};

const addFilterStyle = kialiStyle({
  marginLeft: 'auto'
});

export const K8sFilterBuilder: React.FC<K8sFilterBuilderProps> = (props: K8sFilterBuilderProps) => {
  const [isFilterDropdown, setIsFilterDropdown] = React.useState<boolean>(false);
  const [isHeaderDropdown, setIsHeaderDropdown] = React.useState<boolean>(false);
  const [isSchemeDropdown, setIsSchemeDropdown] = React.useState<boolean>(false);
  const [isStatusCodeDropdown, setIsStatusCodeDropdown] = React.useState<boolean>(false);
  const [isServiceDropdown, setIsServiceDropdown] = React.useState<boolean>(false);

  const renderFilterOptions: string[] = allOptions[props.filterType];

  return (
    <InputGroup>
      <InputGroupItem>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsFilterDropdown(!isFilterDropdown)}
              data-test={'filtering-type-toggle'}
              isExpanded={isFilterDropdown}
            >
              {props.filterType}
            </MenuToggle>
          )}
          isOpen={isFilterDropdown}
          onOpenChange={(isOpen: boolean) => setIsFilterDropdown(isOpen)}
        >
          <DropdownList>
            {filterOptions[props.protocol].map((mode, index) => (
              <DropdownItem
                key={`${mode}_${index}`}
                value={mode}
                component="button"
                onClick={() => {
                  props.onSelectFilterType(mode);
                  setIsFilterDropdown(!isFilterDropdown);
                }}
                data-test={`filtering-type-${mode}`}
              >
                {mode}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      {(props.filterType === REQ_MOD || props.filterType === RESP_MOD) && (
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsHeaderDropdown(!isHeaderDropdown)}
              data-test={'header-type-toggle'}
              isExpanded={isHeaderDropdown}
            >
              {props.headerOp}
            </MenuToggle>
          )}
          isOpen={isHeaderDropdown}
          onOpenChange={(isOpen: boolean) => setIsHeaderDropdown(isOpen)}
        >
          <DropdownList>
            {renderFilterOptions.map((op, index) => (
              <DropdownItem
                key={`${op}_${index}`}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectHeaderOp(op);
                  setIsHeaderDropdown(!isHeaderDropdown);
                }}
                data-test={`header-type-${op}`}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      )}

      {(props.filterType === REQ_MOD || props.filterType === RESP_MOD) && (
        <TextInput
          id="filter-header-name-id"
          value={props.headerName}
          onChange={(_, value) => props.onHeaderNameChange(value)}
          placeholder="Header name..."
        />
      )}

      {(props.filterType === REQ_MOD || props.filterType === RESP_MOD) && props.headerOp !== REMOVE && (
        <TextInput
          id="filter-header-value-id"
          value={props.headerValue}
          onChange={(_, value) => props.onHeaderValueChange(value)}
          placeholder="Header Value..."
        />
      )}

      {props.filterType === REQ_RED && (
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsSchemeDropdown(!isSchemeDropdown)}
              data-test={'scheme-toggle'}
              isExpanded={isSchemeDropdown}
            >
              {props.schemeOp}
            </MenuToggle>
          )}
          isOpen={isSchemeDropdown}
          onOpenChange={(isOpen: boolean) => setIsSchemeDropdown(isOpen)}
        >
          <DropdownList>
            {schemeOptions.map((op, index) => (
              <DropdownItem
                key={`${op}_${index}`}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectSchemeOp(op);
                  setIsSchemeDropdown(!isSchemeDropdown);
                }}
                data-test={`scheme-${op}`}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      )}

      {props.filterType === REQ_RED && (
        <TextInput
          id="hostname"
          value={props.hostName}
          onChange={(_, value) => props.onHostNameChange(value)}
          placeholder="Hostname..."
        />
      )}

      {props.filterType === REQ_RED && (
        <TextInput
          id="portValue"
          value={props.portValue}
          onChange={(_, value) => props.onPortValueChange(value)}
          placeholder="Port..."
        />
      )}

      {props.filterType === REQ_RED && (
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsStatusCodeDropdown(!isStatusCodeDropdown)}
              data-test={'status-code'}
              isExpanded={isStatusCodeDropdown}
            >
              {props.statusCodeOp}
            </MenuToggle>
          )}
          isOpen={isStatusCodeDropdown}
          onOpenChange={(isOpen: boolean) => setIsStatusCodeDropdown(isOpen)}
        >
          <DropdownList>
            {statusOptions.map((op, index) => (
              <DropdownItem
                key={`${op}_${index}`}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectStatusCodeOp(op);
                  setIsStatusCodeDropdown(!isStatusCodeDropdown);
                }}
                data-test={`status-code-${op}`}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      )}

      {props.filterType === REQ_MIR && (
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsServiceDropdown(!isServiceDropdown)}
              data-test={'service'}
              isExpanded={isServiceDropdown}
            >
              {props.serviceOp}
            </MenuToggle>
          )}
          isOpen={isServiceDropdown}
          onOpenChange={(isOpen: boolean) => setIsServiceDropdown(isOpen)}
        >
          <DropdownList>
            {props.subServices.map((so, index) => (
              <DropdownItem
                key={`${so.name}_${index}`}
                value={`${so.name}:${getServicePort(so.ports)}`}
                component="button"
                onClick={() => {
                  props.onSelectServiceOp(`${so.name}:${getServicePort(so.ports)}`);
                  setIsServiceDropdown(!isServiceDropdown);
                }}
                data-test={`service-${so.name}`}
              >
                {`${so.name}:${getServicePort(so.ports)}`}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      )}

      <InputGroupItem className={addFilterStyle}>
        <Button
          variant={ButtonVariant.secondary}
          isDisabled={!props.isValid}
          onClick={props.onAddFilter}
          data-test="add-filter"
        >
          Add Filter
        </Button>
      </InputGroupItem>
    </InputGroup>
  );
};
