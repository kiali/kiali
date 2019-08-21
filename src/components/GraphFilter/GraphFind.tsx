import * as React from 'react';
import { Button, FormControl, FormGroup, Icon, InputGroup, OverlayTrigger, Tooltip } from 'patternfly-react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../store/Store';
import { findValueSelector, hideValueSelector } from '../../store/Selectors';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
import { KialiAppAction } from '../../actions/KialiAppAction';
import GraphHelpFind from '../../pages/Graph/GraphHelpFind';
import { CyNode, CyEdge } from '../CytoscapeGraph/CytoscapeGraphUtils';
import * as CytoscapeGraphUtils from '../CytoscapeGraph/CytoscapeGraphUtils';
import { CyData } from '../../types/Graph';
import { Layout } from 'types/GraphFilter';

type ReduxProps = {
  cyData: CyData | null;
  findValue: string;
  hideValue: string;
  layout: Layout;
  showFindHelp: boolean;

  setFindValue: (val: string) => void;
  setHideValue: (val: string) => void;
  toggleFindHelp: () => void;
};

type GraphFindProps = ReduxProps;

type GraphFindState = {
  compressOnHide: boolean;
  errorMessage: string;
  findInputValue: string;
  hideInputValue: string;
};

type ParsedExpression = {
  target: 'node' | 'edge';
  selector: string;
};

const inputWidth = {
  width: '10em'
};

// reduce toolbar padding from 20px to 10px to save space
const thinGroupStyle = {
  paddingLeft: '10px',
  paddingRight: '10px'
};

export class GraphFind extends React.PureComponent<GraphFindProps, GraphFindState> {
  static contextTypes = {
    router: () => null
  };

  private findInputRef;
  private hiddenElements: any | undefined;
  private hideInputRef;
  private removedElements: any | undefined;

  constructor(props: GraphFindProps) {
    super(props);
    const findValue = props.findValue ? props.findValue : '';
    const hideValue = props.hideValue ? props.hideValue : '';
    this.state = { errorMessage: '', findInputValue: findValue, hideInputValue: hideValue, compressOnHide: false };
    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
  }

  // Note that we may have redux hide/find values set at mount-time. But because the toolbar mounts prior to
  // the graph loading, we can't perform this graph "post-processing" until we have a valid cy graph.  We can assume
  // that applying the find/hide on update is sufficient because  we will be updated after the cy is loaded
  // due to a change notification for this.props.cyData.
  componentDidUpdate(prevProps: GraphFindProps, prevState: GraphFindState) {
    const findChanged = this.props.findValue !== prevProps.findValue;
    const hideChanged = this.props.hideValue !== prevProps.hideValue;
    const compressOnHideChanged = this.state.compressOnHide !== prevState.compressOnHide;
    const hadCyData = prevProps.cyData != null;
    const hasCyData = this.props.cyData != null;
    const graphChanged =
      (!hadCyData && hasCyData) ||
      (hadCyData && hasCyData && this.props.cyData!.updateTimestamp !== prevProps.cyData!.updateTimestamp);

    // make sure the value is updated if there was a change
    if (findChanged) {
      this.setState({ findInputValue: this.props.findValue });
    }
    if (hideChanged) {
      this.setState({ hideInputValue: this.props.hideValue });
    }

    if (findChanged || (graphChanged && this.props.findValue)) {
      this.handleFind();
    }
    if (hideChanged || compressOnHideChanged || (graphChanged && this.props.hideValue)) {
      this.handleHide(graphChanged, hideChanged, compressOnHideChanged);
    }
  }

