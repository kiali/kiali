import { Criteria, HeaderMatch, Host, HttpMatch, initCriteria, URIMatch } from '../../../../types/Iter8';
import * as React from 'react';
import { Button } from '@patternfly/react-core';
import Matches from './../../../../components/IstioWizards/RequestRouting/Matches';
import ExperimentMatchBuilder, { ANYTHING, EXACT, HEADERS, PRESENCE, REGEX, URI } from './ExperimentMatchBuilder';
import { style } from 'typestyle';
import { PfColors } from './../../../../components/Pf/PfColors';
import ExperimentRules, { MOVE_TYPE, Rule } from './ExperimentRules';
import { OnRemoveFromListOptions } from './ExperimentCreatePage';

const MSG_SAME_MATCHING = 'A Rule with same matching criteria is already added.';
const MSG_HEADER_NAME_NON_EMPTY = 'Header name must be non empty';
const MSG_HEADER_VALUE_NON_EMPTY = 'Header value must be non empty';

const addRuleStyle = style({
  width: '100%',
  textAlign: 'right'
});

const validationStyle = style({
  marginRight: 20,
  color: PfColors.Red100,
  display: 'inline'
});

type Props = {
  matches: HttpMatch[];

  onRemove: (type: OnRemoveFromListOptions, index: number) => void;
  onAdd: (criteria: Criteria, host: Host, match: any) => void;
  onMoveMatchRule: (index: number, move: MOVE_TYPE) => void;
};

type URIMatchState = {
  uriMatchString?: string;
  uriMatch?: URIMatch;
};

export type TrafficState = {
  uriMatchString?: string;
  uriMatch?: URIMatch;
  matchStringToHeaderMatch: { [matchString: string]: HeaderMatch };

  focusElementName: string;
  validName: boolean;

  validationMsg: string;

  // Match state
  // MatchBuilder props
  category: string;
  operator: string;
  headerName: string;
  matchValue: string;
  isValid: boolean;
};

export const initMatch = (): TrafficState => ({
  matchStringToHeaderMatch: {},

  focusElementName: 'Unknown',
  validName: false,

  validationMsg: '',

  // Match state
  // MatchBuilder props
  category: URI,
  operator: EXACT,
  headerName: '',
  matchValue: '',
  isValid: true
});

// Create Success Criteria, can be multiple with same metric, but different sampleSize, etc...
class ExperimentTrafficForm extends React.Component<Props, TrafficState> {
  constructor(props: Props) {
    super(props);
    this.state = initMatch();
  }

  // TODO: Is this necessary?
  componentDidUpdate() {
    if (this.state.focusElementName !== '') {
      const focusElement = document.getElementById(this.state.focusElementName);
      if (focusElement) {
        focusElement.focus();
      }
    }
  }

  isMatchesIncluded = (rules: Rule[], newRule: Rule) => {
    return rules.some(rule => {
      return (
        rule.matches.length === newRule.matches.length && rule.matches.every(match => newRule.matches.includes(match))
      );
    });
  };

  onHeaderNameChange = (headerName: string) => {
    let validationMsg = '';
    if (this.state.matchValue !== '' && headerName === '') {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (this.state.matchValue === '' && headerName !== '' && this.state.operator !== PRESENCE) {
      validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: headerName,
      validationMsg: validationMsg
    });
  };

  onMatchValueChange = (matchValue: string) => {
    let validationMsg = '';
    if (this.state.category === HEADERS) {
      if (this.state.headerName === '' && matchValue !== '') {
        validationMsg = MSG_HEADER_NAME_NON_EMPTY;
      }
      if (this.state.headerName !== '' && matchValue === '') {
        validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
      }
    }
    if (matchValue === '') {
      validationMsg = '';
    }

    // Setting match state
    this.setState({
      matchValue: matchValue,
      validationMsg: validationMsg
    });
  };

  // Simply for converting between HttpMatch and Rule types
  // Only supports URI and HEADERS
  httpMatchesToRules = (matches: HttpMatch[]): Rule[] => {
    return matches.map(match => {
      let rule: Rule = {
        matches: [],
        workloadWeights: []
      };

      // URI and header matches are added separately
      if (match.uri && match.uri.match && match.uri.stringMatch) {
        rule.matches.push(this.matchToIstioMatchString(URI, match.uri.match, match.uri.stringMatch));
      }

      if (match.headers) {
        match.headers.forEach(header => {
          rule.matches.push(this.matchToIstioMatchString(HEADERS, header.match, header.stringMatch, header.key));
        });
      }

      return rule;
    });
  };

  matchToIstioMatchString = (
    matchOption: string,
    operator: string,
    stringMatch: string,
    headerName?: string
  ): string => {
    if (stringMatch !== '') {
      return matchOption + (matchOption === HEADERS ? ' [' + headerName + '] ' : ' ') + operator + ' ' + stringMatch;
    } else {
      return matchOption + ' [' + headerName + '] ' + REGEX + ' ' + ANYTHING;
    }
  };

