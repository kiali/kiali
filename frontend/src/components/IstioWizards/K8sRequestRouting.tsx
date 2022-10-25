import * as React from 'react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import K8sRules, {MOVE_TYPE, K8sRule} from './K8sRequestRouting/K8sRules';
import K8sRuleBuilder, {K8sRouteBackendRef} from './K8sRequestRouting/K8sRuleBuilder';
import { EXACT, PATH, METHOD, GET, HEADERS, QUERY_PARAMS } from './K8sRequestRouting/K8sMatchBuilder';
import {getDefaultBackendRefs} from './WizardActions';

type Props = {
  serviceName: string;
  workloads: WorkloadOverview[];
  initRules: K8sRule[];
  onChange: (valid: boolean, k8sRules: K8sRule[]) => void;
};

type State = {
  category: string;
  operator: string;
  backendRefs: K8sRouteBackendRef[];
  matches: string[];
  headerName: string;
  queryParamName: string;
  matchValue: string;
  k8sRules: K8sRule[];
  validationMsg: string;
};

const MSG_SAME_MATCHING = 'A Rule with same matching criteria is already added.';
const MSG_HEADER_NAME_NON_EMPTY = 'Header name must be non empty';
const MSG_HEADER_VALUE_NON_EMPTY = 'Header value must be non empty';
const MSG_QUERY_NAME_NON_EMPTY = 'Query name must be non empty';
const MSG_QUERY_VALUE_NON_EMPTY = 'Query value must be non empty';

