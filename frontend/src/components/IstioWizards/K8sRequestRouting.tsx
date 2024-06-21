import * as React from 'react';
import { K8sRules, MOVE_TYPE, K8sRule } from './K8sRequestRouting/K8sRules';
import { K8sRuleBuilder } from './K8sRequestRouting/K8sRuleBuilder';
import { K8sRouteBackendRef } from './K8sTrafficShifting';
import { EXACT, PATH, METHOD, GET, HEADERS, QUERY_PARAMS, GRPC } from './K8sRequestRouting/K8sMatchBuilder';
import { getDefaultBackendRefs, getDefaultService } from './WizardActions';
import { ServiceOverview } from '../../types/ServiceList';
import { REMOVE, REQ_MOD, RESP_MOD, SET, HTTP, SC301, REQ_RED, REQ_MIR } from './K8sRequestRouting/K8sFilterBuilder';
import { isServerHostValid } from '../../utils/IstioConfigUtils';

type Props = {
  initRules: K8sRule[];
  onChange: (valid: boolean, k8sRules: K8sRule[]) => void;
  protocol: string;
  subServices: ServiceOverview[];
};

type State = {
  backendRefs: K8sRouteBackendRef[];
  category: string;
  filterType: string;
  filterValue: string;
  filters: string[];
  headerName: string;
  headerOp: string;
  headerValue: string;
  hostName: string;
  k8sRules: K8sRule[];
  matchValue: string;
  matches: string[];
  methodName: string;
  methodService: string;
  operator: string;
  portValue: string;
  queryParamName: string;
  schemeOp: string;
  serviceOp: string;
  statusCodeOp: string;
  validationMsg: string;
};

const MSG_SAME_MATCHING = 'A Rule with same matching criteria is already added.';
const MSG_HEADER_NAME_NON_EMPTY = 'Header name must be non empty';
const MSG_HEADER_VALUE_NON_EMPTY = 'Header value must be non empty';
const MSG_METHOD_NAME_NON_EMPTY = 'Method name must be non empty';
const MSG_METHOD_SERVICE_NON_EMPTY = 'Method service must be non empty';
const MSG_HOSTNAME_NON_EMPTY = 'Hostname is incorrect';
const MSG_PORT_NON_EMPTY = 'Port is incorrect';
const MSG_QUERY_NAME_NON_EMPTY = 'Query name must be non empty';
const MSG_QUERY_VALUE_NON_EMPTY = 'Query value must be non empty';

