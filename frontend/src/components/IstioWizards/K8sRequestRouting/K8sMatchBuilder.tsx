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
  onSelectCategory: (category: string) => void;
  onMatchHeaderNameChange: (headerName: string) => void;
  onQueryParamNameChange: (queryParamName: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;
  operator: string;
  queryParamName: string;
};

export const PATH = 'path';
export const HEADERS = 'headers';
export const QUERY_PARAMS = 'queryParams';
export const METHOD = 'method';

const matchOptions: string[] = [PATH, HEADERS, QUERY_PARAMS, METHOD];

export const EXACT = 'Exact';
export const PREFIX = 'PathPrefix';
export const REGEX = 'RegularExpression';
export const GET = 'GET';

const allOptions = {
  [PATH]: [EXACT, PREFIX, REGEX],
  [HEADERS]: [EXACT, REGEX],
  [QUERY_PARAMS]: [EXACT, REGEX],
  [METHOD]: ['CONNECT', 'DELETE', GET, 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']
};

const placeholderText = {
  [PATH]: 'Path value...',
  [HEADERS]: 'Header value...',
  [QUERY_PARAMS]: 'Query param value...'
};

export const K8sMatchBuilder: React.FC<K8sMatchBuilderProps> = (props: K8sMatchBuilderProps) => {
  const [isMatchDropdown, setIsMatchDropdown] = React.useState<boolean>(false);
  const [isOperatorDropdown, setIsOperatorDropdown] = React.useState<boolean>(false);

  const renderOpOptions: string[] = allOptions[props.category];

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
            {matchOptions.map((mode, index) => (
              <DropdownItem
                key={mode + '_' + index}
                value={mode}
                component="button"
                onClick={() => {
                  props.onSelectCategory(mode);
                  setIsMatchDropdown(!isMatchDropdown);
                }}
                data-test={'requestmatching-header-' + mode}
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
                key={op + '_' + index}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectOperator(op);
                  setIsOperatorDropdown(!isOperatorDropdown);
                }}
                data-test={'requestmatching-match-' + op}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      <InputGroupItem isFill>
        <TextInput
          id="match-value-id"
          value={props.matchValue}
          onChange={(_, value) => props.onMatchValueChange(value)}
          placeholder={placeholderText[props.category]}
          isDisabled={props.category === METHOD}
        />
      </InputGroupItem>

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
