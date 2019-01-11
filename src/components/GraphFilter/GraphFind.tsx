import * as React from 'react';
import { Button, Form, FormControl, FormGroup, Icon, InputGroup } from 'patternfly-react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState } from '../../store/Store';
import { GraphFilterActions } from '../../actions/GraphFilterActions';

import { KialiAppAction } from '../../actions/KialiAppAction';
import * as MessageCenterUtils from '../../utils/MessageCenter';
import GraphHelpFind from '../../pages/Graph/GraphHelpFind';
import { CyNode, CyEdge } from '../CytoscapeGraph/CytoscapeGraphUtils';
import { CyData } from '../../types/Graph';

type ReduxProps = {
  cyData: CyData;
  showFindHelp: boolean;

  toggleFindHelp: () => void;
};

type GraphFindProps = ReduxProps;

type ParsedExpression = {
  target: 'node' | 'edge';
  selector: string;
};

export class GraphFind extends React.PureComponent<GraphFindProps> {
  static contextTypes = {
    router: () => null
  };

  private findInputRef;
  private findInputValue: string;
  private findValue: string;

  constructor(props: GraphFindProps) {
    super(props);

    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
    this.findInputRef = React.createRef();
    this.findInputValue = '';
    this.findValue = '';
  }

  componentDidUpdate(prevProps: GraphFindProps) {
    if (this.findValue.length > 0 && this.props.cyData.updateTimestamp !== prevProps.cyData.updateTimestamp) {
      this.handleFind();
    }
  }

  render() {
    return (
      <>
        <FormGroup>
          <Form onSubmit={this.handleFindSubmit} inline="true">
            <InputGroup>
              <FormControl
                type="text"
                style={{ width: '18em' }}
                inputRef={ref => {
                  this.findInputRef = ref;
                }}
                onChange={this.updateFind}
                placeholder="Find..."
              />
              <InputGroup.Button>
                <Button onClick={this.clearFind}>
                  <Icon name="close" type="fa" />
                </Button>
              </InputGroup.Button>
            </InputGroup>
            <Button bsStyle="link" style={{ paddingLeft: '6px' }} onClick={this.toggleFindHelp}>
              <Icon name="help" type="pf" title="Help Find..." />
            </Button>
          </Form>
        </FormGroup>
        {this.props.showFindHelp && <GraphHelpFind onClose={this.toggleFindHelp} />}{' '}
      </>
    );
  }

  private toggleFindHelp = () => {
    this.props.toggleFindHelp();
  };

  private updateFind = event => {
    this.findInputValue = event.target.value;
  };

  private clearFind = () => {
    this.findInputValue = '';
    this.findValue = '';
    // note, we don't use findInputRef.current because <FormControl> deals with refs differently than <input>
    this.findInputRef.value = '';
    this.handleFind();
  };

  private handleFindSubmit = event => {
    event.preventDefault();
    this.findValue = this.findInputValue;
    this.handleFind();
  };

  private handleFind = () => {
    if (!this.props.cyData) {
      console.debug('Skip Find: cy not set.');
      return;
    }
    const cy = this.props.cyData.cyRef;
    const selector = this.parseFindValue(this.findValue);
    if (selector) {
      cy.startBatch();
      // unhighlight old find-hits
      cy.elements('*.find').removeClass('find');
      // add new find-hits
      cy.elements(selector).addClass('find');
      cy.endBatch();
    }
  };

  private parseFindValue = (val: string): string | undefined => {
    let validVal = this.prepareFindValue(val);
    if (!validVal) {
      return undefined;
    }
    validVal = validVal.replace(/ and /gi, ' AND ');
    validVal = validVal.replace(/ or /gi, ' OR ');
    const conjunctive = validVal.includes(' AND ');
    const disjunctive = validVal.includes(' OR ');
    if (conjunctive && disjunctive) {
      MessageCenterUtils.add(`Find value can not contain both 'and' and 'or'.`);
      return undefined;
    }
    const separator = disjunctive ? ',' : '';
    const expressions = disjunctive ? validVal.split(' OR ') : validVal.split(' AND ');
    let selector;

    for (const expression of expressions) {
      const parsedExpression = this.parseFindExpression(expression, conjunctive, disjunctive);
      if (!parsedExpression) {
        return undefined;
      }
      selector = this.appendSelector(selector, parsedExpression, separator);
      if (!selector) {
        return undefined;
      }
    }

    return selector;
  };

