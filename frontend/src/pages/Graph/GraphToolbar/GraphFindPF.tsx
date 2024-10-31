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
import { findValueSelector, hideValueSelector, edgeLabelsSelector, edgeModeSelector } from '../../../store/Selectors';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphHelpFind } from '../../../pages/Graph/GraphHelpFind';
import * as CytoscapeGraphUtils from '../../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { EdgeLabelMode, NodeType, Layout, EdgeMode, NodeAttr, EdgeAttr } from '../../../types/Graph';
import * as AlertUtils from '../../../utils/AlertUtils';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { KialiDispatch } from 'types/Redux';
import { AutoComplete } from 'utils/AutoComplete';
import { HEALTHY, NA, NOT_READY } from 'types/Health';
import { GraphFindOptions } from './GraphFindOptions';
import { location, HistoryManager, URLParam } from '../../../app/History';
import { isValid } from 'utils/Common';
import { EdgeData, NodeData } from 'pages/GraphPF/GraphPFElems';
import { elems, SelectAnd, SelectExp, selectOr, SelectOr, setObserved } from 'helpers/GraphHelpers';
import { descendents } from 'helpers/GraphHelpers';
import { isArray } from 'lodash';
import { graphLayout, LayoutType } from 'pages/GraphPF/GraphPF';

type ReduxStateProps = {
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  findValue: string;
  hideValue: string;
  layout: Layout;
  namespaceLayout: Layout;
  showFindHelp: boolean;
  showIdleNodes: boolean;
  showRank: boolean;
  showSecurity: boolean;
};

type ReduxDispatchProps = {
  setEdgeLabels: (vals: EdgeLabelMode[]) => void;
  setFindValue: (val: string) => void;
  setHideValue: (val: string) => void;
  toggleFindHelp: () => void;
  toggleGraphSecurity: () => void;
  toggleIdleNodes: () => void;
  toggleRank: () => void;
};

type GraphFindProps = ReduxStateProps &
  ReduxDispatchProps & {
    controller: Controller;
    elementsChanged: boolean;
  };