  getIstioMatchStrings = () => {
    const matches = Object.keys(this.state.matchStringToHeaderMatch);
    if (this.state.uriMatchString) {
      matches.push(this.state.uriMatchString);
    }

    return matches;
  };

  onAddMatch = () => {
    this.setState(prevState => {
      const istioMatchString = this.matchToIstioMatchString(
        prevState.category,
        prevState.operator,
        prevState.matchValue,
        prevState.headerName
      );

      const uriMatchState: URIMatchState = {};

      if (prevState.category === URI && prevState.matchValue.length > 0) {
        uriMatchState.uriMatchString = istioMatchString;
        uriMatchState.uriMatch = {
          match: prevState.operator,
          stringMatch: prevState.matchValue
        };
      } else if (prevState.category === HEADERS) {
        const httpMatch: HeaderMatch = {
          key: prevState.headerName,
          match: prevState.operator,
          stringMatch: prevState.matchValue
        };

        prevState.matchStringToHeaderMatch[istioMatchString] = httpMatch;
      }

      return {
        /**
         * URIMatchState just sets the uriMatchString and the uriMatch in the
         * state.
         *
         * By using the destructure statement, we can avoid calling setState()
         * multiple times.
         */
        ...uriMatchState,

        matchStringToHeaderMatch: prevState.matchStringToHeaderMatch,

        // Reset headerName and matchValue for next match
        headerName: '',
        matchValue: ''
      };
    });
  };

  onRemoveMatch = (matchToRemove: string) => {
    this.setState(prevState => {
      const uriMatchState: URIMatchState = {};

      if (prevState.uriMatchString) {
        uriMatchState.uriMatchString = undefined;
        uriMatchState.uriMatch = undefined;
      } else if (matchToRemove in prevState.matchStringToHeaderMatch) {
        delete prevState.matchStringToHeaderMatch[matchToRemove];
      }

      return {
        /**
         * URIMatchState just sets the uriMatchString and the uriMatch in the
         * state.
         *
         * By using the destructure statement, we can avoid calling setState()
         * multiple times.
         */
        ...uriMatchState,

        matchStringToHeaderMatch: prevState.matchStringToHeaderMatch,
        validationMsg: prevState.validationMsg === MSG_SAME_MATCHING ? '' : prevState.validationMsg
      };
    });
  };

  onAddRule = (rules: Rule[]) => {
    if (this.state.uriMatch?.match && this.state.uriMatch?.stringMatch) {
      const matches = this.getIstioMatchStrings();

      const rule: Rule = {
        matches,
        workloadWeights: []
      };

      const httpMatch: HttpMatch = {
        uri: {
          match: this.state.uriMatch.match,
          stringMatch: this.state.uriMatch.stringMatch
        },
        headers: Object.values(this.state.matchStringToHeaderMatch)
      };

      if (!this.isMatchesIncluded(rules, rule)) {
        this.props.onAdd(initCriteria(), { name: '', gateway: '' }, httpMatch);
      }
    }
  };

  render() {
    const rules = this.httpMatchesToRules(this.props.matches);
    const matches = this.getIstioMatchStrings();

    return (
      <>
        <div style={{ marginTop: '20px' }}>
          <ExperimentMatchBuilder
            category={this.state.category}
            operator={this.state.operator}
            headerName={this.state.headerName}
            matchValue={this.state.matchValue}
            isValid={this.state.validationMsg === ''}
            onSelectCategory={(category: string) => {
              this.setState(prevState => {
                // PRESENCE operator only applies to HEADERS
                return {
                  category: category,
                  operator: prevState.operator === PRESENCE && category !== HEADERS ? EXACT : prevState.operator
                };
              });
            }}
            onHeaderNameChange={this.onHeaderNameChange}
            onSelectOperator={(operator: string) => this.setState({ operator: operator })}
            onMatchValueChange={this.onMatchValueChange}
            onAddMatch={this.onAddMatch}
          />
          <Matches matches={matches} onRemoveMatch={this.onRemoveMatch} />
        </div>
        <div className={addRuleStyle}>
          <span>
            {this.state.validationMsg.length > 0 && <div className={validationStyle}>{this.state.validationMsg}</div>}
            <Button
              variant="secondary"
              isDisabled={!this.state.isValid}
              onClick={() => {
                this.onAddRule(rules);
              }}
            >
              Add Rule
            </Button>
          </span>
        </div>
        <ExperimentRules
          rules={rules}
          onRemoveRule={index => {
            this.props.onRemove(OnRemoveFromListOptions.Match, index);
          }}
          onMoveRule={this.props.onMoveMatchRule}
        />
      </>
    );
  }
}

export default ExperimentTrafficForm;
