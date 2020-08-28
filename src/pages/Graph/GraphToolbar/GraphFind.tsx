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
import { EdgeLabelMode, NodeType, Layout } from '../../../types/Graph';
import * as AlertUtils from '../../../utils/AlertUtils';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { style } from 'typestyle';
import TourStopContainer from 'components/Tour/TourStop';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { TimeInMilliseconds } from 'types/Common';
import { AutoComplete } from 'utils/AutoComplete';

type ReduxProps = {
  compressOnHide: boolean;
  edgeLabelMode: EdgeLabelMode;
  findValue: string;
  hideValue: string;
  layout: Layout;
  showFindHelp: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;
  updateTime: TimeInMilliseconds;

  setEdgeLabelMode: (val: EdgeLabelMode) => void;
  setFindValue: (val: string) => void;
  setHideValue: (val: string) => void;
  toggleFindHelp: () => void;
  toggleGraphSecurity: () => void;
  toggleUnusedNodes: () => void;
};

type GraphFindProps = ReduxProps & {
  cy: any;
};

type GraphFindState = {
  findError?: string;
  findInputValue: string;
  hideError?: string;
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

const operands: string[] = [
  '%grpcerr',
  '%grpctraffic',
  '%httperr',
  '%httptraffic',
  'app',
  'circuitbreaker',
  'grpc',
  'grpcerr',
  'grpcin',
  'grpcout',
  'http',
  'httpin',
  'httpout',
  'mtls',
  'name',
  'namespace',
  'node',
  'operation',
  'outside',
  'protocol',
  'responsetime',
  'service',
  'serviceentry',
  'sidecar',
  'tcp',
  'traffic',
  'trafficsource',
  'unused',
  'version',
  'tcpin',
  'tcpout',
  'workload'
];

export class GraphFind extends React.Component<GraphFindProps, GraphFindState> {
  static contextTypes = {
    router: () => null
  };

  private findAutoComplete: AutoComplete;
  private findInputRef;
  private hiddenElements: any | undefined;
  private hideAutoComplete: AutoComplete;
  private hideInputRef;
  private removedElements: any | undefined;

  constructor(props: GraphFindProps) {
    super(props);
    const findValue = props.findValue ? props.findValue : '';
    const hideValue = props.hideValue ? props.hideValue : '';
    this.findAutoComplete = new AutoComplete(operands);
    this.hideAutoComplete = new AutoComplete(operands);
    this.state = { findInputValue: findValue, hideInputValue: hideValue };
    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
  }

  // We only update on a change to the find/hide/compress values, or a graph change.  Although we use other props
  // in processing (compressOnHide, layout, etc), a change to those settings will generate a graph change, so we
  // wait for the graph change to do the update.
  shouldComponentUpdate(nextProps: GraphFindProps, nextState: GraphFindState) {
    const cyChanged = this.props.cy !== nextProps.cy;
    const findChanged = this.props.findValue !== nextProps.findValue;
    const hideChanged = this.props.hideValue !== nextProps.hideValue;
    const graphChanged = this.props.updateTime !== nextProps.updateTime;
    const showFindHelpChanged = this.props.showFindHelp !== nextProps.showFindHelp;
    const findErrorChanged = this.state.findError !== nextState.findError;
    const hideErrorChanged = this.state.hideError !== nextState.hideError;

    return (
      cyChanged ||
      findChanged ||
      hideChanged ||
      graphChanged ||
      showFindHelpChanged ||
      findErrorChanged ||
      hideErrorChanged
    );
  }

  // Note that we may have redux hide/find values set at mount-time. But because the toolbar mounts prior to
  // the graph loading, we can't perform this graph "post-processing" until we have a valid cy graph.  But the
  // find/hide processing will be initiated externally (CytoscapeGraph:processgraphUpdate) when the graph is ready.
  componentDidUpdate(prevProps: GraphFindProps) {
    if (!this.props.cy) {
      this.hiddenElements = undefined;
      this.removedElements = undefined;
      return;
    }

    const findChanged = this.props.findValue !== prevProps.findValue;
    const hideChanged = this.props.hideValue !== prevProps.hideValue;
    const graphChanged = this.props.updateTime !== prevProps.updateTime;

    // make sure the value is updated if there was a change
    if (findChanged || (graphChanged && !!this.props.findValue)) {
      this.handleFind(this.props.cy);
    }

    if (hideChanged || (graphChanged && !!this.props.hideValue)) {
      const compressOnHideChanged = this.props.compressOnHide !== prevProps.compressOnHide;
      const layoutChanged = this.props.layout !== prevProps.layout;
      this.handleHide(this.props.cy, hideChanged, graphChanged, compressOnHideChanged, layoutChanged);
    }
  }

  render() {
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
              isValid={!this.state.findError}
              onChange={this.updateFind}
              defaultValue={this.state.findInputValue}
              onKeyDownCapture={this.checkSpecialKeyFind}
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
              isValid={!this.state.hideError}
              type="text"
              onChange={this.updateHide}
              defaultValue={this.state.hideInputValue}
              onKeyDownCapture={this.checkSpecialKeyHide}
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
            {this.state.findError && <div style={{ color: 'red' }}>{this.state.findError}</div>}
            {this.state.hideError && <div style={{ color: 'red' }}>{this.state.hideError}</div>}
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
      const diff = Math.abs(val.length - this.state.findInputValue.length);
      this.findAutoComplete.setRoot(val);
      this.setState({ findInputValue: val, findError: undefined });
      // submit if length change is greater than a single key, assume browser suggestion clicked or user paste
      if (diff > 1) {
        this.props.setFindValue(val);
      }
    }
  };

  private updateHide = val => {
    if ('' === val) {
      this.clearHide();
    } else {
      const diff = Math.abs(val.length - this.state.hideInputValue.length);
      this.hideAutoComplete.setRoot(val);
      this.setState({ hideInputValue: val, hideError: undefined });
      // submit if length change is greater than a single key, assume browser suggestion clicked or user paste
      if (diff > 1) {
        this.props.setHideValue(val);
      }
    }
  };

  private checkSpecialKeyFind = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    switch (keyCode) {
      case 9: // tab (autocomplete)
        event.preventDefault();
        const next = this.findAutoComplete.next();
        if (!!next) {
          this.findInputRef.value = next;
          this.setState({ findInputValue: next, findError: undefined });
        }
        break;
      case 13: // return (submit)
        event.preventDefault();
        this.submitFind();
        break;
      default:
        break;
    }
  };

  private checkSpecialKeyHide = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    switch (keyCode) {
      case 9: // tab (autocomplete)
        event.preventDefault();
        const next = this.hideAutoComplete.next();
        if (!!next) {
          this.hideInputRef.value = next;
          this.setState({ hideInputValue: next, hideError: undefined });
        }
        break;
      case 13: // return (submit)
        event.preventDefault();
        this.submitHide();
        break;
      default:
        break;
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
    this.findAutoComplete.setRoot('');
    this.setState({ findInputValue: '', findError: undefined });
    this.props.setFindValue('');
  };

  private clearHide = () => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.hideInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('graph_hide') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }
    this.hideAutoComplete.setRoot('');
    this.setState({ hideInputValue: '', hideError: undefined });
    this.props.setHideValue('');
  };

  private handleHide = (
    cy: any,
    hideChanged: boolean,
    graphChanged: boolean,
    compressOnHideChanged: boolean,
    layoutChanged: boolean
  ) => {
    const selector = this.parseValue(this.props.hideValue, false);
    let prevRemoved = this.removedElements;

    cy.startBatch();

    // unhide hidden elements when we are dealing with the same graph. Either way,release for garbage collection
    if (!!this.hiddenElements && !graphChanged) {
      this.hiddenElements.style({ visibility: 'visible' });
    }
    this.hiddenElements = undefined;

    // restore removed elements when we are working with the same graph. . Either way,release for garbage collection.  If the graph has changed
    if (!!this.removedElements && !graphChanged) {
      this.removedElements.restore();
    }
    this.removedElements = undefined;

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

    const hasRemovedElements: boolean = !!this.removedElements && this.removedElements.length > 0;
    const same = this.areSameElements(prevRemoved, this.removedElements);
    prevRemoved = undefined;
    if (hideChanged || (compressOnHideChanged && selector) || hasRemovedElements) {
      const zoom = cy.zoom();
      const pan = cy.pan();

      // I don't know why but for some reason the first layout may not leave some elements in their final
      // position.  Running the layout a second time seems to solve the issue, so for now we'll take the hit
      // when removing nodes and run it a second time.
      CytoscapeGraphUtils.runLayout(cy, this.props.layout);
      CytoscapeGraphUtils.runLayout(cy, this.props.layout); // intentionally run a second time

      // after the layout perform a fit to minimize movement, unless we need to maintain a custom zoom/pan.
      // Absorb small zoom/pan changes made by the layout, only re-establish significant, user-generated changes.
      const zoomChanged = Math.abs(zoom - cy.zoom()) > 0.1;
      const panChanged = Math.abs(pan.x - cy.pan().x) > 20 || Math.abs(pan.y - cy.pan().y) > 20;

      if (!same || compressOnHideChanged || layoutChanged || !(zoomChanged || panChanged)) {
        CytoscapeGraphUtils.safeFit(cy);
      } else {
        if (zoomChanged) {
          cy.zoom(zoom);
        }
        if (panChanged) {
          cy.pan(pan);
        }
      }
    }
  };

  private areSameElements(elemsA: any, elemsB: any): boolean {
    if (elemsA === elemsB) {
      return true;
    }
    if (!elemsA || !elemsB) {
      return false;
    }
    if (elemsA.length !== elemsB.length) {
      return false;
    }
    const idsA = elemsA.map(e => e.id).sort();
    return elemsB
      .map(e => e.id)
      .sort()
      .every((eId, index) => eId === idsA[index]);
  }

  private handleFind = (cy: any) => {
    const selector = this.parseValue(this.props.findValue, true);

    cy.startBatch();
    // unhighlight old find-hits
    cy.elements('*.find').removeClass('find');
    if (selector) {
      // add new find-hits
      cy.elements(selector).addClass('find');
    }
    cy.endBatch();
  };

  private setError(error: string | undefined, isFind: boolean): undefined {
    if (isFind && error !== this.state.findError) {
      const findError = !!error ? `Find: ${error}` : undefined;
      this.setState({ findError: findError });
    } else if (error !== this.state.hideError) {
      const hideError = !!error ? `Hide: ${error}` : undefined;
      this.setState({ hideError: hideError });
    }
    return undefined;
  }

  private parseValue = (val: string, isFind: boolean): string | undefined => {
    let preparedVal = this.prepareValue(val);
    if (!preparedVal) {
      return undefined;
    }

    preparedVal = preparedVal.replace(/ and /gi, ' AND ');
    preparedVal = preparedVal.replace(/ or /gi, ' OR ');
    const conjunctive = preparedVal.includes(' AND ');
    const disjunctive = preparedVal.includes(' OR ');
    if (conjunctive && disjunctive) {
      return this.setError(`Expression can not contain both 'AND' and 'OR'`, isFind);
    }
    const separator = disjunctive ? ',' : '';
    const expressions = disjunctive ? preparedVal.split(' OR ') : preparedVal.split(' AND ');
    let selector;

    for (const expression of expressions) {
      const parsedExpression = this.parseExpression(expression, conjunctive, disjunctive, isFind);
      if (!parsedExpression) {
        return undefined;
      }
      selector = this.appendSelector(selector, parsedExpression, separator, isFind);
      if (!selector) {
        return undefined;
      }
    }
    // parsed successfully, clear any previous error message
    this.setError(undefined, isFind);
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
    disjunctive: boolean,
    isFind: boolean
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
        return this.setError(`No valid operator found in expression`, isFind);
      }

      const unaryExpression = this.parseUnaryFindExpression(expression.trim(), false);
      return unaryExpression ? unaryExpression : this.setError(`Invalid Node or Edge operand`, isFind);
    }

    const tokens = expression.split(op);
    if (op === '!') {
      const unaryExpression = this.parseUnaryFindExpression(tokens[1].trim(), true);
      return unaryExpression ? unaryExpression : this.setError(`Invalid Node or Edge operand`, isFind);
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
        const s = this.getNumericSelector(CyNode.grpcIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'grpcout': {
        const s = this.getNumericSelector(CyNode.grpcOut, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpin': {
        const s = this.getNumericSelector(CyNode.httpIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpout': {
        const s = this.getNumericSelector(CyNode.httpOut, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'name': {
        const isNegation = op.startsWith('!');
        if (disjunctive && isNegation) {
          return this.setError(`Can not use 'OR' with negated 'name' operand`, isFind);
        } else if (conjunctive) {
          return this.setError(`Can not use 'AND' with 'name' operand`, isFind);
        }
        const agg = `[${CyNode.aggregateValue} ${op} "${val}"]`;
        const app = `[${CyNode.app} ${op} "${val}"]`;
        const svc = `[${CyNode.service} ${op} "${val}"]`;
        const wl = `[${CyNode.workload} ${op} "${val}"]`;
        return { target: 'node', selector: isNegation ? `${agg}${app}${svc}${wl}` : `${agg},${app},${svc},${wl}` };
      }
      case 'node':
        let nodeType = val.toLowerCase();
        switch (nodeType) {
          case 'op':
          case 'operation':
            nodeType = NodeType.AGGREGATE;
            break;
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
          case NodeType.AGGREGATE:
          case NodeType.APP:
          case NodeType.SERVICE:
          case NodeType.WORKLOAD:
          case NodeType.UNKNOWN:
            return { target: 'node', selector: `[${CyNode.nodeType} ${op} "${nodeType}"]` };
          default:
            this.setError(
              `Invalid node type [${nodeType}]. Expected app | operation | service | unknown | workload`,
              isFind
            );
        }
        return undefined;
      case 'ns':
      case 'namespace':
        return { target: 'node', selector: `[${CyNode.namespace} ${op} "${val}"]` };
      case 'op':
      case 'operation':
        return { target: 'node', selector: `[${CyNode.aggregateValue} ${op} "${val}"]` };
      case 'svc':
      case 'service':
        return { target: 'node', selector: `[${CyNode.service} ${op} "${val}"]` };
      case 'tcpin': {
        const s = this.getNumericSelector(CyNode.tcpIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'tcpout': {
        const s = this.getNumericSelector(CyNode.tcpOut, op, val, expression, isFind);
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
        const s = this.getNumericSelector(CyEdge.grpc, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpcerror':
      case '%grpcerr': {
        const s = this.getNumericSelector(CyEdge.grpcPercentErr, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpctraffic': {
        const s = this.getNumericSelector(CyEdge.grpcPercentReq, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'http': {
        const s = this.getNumericSelector(CyEdge.http, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httperror':
      case '%httperr': {
        const s = this.getNumericSelector(CyEdge.httpPercentErr, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httptraffic': {
        const s = this.getNumericSelector(CyEdge.httpPercentReq, op, val, expression, isFind);
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
        const s = this.getNumericSelector(CyEdge.responseTime, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'tcp': {
        const s = this.getNumericSelector(CyEdge.tcp, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      default:
        return this.setError(`Invalid operand [${field}]`, isFind);
    }
  };

  private getNumericSelector(
    field: string,
    op: string,
    val: any,
    _expression: string,
    isFind: boolean
  ): string | undefined {
    switch (op) {
      case '>':
      case '<':
      case '>=':
      case '<=':
        if (isNaN(val)) {
          return this.setError(`Invalid value [${val}]. Expected a numeric value (use . for decimals)`, isFind);
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
        return this.setError(`Invalid operator [${op}] for numeric condition`, isFind);
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
    separator: string,
    isFind: boolean
  ): string | undefined => {
    if (!selector) {
      return parsedExpression.target + parsedExpression.selector;
    }
    if (!selector.startsWith(parsedExpression.target)) {
      return this.setError('Invalid expression. Can not mix node and edge criteria.', isFind);
    }
    return selector + separator + parsedExpression.selector;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  compressOnHide: state.graph.toolbarState.compressOnHide,
  edgeLabelMode: edgeLabelModeSelector(state),
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  layout: state.graph.layout,
  showFindHelp: state.graph.toolbarState.showFindHelp,
  showSecurity: state.graph.toolbarState.showSecurity,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes,
  updateTime: state.graph.updateTime
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setEdgeLabelMode: bindActionCreators(GraphToolbarActions.setEdgelLabelMode, dispatch),
    setFindValue: bindActionCreators(GraphToolbarActions.setFindValue, dispatch),
    setHideValue: bindActionCreators(GraphToolbarActions.setHideValue, dispatch),
    toggleFindHelp: bindActionCreators(GraphToolbarActions.toggleFindHelp, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphToolbarActions.toggleUnusedNodes, dispatch)
  };
};

const GraphFindContainer = connect(mapStateToProps, mapDispatchToProps)(GraphFind);

export default GraphFindContainer;