type GraphFindState = {
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

const graphFindStyle = kialiStyle({
  marginRight: '0.75rem',
  $nest: {
    '& > .pf-v5-c-form__group-control': {
      display: 'flex'
    }
  }
});

const operands: string[] = [
  '%grpcerr',
  '%grpctraffic',
  '%httperr',
  '%httptraffic',
  'app',
  'circuitbreaker',
  'cluster',
  'destprincipal',
  'faultinjection',
  'grpc',
  'grpcerr',
  'grpcin',
  'grpcout',
  'healthy',
  'http',
  'httpin',
  'httpout',
  'idle',
  'label:',
  'mirroring',
  'mtls',
  'name',
  'namespace',
  'node',
  'operation',
  'outside',
  'protocol',
  'rank',
  'requestrouting',
  'requesttimeout',
  'responsetime',
  'service',
  'serviceentry',
  'sidecar',
  'sourceprincipal',
  'tcp',
  'tcptrafficshifting',
  'throughput',
  'traffic',
  'trafficshifting',
  'trafficsource',
  'version',
  'virtualservice',
  'tcpin',
  'tcpout',
  'workload',
  'workloadentry'
];

class GraphFindPFComponent extends React.Component<GraphFindProps, GraphFindState> {
  static contextTypes = {
    router: (): null => null
  };

  private findAutoComplete: AutoComplete;
  private findInputRef;
  private findElements: GraphElement[] | undefined;
  private hiddenElements: GraphElement[] | undefined;
  private hideAutoComplete: AutoComplete;
  private hideInputRef;

  constructor(props: GraphFindProps) {
    super(props);

    this.findAutoComplete = new AutoComplete(operands);
    this.hideAutoComplete = new AutoComplete(operands);

    let findValue = props.findValue ? props.findValue : '';
    let hideValue = props.hideValue ? props.hideValue : '';

    // Let URL override current redux state at construction time. Update URL as needed.
    const urlParams = new URLSearchParams(location.getSearch());
    const urlFind = HistoryManager.getParam(URLParam.GRAPH_FIND, urlParams);

    if (urlFind) {
      if (urlFind !== findValue) {
        findValue = urlFind;
        props.setFindValue(urlFind);
      }
    } else if (findValue) {
      HistoryManager.setParam(URLParam.GRAPH_FIND, findValue);
    }

    const urlHide = HistoryManager.getParam(URLParam.GRAPH_HIDE, urlParams);
    if (urlHide) {
      if (urlHide !== hideValue) {
        hideValue = urlHide;
        props.setHideValue(urlHide);
      }
    } else if (hideValue) {
      HistoryManager.setParam(URLParam.GRAPH_HIDE, hideValue);
    }

    this.state = { findInputValue: findValue, hideInputValue: hideValue };

    if (props.showFindHelp) {
      props.toggleFindHelp();
    }
  }

  // We only update on a change to the find/hide values, or a graph change.  Although we use other props
  // in processing (layout, etc), a change to those settings will generate a graph change, so we
  // wait for the graph change to do the update.
  shouldComponentUpdate(nextProps: GraphFindProps, nextState: GraphFindState): boolean {
    const controllerChanged = this.props.controller !== nextProps.controller;
    const edgeModeChanged = this.props.edgeMode !== nextProps.edgeMode;
    const elementsChanged = !this.props.elementsChanged && nextProps.elementsChanged;
    const findChanged = this.props.findValue !== nextProps.findValue;
    const hideChanged = this.props.hideValue !== nextProps.hideValue;
    const showFindHelpChanged = this.props.showFindHelp !== nextProps.showFindHelp;
    const findErrorChanged = this.state.findError !== nextState.findError;
    const hideErrorChanged = this.state.hideError !== nextState.hideError;

    const shouldUpdate =
      controllerChanged ||
      edgeModeChanged ||
      elementsChanged ||
      findChanged ||
      hideChanged ||
      showFindHelpChanged ||
      findErrorChanged ||
      hideErrorChanged;

    return shouldUpdate;
  }

  // Note that we may have redux hide/find values set at mount-time. But because the toolbar mounts prior to
  // the graph loading, we can't perform this graph "post-processing" until we have a valid cy graph.  But the
  // find/hide processing will be initiated externally (CytoscapeGraph:processgraphUpdate) when the graph is ready.
  componentDidUpdate(prevProps: GraphFindProps): void {
    if (!this.props.controller) {
      this.findElements = undefined;
      this.hiddenElements = undefined;
      return;
    }

    const controllerChanged = this.props.controller !== prevProps.controller;
    const edgeModeChanged = this.props.edgeMode !== prevProps.edgeMode;
    const elementsChanged = this.props.elementsChanged && !prevProps.elementsChanged;
    const findChanged = this.props.findValue !== prevProps.findValue;
    const hideChanged = this.props.hideValue !== prevProps.hideValue;

    // ensure redux state and URL are aligned
    if (findChanged) {
      if (!this.props.findValue) {
        HistoryManager.deleteParam(URLParam.GRAPH_FIND);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_FIND, this.props.findValue);
      }
    }
    if (hideChanged) {
      if (!this.props.hideValue) {
        HistoryManager.deleteParam(URLParam.GRAPH_HIDE);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_HIDE, this.props.hideValue);
      }
    }

    // make sure the value is updated if there was a change
    if (controllerChanged || findChanged || (elementsChanged && this.props.findValue)) {
      // ensure findInputValue is aligned if findValue is set externally (e.g. resetSettings)
      if (this.state.findInputValue !== this.props.findValue) {
        this.setFind(this.props.findValue);
      }

      this.handleFind(this.props.controller);
    }

    if (
      controllerChanged ||
      hideChanged ||
      (elementsChanged && this.props.hideValue) ||
      edgeModeChanged ||
      this.props.edgeMode !== EdgeMode.ALL
    ) {
      // ensure hideInputValue is aligned if hideValue is set externally (e.g. resetSettings)
      if (this.state.hideInputValue !== this.props.hideValue) {
        this.setHide(this.props.hideValue);
      }
      this.handleHide(this.props.controller);
    }
  }

  render(): React.ReactNode {
    return (
      <TourStop info={GraphTourStops.Find}>
        <Form className={thinGroupStyle}>
          <Grid md={12} className={gridStyle}>
            <GridItem span={5}>
              <FormGroup>
                <TextInput
                  id="graph_find"
                  name="graph_find"
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
              <FormGroup className={graphFindStyle}>
                <GraphFindOptions kind="find" onSelect={this.updateFindOption} />
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
                  id="graph_hide"
                  name="graph_hide"
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
              <FormGroup className={graphFindStyle}>
                <GraphFindOptions kind="hide" onSelect={this.updateHideOption} />
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
          <GraphHelpFind onClose={this.toggleFindHelp}>
            <Button
              data-test="graph-find-hide-help-button"
              variant={ButtonVariant.link}
              className={findHideHelpStyle}
              onClick={this.toggleFindHelp}
            >
              <KialiIcon.Info />
            </Button>
          </GraphHelpFind>
        ) : (
          <Tooltip key={'ot_graph_find_help'} position="top" content="Find/Hide Help...">
            <Button
              data-test="graph-find-hide-help-button"
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

  private toggleFindHelp = (): void => {
    this.props.toggleFindHelp();
  };

  private checkSpecialKeyFind = (event: React.KeyboardEvent): void => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    switch (keyCode) {
      case 9: // tab (autocomplete)
        event.preventDefault();
        const next = this.findAutoComplete.next();
        if (next) {
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

  private updateFindOption = (key: string): void => {
    this.setFind(key);
  };

  private updateFind = (val: string): void => {
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

  private setFind = (val: string): void => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.findInputRef.value = val;
    const htmlInputElement: HTMLInputElement = document.getElementById('graph_find') as HTMLInputElement;

    if (htmlInputElement !== null) {
      htmlInputElement.value = val;
    }

    this.findAutoComplete.setInput(val);
    this.setState({ findInputValue: val, findError: undefined });
    this.props.setFindValue(val);
  };

  private submitFind = (): void => {
    if (this.props.findValue !== this.state.findInputValue) {
      this.props.setFindValue(this.state.findInputValue);
    }
  };

  private checkSpecialKeyHide = (event: React.KeyboardEvent): void => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    switch (keyCode) {
      case 9: // tab (autocomplete)
        event.preventDefault();
        const next = this.hideAutoComplete.next();

        if (next) {
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

  private updateHideOption = (key: string): void => {
    this.setHide(key);
  };

  private updateHide = (val: string): void => {
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

  private submitHide = (): void => {
    if (this.props.hideValue !== this.state.hideInputValue) {
      this.props.setHideValue(this.state.hideInputValue);
    }
  };

  private setHide = (val: string): void => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    this.hideInputRef.value = val;
    const htmlInputElement: HTMLInputElement = document.getElementById('graph_hide') as HTMLInputElement;

    if (htmlInputElement !== null) {
      htmlInputElement.value = val;
    }

    this.hideAutoComplete.setInput(val);
    this.setState({ hideInputValue: val, hideError: undefined });
    this.props.setHideValue(val);
  };

  // All edges have the graph as a parent
  private unhideElements = (g: Graph, elems: GraphElement[]): void => {
    setObserved(() => {
      elems.forEach(e => {
        e.setVisible(true);

        if (!e.hasParent()) {
          g.appendChild(e);
        }
      });
    });
  };

  private handleHide = (controller: Controller): void => {
    const selector = this.parseValue(this.props.hideValue, false);
    const checkRemovals = selector.nodeSelector || selector.edgeSelector || this.props.edgeMode !== EdgeMode.ALL;
    const graph = controller.getGraph();

    console.debug(`Hide selector=[${JSON.stringify(selector)}]`);

    // unhide any currently hidden elements, something changed so we'll redetermine what needs to be hidden
    if (this.hiddenElements) {
      this.unhideElements(graph, this.hiddenElements);
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
        setObserved(() => hiddenNodes.forEach(n => n.setVisible(false)));
      }

      if (selector.edgeSelector) {
        hiddenEdges = selectOr(edges, selector.edgeSelector);
        setObserved(() => hiddenEdges.forEach(e => e.setVisible(false)));
      }

      if (hiddenEdges.length > 0) {
        // also hide nodes with only hidden edges (keep idle nodes as that is an explicit option)
        setObserved(() => {
          nodes.forEach(n => {
            if (n.isVisible()) {
              const nodeData = n.getData();
              const nodeEdges = n.getSourceEdges().concat(n.getTargetEdges());
              if (!nodeData.isIdle && nodeEdges.length > 0 && nodeEdges.every(e => !e.isVisible())) {
                n.setVisible(false);
              }
            }
          });
        });
      }

      // also hide edges connected to hidden nodes
      setObserved(() => {
        edges.forEach(e => {
          if (e.isVisible() && !(e.getSource().isVisible() && e.getTarget().isVisible())) {
            e.setVisible(false);
          }
        });
      });

      // unhide any box hits, we only hide empty boxes
      this.unhideElements(
        graph,
        nodes.filter(n => n.isGroup() && !n.isVisible())
      );

      // Handle EdgeMode as part of Hide, just edges, leave remaining visible nodes
      if (this.props.edgeMode !== EdgeMode.ALL) {
        switch (this.props.edgeMode) {
          case EdgeMode.NONE:
            setObserved(() => edges.forEach(e => e.setVisible(false)));
            break;
          case EdgeMode.UNHEALTHY:
            setObserved(() => {
              edges.forEach(e => {
                if (e.isVisible() && !e.getData()[NodeAttr.healthStatus]) {
                  e.setVisible(false);
                }
              });
            });

            break;
        }
      }

      // now hide any appboxes that don't have any visible children
      setObserved(() => {
        nodes
          .filter(n => n.isGroup())
          .forEach(g => {
            if (descendents(g).every(d => !d.isVisible())) {
              g.setVisible(false);
            }
          });
      });

      const finalNodes = nodes.filter(n => !n.isVisible()) as GraphElement[];
      const finalEdges = edges.filter(e => !e.isVisible()) as GraphElement[];

      // we need to remove edges completely because an invisible edge is not
      // ignored by layout (I don't know why, nodes are ignored)
      setObserved(() => finalEdges.forEach(e => e.remove()));

      this.hiddenElements = finalNodes.concat(finalEdges);
    }

    // always perform a full layout, because if this function is invoked at all, we know either we're dealing with either
    // a new controller, a different topology, a new hide expression, etc
    graphLayout(controller, LayoutType.Layout);
  };

  private handleFind = (controller: Controller): void => {
    const selector = this.parseValue(this.props.findValue, true);
    console.debug(`Find selector=[${JSON.stringify(selector)}]`);

    // unhighlight old find-hits
    setObserved(() => {
      this.findElements?.forEach(e => {
        const data = e.getData() as NodeData | EdgeData;
        e.setData({ ...data, isFind: false } as NodeData | EdgeData);
      });
    });

    this.findElements = undefined;

    // add new find-hits
    if (selector.nodeSelector || selector.edgeSelector) {
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
      setObserved(() => {
        this.findElements?.forEach(e => {
          const data = e.getData() as NodeData | EdgeData;
          e.setData({ ...data, isFind: true } as NodeData | EdgeData);
        });
      });
    }
  };

  private setError(error: string | undefined, isFind: boolean): undefined {
    if (isFind && error !== this.state.findError) {
      const findError = error ? `Find: ${error}` : undefined;
      this.setState({ findError: findError });
    } else if (error !== this.state.hideError) {
      const hideError = error ? `Hide: ${error}` : undefined;
      this.setState({ hideError: hideError });
    }

    return undefined;
  }

  private parseValue = (
    val: string,
    isFind: boolean
  ): { edgeSelector: SelectOr | undefined; nodeSelector: SelectOr | undefined } => {
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
    val = ` ${val}`;
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
    conjunctive: boolean,
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
        return { target: 'node', selector: { prop: NodeAttr.app, op: op, val: val } };
      case 'cluster':
        return { target: 'node', selector: { prop: NodeAttr.cluster, op: op, val: val } };
      case 'grpcin': {
        const s = this.getNumericSelector(NodeAttr.grpcIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'grpcout': {
        const s = this.getNumericSelector(NodeAttr.grpcOut, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpin': {
        const s = this.getNumericSelector(NodeAttr.httpIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'httpout': {
        const s = this.getNumericSelector(NodeAttr.httpOut, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'name': {
        const isNegation = op.startsWith('!');

        if (conjunctive) {
          return this.setError(`Can not use 'AND' with 'name' operand`, isFind);
        }

        const agg = { prop: NodeAttr.aggregateValue, op: op, val: val };
        const app = { prop: NodeAttr.app, op: op, val: val };
        const svc = { prop: NodeAttr.service, op: op, val: val };
        const wl = { prop: NodeAttr.workload, op: op, val: val };

        return { target: 'node', selector: isNegation ? [[agg, app, svc, wl]] : [[agg], [app], [svc], [wl]] };
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
            return { target: 'node', selector: { prop: NodeAttr.nodeType, op: op, val: nodeType } };
          default:
            this.setError(
              `Invalid node type [${nodeType}]. Expected app | operation | service | unknown | workload`,
              isFind
            );
        }
        return undefined;
      case 'ns':
      case 'namespace':
        return { target: 'node', selector: { prop: NodeAttr.namespace, op: op, val: val } };
      case 'op':
      case 'operation':
        return { target: 'node', selector: { prop: NodeAttr.aggregateValue, op: op, val: val } };
      case 'rank': {
        if (!this.props.showRank) {
          AlertUtils.addSuccess('Enabling "Rank" display option for graph find/hide expression');
          this.props.toggleRank();
        }

        const valAsNum = Number(val);

        if (Number.isNaN(valAsNum) || valAsNum < 1 || valAsNum > 100) {
          return this.setError(`Invalid rank range [${val}]. Expected a number between 1..100`, isFind);
        }

        const s = this.getNumericSelector(NodeAttr.rank, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'svc':
      case 'service':
        return { target: 'node', selector: { prop: NodeAttr.service, op: op, val: val } };
      case 'tcpin': {
        const s = this.getNumericSelector(NodeAttr.tcpIn, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'tcpout': {
        const s = this.getNumericSelector(NodeAttr.tcpOut, op, val, expression, isFind);
        return s ? { target: 'node', selector: s } : undefined;
      }
      case 'version':
        return { target: 'node', selector: { prop: NodeAttr.version, op: op, val: val } };
      case 'wl':
      case 'workload':
        return { target: 'node', selector: { prop: NodeAttr.workload, op: op, val: val } };
      //
      // edges..
      //
      case 'destprincipal':
        if (!this.props.showSecurity) {
          AlertUtils.addSuccess('Enabling "Security" display option for graph find/hide expression');
          this.props.toggleGraphSecurity();
        }

        return { target: 'edge', selector: { prop: EdgeAttr.destPrincipal, op: op, val: val } };
      case 'grpc': {
        const s = this.getNumericSelector(EdgeAttr.grpc, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpcerror':
      case '%grpcerr': {
        const s = this.getNumericSelector(EdgeAttr.grpcPercentErr, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%grpctraffic': {
        const s = this.getNumericSelector(EdgeAttr.grpcPercentReq, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'http': {
        const s = this.getNumericSelector(EdgeAttr.http, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httperror':
      case '%httperr': {
        const s = this.getNumericSelector(EdgeAttr.httpPercentErr, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case '%httptraffic': {
        const s = this.getNumericSelector(EdgeAttr.httpPercentReq, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'protocol': {
        return { target: 'edge', selector: { prop: EdgeAttr.protocol, op: op, val: val } };
      }
      case 'rt':
      case 'responsetime': {
        if (!this.props.edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP)) {
          AlertUtils.addSuccess('Enabling [P95] "Response Time" edge labels for this graph find/hide expression');
          this.props.setEdgeLabels([
            ...this.props.edgeLabels,
            EdgeLabelMode.RESPONSE_TIME_GROUP,
            EdgeLabelMode.RESPONSE_TIME_P95
          ]);
        }

        const s = this.getNumericSelector(EdgeAttr.responseTime, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'sourceprincipal':
        if (!this.props.showSecurity) {
          AlertUtils.addSuccess('Enabling "Security" display option for this graph find/hide expression');
          this.props.toggleGraphSecurity();
        }

        return { target: 'edge', selector: { prop: EdgeAttr.sourcePrincipal, op: op, val: val } };
      case 'tcp': {
        const s = this.getNumericSelector(EdgeAttr.tcp, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
      case 'throughput': {
        if (!this.props.edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP)) {
          AlertUtils.addSuccess('Enabling [Request] "Throughput" edge labels for this graph find/hide expression');
          this.props.setEdgeLabels([
            ...this.props.edgeLabels,
            EdgeLabelMode.THROUGHPUT_GROUP,
            EdgeLabelMode.THROUGHPUT_REQUEST
          ]);
        }

        const s = this.getNumericSelector(EdgeAttr.throughput, op, val, expression, isFind);
        return s ? { target: 'edge', selector: s } : undefined;
      }
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

  private parseUnaryFindExpression = (field: string, isNegation): ParsedExpression | undefined => {
    switch (field.toLowerCase()) {
      //
      // nodes...
      //
      case 'cb':
      case 'circuitbreaker':
        return { target: 'node', selector: { prop: NodeAttr.hasCB, op: isNegation ? 'falsy' : 'truthy' } };
      case 'dead':
        return { target: 'node', selector: { prop: NodeAttr.isDead, op: isNegation ? 'falsy' : 'truthy' } };
      case 'fi':
      case 'faultinjection':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasFaultInjection, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'inaccessible':
        return {
          target: 'node',
          selector: { prop: NodeAttr.isInaccessible, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'healthy':
        return {
          target: 'node',
          selector: isNegation
            ? [
                { prop: NodeAttr.healthStatus, op: '!=', val: HEALTHY.name },
                { prop: NodeAttr.healthStatus, op: '!=', val: NA.name },
                { prop: NodeAttr.healthStatus, op: '!=', val: NOT_READY.name }
              ]
            : { prop: NodeAttr.healthStatus, val: HEALTHY.name }
        };
      case 'idle':
        if (!this.props.showIdleNodes) {
          AlertUtils.addSuccess('Enabling "Idle nodes" display option for graph find/hide expression');
          this.props.toggleIdleNodes();
        }
        return { target: 'node', selector: { prop: NodeAttr.isIdle, op: isNegation ? 'falsy' : 'truthy' } };
      case 'mirroring':
        return { target: 'node', selector: { prop: NodeAttr.hasMirroring, op: isNegation ? 'falsy' : 'truthy' } };
      case 'outside':
      case 'outsider':
        return { target: 'node', selector: { prop: NodeAttr.isOutside, op: isNegation ? 'falsy' : 'truthy' } };
      case 'rr':
      case 'requestrouting':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasRequestRouting, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'rto':
      case 'requesttimeout':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasRequestTimeout, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'se':
      case 'serviceentry':
        return {
          target: 'node',
          selector: { prop: NodeAttr.isServiceEntry, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'sc':
      case 'sidecar':
        return { target: 'node', selector: { prop: NodeAttr.isOutOfMesh, op: isNegation ? 'falsy' : 'truthy' } };
      case 'tcpts':
      case 'tcptrafficshifting':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasTCPTrafficShifting, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'ts':
      case 'trafficshifting':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasTrafficShifting, op: isNegation ? 'falsy' : 'truthy' }
        };
      case 'trafficsource':
      case 'root':
        return { target: 'node', selector: { prop: NodeAttr.isRoot, op: isNegation ? 'falsy' : 'truthy' } };
      case 'vs':
      case 'virtualservice':
        return { target: 'node', selector: { prop: NodeAttr.hasVS, op: isNegation ? 'falsy' : 'truthy' } };
      case 'we':
      case 'workloadentry':
        return {
          target: 'node',
          selector: { prop: NodeAttr.hasWorkloadEntry, op: isNegation ? 'falsy' : 'truthy' }
        };
      //
      // edges...
      //
      case 'mtls':
        if (!this.props.showSecurity) {
          AlertUtils.addSuccess('Enabling "Security" display option for graph find/hide expression');
          this.props.toggleGraphSecurity();
        }

        return { target: 'edge', selector: { prop: EdgeAttr.isMTLS, op: isNegation ? '<=' : '>', val: 0 } };
      case 'traffic': {
        return { target: 'edge', selector: { prop: EdgeAttr.hasTraffic, op: isNegation ? 'falsy' : 'truthy' } };
      }
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

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  edgeLabels: edgeLabelsSelector(state),
  edgeMode: edgeModeSelector(state),
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  layout: state.graph.layout,
  namespaceLayout: state.graph.namespaceLayout,
  showFindHelp: state.graph.toolbarState.showFindHelp,
  showIdleNodes: state.graph.toolbarState.showIdleNodes,
  showRank: state.graph.toolbarState.showRank,
  showSecurity: state.graph.toolbarState.showSecurity
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setEdgeLabels: bindActionCreators(GraphToolbarActions.setEdgeLabels, dispatch),
    setFindValue: bindActionCreators(GraphToolbarActions.setFindValue, dispatch),
    setHideValue: bindActionCreators(GraphToolbarActions.setHideValue, dispatch),
    toggleFindHelp: bindActionCreators(GraphToolbarActions.toggleFindHelp, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleIdleNodes: bindActionCreators(GraphToolbarActions.toggleIdleNodes, dispatch),
    toggleRank: bindActionCreators(GraphToolbarActions.toggleRank, dispatch)
  };
};

export const GraphFindPF = connect(mapStateToProps, mapDispatchToProps)(GraphFindPFComponent);
