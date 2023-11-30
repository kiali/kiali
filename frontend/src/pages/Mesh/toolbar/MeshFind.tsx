import * as React from 'react';
import {
  Button,
  ButtonVariant,
  TextInput,
  Tooltip,
  Form,
  FormHelperText,
  Grid,
  HelperText,
  HelperTextItem,
  FormGroup,
  GridItem
} from '@patternfly/react-core';
import { Controller, Graph, GraphElement } from '@patternfly/react-topology';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import { findValueSelector, hideValueSelector } from '../../../store/Selectors';
import * as CytoscapeGraphUtils from '../../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { TourStop } from 'components/Tour/TourStop';
import { MeshTourStops } from 'pages/Mesh/MeshHelpTour';
import { TimeInMilliseconds } from 'types/Common';
import { KialiDispatch } from 'types/Redux';
import { AutoComplete } from 'utils/AutoComplete';
import { HEALTHY, NA, NOT_READY } from 'types/Health';
import { history, HistoryManager, URLParam } from '../../../app/History';
import { isValid } from 'utils/Common';
import {
  descendents,
  EdgeData,
  elems,
  NodeData,
  SelectAnd,
  SelectExp,
  selectOr,
  SelectOr
} from 'pages/GraphPF/GraphPFElems';
import { FIT_PADDING } from 'pages/GraphPF/GraphPF';
import { isArray } from 'lodash';
import { MeshAttr, MeshInfraType, MeshNodeType } from 'types/Mesh';
import { Layout } from 'types/Graph';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { MeshFindOptions } from './MeshFindOptions';
import { MeshHelpFind } from '../MeshHelpFind';

type ReduxProps = {
  findValue: string;
  hideValue: string;
  layout: Layout;
  setFindValue: (val: string) => void;
  setHideValue: (val: string) => void;
  showFindHelp: boolean;
  toggleFindHelp: () => void;
  updateTime: TimeInMilliseconds;
};

type MeshFindProps = ReduxProps & {
  controller: Controller;
  elementsChanged: boolean;
};

type MeshFindState = {
  findError?: string;
  findInputValue: string;
  hideError?: string;
  hideInputValue: string;
};

type ParsedExpression = {
  selector: SelectExp | SelectAnd | SelectOr;
  target: 'node' | 'edge';
};

const thinGroupStyle = kialiStyle({
  paddingLeft: '0.75rem'
});

const buttonClearStyle = kialiStyle({
  paddingLeft: '0.75rem',
  paddingRight: '0.75rem'
});

const findHideHelpStyle = kialiStyle({
  paddingLeft: '0.25rem',
  paddingRight: '0.25rem'
});

const gridStyle = kialiStyle({
  display: 'flex'
});

const meshFindStyle = kialiStyle({
  marginRight: '0.75rem',
  $nest: {
    '& > .pf-v5-c-form__group-control': {
      display: 'flex'
    }
  }
});

const operands: string[] = ['cluster', 'healthy', 'label:', 'mtls', 'name', 'namespace', 'node', 'outside'];

class MeshFindComponent extends React.Component<MeshFindProps, MeshFindState> {
  static contextTypes = {
    router: () => null
  };

  private findAutoComplete: AutoComplete;
  private findInputRef;
  private findElements: GraphElement[] | undefined;
  private hiddenElements: GraphElement[] | undefined;
  private hideAutoComplete: AutoComplete;
  private hideInputRef;

  constructor(props: MeshFindProps) {
    super(props);

    this.findAutoComplete = new AutoComplete(operands);
    this.hideAutoComplete = new AutoComplete(operands);

    let findValue = props.findValue ? props.findValue : '';
    let hideValue = props.hideValue ? props.hideValue : '';

    // Let URL override current redux state at construction time. Update URL as needed.
    const urlParams = new URLSearchParams(history.location.search);
    const urlFind = HistoryManager.getParam(URLParam.MESH_FIND, urlParams);
    if (!!urlFind) {
      if (urlFind !== findValue) {
        findValue = urlFind;
        props.setFindValue(urlFind);
      }
    } else if (!!findValue) {
      HistoryManager.setParam(URLParam.MESH_FIND, findValue);
    }
    const urlHide = HistoryManager.getParam(URLParam.MESH_HIDE, urlParams);
    if (!!urlHide) {
      if (urlHide !== hideValue) {
        hideValue = urlHide;
        props.setHideValue(urlHide);
      }
    } else if (!!hideValue) {
      HistoryManager.setParam(URLParam.MESH_HIDE, hideValue);
    }

    this.state = { findInputValue: findValue, hideInputValue: hideValue };

    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
  }

