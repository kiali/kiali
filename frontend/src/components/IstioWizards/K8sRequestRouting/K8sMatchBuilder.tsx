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

type Props = {
  category: string;
  operator: string;
  headerName: string;
  queryParamName: string;
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onMatchHeaderNameChange: (headerName: string) => void;
  onQueryParamNameChange: (queryParamName: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;
};

type State = {
  isMatchDropdown: boolean;
  isOperatorDropdown: boolean;
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
  [METHOD]: ["CONNECT", "DELETE", GET, "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"]
};

const placeholderText = {
  [PATH]: 'Path value...',
  [HEADERS]: 'Header value...',
  [QUERY_PARAMS]: 'Query param value...',
};

class K8sMatchBuilder extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isMatchDropdown: false,
      isOperatorDropdown: false
    };
  }

  onMathOptionsToggle = () => {
    this.setState({
      isMatchDropdown: !this.state.isMatchDropdown
    });
  };

  onOperatorToggle = () => {
    this.setState({
      isOperatorDropdown: !this.state.isOperatorDropdown
    });
  };

  render() {
    const renderOpOptions: string[] = allOptions[this.props.category]
    return (
      <InputGroup>
        <Dropdown
          toggle={
            <DropdownToggle onToggle={this.onMathOptionsToggle} data-test={'requestmatching-header-toggle'}>
              {this.props.category}
            </DropdownToggle>
          }
          isOpen={this.state.isMatchDropdown}
          dropdownItems={matchOptions.map((mode, index) => (
            <DropdownItem
              key={mode + '_' + index}
              value={mode}
              component="button"
              onClick={() => {
                this.props.onSelectCategory(mode);
                this.onMathOptionsToggle();
              }}
              data-test={'requestmatching-header-' + mode}
            >
              {mode}
            </DropdownItem>
          ))}
        />
        {this.props.category === HEADERS && (
          <TextInput
            id="header-name-id"
            value={this.props.headerName}
            onChange={this.props.onMatchHeaderNameChange}
            placeholder="Header name..."
          />
        )}
        {this.props.category === QUERY_PARAMS && (
          <TextInput
            id="query-param-id"
            value={this.props.queryParamName}
            onChange={this.props.onQueryParamNameChange}
            placeholder="Query param name..."
          />
        )}
        <Dropdown
          toggle={
            <DropdownToggle onToggle={this.onOperatorToggle} data-test={'requestmatching-match-toggle'}>
              {this.props.operator}
            </DropdownToggle>
          }
          isOpen={this.state.isOperatorDropdown}
          dropdownItems={renderOpOptions.map((op, index) => (
            <DropdownItem
              key={op + '_' + index}
              value={op}
              component="button"
              onClick={() => {
                this.props.onSelectOperator(op);
                this.onOperatorToggle();
              }}
              data-test={'requestmatching-match-' + op}
            >
              {op}
            </DropdownItem>
          ))}
        />
        <TextInput
          id="match-value-id"
          value={this.props.matchValue}
          onChange={this.props.onMatchValueChange}
          placeholder={placeholderText[this.props.category]}
          isDisabled={this.props.category === METHOD}
        />
        <Button
          variant={ButtonVariant.secondary}
          disabled={!this.props.isValid}
          onClick={this.props.onAddMatch}
          data-test="add-match"
        >
          Add Match
        </Button>
      </InputGroup>
    );
  }
}

export default K8sMatchBuilder;