  render() {
    return (
      <>
        <FormGroup style={{ flexDirection: 'row', alignItems: 'flex-start', ...thinGroupStyle }}>
          <span className={'form-inline'}>
            <InputGroup>
              <FormControl
                id="graph_find"
                name="graph_find"
                autoComplete="on"
                type="text"
                style={{ ...inputWidth }}
                inputRef={ref => {
                  this.findInputRef = ref;
                }}
                onChange={this.updateFind}
                defaultValue={this.state.findInputValue}
                onKeyPress={this.checkSubmitFind}
                placeholder="Find..."
              />
              {this.props.findValue && (
                <OverlayTrigger
                  key="ot_clear_find"
                  placement="top"
                  trigger={['hover', 'focus']}
                  delayShow={1000}
                  overlay={<Tooltip id="tt_clear_find">Clear Find...</Tooltip>}
                >
                  <InputGroup.Button>
                    <Button onClick={this.clearFind}>
                      <Icon name="close" type="fa" />
                    </Button>
                  </InputGroup.Button>
                </OverlayTrigger>
              )}
              <FormControl
                id="graph_hide"
                name="graph_hide"
                autoComplete="on"
                type="text"
                style={{ ...inputWidth }}
                inputRef={ref => {
                  this.hideInputRef = ref;
                }}
                onChange={this.updateHide}
                defaultValue={this.state.hideInputValue}
                onKeyPress={this.checkSubmitHide}
                placeholder="Hide..."
              />
              {this.props.hideValue && (
                <OverlayTrigger
                  key="ot_clear_hide"
                  placement="top"
                  trigger={['hover', 'focus']}
                  delayShow={1000}
                  overlay={<Tooltip id="tt_clear_hide">Clear Hide...</Tooltip>}
                >
                  <InputGroup.Button>
                    <Button onClick={this.clearHide}>
                      <Icon name="close" type="fa" />
                    </Button>
                  </InputGroup.Button>
                </OverlayTrigger>
              )}
              <OverlayTrigger
                key="ot_compress_on_hide"
                placement="top"
                trigger={['hover', 'focus']}
                delayShow={1000}
                overlay={<Tooltip id="tt_compress_on_hide">Compress Graph on Hide...</Tooltip>}
              >
                <InputGroup.Button>
                  <Button onClick={this.toggleCompressOnHide}>
                    <Icon name={this.state.compressOnHide ? 'compress' : 'expand'} type="fa" />
                  </Button>
                </InputGroup.Button>
              </OverlayTrigger>
            </InputGroup>
            <OverlayTrigger
              key={'ot_graph_find_help'}
              placement="top"
              overlay={<Tooltip id={'tt_graph_find_help'}>Find/Hide Help...</Tooltip>}
            >
              <Button bsStyle="link" style={{ paddingLeft: '6px' }} onClick={this.toggleFindHelp}>
                <Icon name="help" type="pf" />
              </Button>
            </OverlayTrigger>
          </span>
          {this.state.errorMessage && (
            <div>
              <span style={{ color: 'red' }}>{this.state.errorMessage}</span>
            </div>
          )}
        </FormGroup>
        {this.props.showFindHelp && <GraphHelpFind onClose={this.toggleFindHelp} />}{' '}
      </>
    );
  }

  private toggleFindHelp = () => {
    this.props.toggleFindHelp();
  };

  private updateFind = event => {
    if ('' === event.target.value) {
      this.clearFind();
    } else {
      this.setState({ findInputValue: event.target.value, errorMessage: '' });
    }
  };

  private updateHide = event => {
    if ('' === event.target.value) {
      this.clearHide();
    } else {
      this.setState({ hideInputValue: event.target.value, errorMessage: '' });
    }
  };

