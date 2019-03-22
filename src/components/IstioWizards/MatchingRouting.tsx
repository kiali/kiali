import * as React from 'react';
import {
  Button,
  DropdownButton,
  DropdownKebab,
  Form,
  FormControl,
  FormGroup,
  Label,
  ListView,
  ListViewIcon,
  ListViewItem,
  MenuItem
} from 'patternfly-react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';
import { PfColors } from '../Pf/PfColors';

type Props = {
  serviceName: string;
  workloads: WorkloadOverview[];
  onChange: (valid: boolean, rules: Rule[]) => void;
};

export enum ROUTE_TYPE {
  SERVICE = 'service-',
  WORKLOAD = 'workload-'
}

export type Rule = {
  matches: string[];
  routeType: ROUTE_TYPE;
  route: string;
};

type State = {
  category: string;
  operator: string;
  route: string;
  routeType: ROUTE_TYPE;
  matches: string[];
  headerName: string;
  matchValue: string;
  rules: Rule[];
  validationMsg: string;
};

const HEADERS = 'headers';
const URI = 'uri';
const SCHEME = 'scheme';
const METHOD = 'method';
const AUTHORITY = 'authority';

const matchOptions: string[] = [HEADERS, URI, SCHEME, METHOD, AUTHORITY];

const EXACT = 'exact';
const PREFIX = 'prefix';
const REGEX = 'regex';

const opOptions: string[] = [EXACT, PREFIX, REGEX];

const placeholderText = {
  [HEADERS]: 'Header value...',
  [URI]: 'Uri value...',
  [SCHEME]: 'Scheme value...',
  [METHOD]: 'Method value...',
  [AUTHORITY]: 'Authority value...'
};

const matchStyle = style({
  marginLeft: 20,
  marginRight: 20
});

const createStyle = style({
  marginTop: 70,
  marginLeft: 20
});

const labelContainerStyle = style({
  marginTop: 5
});

const labelMatchStyle = style({});

const routeStyle = style({
  marginTop: 15
});

const routeToStyle = style({
  marginLeft: 10
});

const validationStyle = style({
  marginTop: 15,
  color: PfColors.Red100
});

const ruleItemStyle = style({
  $nest: {
    ['.list-group-item-heading']: {
      flexBasis: 'calc(50% - 20px)',
      width: 'calc(50% - 20px)'
    },
    ['.list-view-pf-actions']: {
      zIndex: 10
    }
  }
});

const matchValueStyle = style({
  fontWeight: 'normal',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
});

enum MOVE_TYPE {
  UP,
  DOWN
}

const vsIconType = 'fa';
const vsIconName = 'code-fork';

const svcIconType = 'pf';
const svcIconName = 'service';

const wkIconType = 'pf';
const wkIconName = 'bundle';

class MatchingRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      category: HEADERS,
      operator: EXACT,
      routeType: props.workloads.length > 0 ? ROUTE_TYPE.WORKLOAD : ROUTE_TYPE.SERVICE,
      route: props.workloads.length > 0 ? props.workloads[0].name : props.serviceName,
      matches: [],
      headerName: '',
      matchValue: '',
      rules: [],
      validationMsg: ''
    };
  }

  onSelectCategory = (category: string) => {
    this.setState({
      category: category
    });
  };

  onSelectOperator = (operator: string) => {
    this.setState({
      operator: operator
    });
  };

  onSelectRoute = (routeName: string) => {
    let route = '';
    let routeType: ROUTE_TYPE;
    if (routeName.startsWith(ROUTE_TYPE.SERVICE.toString())) {
      routeType = ROUTE_TYPE.SERVICE;
      route = routeName.substring(ROUTE_TYPE.SERVICE.toString().length);
    } else {
      routeType = ROUTE_TYPE.WORKLOAD;
      route = routeName.substring(ROUTE_TYPE.WORKLOAD.toString().length);
    }
    this.setState({
      route: route,
      routeType: routeType
    });
  };

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
          routeType: prevState.routeType,
          route: prevState.route
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
            validationMsg: 'A Rule with same matching criteria is already added.'
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
    this.setState({
      headerName: event.target.value,
      validationMsg: ''
    });
  };

  onMatchValueChange = (event: any) => {
    let validationMsg = '';
    if (this.state.category === HEADERS && this.state.headerName === '') {
      validationMsg = 'Header name must be non empty';
    }
    if (event.target.value === '') {
      validationMsg = '';
    }
    this.setState({
      matchValue: event.target.value,
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

  matchBuilderValidation = (): string => {
    return this.state.validationMsg === '' ? 'success' : 'error';
  };

  renderRuleBuilder = () => {
    return (
      <ListView>
        <ListViewItem
          key={'match-builder'}
          description={
            <div>
              <div>
                Matches:
                {this.renderMatchBuilder()}
                {this.renderMatches()}
              </div>
              <div className={routeStyle}>
                Route:
                {this.renderRouteBuilder()}
              </div>
              {this.state.validationMsg !== '' && <div className={validationStyle}>{this.state.validationMsg}</div>}
            </div>
          }
          // tslint:disable
          actions={
            <Button
              bsStyle="primary"
              className={createStyle}
              disabled={this.state.validationMsg !== ''}
              onClick={this.onAddRule}
            >
              Add Rule
            </Button>
          }
        />
      </ListView>
    );
  };

  renderMatchBuilder = () => {
    const matchItems: any[] = matchOptions.map((mode, index) => (
      <MenuItem key={mode + '-' + index} eventKey={mode} active={mode === this.state.category}>
        {mode}
      </MenuItem>
    ));
    const opItems: any[] = opOptions.map((op, index) => (
      <MenuItem key={op + '-' + index} eventKey={op} active={op === this.state.operator}>
        {op}
      </MenuItem>
    ));
    return (
      <Form inline={true}>
        <FormGroup validationState={this.matchBuilderValidation()}>
          <DropdownButton
            bsStyle="default"
            title={this.state.category}
            id="match-dropdown"
            onSelect={this.onSelectCategory}
          >
            {matchItems}
          </DropdownButton>
          {this.state.category === HEADERS && (
            <FormControl
              type="text"
              id="header-name-text"
              placeholder={'Header name...'}
              value={this.state.headerName}
              onChange={this.onHeaderNameChange}
            />
          )}
          <DropdownButton
            bsStyle="default"
            title={this.state.operator}
            id="operator-dropdown"
            onSelect={this.onSelectOperator}
          >
            {opItems}
          </DropdownButton>
          <FormControl
            type="text"
            id="header-value-text"
            placeholder={placeholderText[this.state.category]}
            value={this.state.matchValue}
            onChange={this.onMatchValueChange}
          />
          <Button
            bsStyle="default"
            className={matchStyle}
            disabled={this.state.validationMsg !== ''}
            onClick={this.onAddMatch}
          >
            Add Match
          </Button>
        </FormGroup>
      </Form>
    );
  };

  renderRouteBuilder = () => {
    const routeItems: any[] = this.props.workloads.map(wk => (
      <MenuItem
        key={'workload-' + wk.name}
        eventKey={'workload-' + wk.name}
        active={wk.name === this.state.route && this.state.routeType === ROUTE_TYPE.WORKLOAD}
      >
        Workload: {wk.name}
      </MenuItem>
    ));
    routeItems.push(
      <MenuItem
        key={'service-' + this.props.serviceName}
        eventKey={'service-' + this.props.serviceName}
        active={this.props.serviceName === this.state.route && this.state.routeType === ROUTE_TYPE.SERVICE}
      >
        Service: {this.props.serviceName}
      </MenuItem>
    );
    return (
      <Form inline={true}>
        <DropdownButton
          bsStyle="default"
          title={(this.state.routeType === ROUTE_TYPE.SERVICE ? 'Service: ' : 'Workload: ') + this.state.route}
          id="route-dropdown"
          onSelect={this.onSelectRoute}
        >
          {routeItems}
        </DropdownButton>
      </Form>
    );
  };

  renderMatches = () => {
    const matches: any[] = this.state.matches.map((match, index) => (
      <span key={match + '-' + index}>
        <Label className={labelMatchStyle} type="primary" onRemoveClick={() => this.onRemoveMatch(match)}>
          {match}
        </Label>{' '}
      </span>
    ));
    return <div className={labelContainerStyle}>{matches}</div>;
  };

  renderRules = () => {
    let ruleItems: any[] = [];
    let isValid: boolean = true;
    let matchAll: number = this.matchAllIndex(this.state.rules);
    for (let index = 0; index < this.state.rules.length; index++) {
      const rule = this.state.rules[index];
      isValid = matchAll === -1 || index <= matchAll;
      const matches: any[] = rule.matches.map((map, index) => {
        return (
          <div key={'match-' + map + '-' + index} className={matchValueStyle}>
            {map}
          </div>
        );
      });
      const ruleActions = (
        <div>
          <Button onClick={() => this.onRemoveRule(index)}>Remove</Button>
          {this.state.rules.length > 1 && (
            <DropdownKebab key={'move-rule-actions-' + index} id={'move-rule-actions-' + index} pullRight={true}>
              {index > 0 && <MenuItem onClick={() => this.onMoveRule(index, MOVE_TYPE.UP)}>Move Up</MenuItem>}
              {index + 1 < this.state.rules.length && (
                <MenuItem onClick={() => this.onMoveRule(index, MOVE_TYPE.DOWN)}>Move Down</MenuItem>
              )}
            </DropdownKebab>
          )}
        </div>
      );
      ruleItems.push(
        <ListViewItem
          key={'match-rule-' + index}
          className={ruleItemStyle}
          leftContent={<ListViewIcon type={vsIconType} name={vsIconName} />}
          heading={
            <div>
              Matches:
              {rule.matches.length === 0 && <div className={matchValueStyle}>Any request</div>}
              {rule.matches.length !== 0 && matches}
            </div>
          }
          description={
            <div>
              <b>Route to:</b>
              <div>
                <span>
                  <ListViewIcon
                    type={rule.routeType === ROUTE_TYPE.SERVICE ? svcIconType : wkIconType}
                    name={rule.routeType === ROUTE_TYPE.SERVICE ? svcIconName : wkIconName}
                  />
                  <span className={routeToStyle}>{rule.route}</span>
                </span>
              </div>
              {!isValid && (
                <div className={validationStyle}>
                  Match 'Any request' is defined in a previous rule.
                  <br />
                  This rule is not accessible.
                </div>
              )}
            </div>
          }
          actions={ruleActions}
        />
      );
    }
    return (
      <div>
        <ListView>{ruleItems}</ListView>
      </div>
    );
  };

  render() {
    return (
      <>
        {this.renderRuleBuilder()}
        {this.renderRules()}
      </>
    );
  }
}

export default MatchingRouting;