class K8sRequestRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      category: PATH,
      operator: EXACT,
      backendRefs: getDefaultBackendRefs(this.props.workloads),
      matches: [],
      headerName: '',
      queryParamName: '',
      matchValue: '',
      k8sRules: this.props.initRules,
      validationMsg: ''
    };
  }

  isMatchesIncluded = (k8sRules: K8sRule[], k8sRule: K8sRule) => {
    let found = false;
    for (let i = 0; i < k8sRules.length; i++) {
      const item = k8sRules[i];
      if (item.matches.length !== k8sRule.matches.length) {
        continue;
      }
      found = item.matches.every(value => k8sRule.matches.includes(value));
      if (found) {
        break;
      }
    }
    return found;
  };

  isValid = (k8sRules: K8sRule[]): boolean => {
    // Corner case, an empty rules shouldn't be a valid scenario to create a VS/DR
    if (k8sRules.length === 0) {
      return false;
    }
    const matchAll: number = this.matchAllIndex(k8sRules);
    let isValid: boolean = true;
    for (let index = 0; index < this.state.k8sRules.length; index++) {
      isValid = matchAll === -1 || index <= matchAll;
      if (!isValid) {
        return isValid;
      }
    }
    return isValid;
  };

  onAddMatch = () => {
    this.setState(prevState => {
      let newMatch: string;
      if (prevState.category === PATH) {
        newMatch = prevState.category + ' ' + prevState.operator + ' ' + prevState.matchValue;
      } else if (prevState.category === HEADERS) {
        newMatch = prevState.category + ' [' + prevState.headerName + '] ' + prevState.operator + ' ' + prevState.matchValue;
      } else if (prevState.category === QUERY_PARAMS) {
        newMatch = prevState.category + ' [' + prevState.queryParamName + '] ' + prevState.operator + ' ' + prevState.matchValue;
      } else {
        newMatch = prevState.category + ' [' + prevState.operator + ']';
      }
      if (!prevState.matches.includes(newMatch)) {
        prevState.matches.push(newMatch);
      }
      return {
        matches: prevState.matches,
        headerName: '',
        matchValue: ''
      };
    });
  };

  onAddK8sRule = () => {
    this.setState(
      prevState => {
        const newBackendRefs: K8sRouteBackendRef[] = [];
        prevState.backendRefs.forEach(br =>
          newBackendRefs.push({
            name: br.name,
            weight: br.weight
          })
        );
        const newRule: K8sRule = {
          matches: Object.assign([], prevState.matches),
          backendRefs: newBackendRefs
        };
        if (!this.isMatchesIncluded(prevState.k8sRules, newRule)) {
          prevState.k8sRules.push(newRule);
          return {
            matches: prevState.matches,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            k8sRules: prevState.k8sRules,
            validationMsg: ''
          };
        } else {
          return {
            matches: prevState.matches,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            k8sRules: prevState.k8sRules,
            validationMsg: MSG_SAME_MATCHING
          };
        }
      },
      () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
    );
  };

  onRemoveMatch = (matchToRemove: string) => {
    this.setState(prevState => {
      return {
        matches: prevState.matches.filter(m => matchToRemove !== m),
        validationMsg: prevState.validationMsg === MSG_SAME_MATCHING ? '' : prevState.validationMsg
      };
    });
  };

  onRemoveRule = (index: number) => {
    this.setState(
      prevState => {
        prevState.k8sRules.splice(index, 1);
        return {
          k8sRules: prevState.k8sRules,
          validationMsg: ''
        };
      },
      () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
    );
  };

  onHeaderNameChange = (headerName: string) => {
    let validationMsg = '';
    if (this.state.matchValue !== '' && headerName === '') {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (this.state.matchValue === '' && headerName !== '') {
      validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: headerName,
      validationMsg: validationMsg
    });
  };

  onQueryParamNameChange = (queryParamName: string) => {
    let validationMsg = '';
    if (this.state.matchValue !== '' && queryParamName === '') {
      validationMsg = MSG_QUERY_NAME_NON_EMPTY;
    }
    if (this.state.matchValue === '' && queryParamName !== '') {
      validationMsg = MSG_QUERY_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: queryParamName,
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
    if (this.state.category === QUERY_PARAMS) {
      if (this.state.headerName === '' && matchValue !== '') {
        validationMsg = MSG_QUERY_NAME_NON_EMPTY;
      }
      if (this.state.headerName !== '' && matchValue === '') {
        validationMsg = MSG_QUERY_VALUE_NON_EMPTY;
      }
    }
    if (matchValue === '') {
      validationMsg = '';
    }
    this.setState({
      matchValue: matchValue,
      validationMsg: validationMsg
    });
  };

  onMoveRule = (index: number, move: MOVE_TYPE) => {
    this.setState(
      prevState => {
        const sourceRule = prevState.k8sRules[index];
        const targetIndex = move === MOVE_TYPE.UP ? index - 1 : index + 1;
        const targetRule = prevState.k8sRules[targetIndex];
        prevState.k8sRules[targetIndex] = sourceRule;
        prevState.k8sRules[index] = targetRule;
        return {
          k8sRules: prevState.k8sRules
        };
      },
      () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
    );
  };

  matchAllIndex = (k8sRules: K8sRule[]): number => {
    let matchAll: number = -1;
    for (let index = 0; index < k8sRules.length; index++) {
      const rule = k8sRules[index];
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
          k8sRules: this.props.initRules
        },
        () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
      );
    }
  }

  render() {
    return (
      <>
        <K8sRuleBuilder
          category={this.state.category}
          operator={this.state.operator}
          headerName={this.state.headerName}
          queryParamName={this.state.queryParamName}
          matchValue={this.state.matchValue}
          isValid={this.state.validationMsg === ''}
          onSelectCategory={(category: string) => {
            this.setState(_ => {
              return {
                category: category,
                operator: category === METHOD ? GET : EXACT
              };
            });
          }}
          onHeaderNameChange={this.onHeaderNameChange}
          onQueryParamNameChange={this.onQueryParamNameChange}
          onSelectOperator={(operator: string) => this.setState({ operator: operator })}
          onMatchValueChange={this.onMatchValueChange}
          onAddMatch={this.onAddMatch}
          matches={this.state.matches}
          onRemoveMatch={this.onRemoveMatch}
          workloads={this.props.workloads}
          backendRefs={this.state.backendRefs}
          validationMsg={this.state.validationMsg}
          onAddRule={this.onAddK8sRule}
        />
        <K8sRules k8sRules={this.state.k8sRules} onRemoveRule={this.onRemoveRule} onMoveRule={this.onMoveRule} />
      </>
    );
  }
}

export default K8sRequestRouting;