  private checkSubmitFind = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === 13) {
      event.preventDefault();
      this.submitFind();
    }
  };

  private checkSubmitHide = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === 13) {
      event.preventDefault();
      this.submitHide();
    }
  };

  private submitFind = () => {
    if (this.props.findValue !== this.state.findInputValue) {
      this.props.setFindValue(this.state.findInputValue);
    }
  };

  private submitHide = () => {
    if (this.props.hideValue !== this.state.hideInputValue) {
      this.props.setHideValue(this.state.hideInputValue);
    }
  };

  private clearFind = () => {
    // note, we don't use findInputRef.current because <FormControl> deals with refs differently than <input>
    this.findInputRef.value = '';
    this.setState({ findInputValue: '', errorMessage: '' });
    this.props.setFindValue('');
  };

  private clearHide = () => {
    // note, we don't use hideInputRef.current because <FormControl> deals with refs differently than <input>
    this.hideInputRef.value = '';
    this.setState({ hideInputValue: '', errorMessage: '' });
    this.props.setHideValue('');
  };

  private toggleCompressOnHide = () => {
    this.setState({ compressOnHide: !this.state.compressOnHide });
  };

  private handleHide = (graphChanged: boolean, hideChanged: boolean, compressOnHideChanged: boolean) => {
    if (!this.props.cyData) {
      console.debug('Skip Hide: cy not set.');
      return;
    }

    const cy = this.props.cyData.cyRef;
    const selector = this.parseValue(this.props.hideValue);

    cy.startBatch();
    if (this.hiddenElements) {
      // make visible old hide-hits
      this.hiddenElements.style({ visibility: 'visible' });
      this.hiddenElements = undefined;
    }
    if (this.removedElements) {
      // Only restore the removed nodes if we are working with the same graph.  If the graph has changed
      // (i.e. refresh) then we have new nodes, and therefore a potential ID conflict. don't restore the
      // removed nodes, instead, just remove our reference and they should get garbage collected.
      if (!graphChanged) {
        this.removedElements.restore();
      }
      this.removedElements = undefined;
    }
    if (selector) {
      // select the new hide-hits
      let hiddenElements = cy.$(selector);
      // add the edges connected to hidden nodes
      hiddenElements = hiddenElements.add(hiddenElements.connectedEdges());
      // add nodes with only hidden edges (keep unused nodes as that is an explicit option)
      const visibleElements = hiddenElements.absoluteComplement();
      const nodesWithVisibleEdges = visibleElements.edges().connectedNodes();
      const nodesWithOnlyHiddenEdges = visibleElements.nodes(`[^${CyNode.isUnused}]`).subtract(nodesWithVisibleEdges);
      hiddenElements = hiddenElements.add(nodesWithOnlyHiddenEdges);
      // subtract any appbox hits, we only hide empty appboxes
      hiddenElements = hiddenElements.subtract(hiddenElements.filter('$node[isGroup]'));
      if (this.state.compressOnHide) {
        this.removedElements = cy.remove(hiddenElements);
        // now subtract any appboxes that don't have any visible children
        const hiddenAppBoxes = cy.$('$node[isGroup]').subtract(cy.$('$node[isGroup] > :inside'));
        this.removedElements = this.removedElements.add(cy.remove(hiddenAppBoxes));
      } else {
        // set the remaining hide-hits hidden
        this.hiddenElements = hiddenElements;
        this.hiddenElements.style({ visibility: 'hidden' });
        // now subtract any appboxes that don't have any visible children
        const hiddenAppBoxes = cy.$('$node[isGroup]').subtract(cy.$('$node[isGroup] > :visible'));
        hiddenAppBoxes.style({ visibility: 'hidden' });
        this.hiddenElements = this.hiddenElements.add(hiddenAppBoxes);
      }
    }

    const removedElements: boolean = this.removedElements && this.removedElements.size() > 0;
    if (hideChanged || (compressOnHideChanged && selector) || removedElements) {
      const zoom = cy.zoom();
      const pan = cy.pan();
      CytoscapeGraphUtils.runLayout(cy, this.props.layout);
      if (!hideChanged && !compressOnHideChanged) {
        if (zoom !== cy.zoom()) {
          cy.zoom(zoom);
        }
        if (pan.x !== cy.pan().x || pan.y !== cy.pan().y) {
          cy.pan(pan);
        }
      }
    }
    cy.endBatch();
  };

  private handleFind = () => {
    if (!this.props.cyData) {
      console.debug('Skip Find: cy not set.');
      return;
    }
    const cy = this.props.cyData.cyRef;
    const selector = this.parseValue(this.props.findValue);
    cy.startBatch();
    // unhighlight old find-hits
    cy.elements('*.find').removeClass('find');
    if (selector) {
      // add new find-hits
      cy.elements(selector).addClass('find');
    }
    cy.endBatch();
  };

  private setErrorMsg(errorMessage: string): undefined {
    if (errorMessage !== this.state.errorMessage) {
      this.setState({ errorMessage: errorMessage });
    }
    return undefined;
  }

  private parseValue = (val: string): string | undefined => {
    let preparedVal = this.prepareValue(val);
    if (!preparedVal) {
      return undefined;
    }

    preparedVal = preparedVal.replace(/ and /gi, ' AND ');
    preparedVal = preparedVal.replace(/ or /gi, ' OR ');
    const conjunctive = preparedVal.includes(' AND ');
    const disjunctive = preparedVal.includes(' OR ');
    if (conjunctive && disjunctive) {
      return this.setErrorMsg(`Expression can not contain both 'AND' and 'OR'`);
    }
    const separator = disjunctive ? ',' : '';
    const expressions = disjunctive ? preparedVal.split(' OR ') : preparedVal.split(' AND ');
    let selector;

    for (const expression of expressions) {
      const parsedExpression = this.parseExpression(expression, conjunctive, disjunctive);
      if (!parsedExpression) {
        return undefined;
      }
      selector = this.appendSelector(selector, parsedExpression, separator);
      if (!selector) {
        return undefined;
      }
    }
    // parsed successfully, clear any previous error message
    this.setErrorMsg('');
    return selector;
  };

  private prepareValue = (val: string): string => {
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

  private parseExpression = (
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
        return this.setErrorMsg(`No valid operator found in expression`);
      }

      const unaryExpression = this.parseUnaryFindExpression(expression.trim(), false);
      return unaryExpression ? unaryExpression : this.setErrorMsg(`Invalid Node or Edge operand`);
    }

    const tokens = expression.split(op);
    if (op === '!') {
      const unaryExpression = this.parseUnaryFindExpression(tokens[1].trim(), true);
      return unaryExpression ? unaryExpression : this.setErrorMsg(`Invalid Node or Edge operand`);
    }

    const field = tokens[0].trim();
    const val = tokens[1].trim();

    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'app':
        return { target: 'node', selector: `[${CyNode.app} ${op} "${val}"]` };
      case 'grpcin': {
        const s = this.getNumericSelector(CyNode.grpcIn, op, val, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'grpcout': {
        const s = this.getNumericSelector(CyNode.grpcOut, op, val, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpin': {
        const s = this.getNumericSelector(CyNode.httpIn, op, val, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpout': {
        const s = this.getNumericSelector(CyNode.httpOut, op, val, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'name': {
        const isNegation = op.startsWith('!');
        if (disjunctive && isNegation) {
          return this.setErrorMsg(`Can not use 'OR' with negated 'name' operand`);
        } else if (conjunctive) {
          return this.setErrorMsg(`Can not use 'AND' with 'name' operand`);
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
            this.setErrorMsg(`Invalid node type [${nodeType}]. Expected app | service | unknown | workload`);
        }
        return undefined;
      case 'ns':
      case 'namespace':
        return { target: 'node', selector: `[${CyNode.namespace} ${op} "${val}"]` };
      case 'svc':
      case 'service':
        return { target: 'node', selector: `[${CyNode.service} ${op} "${val}"]` };
      case 'tcpin': {
        const s = this.getNumericSelector(CyNode.tcpIn, op, val, expression);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'tcpout': {
        const s = this.getNumericSelector(CyNode.tcpOut, op, val, expression);
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
      case 'grpc': {
        const s = this.getNumericSelector(CyEdge.grpc, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpcerror':
      case '%grpcerr': {
        const s = this.getNumericSelector(CyEdge.grpcPercentErr, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpctraffic': {
        const s = this.getNumericSelector(CyEdge.grpcPercentReq, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'http': {
        const s = this.getNumericSelector(CyEdge.http, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httperror':
      case '%httperr': {
        const s = this.getNumericSelector(CyEdge.httpPercentErr, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httptraffic': {
        const s = this.getNumericSelector(CyEdge.httpPercentReq, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'protocol': {
        return { target: 'edge', selector: `[${CyEdge.protocol} ${op} "${val}"]` };
      }
      case 'rt':
      case 'responsetime': {
        const s = this.getNumericSelector(CyEdge.responseTime, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'tcp': {
        const s = this.getNumericSelector(CyEdge.tcp, op, val, expression);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      default:
        return this.setErrorMsg(`Invalid operand [${field}]`);
    }
  };

  private getNumericSelector(field: string, op: string, val: any, _expression: string): string | undefined {
    switch (op) {
      case '>':
      case '<':
      case '>=':
      case '<=':
        if (isNaN(val)) {
          return this.setErrorMsg(`Invalid value [${val}]. Expected a numeric value (use . for decimals)`);
        }
        return `[${field} ${op} ${val}]`;
      case '=':
      case '!=':
        if (val !== 'NaN' && isNaN(val)) {
          return this.setErrorMsg(`Invalid value [${val}]. Expected NaN or a numeric value (use . for decimals)`);
        }
        return Number(val) !== 0 ? `[${field} ${op} "${val}"]` : `[${field} ${op} "0"]`;
      default:
        return this.setErrorMsg(`Invalid operator [${op}] for numeric condition`);
    }
  }

  private parseUnaryFindExpression = (field: string, isNegation): ParsedExpression | undefined => {
    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'cb':
      case 'circuitbreaker':
        return { target: 'node', selector: isNegation ? `[^${CyNode.hasCB}]` : `[?${CyNode.hasCB}]` };
      case 'dead':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isDead}]` : `[?${CyNode.isDead}]` };
      case 'inaccessible':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isInaccessible}]` : `[?${CyNode.isInaccessible}]` };
      case 'outside':
      case 'outsider':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isOutside}]` : `[?${CyNode.isOutside}]` };
      case 'se':
      case 'serviceentry':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isServiceEntry}]` : `[?${CyNode.isServiceEntry}]` };
      case 'sc':
      case 'sidecar':
        return { target: 'node', selector: isNegation ? `[?${CyNode.hasMissingSC}]` : `[^${CyNode.hasMissingSC}]` };
      case 'trafficsource':
      case 'root':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isRoot}]` : `[?${CyNode.isRoot}]` };
      case 'unused':
        return { target: 'node', selector: isNegation ? `[^${CyNode.isUnused}]` : `[?${CyNode.isUnused}]` };
      case 'vs':
      case 'virtualservice':
        return { target: 'node', selector: isNegation ? `[^${CyNode.hasVS}]` : `[?${CyNode.hasVS}]` };
      //
      // edges...
      //
      case 'mtls':
        return { target: 'edge', selector: isNegation ? `[${CyEdge.isMTLS} <= 0]` : `[${CyEdge.isMTLS} > 0]` };
      case 'traffic': {
        return { target: 'edge', selector: isNegation ? `[^${CyEdge.hasTraffic}]` : `[?${CyEdge.hasTraffic}]` };
      }
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
      return this.setErrorMsg('Invalid expression. Can not mix node and edge criteria.');
    }
    return selector + separator + parsedExpression.selector;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  cyData: state.graph.cyData,
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  layout: state.graph.layout,
  showFindHelp: state.graph.filterState.showFindHelp
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setFindValue: bindActionCreators(GraphFilterActions.setFindValue, dispatch),
    setHideValue: bindActionCreators(GraphFilterActions.setHideValue, dispatch),
    toggleFindHelp: bindActionCreators(GraphFilterActions.toggleFindHelp, dispatch)
  };
};

const GraphFindContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFind);

export default GraphFindContainer;
