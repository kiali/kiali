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
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onHeaderNameChange: (headerName: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;
};

type State = {
  isMatchDropdown: boolean;
  isOperatorDropdown: boolean;
};

export const HEADERS = 'headers';
export const URI = 'uri';
export const SCHEME = 'scheme';
export const METHOD = 'method';
export const AUTHORITY = 'authority';

const matchOptions: string[] = [HEADERS, URI, SCHEME, METHOD, AUTHORITY];

export const EXACT = 'exact';
export const PREFIX = 'prefix';
export const REGEX = 'regex';

// Pseudo operator
export const PRESENCE = 'is present';
export const ANYTHING = '^.*$';

const opOptions: string[] = [EXACT, PREFIX, REGEX];

const placeholderText = {
  [HEADERS]: 'Header value...',
  [URI]: 'Uri value...',
  [SCHEME]: 'Scheme value...',
  [METHOD]: 'Method value...',
  [AUTHORITY]: 'Authority value...'
};

class MatchBuilder extends React.Component<Props, State> {
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
    const renderOpOptions: string[] = this.props.category === HEADERS ? [PRESENCE, ...opOptions] : opOptions;
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
            onChange={this.props.onHeaderNameChange}
            placeholder="Header name..."
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
        {this.props.operator !== PRESENCE && (
          <TextInput
            id="match-value-id"
            value={this.props.matchValue}
            onChange={this.props.onMatchValueChange}
            placeholder={placeholderText[this.props.category]}
          />
        )}
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

export default MatchBuilder;