  private prepareFindValue = (val: string): string => {
    // remove double spaces
    val = val.replace(/ +(?= )/g, '');

    // remove unnecessary mnemonic qualifiers on unary operators (e.g. 'has cb' -> 'cb').
    val = ' ' + val;
    val = val.replace(/ is /gi, ' ');
    val = val.replace(/ has /gi, ' ');
    val = val.replace(/ !\s*is /gi, ' ! ');
    val = val.replace(/ !\s*has /gi, ' ! ');

    // replace string operators
    val = val.replace(/ not /gi, ' !');
    val = val.replace(/ !\s*contains /gi, ' !*= ');
    val = val.replace(/ !\s*startswith /gi, ' !^= ');
    val = val.replace(/ !\s*endswith /gi, ' !$= ');
    val = val.replace(/ contains /gi, ' *= ');
    val = val.replace(/ startswith /gi, ' ^= ');
    val = val.replace(/ endswith /gi, ' $= ');
    return val.trim();
  };

  private parseFindExpression = (
    expression: string,
    conjunctive: boolean,
    disjunctive: boolean
  ): ParsedExpression | undefined => {
    let op;
    if (expression.includes('!=')) {
      op = '!=';
    } else if (expression.includes('!*=')) {
      op = '!*=';
    } else if (expression.includes('!$=')) {
      op = '!$=';
    } else if (expression.includes('!^=')) {
      op = '!^=';
    } else if (expression.includes('>=')) {
      op = '>=';
    } else if (expression.includes('<=')) {
      op = '<=';
    } else if (expression.includes('*=')) {
      op = '*='; // substring
    } else if (expression.includes('$=')) {
      op = '$='; // starts with
    } else if (expression.includes('^=')) {
      op = '^='; // ends with
    } else if (expression.includes('=')) {
      op = '=';
    } else if (expression.includes('>')) {
      op = '>';
    } else if (expression.includes('<')) {
      op = '<';
    } else if (expression.includes('!')) {
      op = '!';
    }
    if (!op) {
      if (expression.split(' ').length > 1) {
        MessageCenterUtils.add(`Invalid find expression or operator: [${expression}]`);
        return undefined;
      }

      const unaryExpression = this.parseUnaryFindExpression(expression.trim(), false);
      if (!unaryExpression) {
        MessageCenterUtils.add(`Invalid find expression or operator: [${expression}]`);
      }

      return unaryExpression;
    }

    let tokens = expression.split(op);
    if (op === '!') {
      const unaryExpression = this.parseUnaryFindExpression(tokens[1].trim(), true);
      if (!unaryExpression) {
        MessageCenterUtils.add(`Invalid find expression or operator: [${expression}]`);
      }

      return unaryExpression;
    }

    const field = tokens[0].trim();
    const val = tokens[1].trim();

    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'app':
        return { target: 'node', selector: `[${CyNode.app} ${op} "${val}"]` };
      case 'httpin': {
        const s = this.getNumericSelector(CyNode.httpIn, op, val, 1.0, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpout': {
        const s = this.getNumericSelector(CyNode.httpOut, op, val, 1.0, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'name': {
        const isNegation = op.startsWith('!');
        if (disjunctive && isNegation) {
          MessageCenterUtils.add(`Find values do not allow OR expressions with "not find by name": [${expression}]`);
          return undefined;
        } else if (conjunctive) {
          MessageCenterUtils.add(`Find values do not allow AND expressions with "find by name": [${expression}]`);
          return undefined;
        }
        const wl = `[${CyNode.workload} ${op} "${val}"]`;
        const app = `[${CyNode.app} ${op} "${val}"]`;
        const svc = `[${CyNode.service} ${op} "${val}"]`;
        return { target: 'node', selector: isNegation ? `${wl}${app}${svc}` : `${wl},${app},${svc}` };
      }
      case 'node':
        let nodeType = val.toLowerCase();
        switch (nodeType) {
          case 'svc':
            nodeType = 'service';
            break;
          case 'wl':
            nodeType = 'workload';
            break;
          default:
            break; // no-op
        }
        switch (nodeType) {
          case 'app':
          case 'service':
          case 'workload':
          case 'unknown':
            return { target: 'node', selector: `[${CyNode.nodeType} ${op} "${nodeType}"]` };
          default:
            MessageCenterUtils.add(`Invalid node type. Expected app | service | unknown | workload : [${expression}]`);
        }
        return undefined;
      case 'ns':
      case 'namespace':
        return { target: 'node', selector: `[${CyNode.namespace} ${op} "${val}"]` };
      case 'svc':
      case 'service':
        return { target: 'node', selector: `[${CyNode.service} ${op} "${val}"]` };
      case 'tcpin': {
        const s = this.getNumericSelector(CyNode.tcpIn, op, val, 1.0, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'tcpout': {
        const s = this.getNumericSelector(CyNode.tcpOut, op, val, 1.0, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'version':
        return { target: 'node', selector: `[${CyNode.version} ${op} "${val}"]` };
      case 'wl':
      case 'workload':
        return { target: 'node', selector: `[${CyNode.workload} ${op} "${val}"]` };
      //
      // edges..
      //
      case 'http': {
        const s = this.getNumericSelector(CyEdge.http, op, val, 1.0, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%error':
      case '%err': {
        const s = this.getNumericSelector(CyEdge.httpPercentErr, op, val, 1.0, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%traffic': {
        const s = this.getNumericSelector(CyEdge.httpPercentReq, op, val, 1.0, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'rt':
      case 'responsetime': {
        const s = this.getNumericSelector(CyEdge.responseTime, op, val, 0.001, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'tcp': {
        const s = this.getNumericSelector(CyEdge.tcp, op, val, 1.0, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      default:
        MessageCenterUtils.add(`Invalid find value: [${expression}]`);
        return undefined;
    }
  };

  private getNumericSelector(
    field: string,
    op: string,
    val: any,
    multiplier: number,
    expression: string
  ): string | undefined {
    if (isNaN(val)) {
      MessageCenterUtils.add(`Invalid find value, expected a numeric value (use . for decimals):  [${expression}]`);
      return undefined;
    }
    switch (op) {
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '=':
      case '!=':
        break;
      default:
        MessageCenterUtils.add(`Invalid operator for numeric condition: [${expression}]`);
        return undefined;
    }

    const numVal = Number(val) * multiplier;
    switch (op) {
      case '=':
        return numVal === 0 ? `[^${field}]` : `[${field} ${op} "${val}"]`;
      case '!=':
        return `[${field} ${op} "${val}"]`;
      default:
        return `[${field} ${op} ${val}]`;
    }
  }

  private parseUnaryFindExpression = (field: string, isNegation): ParsedExpression | undefined => {
    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'cb':
      case 'circuitbreaker':
        return { target: 'node', selector: isNegation ? `[^${CyNode.hasCB}]` : `[${CyNode.hasCB}]` };
      case 'dead':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isDead}]` : `[${CyNode.isDead}]` };
      case 'inaccessible':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isInaccessible}]` : `[${CyNode.isInaccessible}]` };
      case 'outside':
      case 'outsider':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isOutside}]` : `[${CyNode.isOutside}]` };
      case 'se':
      case 'serviceentry':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isServiceEntry}]` : `[${CyNode.isServiceEntry}]` };
      case 'sc':
      case 'sidecar':
        return { target: 'node', selector: isNegation ? `[${CyNode.hasMissingSC}]` : `[^${CyNode.hasMissingSC}]` };
      case 'trafficsource':
      case 'root':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isRoot}]` : `[${CyNode.isRoot}]` };
      case 'unused':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isUnused}]` : `[${CyNode.isUnused}]` };
      case 'vs':
      case 'virtualservice':
        return { target: 'node', selector: isNegation ? `[^${CyNode.hasVS}]` : `[${CyNode.hasVS}]` };
      //
      // edges...
      //
      case 'mtls':
        return { target: 'edge', selector: isNegation ? `[^${CyEdge.isMTLS}]` : `[${CyEdge.isMTLS}]` };
      default:
        return undefined;
    }
  };

  private appendSelector = (
    selector: string,
    parsedExpression: ParsedExpression,
    separator: string
  ): string | undefined => {
    if (!selector) {
      return parsedExpression.target + parsedExpression.selector;
    }
    if (!selector.startsWith(parsedExpression.target)) {
      MessageCenterUtils.add('Find value can not mix node and edge criteria.');
      return undefined;
    }
    return selector + separator + parsedExpression.selector;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  cyData: state.graph.cyData,
  showFindHelp: state.graph.filterState.showFindHelp
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    toggleFindHelp: bindActionCreators(GraphFilterActions.toggleFindHelp, dispatch)
  };
};

const GraphFindContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFind);

export default GraphFindContainer;
