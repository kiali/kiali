import * as React from 'react';
import * as Cy from 'cytoscape';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from '../../store/Store';
import { PFColors } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { EdgeMode, Layout } from '../../types/Graph';
import { GraphActions } from '../../actions/GraphActions';
import { HistoryManager, URLParam } from '../../app/History';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { TourStop } from 'components/Tour/TourStop';
import { edgeModeSelector } from 'store/Selectors';
import { KialiDagreGraph } from './graphs/KialiDagreGraph';
import { KialiGridGraph } from './graphs/KialiGridGraph';
import { KialiConcentricGraph } from './graphs/KialiConcentricGraph';
import { KialiBreadthFirstGraph } from './graphs/KialiBreadthFirstGraph';
import { KialiIcon } from 'config/KialiIcon';

type ReduxStateProps = {
  boxByNamespace: boolean;
  edgeMode: EdgeMode;
  layout: Layout;
  namespaceLayout: Layout;
  showLegend: boolean;
};

type ReduxDispatchProps = {
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: Layout) => void;
  setNamespaceLayout: (layout: Layout) => void;
  toggleLegend: () => void;
};

type CytoscapeToolbarProps = ReduxStateProps &
  ReduxDispatchProps & {
    cytoscapeGraphRef: any;
    disabled: boolean;
  };

type CytoscapeToolbarState = {
  allowGrab: boolean;
};

const activeButtonStyle = kialiStyle({
  color: PFColors.Active
});

const buttonStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  margin: '0.125rem 0.25rem',
  padding: '0.25rem 0.5rem'
});

const cyToolbarStyle = kialiStyle({
  width: '1.25rem'
});

class CytoscapeToolbarComponent extends React.PureComponent<CytoscapeToolbarProps, CytoscapeToolbarState> {
  constructor(props: CytoscapeToolbarProps) {
    super(props);

    // Let URL override current redux state at construction time. Update URL with unset params.
    const urlLayout = HistoryManager.getParam(URLParam.GRAPH_LAYOUT);

    if (urlLayout) {
      if (urlLayout !== props.layout.name) {
        props.setLayout(LayoutDictionary.getLayoutByName(urlLayout));
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_LAYOUT, props.layout.name);
    }

    const urlNamespaceLayout = HistoryManager.getParam(URLParam.GRAPH_NAMESPACE_LAYOUT);

    if (urlNamespaceLayout) {
      if (urlNamespaceLayout !== props.namespaceLayout.name) {
        props.setNamespaceLayout(LayoutDictionary.getLayoutByName(urlNamespaceLayout));
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_NAMESPACE_LAYOUT, props.namespaceLayout.name);
    }

    this.state = { allowGrab: false };
  }

  componentDidMount(): void {
    // Toggle drag once when component is initialized
    this.toggleDrag();
  }