  // We only update on a change to the find/hide values, or a mesh change.  Although we use other props
  // in processing (layout, etc), a change to those settings will generate a mesh change, so we
  // wait for the mesh change to do the update.
  shouldComponentUpdate(nextProps: MeshFindProps, nextState: MeshFindState) {
    const controllerChanged = this.props.controller !== nextProps.controller;
    const findChanged = this.props.findValue !== nextProps.findValue;
    const hideChanged = this.props.hideValue !== nextProps.hideValue;
    const meshChanged = this.props.updateTime !== nextProps.updateTime;
    const showFindHelpChanged = this.props.showFindHelp !== nextProps.showFindHelp;
    const findErrorChanged = this.state.findError !== nextState.findError;
    const hideErrorChanged = this.state.hideError !== nextState.hideError;

    const shouldUpdate =
      controllerChanged ||
      findChanged ||
      hideChanged ||
      meshChanged ||
      showFindHelpChanged ||
      findErrorChanged ||
      hideErrorChanged;

    return shouldUpdate;
  }

  // Note that we may have redux hide/find values set at mount-time. But because the toolbar mounts prior to
  // the mesh loading, we can't perform this mesh "post-processing" until we have a valid controller.  But the
  // find/hide processing will be initiated externally (processMeshUpdate) when the mesh is ready.
  componentDidUpdate(prevProps: MeshFindProps) {
    if (!this.props.controller) {
      this.findElements = undefined;
      this.hiddenElements = undefined;
      return;
    }

    const findChanged = this.props.findValue !== prevProps.findValue;
    const hideChanged = this.props.hideValue !== prevProps.hideValue;
    const meshChanged = this.props.updateTime !== prevProps.updateTime;

    // ensure redux state and URL are aligned
    if (findChanged) {
      if (!this.props.findValue) {
        HistoryManager.deleteParam(URLParam.MESH_FIND, true);
      } else {
        HistoryManager.setParam(URLParam.MESH_FIND, this.props.findValue);
      }
    }
    if (hideChanged) {
      if (!this.props.hideValue) {
        HistoryManager.deleteParam(URLParam.MESH_HIDE, true);
      } else {
        HistoryManager.setParam(URLParam.MESH_HIDE, this.props.hideValue);
      }
    }

    // make sure the value is updated if there was a change
    if (findChanged || (meshChanged && !!this.props.findValue)) {
      // ensure findInputValue is aligned if findValue is set externally (e.g. resetSettings)
      if (this.state.findInputValue !== this.props.findValue) {
        this.setFind(this.props.findValue);
      }

      this.handleFind(this.props.controller);
    }

    if (hideChanged || (meshChanged && !!this.props.hideValue)) {
      // ensure hideInputValue is aligned if hideValue is set externally (e.g. resetSettings)
      if (this.state.hideInputValue !== this.props.hideValue) {
        this.setHide(this.props.hideValue);
      }
      this.handleHide(this.props.controller, meshChanged);
    }
  }

