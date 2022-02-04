import * as React from 'react';
import * as Cy from 'cytoscape';
import { Button, Toolbar, ToolbarItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import {
  ExpandArrowsAltIcon,
  MapIcon,
  PficonDragdropIcon,
  SearchMinusIcon,
  SearchPlusIcon,
  TopologyIcon
} from '@patternfly/react-icons';
import { style } from 'typestyle';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../../store/Store';
import { PFColors } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { Layout } from '../../types/Graph';
import { ConcentricGraph } from './graphs/ConcentricGraph';
import { DagreGraph } from './graphs/DagreGraph';
import { GridGraph } from './graphs/GridGraph';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphActions } from '../../actions/GraphActions';
import { HistoryManager, URLParam } from '../../app/History';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import TourStopContainer from 'components/Tour/TourStop';

type ReduxProps = {
  layout: Layout;
  showLegend: boolean;

  setLayout: (layout: Layout) => void;
  toggleLegend: () => void;
};

type CytoscapeToolbarProps = ReduxProps & {
  cytoscapeGraphRef: any;
  disabled: boolean;
};

type CytoscapeToolbarState = {
  allowGrab: boolean;
};

const buttonStyle = style({
  backgroundColor: PFColors.White,
  marginBottom: '2px',
  marginLeft: '4px',
  padding: '3px 8px'
});
const activeButtonStyle = style({
  color: PFColors.Active
});
const cytoscapeToolbarStyle = style({
  width: '20px'
});

const ZOOM_STEP = 0.2;

export class CytoscapeToolbar extends React.PureComponent<CytoscapeToolbarProps, CytoscapeToolbarState> {
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

    this.state = { allowGrab: false };
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.GRAPH_LAYOUT, this.props.layout.name);
  }

  render() {
    return (
      <Toolbar className={cytoscapeToolbarStyle}>
        <ToolbarItem>
          <Tooltip content={this.state.allowGrab ? 'Disable Drag' : 'Enable Drag'} position={TooltipPosition.right}>
            <Button
              id="toolbar_grab"
              aria-label="Toggle Drag"
              className={buttonStyle}
              variant="plain"
              onClick={() => this.toggleDrag()}
              isActive={this.state.allowGrab}
            >
              <PficonDragdropIcon className={this.state.allowGrab ? activeButtonStyle : undefined} />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom In" position={TooltipPosition.right}>
            <Button
              id="toolbar_zoom_in"
              aria-label="Zoom In"
              className={buttonStyle}
              variant="plain"
              onClick={() => this.zoomIn()}
            >
              <SearchPlusIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom Out" position={TooltipPosition.right}>
            <Button
              id="toolbar_zoom_out"
              aria-label="Zoom Out"
              className={buttonStyle}
              variant="plain"
              onClick={() => this.zoomOut()}
            >
              <SearchMinusIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom to Fit" position={TooltipPosition.right}>
            <Button
              id="toolbar_graph_fit"
              aria-label="Zoom to Fit"
              className={buttonStyle}
              variant="plain"
              onClick={() => this.fit()}
            >
              <ExpandArrowsAltIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <ToolbarItem>
          <Tooltip content={'Layout default ' + DagreGraph.getLayout().name} position={TooltipPosition.right}>
            <Button
              id="toolbar_layout_default"
              aria-label="Graph Layout Default Style"
              className={buttonStyle}
              isActive={this.props.layout.name === DagreGraph.getLayout().name}
              isDisabled={this.props.disabled}
              onClick={() => {
                this.setLayout(DagreGraph.getLayout());
              }}
              variant="plain"
            >
              <TopologyIcon
                className={this.props.layout.name === DagreGraph.getLayout().name ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Layout}>
          <ToolbarItem>
            <Tooltip content={'Layout 1 ' + GridGraph.getLayout().name} position={TooltipPosition.right}>
              <Button
                id="toolbar_layout1"
                aria-label="Graph Layout Style 1"
                className={buttonStyle}
                isActive={this.props.layout.name === GridGraph.getLayout().name}
                isDisabled={this.props.disabled}
                onClick={() => {
                  this.setLayout(GridGraph.getLayout());
                }}
                variant="plain"
              >
                <TopologyIcon
                  className={this.props.layout.name === GridGraph.getLayout().name ? activeButtonStyle : undefined}
                />
              </Button>
            </Tooltip>
          </ToolbarItem>
        </TourStopContainer>

        <ToolbarItem>
          <Tooltip content={'Layout 2 ' + ConcentricGraph.getLayout().name} position={TooltipPosition.right}>
            <Button
              id="toolbar_layout2"
              aria-label="Graph Layout Style 2"
              className={buttonStyle}
              isActive={this.props.layout.name === ConcentricGraph.getLayout().name}
              isDisabled={this.props.disabled}
              onClick={() => {
                this.setLayout(ConcentricGraph.getLayout());
              }}
              variant="plain"
            >
              <TopologyIcon
                className={this.props.layout.name === ConcentricGraph.getLayout().name ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Legend}>
          <ToolbarItem>
            <Tooltip content="Show Legend" position={TooltipPosition.right}>
              <Button
                id="toolbar_toggle_legend"
                aria-label="Show Legend"
                className={buttonStyle}
                variant="plain"
                onClick={this.props.toggleLegend}
                isActive={this.props.showLegend}
              >
                <MapIcon className={this.props.showLegend ? activeButtonStyle : undefined} size="sm" />
              </Button>
            </Tooltip>
          </ToolbarItem>
        </TourStopContainer>
      </Toolbar>
    );
  }

  private getCy = (): Cy.Core | null => {
    if (this.props.cytoscapeGraphRef.current) {
      return this.props.cytoscapeGraphRef.current.getCy();
    }
    return null;
  };

  private toggleDrag = () => {
    const cy = this.getCy();
    if (!cy) {
      return;
    }
    cy.autoungrabify(this.state.allowGrab);
    this.setState({ allowGrab: !this.state.allowGrab });
  };

  private zoom = (step: number) => {
    const cy = this.getCy();
    const container = cy ? cy.container() : undefined;
    if (cy && container) {
      cy.zoom({
        level: cy.zoom() * (1 + step),
        renderedPosition: {
          x: container.offsetWidth / 2,
          y: container.offsetHeight / 2
        }
      });
    }
  };

  private zoomIn = () => {
    this.zoom(ZOOM_STEP);
  };

  private zoomOut = () => {
    this.zoom(-ZOOM_STEP);
  };

  private fit = () => {
    const cy = this.getCy();
    if (cy) {
      CytoscapeGraphUtils.safeFit(cy);
    }
  };

  private setLayout = (layout: Layout) => {
    if (layout.name !== this.props.layout.name) {
      this.props.setLayout(layout);
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  layout: state.graph.layout,
  showLegend: state.graph.toolbarState.showLegend
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch)
});

const CytoscapeToolbarContainer = connect(mapStateToProps, mapDispatchToProps)(CytoscapeToolbar);
export default CytoscapeToolbarContainer;
