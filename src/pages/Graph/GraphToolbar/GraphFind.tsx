import * as React from 'react';
import { Button, Tooltip, ButtonVariant, TextInput, Form } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import { findValueSelector, hideValueSelector, edgeLabelModeSelector } from '../../../store/Selectors';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { KialiAppAction } from '../../../actions/KialiAppAction';
import GraphHelpFind from '../../../pages/Graph/GraphHelpFind';
import { CyNode, CyEdge } from '../../../components/CytoscapeGraph/CytoscapeGraphUtils';
import * as CytoscapeGraphUtils from '../../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { Layout, EdgeLabelMode, CyData, NodeType } from '../../../types/Graph';
import * as AlertUtils from '../../../utils/AlertUtils';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { style } from 'typestyle';
import TourStopContainer from 'components/Tour/TourStop';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';

type ReduxProps = {
  compressOnHide: boolean;
  cyData: CyData | null;
  edgeLabelMode: EdgeLabelMode;
  findValue: string;
  hideValue: string;
  layout: Layout;
  showFindHelp: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;

  setEdgeLabelMode: (val: EdgeLabelMode) => void;
  setFindValue: (val: string) => void;
  setHideValue: (val: string) => void;
  toggleFindHelp: () => void;
  toggleGraphSecurity: () => void;
  toggleUnusedNodes: () => void;
};

type GraphFindProps = ReduxProps;