  componentDidUpdate(): void {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.GRAPH_LAYOUT, this.props.layout.name);
    HistoryManager.setParam(URLParam.GRAPH_NAMESPACE_LAYOUT, this.props.namespaceLayout.name);
  }

  render(): React.ReactNode {
    return (
      <div className={cyToolbarStyle}>
        <div>
          <Tooltip content={this.state.allowGrab ? 'Disable Drag' : 'Enable Drag'} position={TooltipPosition.right}>
            <Button
              id="toolbar_grab"
              aria-label="Toggle Drag"
              isActive={this.state.allowGrab}
              onClick={() => this.toggleDrag()}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.DragDrop className={this.state.allowGrab ? activeButtonStyle : undefined} />
            </Button>
          </Tooltip>
        </div>

        <div>
          <Tooltip content="Zoom to Fit" position={TooltipPosition.right}>
            <Button
              id="toolbar_graph_fit"
              aria-label="Zoom to Fit"
              onClick={() => this.fit()}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.ExpandArrows />
            </Button>
          </Tooltip>
        </div>

        <div>
          <Tooltip content="Hide healthy edges" position={TooltipPosition.right}>
            <Button
              id="toolbar_edge_mode_unhealthy"
              aria-label="Hide Healthy Edges"
              isActive={this.props.edgeMode === EdgeMode.UNHEALTHY}
              onClick={() => {
                this.handleEdgeModeClick(EdgeMode.UNHEALTHY);
              }}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.LongArrowRight
                className={this.props.edgeMode === EdgeMode.UNHEALTHY ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </div>

        <div>
          <Tooltip content="Hide all edges" position={TooltipPosition.right}>
            <Button
              id="toolbar_edge_mode_none"
              aria-label="Hide All Edges"
              isActive={this.props.edgeMode === EdgeMode.NONE}
              onClick={() => {
                this.handleEdgeModeClick(EdgeMode.NONE);
              }}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.LongArrowRight
                className={this.props.edgeMode === EdgeMode.NONE ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </div>

        <div>
          <Tooltip content={`Layout default ${KialiDagreGraph.getLayout().name}`} position={TooltipPosition.right}>
            <Button
              id="toolbar_layout_default"
              aria-label="Graph Layout Default Style"
              isActive={this.props.layout.name === KialiDagreGraph.getLayout().name}
              isDisabled={this.props.disabled}
              onClick={() => {
                this.setLayout(KialiDagreGraph.getLayout());
              }}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.Topology
                className={this.props.layout.name === KialiDagreGraph.getLayout().name ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </div>

        <TourStop info={GraphTourStops.Layout}>
          <div>
            <Tooltip content={`Layout 1 ${KialiGridGraph.getLayout().name}`} position={TooltipPosition.right}>
              <Button
                id="toolbar_layout1"
                aria-label="Graph Layout Style 1"
                isActive={this.props.layout.name === KialiGridGraph.getLayout().name}
                isDisabled={this.props.disabled}
                onClick={() => {
                  this.setLayout(KialiGridGraph.getLayout());
                }}
                className={buttonStyle}
                variant={ButtonVariant.plain}
              >
                <KialiIcon.Topology
                  className={this.props.layout.name === KialiGridGraph.getLayout().name ? activeButtonStyle : undefined}
                />
              </Button>
            </Tooltip>
          </div>
        </TourStop>

        <div>
          <Tooltip content={`Layout 2 ${KialiConcentricGraph.getLayout().name}`} position={TooltipPosition.right}>
            <Button
              id="toolbar_layout2"
              aria-label="Graph Layout Style 2"
              isActive={this.props.layout.name === KialiConcentricGraph.getLayout().name}
              isDisabled={this.props.disabled}
              onClick={() => {
                this.setLayout(KialiConcentricGraph.getLayout());
              }}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.Topology
                className={
                  this.props.layout.name === KialiConcentricGraph.getLayout().name ? activeButtonStyle : undefined
                }
              />
            </Button>
          </Tooltip>
        </div>

        <div>
          <Tooltip content={`Layout 3 ${KialiBreadthFirstGraph.getLayout().name}`} position={TooltipPosition.right}>
            <Button
              id="toolbar_layout3"
              aria-label="Graph Layout Style 3"
              isActive={this.props.layout.name === KialiBreadthFirstGraph.getLayout().name}
              isDisabled={this.props.disabled}
              onClick={() => {
                this.setLayout(KialiBreadthFirstGraph.getLayout());
              }}
              className={buttonStyle}
              variant={ButtonVariant.plain}
            >
              <KialiIcon.Topology
                className={
                  this.props.layout.name === KialiBreadthFirstGraph.getLayout().name ? activeButtonStyle : undefined
                }
              />
            </Button>
          </Tooltip>
        </div>

        {this.props.boxByNamespace && (
          <div>
            <Tooltip
              content={`Namespace Layout 1 ${KialiDagreGraph.getLayout().name}`}
              position={TooltipPosition.right}
            >
              <Button
                id="toolbar_namespace_layout1"
                aria-label="Namespace Layout Style 1"
                isActive={this.props.namespaceLayout.name === KialiDagreGraph.getLayout().name}
                isDisabled={this.props.disabled}
                onClick={() => {
                  this.setNamespaceLayout(KialiDagreGraph.getLayout());
                }}
                className={buttonStyle}
                variant={ButtonVariant.plain}
              >
                <KialiIcon.Tenant
                  className={
                    this.props.namespaceLayout.name === KialiDagreGraph.getLayout().name ? activeButtonStyle : undefined
                  }
                />
              </Button>
            </Tooltip>
          </div>
        )}

        {this.props.boxByNamespace && (
          <div>
            <Tooltip
              content={`Namespace Layout 2 ${KialiBreadthFirstGraph.getLayout().name}`}
              position={TooltipPosition.right}
            >
              <Button
                id="toolbar_namespace_layout2"
                aria-label="Namespace Layout Style 2"
                isActive={this.props.namespaceLayout.name === KialiBreadthFirstGraph.getLayout().name}
                isDisabled={this.props.disabled}
                onClick={() => {
                  this.setNamespaceLayout(KialiBreadthFirstGraph.getLayout());
                }}
                className={buttonStyle}
                variant={ButtonVariant.plain}
              >
                <KialiIcon.Tenant
                  className={
                    this.props.namespaceLayout.name === KialiBreadthFirstGraph.getLayout().name
                      ? activeButtonStyle
                      : undefined
                  }
                />
              </Button>
            </Tooltip>
          </div>
        )}

        <TourStop info={GraphTourStops.Legend}>
          <div>
            <Tooltip content="Show Legend" position={TooltipPosition.right}>
              <Button
                id="toolbar_toggle_legend"
                aria-label="Show Legend"
                isActive={this.props.showLegend}
                onClick={this.props.toggleLegend}
                className={buttonStyle}
                variant={ButtonVariant.plain}
              >
                <KialiIcon.Map className={this.props.showLegend ? activeButtonStyle : undefined} size="sm" />
              </Button>
            </Tooltip>
          </div>
        </TourStop>
      </div>
    );
  }

  private getCy = (): Cy.Core | null => {
    if (this.props.cytoscapeGraphRef.current) {
      return this.props.cytoscapeGraphRef.current.getCy();
    }

    return null;
  };

  private toggleDrag = (): void => {
    const cy = this.getCy();

    if (!cy) {
      return;
    }

    cy.autoungrabify(this.state.allowGrab);
    this.setState({ allowGrab: !this.state.allowGrab });
  };

  private fit = (): void => {
    const cy = this.getCy();

    if (cy) {
      CytoscapeGraphUtils.safeFit(cy);
    }
  };

  private handleEdgeModeClick = (edgeMode: EdgeMode): void => {
    this.props.setEdgeMode(edgeMode === this.props.edgeMode ? EdgeMode.ALL : edgeMode);
  };

  private setLayout = (layout: Layout): void => {
    if (layout.name !== this.props.layout.name) {
      this.props.setLayout(layout);
    }
  };

  private setNamespaceLayout = (layout: Layout): void => {
    if (layout.name !== this.props.namespaceLayout.name) {
      this.props.setNamespaceLayout(layout);
    }
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  edgeMode: edgeModeSelector(state),
  boxByNamespace: state.graph.toolbarState.boxByNamespace,
  layout: state.graph.layout,
  namespaceLayout: state.graph.namespaceLayout,
  showLegend: state.graph.toolbarState.showLegend
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setEdgeMode: bindActionCreators(GraphActions.setEdgeMode, dispatch),
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  setNamespaceLayout: bindActionCreators(GraphActions.setNamespaceLayout, dispatch),
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch)
});

export const CytoscapeToolbar = connect(mapStateToProps, mapDispatchToProps)(CytoscapeToolbarComponent);
