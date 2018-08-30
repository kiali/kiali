import * as React from 'react';
import { Button, Icon } from 'patternfly-react';
import { style } from 'typestyle';
import { PfColors } from '../Pf/PfColors';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';

type CytoscapeToolbarProps = {
  cytoscapeGraphRef: any;
  isLegendActive: boolean;
  toggleLegend(): void;
};

const cytoscapeToolbarStyle = style({
  padding: '7px 10px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: PfColors.Black500,
  backgroundColor: PfColors.White
});
const cytoscapeToolbarButtonStyle = style({ marginLeft: '10px' });

const ZOOM_STEP = 0.2;

export class CytoscapeToolbar extends React.PureComponent<CytoscapeToolbarProps> {
  render() {
    return (
      <div className={cytoscapeToolbarStyle}>
        <Button onClick={this.zoomIn}>
          <Icon type="fa" name="plus" />
        </Button>
        <Button onClick={this.zoomOut} className={cytoscapeToolbarButtonStyle}>
          <Icon type="fa" name="minus" />
        </Button>
        <Button onClick={this.fit} className={cytoscapeToolbarButtonStyle}>
          <div className="glyphicon glyphicon-fullscreen" />
        </Button>
        <Button
          onClick={this.props.toggleLegend}
          active={this.props.isLegendActive}
          className={cytoscapeToolbarButtonStyle}
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
