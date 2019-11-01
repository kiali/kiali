import * as React from 'react';
import * as Cy from 'cytoscape';
import { Button, Toolbar, ToolbarItem, Tooltip } from '@patternfly/react-core';
import { ExpandArrowsAltIcon, SearchMinusIcon, SearchPlusIcon, TopologyIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../../store/Store';

import { PfColors } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { Layout } from '../../types/GraphFilter';
import { ColaGraph } from './graphs/ColaGraph';
import { CoseGraph } from './graphs/CoseGraph';
import { DagreGraph } from './graphs/DagreGraph';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphActions } from '../../actions/GraphActions';
import { HistoryManager, URLParam } from '../../app/History';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
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

const buttonStyle = style({
  backgroundColor: PfColors.White,
  marginRight: '1px'
});
const cytoscapeToolbarStyle = style({
  padding: '7px 10px'
});
const cytoscapeToolbarPadStyle = style({ marginLeft: '9px' });

const ZOOM_STEP = 0.2;

export class CytoscapeToolbar extends React.PureComponent<CytoscapeToolbarProps> {
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
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.GRAPH_LAYOUT, this.props.layout.name);
  }

  render() {
    return (
      <Toolbar className={cytoscapeToolbarStyle}>
        <ToolbarItem>
          <Tooltip content="Zoom In">
            <Button id="toolbar_zoom_in" className={buttonStyle} variant="plain" onClick={this.zoomIn}>
              <SearchPlusIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom Out">
            <Button id="toolbar_zoom_out" className={buttonStyle} variant="plain" onClick={this.zoomOut}>
              <SearchMinusIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>
        <ToolbarItem>
          <Tooltip content="Zoom to Fit">
            <Button
              id="toolbar_graph_fit"
              className={[cytoscapeToolbarPadStyle, buttonStyle].join(' ')}
              variant="plain"
              onClick={this.fit}
            >
              <ExpandArrowsAltIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <ToolbarItem className={cytoscapeToolbarPadStyle}>
          <Tooltip content={'Layout default ' + DagreGraph.getLayout().name}>
            <Button
              id="toolbar_layout_default"
              className={buttonStyle}
              variant="plain"
              onClick={() => {
                this.props.setLayout(DagreGraph.getLayout());
              }}
              isActive={this.props.layout.name === DagreGraph.getLayout().name}
            >
              <TopologyIcon />
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Layout}>
          <ToolbarItem>
            <Tooltip content={'Layout 1 ' + CoseGraph.getLayout().name}>
              <Button
                id="toolbar_layout1"
                className={buttonStyle}
                variant="plain"
                onClick={() => {
                  this.props.setLayout(CoseGraph.getLayout());
                }}
                isActive={this.props.layout.name === CoseGraph.getLayout().name}
              >
                <TopologyIcon /> 1
              </Button>
            </Tooltip>
          </ToolbarItem>
        </TourStopContainer>

        <ToolbarItem>
          <Tooltip content={'Layout 2 ' + ColaGraph.getLayout().name}>
            <Button
              id="toolbar_layout2"
              className={buttonStyle}
              variant="plain"
              onClick={() => {
                this.props.setLayout(ColaGraph.getLayout());
              }}
              isActive={this.props.layout.name === ColaGraph.getLayout().name}
            >
              <TopologyIcon /> 2
            </Button>
          </Tooltip>
        </ToolbarItem>

        <TourStopContainer info={GraphTourStops.Legend}>
          <ToolbarItem>
            <Button
              variant="primary"
              id="toolbar_toggle_legend"
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

  getCy(): Cy.Core | null {
    if (this.props.cytoscapeGraphRef.current) {
      return this.props.cytoscapeGraphRef.current.getCy();
    }
    return null;
  }

  zoom(step: number) {
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
  }

  zoomIn = () => {
    this.zoom(ZOOM_STEP);
  };

  zoomOut = () => {
    this.zoom(-ZOOM_STEP);
  };

  fit = () => {
    const cy = this.getCy();
    if (cy) {
      CytoscapeGraphUtils.safeFit(cy);
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  layout: state.graph.layout,
  showLegend: state.graph.filterState.showLegend
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  toggleLegend: bindActionCreators(GraphFilterActions.toggleLegend, dispatch)
});

const CytoscapeToolbarContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(CytoscapeToolbar);
export default CytoscapeToolbarContainer;