export class K8sRequestRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      category: HEADERS,
      operator: EXACT,
      backendRefs: getDefaultBackendRefs(this.props.subServices),
      matches: [],
      headerName: '',
      queryParamName: '',
      matchValue: '',
      methodName: '',
      methodService: '',
      k8sRules: this.props.initRules,
      validationMsg: '',
      filterValue: '',
      filters: [],
      headerOp: SET,
      schemeOp: HTTP,
      statusCodeOp: SC301,
      serviceOp: getDefaultService(this.props.subServices),
      headerValue: '',
      hostName: '',
      portValue: '',
      filterType: REQ_MOD
    };
  }

  isMatchesIncluded = (k8sRules: K8sRule[], k8sRule: K8sRule): boolean => {
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
    let isValid = true;
    for (let index = 0; index < this.state.k8sRules.length; index++) {
      isValid = matchAll === -1 || index <= matchAll;
      if (!isValid) {
        return isValid;
      }
    }
    return isValid;
  };

  onAddMatch = (): void => {
    this.setState(prevState => {
      if (this.state.matchValue !== '') {
        let newMatch: string;
        if (prevState.category === PATH) {
          newMatch = `${prevState.category} ${prevState.operator} ${prevState.matchValue}`;
        } else if (prevState.category === HEADERS) {
          newMatch = `${prevState.category} [${prevState.headerName}] ${prevState.operator} ${prevState.matchValue}`;
        } else if (prevState.category === QUERY_PARAMS) {
          newMatch = `${prevState.category} ${prevState.queryParamName} ${prevState.operator} ${prevState.matchValue}`;
        } else if (prevState.category === METHOD || this.props.protocol === GRPC) {
          newMatch = `${prevState.category} ${prevState.methodName} ${prevState.operator} ${prevState.methodService}`;
        } else {
          newMatch = `${prevState.category} ${prevState.operator}`;
        }
        if (!prevState.matches.includes(newMatch)) {
          prevState.matches.push(newMatch);
        }
      }
      return {
        matches: prevState.matches,
        headerName: '',
        queryParamName: '',
        matchValue: ''
      };
    });
  };

  onAddK8sRule = (): void => {
    this.setState(
      prevState => {
        const newBackendRefs: K8sRouteBackendRef[] = [];
        prevState.backendRefs.forEach(br =>
          newBackendRefs.push({
            name: br.name,
            weight: br.weight,
            port: br.port ? br.port : 80
          })
        );
        const newRule: K8sRule = {
          matches: Object.assign([], prevState.matches),
          filters: Object.assign([], prevState.filters),
          backendRefs: newBackendRefs
        };
        if (!this.isMatchesIncluded(prevState.k8sRules, newRule)) {
          prevState.k8sRules.push(newRule);
          return {
            matches: prevState.matches,
            filters: prevState.filters,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            methodName: prevState.methodName,
            methodService: prevState.methodService,
            k8sRules: prevState.k8sRules,
            validationMsg: ''
          };
        } else {
          return {
            matches: prevState.matches,
            filters: prevState.filters,
            headerName: prevState.headerName,
            matchValue: prevState.matchValue,
            methodName: prevState.methodName,
            methodService: prevState.methodService,
            k8sRules: prevState.k8sRules,
            validationMsg: MSG_SAME_MATCHING
          };
        }
      },
      () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
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
        prevState.k8sRules.splice(index, 1);
        return {
          k8sRules: prevState.k8sRules,
          validationMsg: ''
        };
      },
      () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
    );
  };

  onMatchHeaderNameChange = (headerName: string): void => {
    let validationMsg = '';
    if (!headerName && !!this.state.matchValue) {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (!this.state.matchValue && !!headerName) {
      validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: headerName,
      validationMsg: validationMsg
    });
  };

  onMatchMethodNameChange = (methodName: string): void => {
    let validationMsg = '';
    if (!methodName && !!this.state.matchValue) {
      validationMsg = MSG_METHOD_NAME_NON_EMPTY;
    }
    if (!this.state.matchValue && !!methodName) {
      validationMsg = MSG_METHOD_SERVICE_NON_EMPTY;
    }
    this.setState({
      methodName: methodName,
      validationMsg: validationMsg
    });
  };

  onMatchMethodServiceChange = (methodService: string): void => {
    let validationMsg = '';
    if (methodService !== '' && !this.state.methodName) {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (!methodService && !!this.state.methodName) {
      validationMsg = MSG_METHOD_SERVICE_NON_EMPTY;
    }
    this.setState({
      methodService: methodService,
      validationMsg: validationMsg
    });
  };

  onHeaderNameChange = (headerName: string): void => {
    let validationMsg = '';
    if (headerName === '' && !!this.state.headerValue) {
      validationMsg = MSG_HEADER_NAME_NON_EMPTY;
    }
    if (headerName !== '' && !this.state.headerValue && this.state.headerOp !== REMOVE) {
      validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
    }
    this.setState({
      headerName: headerName,
      validationMsg: validationMsg
    });
  };

  onQueryParamNameChange = (queryParamName: string): void => {
    let validationMsg = '';
    if (this.state.matchValue !== '' && queryParamName === '') {
      validationMsg = MSG_QUERY_NAME_NON_EMPTY;
    }
    if (this.state.matchValue === '' && queryParamName !== '') {
      validationMsg = MSG_QUERY_VALUE_NON_EMPTY;
    }
    this.setState({
      queryParamName: queryParamName,
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
    }
    if (this.state.category === QUERY_PARAMS) {
      if (this.state.queryParamName === '' && matchValue !== '') {
        validationMsg = MSG_QUERY_NAME_NON_EMPTY;
      }
      if (this.state.queryParamName !== '' && matchValue === '') {
        validationMsg = MSG_QUERY_VALUE_NON_EMPTY;
      }
    }

    this.setState({
      matchValue: matchValue,
      validationMsg: validationMsg
    });
  };

  onSelectWeights = (backendRefs: K8sRouteBackendRef[]): void => {
    this.setState({
      backendRefs: backendRefs,
      validationMsg: ''
    });
  };

  onMoveRule = (index: number, move: MOVE_TYPE): void => {
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
    let matchAll = -1;
    for (let index = 0; index < k8sRules.length; index++) {
      const rule = k8sRules[index];
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
          k8sRules: this.props.initRules
        },
        () => this.props.onChange(this.isValid(this.state.k8sRules), this.state.k8sRules)
      );
    }
  }

  onAddFilter = (): void => {
    this.setState(prevState => {
      let newFilter = '';
      if (this.state.filterType === REQ_MOD || this.state.filterType === RESP_MOD) {
        if (this.state.headerOp !== REMOVE) {
          newFilter = `${prevState.filterType} [${prevState.headerName}] ${prevState.headerOp} ${prevState.headerValue}`;
        } else {
          newFilter = `${prevState.filterType} [${prevState.headerName}] ${prevState.headerOp}`;
        }
      } else if (this.state.filterType === REQ_RED) {
        newFilter = `${prevState.filterType} ${prevState.schemeOp}://${prevState.hostName}:${prevState.portValue} ${prevState.statusCodeOp}`;
      } else if (this.state.filterType === REQ_MIR) {
        newFilter = `${prevState.filterType} ${prevState.serviceOp}`;
      }
      if (newFilter && !prevState.filters.includes(newFilter)) {
        prevState.filters.push(newFilter);
      }
      return {
        filters: prevState.filters,
        headerName: '',
        headerValue: ''
      };
    });
  };

  onHeaderValueChange = (headerValue: string): void => {
    let validationMsg = '';
    if ((this.state.filterType === REQ_MOD || this.state.filterType === RESP_MOD) && this.state.headerOp !== REMOVE) {
      if (headerValue !== '' && !this.state.headerName) {
        validationMsg = MSG_HEADER_NAME_NON_EMPTY;
      }
      if (!headerValue && !!this.state.headerName) {
        validationMsg = MSG_HEADER_VALUE_NON_EMPTY;
      }
    }
    this.setState({
      headerValue: headerValue,
      validationMsg: validationMsg
    });
  };

  onHostNameChange = (hostName: string): void => {
    let validationMsg = '';
    if (!hostName || !isServerHostValid(hostName, false)) {
      validationMsg = MSG_HOSTNAME_NON_EMPTY;
    }
    this.setState({
      hostName: hostName,
      validationMsg: validationMsg
    });
  };

  onPortValueChange = (portValue: string): void => {
    let validationMsg = '';
    if (!portValue || isNaN(Number(portValue))) {
      validationMsg = MSG_PORT_NON_EMPTY;
    }
    this.setState({
      portValue: portValue,
      validationMsg: validationMsg
    });
  };

  onRemoveFilter = (filterToRemove: string): void => {
    this.setState(prevState => {
      return {
        filters: prevState.filters.filter(m => filterToRemove !== m),
        validationMsg: prevState.validationMsg === MSG_SAME_MATCHING ? '' : prevState.validationMsg
      };
    });
  };

  render(): React.ReactNode {
    return (
      <>
        <K8sRuleBuilder
          category={this.state.category}
          operator={this.state.operator}
          headerName={this.state.headerName}
          queryParamName={this.state.queryParamName}
          matchValue={this.state.matchValue}
          methodName={this.state.methodName}
          methodService={this.state.methodService}
          isValid={this.state.validationMsg === ''}
          protocol={this.props.protocol}
          onSelectCategory={(category: string) => {
            this.setState(_ => {
              return {
                category: category,
                operator: category === METHOD && this.props.protocol === HTTP ? GET : EXACT
              };
            });
          }}
          onHeaderNameChange={this.onHeaderNameChange}
          onMatchHeaderNameChange={this.onMatchHeaderNameChange}
          onMatchMethodNameChange={this.onMatchMethodNameChange}
          onMatchMethodServiceChange={this.onMatchMethodServiceChange}
          onQueryParamNameChange={this.onQueryParamNameChange}
          onSelectOperator={(operator: string) => this.setState({ operator: operator })}
          onMatchValueChange={this.onMatchValueChange}
          onAddMatch={this.onAddMatch}
          matches={this.state.matches}
          onRemoveMatch={this.onRemoveMatch}
          subServices={this.props.subServices}
          onSelectWeights={this.onSelectWeights}
          backendRefs={this.state.backendRefs}
          validationMsg={this.state.validationMsg}
          onAddRule={this.onAddK8sRule}
          onAddFilter={this.onAddFilter}
          onRemoveFilter={this.onRemoveFilter}
          filters={this.state.filters}
          filterValue={this.state.filterValue}
          onHeaderValueChange={this.onHeaderValueChange}
          onHostNameChange={this.onHostNameChange}
          onPortValueChange={this.onPortValueChange}
          onSelectStatusCodeOp={(statusCodeOp: string) => this.setState({ statusCodeOp: statusCodeOp })}
          onSelectServiceOp={(serviceOp: string) => this.setState({ serviceOp: serviceOp })}
          headerOp={this.state.headerOp}
          schemeOp={this.state.schemeOp}
          statusCodeOp={this.state.statusCodeOp}
          serviceOp={this.state.serviceOp}
          hostName={this.state.hostName}
          portValue={this.state.portValue}
          filterType={this.state.filterType}
          headerValue={this.state.headerValue}
          onSelectFilterType={(filterType: string) => this.setState({ filterType: filterType })}
          onSelectHeaderOp={(headerOp: string) => this.setState({ headerOp: headerOp })}
          onSelectSchemeOp={(schemeOp: string) => this.setState({ schemeOp: schemeOp })}
        />
        <K8sRules k8sRules={this.state.k8sRules} onRemoveRule={this.onRemoveRule} onMoveRule={this.onMoveRule} />
      </>
    );
  }
}
