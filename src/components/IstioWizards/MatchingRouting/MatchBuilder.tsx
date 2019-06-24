import * as React from 'react';
import { Button, DropdownButton, Form, FormControl, FormGroup, MenuItem } from 'patternfly-react';
import { style } from 'typestyle';

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

export const HEADERS = 'headers';
export const URI = 'uri';
export const SCHEME = 'scheme';
export const METHOD = 'method';
export const AUTHORITY = 'authority';

const matchOptions: string[] = [HEADERS, URI, SCHEME, METHOD, AUTHORITY];

export const EXACT = 'exact';
export const PREFIX = 'prefix';
export const REGEX = 'regex';

const opOptions: string[] = [EXACT, PREFIX, REGEX];

const placeholderText = {
  [HEADERS]: 'Header value...',
  [URI]: 'Uri value...',
  [SCHEME]: 'Scheme value...',
  [METHOD]: 'Method value...',
  [AUTHORITY]: 'Authority value...'
};

const matchStyle = style({
  marginLeft: 20
});

class MatchBuilder extends React.Component<Props> {
  render() {
    const matchItems: any[] = matchOptions.map((mode, index) => (
      <MenuItem key={mode + '-' + index} eventKey={mode} active={mode === this.props.category}>
        {mode}
      </MenuItem>
    ));
    const opItems: any[] = opOptions.map((op, index) => (
      <MenuItem key={op + '-' + index} eventKey={op} active={op === this.props.operator}>
        {op}
      </MenuItem>
    ));
    return (
      <Form inline={true}>
        <FormGroup validationState={this.props.isValid ? 'success' : 'error'}>
          <DropdownButton
            bsStyle="default"
            title={this.props.category}
            id="match-dropdown"
            onSelect={this.props.onSelectCategory}
          >
            {matchItems}
          </DropdownButton>
          {this.props.category === HEADERS && (
            <FormControl
              type="text"
              id="header-name-text"
              placeholder={'Header name...'}
              value={this.props.headerName}
              onChange={this.props.onHeaderNameChange}
            />
          )}
          <DropdownButton
            bsStyle="default"
            title={this.props.operator}
            id="operator-dropdown"
            onSelect={this.props.onSelectOperator}
          >
            {opItems}
          </DropdownButton>
          <FormControl
            type="text"
            id="header-value-text"
            placeholder={placeholderText[this.props.category]}
            value={this.props.matchValue}
            onChange={this.props.onMatchValueChange}
          />
          <Button
            bsStyle="default"
            className={matchStyle}
            disabled={!this.props.isValid}
            onClick={this.props.onAddMatch}
          >
            Add Match
          </Button>
        </FormGroup>
      </Form>
    );
  }
}

export default MatchBuilder;
