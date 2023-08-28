import * as React from 'react';
import { Button, InputGroup, TextInput, ButtonVariant, InputGroupItem } from '@patternfly/react-core';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core/deprecated';

type Props = {
  category: string;
  operator: string;
  headerName: string;
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onHeaderNameChange: (value: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (value: string) => void;
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

export class MatchBuilder extends React.Component<Props, State> {
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
        <InputGroupItem>
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
        </InputGroupItem>
        {this.props.category === HEADERS && (
          <TextInput
            id="header-name-id"
            value={this.props.headerName}
            onChange={(_, value) => this.props.onHeaderNameChange(value)}
            placeholder="Header name..."
          />
        )}
        <InputGroupItem>
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
        </InputGroupItem>
        {this.props.operator !== PRESENCE && (
          <TextInput
            id="match-value-id"
            value={this.props.matchValue}
            onChange={(_, value) => this.props.onMatchValueChange(value)}
            placeholder={placeholderText[this.props.category]}
          />
        )}
        <InputGroupItem>
          <Button
            variant={ButtonVariant.secondary}
            disabled={!this.props.isValid}
            onClick={this.props.onAddMatch}
            data-test="add-match"
          >
            Add Match
          </Button>
        </InputGroupItem>
      </InputGroup>
    );
  }
}
