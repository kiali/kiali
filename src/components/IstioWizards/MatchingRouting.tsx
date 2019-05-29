import * as React from 'react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import Rules, { MOVE_TYPE, Rule } from './MatchingRouting/Rules';
import RuleBuilder from './MatchingRouting/RuleBuilder';
import { EXACT, HEADERS } from './MatchingRouting/MatchBuilder';

type Props = {
  serviceName: string;
  workloads: WorkloadOverview[];
  initRules: Rule[];
  onChange: (valid: boolean, rules: Rule[]) => void;
};

type State = {
  category: string;
  operator: string;
  routes: string[];
  matches: string[];
  headerName: string;
  matchValue: string;
  rules: Rule[];
  validationMsg: string;
};

const MSG_SAME_MATCHING = 'A Rule with same matching criteria is already added.';
const MSG_HEADER_NAME_NON_EMPTY = 'Header name must be non empty';
const MSG_HEADER_VALUE_NON_EMPTY = 'Header value must be non empty';
const MSG_ROUTES_NON_EMPTY = 'Routes must be non empty';

class MatchingRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      category: HEADERS,
      operator: EXACT,
      routes: this.props.workloads.map(w => w.name),
      matches: [],
      headerName: '',
      matchValue: '',
      rules: this.props.initRules,
      validationMsg: ''
    };
  }

  isMatchesIncluded = (rules: Rule[], rule: Rule) => {
    let found = false;
    for (let i = 0; i < rules.length; i++) {
      const item = rules[i];
      if (item.matches.length !== rule.matches.length) {
        continue;
      }
      found = item.matches.every(value => rule.matches.includes(value));
    }
    return found;
  };

  isValid = (rules: Rule[]): boolean => {
    // Corner case, an empty rules shouldn't be a valid scenario to create a VS/DR
    if (rules.length === 0) {
      return false;
    }
    const matchAll: number = this.matchAllIndex(rules);
    let isValid: boolean = true;
    for (let index = 0; index < this.state.rules.length; index++) {
      isValid = matchAll === -1 || index <= matchAll;
      if (!isValid) {
        return isValid;
      }
    }
    return isValid;
  };

  onAddMatch = () => {
    // Change only state when there is a match
    if (this.state.matchValue !== '') {
      this.setState(prevState => {
        const newMatch: string =
          prevState.category +
          (prevState.category === HEADERS ? ' [' + prevState.headerName + '] ' : ' ') +
          prevState.operator +
          ' ' +
          prevState.matchValue;
        prevState.matches.push(newMatch);
        return {
          matches: prevState.matches,
          headerName: '',
          matchValue: ''
        };
      });
    }
  };

  onAddRule = () => {
    this.setState(
      prevState => {
        // Just if there is a missing match
        if (this.state.matchValue !== '') {
          const newMatch: string =
            prevState.category +
            (prevState.category === HEADERS ? ' [' + prevState.headerName + '] ' : ' ') +
            prevState.operator +
            ' ' +
            prevState.matchValue;
          if (!prevState.matches.includes(newMatch)) {
            prevState.matches.push(newMatch);
          }
        }
        const newRule: Rule = {
          matches: prevState.matches,
          routes: prevState.routes
        };
        if (!this.isMatchesIncluded(prevState.rules, newRule)) {
          prevState.rules.push(newRule);
          return {
            matches: [],
            headerName: '',
            matchValue: '',
            rules: prevState.rules,
            validationMsg: ''
          };
        } else {
          return {
            matches: prevState.matches,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            rules: prevState.rules,
            validationMsg: MSG_SAME_MATCHING
          };
        }
      },
      () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
    );
  };

  onRemoveMatch = (matchToRemove: string) => {
    this.setState(prevState => {
      return {
        matches: prevState.matches.filter(m => matchToRemove !== m)
      };
    });
  };

  onRemoveRule = (index: number) => {
    this.setState(
      prevState => {
        prevState.rules.splice(index, 1);
        return {
          rules: prevState.rules
        };
      },
      () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
    );
  };

  onHeaderNameChange = (event: any) => {
    let validationMsg = '';
    if (this.state.matchValue !== '' && event.target.value === '') {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (this.state.matchValue === '' && event.target.value !== '') {
      validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: event.target.value,
      validationMsg: validationMsg
    });
  };

  onMatchValueChange = (event: any) => {
    let validationMsg = '';
    if (this.state.category === HEADERS) {
      if (this.state.headerName === '' && event.target.value !== '') {
        validationMsg = MSG_HEADER_NAME_NON_EMPTY;
      }
      if (this.state.headerName !== '' && event.target.value === '') {
        validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
      }
    }
    if (event.target.value === '') {
      validationMsg = '';
    }
    this.setState({
      matchValue: event.target.value,
      validationMsg: validationMsg
    });
  };

  onSelectRoutes = (routes: string[]) => {
    let validationMsg = '';
    if (routes.length === 0) {
      validationMsg = MSG_ROUTES_NON_EMPTY;
    }
    this.setState({
      routes: routes,
      validationMsg: validationMsg
    });
  };

  onMoveRule = (index: number, move: MOVE_TYPE) => {
    this.setState(
      prevState => {
        const sourceRule = prevState.rules[index];
        const targetIndex = move === MOVE_TYPE.UP ? index - 1 : index + 1;
        const targetRule = prevState.rules[targetIndex];
        prevState.rules[targetIndex] = sourceRule;
        prevState.rules[index] = targetRule;
        return {
          rules: prevState.rules
        };
      },
      () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
    );
  };

  matchAllIndex = (rules: Rule[]): number => {
    let matchAll: number = -1;
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule.matches.length === 0) {
        matchAll = index;
        break;
      }
    }
    return matchAll;
  };

  componentDidMount() {
    if (this.props.initRules.length > 0) {
      this.setState(
        {
          rules: this.props.initRules
        },
        () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
      );
    }
  }

  render() {
    return (
      <>
        <RuleBuilder
          category={this.state.category}
          operator={this.state.operator}
          headerName={this.state.headerName}
          matchValue={this.state.matchValue}
          isValid={this.state.validationMsg === ''}
          onSelectCategory={(category: string) => this.setState({ category: category })}
          onHeaderNameChange={this.onHeaderNameChange}
          onSelectOperator={(operator: string) => this.setState({ operator: operator })}
          onMatchValueChange={this.onMatchValueChange}
          onAddMatch={this.onAddMatch}
          matches={this.state.matches}
          onRemoveMatch={this.onRemoveMatch}
          workloads={this.props.workloads}
          routes={this.state.routes}
          onSelectRoutes={this.onSelectRoutes}
          validationMsg={this.state.validationMsg}
          onAddRule={this.onAddRule}
        />
        <Rules rules={this.state.rules} onRemoveRule={this.onRemoveRule} onMoveRule={this.onMoveRule} />
      </>
    );
  }
}

export default MatchingRouting;
