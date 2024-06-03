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

type K8sMatchBuilderProps = {
  category: string;
  headerName: string;
  isValid: boolean;
  matchValue: string;
  onAddMatch: () => void;
  onMatchHeaderNameChange: (headerName: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onQueryParamNameChange: (queryParamName: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectOperator: (operator: string) => void;
  operator: string;
  protocol: string;
  queryParamName: string;
};

export const HTTP = 'HTTP';
export const GRPC = 'GRPC';

export const PATH = 'path';
export const HEADERS = 'headers';
export const QUERY_PARAMS = 'queryParams';
export const METHOD = 'method';

const matchOptions = {
  [HTTP]: [PATH, HEADERS, QUERY_PARAMS, METHOD],
  [GRPC]: [HEADERS, METHOD]
};

export const EXACT = 'Exact';
export const PREFIX = 'PathPrefix';
export const REGEX = 'RegularExpression';
export const GET = 'GET';

const allOptions = {
  [HTTP]: {
    [PATH]: [EXACT, PREFIX, REGEX],
    [HEADERS]: [EXACT, REGEX],
    [QUERY_PARAMS]: [EXACT, REGEX],
    [METHOD]: ['CONNECT', 'DELETE', GET, 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']
  },
  [GRPC]: {
    [HEADERS]: [EXACT, REGEX],
    [METHOD]: [EXACT, REGEX]
  }
};

const placeholderText = {
  [METHOD]: 'Method service...',
  [PATH]: 'Path value...',
  [HEADERS]: 'Header value...',
  [QUERY_PARAMS]: 'Query param value...'
};

export const K8sMatchBuilder: React.FC<K8sMatchBuilderProps> = (props: K8sMatchBuilderProps) => {
  const [isMatchDropdown, setIsMatchDropdown] = React.useState<boolean>(false);
  const [isOperatorDropdown, setIsOperatorDropdown] = React.useState<boolean>(false);

  const renderOpOptions: string[] = allOptions[props.protocol][props.category];

  return (
    <InputGroup>
      <InputGroupItem>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsMatchDropdown(!isMatchDropdown)}
              data-test={'requestmatching-header-toggle'}
              isExpanded={isMatchDropdown}
            >
              {props.category}
            </MenuToggle>
          )}
          isOpen={isMatchDropdown}
          onOpenChange={(isOpen: boolean) => setIsMatchDropdown(isOpen)}
        >
          <DropdownList>
            {matchOptions[props.protocol].map((mode, index) => (
              <DropdownItem
                key={`${mode}_${index}`}
                value={mode}
                component="button"
                onClick={() => {
                  props.onSelectCategory(mode);
                  setIsMatchDropdown(!isMatchDropdown);
                }}
                data-test={`requestmatching-header-${mode}`}
              >
                {mode}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      {props.category === HEADERS && (
        <TextInput
          id="header-name-id"
          value={props.headerName}
          onChange={(_, value) => props.onMatchHeaderNameChange(value)}
          placeholder="Header name..."
        />
      )}

      {props.category === METHOD && props.protocol === GRPC && (
        <TextInput
          id="method-name-id"
          value={props.headerName}
          onChange={(_, value) => props.onMatchHeaderNameChange(value)}
          placeholder="Method name..."
        />
      )}

      {props.category === QUERY_PARAMS && (
        <TextInput
          id="query-param-id"
          value={props.queryParamName}
          onChange={(_, value) => props.onQueryParamNameChange(value)}
          placeholder="Query param name..."
        />
      )}

      <InputGroupItem>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsOperatorDropdown(!isOperatorDropdown)}
              data-test={'requestmatching-match-toggle'}
              isExpanded={isOperatorDropdown}
            >
              {props.operator}
            </MenuToggle>
          )}
          isOpen={isOperatorDropdown}
          onOpenChange={(isOpen: boolean) => setIsOperatorDropdown(isOpen)}
        >
          <DropdownList>
            {renderOpOptions.map((op, index) => (
              <DropdownItem
                key={`${op}_${index}`}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectOperator(op);
                  setIsOperatorDropdown(!isOperatorDropdown);
                }}
                data-test={`requestmatching-match-${op}`}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      {props.protocol === GRPC && (
        <InputGroupItem isFill>
          <TextInput
            id="match-value-id"
            value={props.matchValue}
            onChange={(_, value) => props.onMatchValueChange(value)}
            placeholder={placeholderText[props.category]}
          />
        </InputGroupItem>
      )}

      {props.protocol === HTTP && (
        <InputGroupItem isFill>
          <TextInput
            id="match-value-id"
            value={props.matchValue}
            onChange={(_, value) => props.onMatchValueChange(value)}
            placeholder={placeholderText[props.category]}
            isDisabled={props.category === METHOD}
          />
        </InputGroupItem>
      )}

      <InputGroupItem>
        <Button
          variant={ButtonVariant.secondary}
          disabled={!props.isValid}
          onClick={props.onAddMatch}
          data-test="add-match"
        >
          Add Match
        </Button>
      </InputGroupItem>
    </InputGroup>
  );
};