type GraphFindState = {
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
const thinGroupStyle = style({
  paddingLeft: '10px',
  paddingRight: '10px'
});

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
    this.state = { errorMessage: '', findInputValue: findValue, hideInputValue: hideValue };
    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
  }

  // Note that we may have redux hide/find values set at mount-time. But because the toolbar mounts prior to
  // the graph loading, we can't perform this graph "post-processing" until we have a valid cy graph.  We can assume
  // that applying the find/hide on update is sufficient because  we will be updated after the cy is loaded
  // due to a change notification for this.props.cyData.
  componentDidUpdate(prevProps: GraphFindProps) {
    const findChanged = this.props.findValue !== prevProps.findValue;
    const hideChanged = this.props.hideValue !== prevProps.hideValue;
    const compressOnHideChanged = this.props.compressOnHide !== prevProps.compressOnHide;
    const layoutChanged = this.props.layout !== prevProps.layout;
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
      this.handleHide(graphChanged, hideChanged, compressOnHideChanged, layoutChanged);
    }
  }

  render() {
    const isFindValid: boolean = !(this.props.findValue.length > 0 && this.state.errorMessage.length > 0);
    const isHideValid: boolean = !(this.props.hideValue.length > 0 && this.state.errorMessage.length > 0);

    return (
      <TourStopContainer info={GraphTourStops.Find}>
        <Form style={{ float: 'left' }} isHorizontal={true}>
          <span className={thinGroupStyle}>
            <TextInput
              id="graph_find"
              name="graph_find"
              ref={ref => {
                this.findInputRef = ref;
              }}
              style={{ ...inputWidth }}
              type="text"
              autoComplete="on"
              isValid={isFindValid}
              onChange={this.updateFind}
              defaultValue={this.state.findInputValue}
              onKeyPress={this.checkSubmitFind}
              placeholder="Find..."
            />
            {this.props.findValue && (
              <Tooltip key="ot_clear_find" position="top" content="Clear Find...">
                <Button variant={ButtonVariant.control} onClick={this.clearFind}>
                  <KialiIcon.Close />
                </Button>
              </Tooltip>
            )}
            <TextInput
              id="graph_hide"
              name="graph_hide"
              ref={ref => {
                this.hideInputRef = ref;
              }}
              style={{ ...inputWidth }}
              autoComplete="on"
              isValid={isHideValid}
              type="text"
              onChange={this.updateHide}
              defaultValue={this.state.hideInputValue}
              onKeyPress={this.checkSubmitHide}
              placeholder="Hide..."
            />
            {this.props.hideValue && (
              <Tooltip key="ot_clear_hide" position="top" content="Clear Hide...">
                <Button variant={ButtonVariant.control} onClick={this.clearHide}>
                  <KialiIcon.Close />
                </Button>
              </Tooltip>
            )}
            {this.props.showFindHelp ? (
              <GraphHelpFind onClose={this.toggleFindHelp}>
                <Button variant={ButtonVariant.link} style={{ paddingLeft: '6px' }} onClick={this.toggleFindHelp}>
                  <KialiIcon.Info className={defaultIconStyle} />
                </Button>
              </GraphHelpFind>
            ) : (
              <Tooltip key={'ot_graph_find_help'} position="top" content="Find/Hide Help...">
                <Button variant={ButtonVariant.link} style={{ paddingLeft: '6px' }} onClick={this.toggleFindHelp}>
                  <KialiIcon.Info className={defaultIconStyle} />
                </Button>
              </Tooltip>
            )}
            {this.state.errorMessage && (
              <div>
                <span style={{ color: 'red' }}>{this.state.errorMessage}</span>
              </div>
            )}
          </span>
        </Form>
      </TourStopContainer>
    );
  }

  private toggleFindHelp = () => {
    this.props.toggleFindHelp();
  };

  private updateFind = val => {
    if ('' === val) {
      this.clearFind();
    } else {
      this.setState({ findInputValue: val, errorMessage: '' });
    }
  };

  private updateHide = val => {
    if ('' === val) {
      this.clearHide();
    } else {
      this.setState({ hideInputValue: val, errorMessage: '' });
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
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.findInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('graph_find') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }
    this.setState({ findInputValue: '', errorMessage: '' });
    this.props.setFindValue('');
  };

  private clearHide = () => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.hideInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('graph_hide') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }
    this.setState({ hideInputValue: '', errorMessage: '' });
    this.props.setHideValue('');
  };

  private handleHide = (
    graphChanged: boolean,
    hideChanged: boolean,
    compressOnHideChanged: boolean,
    layoutChanged: boolean
  ) => {
    if (!this.props.cyData) {
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
      if (this.props.compressOnHide) {
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

    cy.endBatch();

    const removedElements: boolean = this.removedElements && this.removedElements.size() > 0;
    if (hideChanged || (compressOnHideChanged && selector) || removedElements) {
      const zoom = cy.zoom();
      const pan = cy.pan();
      CytoscapeGraphUtils.runLayout(cy, this.props.layout);
      if (!hideChanged && !compressOnHideChanged && !layoutChanged) {
        if (zoom !== cy.zoom()) {
          cy.zoom(zoom);
        }
        if (pan.x !== cy.pan().x || pan.y !== cy.pan().y) {
          cy.pan(pan);
        }
      }
    }
  };

  private handleFind = () => {
    if (!this.props.cyData) {
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
            nodeType = NodeType.SERVICE;
            break;
          case 'wl':
            nodeType = NodeType.WORKLOAD;
            break;
          default:
            break; // no-op
        }
        switch (nodeType) {
          case NodeType.APP:
          case NodeType.SERVICE:
          case NodeType.WORKLOAD:
          case NodeType.UNKNOWN:
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
        if (this.props.edgeLabelMode !== EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE) {
          AlertUtils.addSuccess('Enabling "response time" edge labels for graph find/hide expression');
          this.props.setEdgeLabelMode(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE);
        }
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
        if (isNaN(val)) {
          return `[!${field}]`;
        }
        return `[${field} ${op} ${val}]`;
      case '!=':
        if (isNaN(val)) {
          return `[?${field}]`;
        }
        return `[${field} ${op} ${val}]`;
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
        if (!this.props.showUnusedNodes) {
          AlertUtils.addSuccess('Enabling "unused nodes" display option for graph find/hide expression');
          this.props.toggleUnusedNodes();
        }
        return { target: 'node', selector: isNegation ? `[^${CyNode.isUnused}]` : `[?${CyNode.isUnused}]` };
      case 'vs':
      case 'virtualservice':
        return { target: 'node', selector: isNegation ? `[^${CyNode.hasVS}]` : `[?${CyNode.hasVS}]` };
      //
      // edges...
      //
      case 'mtls':
        if (!this.props.showSecurity) {
          AlertUtils.addSuccess('Enabling "security" display option for graph find/hide expression');
          this.props.toggleGraphSecurity();
        }
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
  compressOnHide: state.graph.toolbarState.compressOnHide,
  cyData: state.graph.cyData,
  edgeLabelMode: edgeLabelModeSelector(state),
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  layout: state.graph.layout,
  showFindHelp: state.graph.toolbarState.showFindHelp,
  showSecurity: state.graph.toolbarState.showSecurity,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setEdgeLabelMode: bindActionCreators(GraphToolbarActions.setEdgelLabelMode, dispatch),
    setFindValue: bindActionCreators(GraphToolbarActions.setFindValue, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    setHideValue: bindActionCreators(GraphToolbarActions.setHideValue, dispatch),
    toggleFindHelp: bindActionCreators(GraphToolbarActions.toggleFindHelp, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphToolbarActions.toggleUnusedNodes, dispatch)
  };
};

const GraphFindContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFind);

export default GraphFindContainer;
