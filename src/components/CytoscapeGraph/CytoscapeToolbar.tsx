import * as React from 'react';
import { ButtonGroup, Button, Icon } from 'patternfly-react';
import { style } from 'typestyle';
import { PfColors } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { Layout } from '../../types/GraphFilter';
import { ColaGraph } from './graphs/ColaGraph';
import { CoseGraph } from './graphs/CoseGraph';
import { DagreGraph } from './graphs/DagreGraph';

type CytoscapeToolbarProps = {
  cytoscapeGraphRef: any;
  isLegendActive: boolean;
  activeLayout: Layout;
  onLayoutChange: (layout: Layout) => void;
  toggleLegend: () => void;
};

const cytoscapeToolbarStyle = style({
  padding: '7px 10px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: PfColors.Black500,
  backgroundColor: PfColors.White
});
const cytoscapeToolbarPadStyle = style({ marginLeft: '10px' });

const ZOOM_STEP = 0.2;

export class CytoscapeToolbar extends React.PureComponent<CytoscapeToolbarProps> {
  render() {
    return (
      <div className={cytoscapeToolbarStyle}>
        <ButtonGroup>
          <Button onClick={this.zoomIn}>
            <Icon type="fa" name="plus" />
          </Button>

          <Button onClick={this.zoomOut}>
            <Icon type="fa" name="minus" />
          </Button>
        </ButtonGroup>

        <Button onClick={this.fit} className={cytoscapeToolbarPadStyle}>
          <div className="glyphicon glyphicon-fullscreen" />
        </Button>

        <ButtonGroup id="toolbar_layout_group" className={cytoscapeToolbarPadStyle}>
          <Button
            onClick={() => {
              this.props.onLayoutChange(DagreGraph.getLayout());
            }}
            title={DagreGraph.getLayout().name}
            active={this.props.activeLayout.name === DagreGraph.getLayout().name}
          >
            <div className="fa pficon-infrastructure fa-rotate-270" />
          </Button>

          <Button
            onClick={() => {
              this.props.onLayoutChange(CoseGraph.getLayout());
            }}
            title={CoseGraph.getLayout().name}
            active={this.props.activeLayout.name === CoseGraph.getLayout().name}
          >
            <div className="fa pficon-topology" /> 1
          </Button>

          <Button
            onClick={() => {
              this.props.onLayoutChange(ColaGraph.getLayout());
            }}
            title={ColaGraph.getLayout().name}
            active={this.props.activeLayout.name === ColaGraph.getLayout().name}
          >
            <div className="fa pficon-topology" /> 2
          </Button>
        </ButtonGroup>

        <Button
          id="toolbar_toggle_legend"
          onClick={this.props.toggleLegend}
          active={this.props.isLegendActive}
          className={cytoscapeToolbarPadStyle}
        >
          Legend
        </Button>
      </div>
    );
  }

  getCy() {
    if (this.props.cytoscapeGraphRef.current) {
      return this.props.cytoscapeGraphRef.current.getCy();
    }
    return null;
  }

  zoom(step: number) {
    const cy: any = this.getCy();
    if (cy) {
      cy.zoom({
        level: cy.zoom() * (1 + step),
        renderedPosition: {
          x: cy.container().offsetWidth / 2,
          y: cy.container().offsetHeight / 2
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
    const cy: any = this.getCy();
    if (cy) {
      CytoscapeGraphUtils.safeFit(cy);
    }
  };
}