  render() {
    return (
      <TourStop info={MeshTourStops.Find}>
        <Form className={thinGroupStyle}>
          <Grid md={12} className={gridStyle}>
            <GridItem span={5}>
              <FormGroup>
                <TextInput
                  id="MESH_FIND"
                  name="MESH_FIND"
                  ref={ref => {
                    this.findInputRef = ref;
                  }}
                  type="text"
                  autoComplete="on"
                  validated={isValid(this.state.findInputValue ? !this.state.findError : undefined)}
                  onChange={(_event, val) => this.updateFind(val)}
                  defaultValue={this.state.findInputValue}
                  onKeyDownCapture={this.checkSpecialKeyFind}
                  placeholder="Find..."
                />
                {this.state.findError && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant={'error'}>{this.state.findError}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            </GridItem>
            <GridItem span={1}>
              <FormGroup className={meshFindStyle}>
                <MeshFindOptions kind="find" onSelect={this.updateFindOption} />
                {this.props.findValue && (
                  <Tooltip key="ot_clear_find" position="top" content="Clear Find...">
                    <Button
                      className={buttonClearStyle}
                      variant={ButtonVariant.control}
                      onClick={() => this.setFind('')}
                    >
                      <KialiIcon.Close />
                    </Button>
                  </Tooltip>
                )}
              </FormGroup>
            </GridItem>
            <GridItem span={5}>
              <FormGroup>
                <TextInput
                  id="MESH_HIDE"
                  name="MESH_HIDE"
                  ref={ref => {
                    this.hideInputRef = ref;
                  }}
                  autoComplete="on"
                  validated={isValid(this.state.hideInputValue ? !this.state.hideError : undefined)}
                  type="text"
                  onChange={(_event, val) => this.updateHide(val)}
                  defaultValue={this.state.hideInputValue}
                  onKeyDownCapture={this.checkSpecialKeyHide}
                  placeholder="Hide..."
                />
                {this.state.hideError && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant={'error'}>{this.state.hideError}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            </GridItem>
            <GridItem span={1}>
              <FormGroup className={meshFindStyle}>
                <MeshFindOptions kind="hide" onSelect={this.updateHideOption} />
                {this.props.hideValue && (
                  <Tooltip key="ot_clear_hide" position="top" content="Clear Hide...">
                    <Button
                      className={buttonClearStyle}
                      variant={ButtonVariant.control}
                      onClick={() => this.setHide('')}
                    >
                      <KialiIcon.Close />
                    </Button>
                  </Tooltip>
                )}
              </FormGroup>
            </GridItem>
          </Grid>
        </Form>
        {this.props.showFindHelp ? (
          <MeshHelpFind onClose={this.toggleFindHelp}>
            <Button
              data-test="mesh-find-hide-help-button"
              variant={ButtonVariant.link}
              className={findHideHelpStyle}
              onClick={this.toggleFindHelp}
            >
              <KialiIcon.Info />
            </Button>
          </MeshHelpFind>
        ) : (
          <Tooltip key={'ot_mesh_find_help'} position="top" content="Find/Hide Help...">
            <Button
              data-test="mesh-find-hide-help-button"
              variant={ButtonVariant.link}
              className={findHideHelpStyle}
              onClick={this.toggleFindHelp}
            >
              <KialiIcon.Info />
            </Button>
          </Tooltip>
        )}
      </TourStop>
    );
  }

  private toggleFindHelp = () => {
    this.props.toggleFindHelp();
  };

  private checkSpecialKeyFind = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    switch (keyCode) {
      case 9: // tab (autocomplete)
        event.preventDefault();
        const next = this.findAutoComplete.next();
        if (!!next) {
          this.findInputRef.value = next;
          this.findInputRef.scrollLeft = this.findInputRef.scrollWidth;
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

  private updateFindOption = key => {
    this.setFind(key);
  };

  private updateFind = val => {
    if ('' === val) {
      this.setFind('');
    } else {
      const diff = Math.abs(val.length - this.state.findInputValue.length);
      this.findAutoComplete.setInput(val, [' ', '!']);
      this.setState({ findInputValue: val, findError: undefined });
      // submit if length change is greater than a single key, assume browser suggestion clicked or user paste
      if (diff > 1) {
        this.props.setFindValue(val);
      }
    }
  };

  private setFind = val => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.findInputRef.value = val;
    const htmlInputElement: HTMLInputElement = document.getElementById('MESH_FIND') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = val;
    }
    this.findAutoComplete.setInput(val);
    this.setState({ findInputValue: val, findError: undefined });
    this.props.setFindValue(val);
  };

  private submitFind = () => {
    if (this.props.findValue !== this.state.findInputValue) {
      this.props.setFindValue(this.state.findInputValue);
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
          this.hideInputRef.scrollLeft = this.hideInputRef.scrollWidth;
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

  private updateHideOption = key => {
    this.setHide(key);
  };

  private updateHide = val => {
    if ('' === val) {
      this.setHide('');
    } else {
      const diff = Math.abs(val.length - this.state.hideInputValue.length);
      this.hideAutoComplete.setInput(val, [' ', '!']);
      this.setState({ hideInputValue: val, hideError: undefined });
      // submit if length change is greater than a single key, assume browser suggestion clicked or user paste
      if (diff > 1) {
        this.props.setHideValue(val);
      }
    }
  };

  private submitHide = () => {
    if (this.props.hideValue !== this.state.hideInputValue) {
      this.props.setHideValue(this.state.hideInputValue);
    }
  };

  private setHide = val => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.hideInputRef.value = val;
    const htmlInputElement: HTMLInputElement = document.getElementById('MESH_HIDE') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = val;
    }
    this.hideAutoComplete.setInput(val);
    this.setState({ hideInputValue: val, hideError: undefined });
    this.props.setHideValue(val);
  };

  // All edges have the graph as a parent
  private unhideElement(g: Graph, e: GraphElement) {
    e.setVisible(true);
    if (!e.hasParent()) {
      g.appendChild(e);
    }
  }

  private handleHide = (controller: Controller, meshChanged: boolean) => {
    const selector = this.parseValue(this.props.hideValue, false);
    const checkRemovals = selector.nodeSelector || selector.edgeSelector;
    const mesh = controller.getGraph();
    let needLayout = false;

    console.debug(`Hide selector=[${JSON.stringify(selector)}]`);

    // unhide hidden elements when we are dealing with the same mesh. Either way,release for garbage collection
    if (!!this.hiddenElements && !meshChanged) {
      needLayout = true;
      this.hiddenElements.forEach(e => this.unhideElement(mesh, e));
    }
    this.hiddenElements = undefined;

    // select the new hide-hits
    if (checkRemovals) {
      let hiddenNodes = [] as GraphElement[];
      let hiddenEdges = [] as GraphElement[];
      const { nodes, edges } = elems(controller);

      // add elements described by the hide expression
      if (selector.nodeSelector) {
        hiddenNodes = selectOr(nodes, selector.nodeSelector);
        hiddenNodes.forEach(n => n.setVisible(false));
      }
      if (selector.edgeSelector) {
        hiddenEdges = selectOr(edges, selector.edgeSelector);
        hiddenEdges.forEach(e => e.setVisible(false));
      }
      if (hiddenEdges.length > 0) {
        // also hide nodes with only hidden edges (keep idle nodes as that is an explicit option)
        nodes.forEach(n => {
          if (n.isVisible()) {
            const nodeData = n.getData();
            const nodeEdges = n.getSourceEdges().concat(n.getTargetEdges());
            if (!nodeData.isIdle && nodeEdges.length > 0 && nodeEdges.every(e => !e.isVisible())) {
              n.setVisible(false);
            }
          }
        });
      }

      // also hide edges connected to hidden nodes
      edges.forEach(e => {
        if (e.isVisible() && !(e.getSource().isVisible() && e.getTarget().isVisible())) {
          e.setVisible(false);
        }
      });

      // unhide any box hits, we only hide empty boxes
      nodes.filter(n => n.isGroup() && !n.isVisible()).forEach(g => this.unhideElement(mesh, g));

      // now hide any boxes that don't have any visible children
      nodes
        .filter(n => n.isGroup())
        .forEach(g => {
          if (descendents(g).every(d => !d.isVisible())) {
            g.setVisible(false);
          }
        });

      const finalNodes = nodes.filter(n => !n.isVisible()) as GraphElement[];
      const finalEdges = edges.filter(e => !e.isVisible()) as GraphElement[];
      // we need to remove edges completely because an invisible edge is not
      // ignored by layout (I don't know why, nodes are ignored)
      finalEdges.forEach(e => e.remove());
      this.hiddenElements = finalNodes.concat(finalEdges);
    }

    if (needLayout || !!this.hiddenElements) {
      controller.getGraph().reset();
      controller.getGraph().layout();
      controller.getGraph().fit(FIT_PADDING);
    }
  };

  private handleFind = (controller: Controller) => {
    const selector = this.parseValue(this.props.findValue, true);
    console.debug(`Find selector=[${JSON.stringify(selector)}]`);

    // unhighlight old find-hits
    this.findElements?.forEach(e => {
      const data = e.getData() as NodeData | EdgeData;
      e.setData({ ...data, isFind: false });
    });
    this.findElements = undefined;

    // add new find-hits
    if (!!selector.nodeSelector || !!selector.edgeSelector) {
      const { nodes, edges } = elems(controller);
      let findNodes = [] as GraphElement[];
      let findEdges = [] as GraphElement[];
      if (selector.nodeSelector) {
        findNodes = selectOr(nodes, selector.nodeSelector);
      }
      if (selector.edgeSelector) {
        findEdges = selectOr(edges, selector.edgeSelector);
      }
      this.findElements = findNodes.concat(findEdges);
      this.findElements.forEach(e => {
        const data = e.getData() as NodeData | EdgeData;
        e.setData({ ...data, isFind: true });
      });
    }
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

  private parseValue = (
    val: string,
    isFind: boolean
  ): { nodeSelector: SelectOr | undefined; edgeSelector: SelectOr | undefined } => {
    let preparedVal = this.prepareValue(val);
    if (!preparedVal) {
      return { nodeSelector: undefined, edgeSelector: undefined };
    }

    // generate separate selectors for each disjunctive clause and then stitch them together. This
    // lets us mix node and edge criteria.
    const orClauses = preparedVal.split(' OR ');
    let orNodeSelector: SelectOr = [];
    let orEdgeSelector: SelectOr = [];

    for (const clause of orClauses) {
      const expressions = clause.split(' AND ');
      const conjunctive = expressions.length > 1;
      let nodeSelector: SelectAnd = [];
      let edgeSelector: SelectAnd = [];
      let target;

      for (const expression of expressions) {
        const parsedExpression = this.parseExpression(expression, conjunctive, isFind);
        if (!parsedExpression) {
          return { nodeSelector: undefined, edgeSelector: undefined };
        }
        if (!target) {
          target = parsedExpression.target;
        } else if (target !== parsedExpression.target) {
          this.setError('Invalid expression. Can not AND node and edge criteria.', isFind);
          return { nodeSelector: undefined, edgeSelector: undefined };
        }

        const selector = parsedExpression.selector;
        if (target === 'node') {
          // special case, selector is a SelectAnd or SelectOr
          if (isArray(selector)) {
            // if 'selector' is already a SelectOr then directly add to orSelector
            if (isArray(selector[0])) {
              orNodeSelector.push(...(selector as SelectAnd[]));
            } else {
              nodeSelector.push(...(selector as SelectExp[]));
            }
          } else {
            nodeSelector.push(selector as SelectExp);
          }
        } else {
          edgeSelector.push(parsedExpression.selector as SelectExp);
        }
      }

      // parsed successfully, clear any previous error message
      this.setError(undefined, isFind);
      if (nodeSelector.length > 0) {
        orNodeSelector.push(nodeSelector);
      }
      if (edgeSelector.length > 0) {
        orEdgeSelector.push(edgeSelector);
      }
    }

    return { nodeSelector: orNodeSelector, edgeSelector: orEdgeSelector };
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

    // uppercase conjunctions
    val = val.replace(/ and /gi, ' AND ');
    val = val.replace(/ or /gi, ' OR ');

    return val.trim();
  };

  private parseExpression = (
    expression: string,
    _conjunctive: boolean,
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
      case 'cluster':
        return { target: 'node', selector: { prop: MeshAttr.cluster, op: op, val: val } };
      case 'name': {
        return { target: 'node', selector: { prop: MeshAttr.infraName, op: op, val: val } };
      }
      case 'node':
        let nodeType = val.toLowerCase();
        switch (nodeType) {
          case MeshNodeType.BOX:
          case MeshNodeType.INFRA:
            return { target: 'node', selector: { prop: MeshAttr.nodeType, op: op, val: nodeType } };
          default:
            this.setError(
              `Invalid node type [${nodeType}]. Expected app | operation | service | unknown | workload`,
              isFind
            );
        }
        return undefined;
      case 'ns':
      case 'namespace':
        return { target: 'node', selector: { prop: MeshAttr.namespace, op: op, val: val } };
      case 'type':
      case 'infratype':
        let infraType = val.toLowerCase();
        switch (infraType) {
          case MeshInfraType.CLUSTER:
          case MeshInfraType.ISTIOD:
          case MeshInfraType.KIALI:
          case MeshInfraType.NAMESPACE:
            return { target: 'node', selector: { prop: MeshAttr.infraType, op: op, val: infraType } };
          case 'metricstore':
          case 'ms':
          case 'prom':
          case 'prometheus':
            return { target: 'node', selector: { prop: MeshAttr.infraType, op: op, val: MeshInfraType.METRIC_STORE } };
          case 'tracestore':
          case 'ts':
          case 'jaeger':
          case 'tempo':
            return { target: 'node', selector: { prop: MeshAttr.infraType, op: op, val: MeshInfraType.TRACE_STORE } };
          default:
            this.setError(
              `Invalid infra type [${infraType}]. Expected cluster | istiod | kiali | metricStore | namespace | traceStore`,
              isFind
            );
        }
        return undefined;
      //
      // edges..
      // currently N/A
      //
      default:
        // special node operand
        if (field.startsWith('label:')) {
          return {
            target: 'node',
            selector: { prop: CytoscapeGraphUtils.toSafeCyFieldName(field), op: op, val: val }
          };
        }

        return this.setError(`Invalid operand [${field}]`, isFind);
    }
  };

  /*
  private getNumericSelector(
    field: string,
    op: string,
    val: any,
    _expression: string,
    isFind: boolean
  ): SelectExp | undefined {
    switch (op) {
      case '>':
      case '<':
      case '>=':
      case '<=':
        if (isNaN(val)) {
          return this.setError(`Invalid value [${val}]. Expected a numeric value (use '.' for decimals)`, isFind);
        }
        return { prop: field, op: op, val: val };
      case '=':
        if (isNaN(val)) {
          return { prop: field, op: 'falsy' };
        }
        return { prop: field, op: op, val: val };
      case '!=':
        if (isNaN(val)) {
          return { prop: field, op: 'truthy' };
        }
        return { prop: field, op: op, val: val };
      default:
        return this.setError(`Invalid operator [${op}] for numeric condition`, isFind);
    }
  }
  */

  private parseUnaryFindExpression = (field: string, isNegation): ParsedExpression | undefined => {
    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'inaccessible':
        return {
          target: 'node',
          selector: { prop: MeshAttr.isInaccessible, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'healthy':
        return {
          target: 'node',
          selector: isNegation
            ? [
                { prop: MeshAttr.healthStatus, op: '!=', val: HEALTHY.name },
                { prop: MeshAttr.healthStatus, op: '!=', val: NA.name },
                { prop: MeshAttr.healthStatus, op: '!=', val: NOT_READY.name }
              ]
            : { prop: MeshAttr.healthStatus, val: HEALTHY.name }
        };
      //
      // edges...
      //
      case 'mtls':
        return { target: 'edge', selector: { prop: MeshAttr.isMTLS, op: isNegation ? '<=' : '>', val: 0 } };
      default:
        // special node operand
        if (field.startsWith('label:')) {
          const safeFieldName = CytoscapeGraphUtils.toSafeCyFieldName(field);
          return { target: 'node', selector: { prop: safeFieldName, op: isNegation ? '<=' : '>', val: 0 } };
        }

        return undefined;
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  layout: state.mesh.layout,
  showFindHelp: state.mesh.toolbarState.showFindHelp,
  updateTime: state.mesh.updateTime
});

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setFindValue: bindActionCreators(MeshToolbarActions.setFindValue, dispatch),
    setHideValue: bindActionCreators(MeshToolbarActions.setHideValue, dispatch),
    toggleFindHelp: bindActionCreators(MeshToolbarActions.toggleFindHelp, dispatch)
  };
};

export const MeshFind = connect(mapStateToProps, mapDispatchToProps)(MeshFindComponent);
