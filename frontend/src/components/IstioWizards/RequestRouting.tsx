import * as React from 'react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { Rules, MOVE_TYPE, Rule } from './RequestRouting/Rules';
import { RuleBuilder } from './RequestRouting/RuleBuilder';
import { ANYTHING, EXACT, HEADERS, PRESENCE } from './RequestRouting/MatchBuilder';
import { MSG_WEIGHTS_NOT_VALID, WorkloadWeight } from './TrafficShifting';
import { getDefaultWeights } from './WizardActions';
import { FaultInjectionRoute } from './FaultInjection';
import { TimeoutRetryRoute } from './RequestTimeouts';

type Props = {
  initRules: Rule[];
  onChange: (valid: boolean, rules: Rule[]) => void;
  serviceName: string;
  workloads: WorkloadOverview[];
};

type State = {
  category: string;
  faultInjectionRoute: FaultInjectionRoute;
  headerName: string;
  matchValue: string;
  matches: string[];
  operator: string;
  rules: Rule[];
  timeoutRetryRoute: TimeoutRetryRoute;
  validationMsg: string;
  workloadWeights: WorkloadWeight[];
};

const MSG_SAME_MATCHING = 'A Rule with same matching criteria is already added.';
const MSG_HEADER_NAME_NON_EMPTY = 'Header name must be non empty';
const MSG_HEADER_VALUE_NON_EMPTY = 'Header value must be non empty';
const MSG_VALUE_NON_EMPTY = 'Value must be non empty';

