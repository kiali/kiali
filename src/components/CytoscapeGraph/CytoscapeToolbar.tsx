import * as React from 'react';
import * as Cy from 'cytoscape';
import { Button, Toolbar, ToolbarItem, Tooltip } from '@patternfly/react-core';
import {
  ExpandArrowsAltIcon,
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
import { PfColors, PFKialiColor } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { Layout } from '../../types/Graph';
import { ColaGraph } from './graphs/ColaGraph';
import { CoseGraph } from './graphs/CoseGraph';
import { DagreGraph } from './graphs/DagreGraph';
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
};

type CytoscapeToolbarState = {
  allowGrab: boolean;
};

const buttonStyle = style({
  backgroundColor: PfColors.White,
  marginRight: '1px'
});
const activeButtonStyle = style({
  color: PFKialiColor.Active
});
const cytoscapeToolbarStyle = style({
  padding: '7px 10px'
});
const cytoscapeToolbarPadStyle = style({ marginLeft: '9px' });

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
          <Tooltip content={this.state.allowGrab ? 'Disable Drag' : 'Enable Drag'}>
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
          <Tooltip content="Zoom In">
            <Button
              id="toolbar_zoom_in"
              aria-label="Zoom In"
              className={[cytoscapeToolbarPadStyle, buttonStyle].join(' ')}
              variant="plain"
              onClick={() => this.zoomIn()}
            >
              <SearchPlusIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom Out">
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
          <Tooltip content="Zoom to Fit">
            <Button
              id="toolbar_graph_fit"
              aria-label="Zoom to Fit"
              className={[cytoscapeToolbarPadStyle, buttonStyle].join(' ')}
              variant="plain"
              onClick={() => this.fit()}
            >
              <ExpandArrowsAltIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <ToolbarItem className={cytoscapeToolbarPadStyle}>
          <Tooltip content={'Layout default ' + DagreGraph.getLayout().name}>
            <Button
              id="toolbar_layout_default"
              aria-label="Graph Layout Default Style"
              className={buttonStyle}
              variant="plain"
              onClick={() => {
                this.props.setLayout(DagreGraph.getLayout());
              }}
              isActive={this.props.layout.name === DagreGraph.getLayout().name}
            >
              <TopologyIcon
                className={this.props.layout.name === DagreGraph.getLayout().name ? activeButtonStyle : undefined}
              />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Layout}>
          <ToolbarItem>
            <Tooltip content={'Layout 1 ' + CoseGraph.getLayout().name}>
              <Button
                id="toolbar_layout1"
                aria-label="Graph Layout Style 1"
                className={buttonStyle}
                variant="plain"
                onClick={() => {
                  this.props.setLayout(CoseGraph.getLayout());
                }}
                isActive={this.props.layout.name === CoseGraph.getLayout().name}
              >
                <TopologyIcon
                  className={this.props.layout.name === CoseGraph.getLayout().name ? activeButtonStyle : undefined}
                />{' '}
                1
              </Button>
            </Tooltip>
          </ToolbarItem>
        </TourStopContainer>

        <ToolbarItem>
          <Tooltip content={'Layout 2 ' + ColaGraph.getLayout().name}>
            <Button
              id="toolbar_layout2"
              aria-label="Graph Layout Style 2"
              className={buttonStyle}
              variant="plain"
              onClick={() => {
                this.props.setLayout(ColaGraph.getLayout());
              }}
              isActive={this.props.layout.name === ColaGraph.getLayout().name}
            >
              <TopologyIcon
                className={this.props.layout.name === ColaGraph.getLayout().name ? activeButtonStyle : undefined}
              />{' '}
              2
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Legend}>
          <ToolbarItem>
            <Button
              variant="primary"
              id="toolbar_toggle_legend"
              aria-label="Show Legend"
              onClick={this.props.toggleLegend}
              isActive={this.props.showLegend}
              className={cytoscapeToolbarPadStyle}
            >
              Legend
            </Button>
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