export class RequestRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      category: HEADERS,
      operator: EXACT,
      workloadWeights: getDefaultWeights(this.props.workloads),
      faultInjectionRoute: {
        workloads: [],
        delayed: false,
        delay: {
          percentage: {
            value: 100
          },
          fixedDelay: '5s'
        },
        isValidDelay: true,
        aborted: false,
        abort: {
          percentage: {
            value: 100
          },
          httpStatus: 503
        },
        isValidAbort: true
      },
      timeoutRetryRoute: {
        workloads: [],
        isTimeout: false,
        timeout: '2s',
        isValidTimeout: true,
        isRetry: false,
        retries: {
          attempts: 3,
          perTryTimeout: '2s',
          retryOn: 'gateway-error,connect-failure,refused-stream'
        },
        isValidRetry: true
      },
      matches: [],
      headerName: '',
      matchValue: '',
      rules: this.props.initRules,
      validationMsg: ''
    };
  }

  isMatchesIncluded = (rules: Rule[], rule: Rule): boolean => {
    let found = false;
    for (let i = 0; i < rules.length; i++) {
      const item = rules[i];
      if (item.matches.length !== rule.matches.length) {
        continue;
      }
      found = item.matches.every(value => rule.matches.includes(value));
      if (found) {
        break;
      }
    }
    return found;
  };

  isValid = (rules: Rule[]): boolean => {
    // Corner case, an empty rules shouldn't be a valid scenario to create a VS/DR
    if (rules.length === 0) {
      return false;
    }
    const matchAll: number = this.matchAllIndex(rules);
    let isValid = true;
    for (let index = 0; index < this.state.rules.length; index++) {
      isValid = matchAll === -1 || index <= matchAll;
      if (!isValid) {
        return isValid;
      }
    }
    return isValid;
  };

  onAddMatch = (): void => {
    this.setState(prevState => {
      let newMatch = '';
      let validationMsg = '';
      if (prevState.operator === PRESENCE && prevState.category === HEADERS) {
        // presence requires only header name
        if (prevState.headerName === '') {
          validationMsg = MSG_HEADER_NAME_NON_EMPTY;
        } else {
          newMatch = `${prevState.category}${prevState.category === HEADERS ? ` [${prevState.headerName}] ` : ' '}${
            prevState.operator
          } ${ANYTHING}`;
        }
      } else {
        if (this.state.matchValue !== '') {
          newMatch = `${prevState.category}${prevState.category === HEADERS ? ` [${prevState.headerName}] ` : ' '}${
            prevState.operator
          } ${prevState.matchValue}`;
        } else {
          if (prevState.category === HEADERS) {
            // header value required
            validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
          } else {
            // all other values required
            validationMsg = MSG_VALUE_NON_EMPTY;
          }
        }
      }

      if (newMatch !== '' && !prevState.matches.includes(newMatch)) {
        prevState.matches.push(newMatch);
      }
      return {
        matches: prevState.matches,
        headerName: '',
        matchValue: '',
        validationMsg: validationMsg
      };
    });
  };

  onAddRule = (): void => {
    this.setState(
      prevState => {
        const newWorkloadWeights: WorkloadWeight[] = [];
        prevState.workloadWeights.forEach(ww =>
          newWorkloadWeights.push({
            name: ww.name,
            weight: ww.weight,
            locked: ww.locked,
            maxWeight: ww.maxWeight,
            mirrored: ww.mirrored
          })
        );
        const newRule: Rule = {
          matches: Object.assign([], prevState.matches),
          workloadWeights: newWorkloadWeights
        };
        if (prevState.faultInjectionRoute.delayed && prevState.faultInjectionRoute.isValidDelay) {
          newRule.delay = prevState.faultInjectionRoute.delay;
        }
        if (prevState.faultInjectionRoute.aborted && prevState.faultInjectionRoute.isValidAbort) {
          newRule.abort = prevState.faultInjectionRoute.abort;
        }
        if (prevState.timeoutRetryRoute.isTimeout && prevState.timeoutRetryRoute.isValidTimeout) {
          newRule.timeout = prevState.timeoutRetryRoute.timeout;
        }
        if (prevState.timeoutRetryRoute.isRetry && prevState.timeoutRetryRoute.isValidRetry) {
          newRule.retries = prevState.timeoutRetryRoute.retries;
        }
        if (!this.isMatchesIncluded(prevState.rules, newRule)) {
          prevState.rules.push(newRule);
          return {
            matches: prevState.matches,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            rules: prevState.rules,
            validationMsg: '',
            faultInjectionRoute: prevState.faultInjectionRoute,
            timeoutRetryRoute: prevState.timeoutRetryRoute
          };
        } else {
          return {
            matches: prevState.matches,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            rules: prevState.rules,
            validationMsg: MSG_SAME_MATCHING,
            faultInjectionRoute: prevState.faultInjectionRoute,
            timeoutRetryRoute: prevState.timeoutRetryRoute
          };
        }
      },
      () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
    );
  };

  onRemoveMatch = (matchToRemove: string): void => {
    this.setState(prevState => {
      return {
        matches: prevState.matches.filter(m => matchToRemove !== m),
        validationMsg: prevState.validationMsg === MSG_SAME_MATCHING ? '' : prevState.validationMsg
      };
    });
  };

  onRemoveRule = (index: number): void => {
    this.setState(
      prevState => {
        prevState.rules.splice(index, 1);
        return {
          rules: prevState.rules,
          validationMsg: ''
        };
      },
      () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
    );
  };

  onHeaderNameChange = (headerName: string): void => {
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

  onMatchValueChange = (matchValue: string): void => {
    let validationMsg = '';
    if (this.state.category === HEADERS) {
      if (this.state.headerName === '' && matchValue !== '') {
        validationMsg = MSG_HEADER_NAME_NON_EMPTY;
      }
      if (this.state.headerName !== '' && matchValue === '') {
        validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
      }
    } else if (matchValue === '') {
      validationMsg = '';
    }
    this.setState({
      matchValue: matchValue,
      validationMsg: validationMsg
    });
  };

  onSelectWeights = (valid: boolean, workloads: WorkloadWeight[]): void => {
    this.setState({
      workloadWeights: workloads,
      validationMsg: !valid ? MSG_WEIGHTS_NOT_VALID : ''
    });
  };

  onMoveRule = (index: number, move: MOVE_TYPE): void => {
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
    let matchAll = -1;
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule.matches.length === 0) {
        matchAll = index;
        break;
      }
    }
    return matchAll;
  };

  componentDidMount(): void {
    if (this.props.initRules.length > 0) {
      this.setState(
        {
          rules: this.props.initRules
        },
        () => this.props.onChange(this.isValid(this.state.rules), this.state.rules)
      );
    }
  }

  render(): React.ReactNode {
    return (
      <>
        <RuleBuilder
          category={this.state.category}
          operator={this.state.operator}
          headerName={this.state.headerName}
          matchValue={this.state.matchValue}
          isValid={this.state.validationMsg === ''}
          onSelectCategory={(category: string) => {
            // PRESENCE operator only applies to HEADERS
            this.setState(prevState => {
              return {
                category: category,
                operator: prevState.operator === PRESENCE && category !== HEADERS ? EXACT : prevState.operator
              };
            });
          }}
          onHeaderNameChange={this.onHeaderNameChange}
          onSelectOperator={(operator: string) => this.setState({ operator: operator, validationMsg: '' })}
          onMatchValueChange={this.onMatchValueChange}
          onAddMatch={this.onAddMatch}
          matches={this.state.matches}
          onRemoveMatch={this.onRemoveMatch}
          workloads={this.props.workloads}
          weights={this.state.workloadWeights}
          onSelectWeights={this.onSelectWeights}
          faultInjectionRoute={this.state.faultInjectionRoute}
          onSelectFaultInjection={(valid, faultInjectionRoute) => {
            this.setState(_prevState => {
              return {
                faultInjectionRoute: faultInjectionRoute,
                validationMsg: !valid ? 'Fault Injection not valid' : ''
              };
            });
          }}
          timeoutRetryRoute={this.state.timeoutRetryRoute}
          onSelectTimeoutRetry={(valid, timeoutRetryRoute) => {
            this.setState(_prevState => {
              return {
                timeoutRetryRoute: timeoutRetryRoute,
                validationMsg: !valid ? 'Request Timeout not valid' : ''
              };
            });
          }}
          validationMsg={this.state.validationMsg}
          onAddRule={this.onAddRule}
        />
        <Rules rules={this.state.rules} onRemoveRule={this.onRemoveRule} onMoveRule={this.onMoveRule} />
      </>
    );
  }
}
