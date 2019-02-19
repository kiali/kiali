import * as React from 'react';
import { ToolbarRightContent, Button, Icon } from 'patternfly-react';

interface RightToolbarProps {
  disabled: boolean;
  graph: boolean;
  minimap: boolean;
  summary: boolean;
  onGraphClick: (state: boolean) => void;
  onSummaryClick: (state: boolean) => void;
  onMinimapClick: (state: boolean) => void;
  onSubmit: () => void;
}

export class RightToolbar extends React.PureComponent<RightToolbarProps, {}> {
  static active = { color: '#0088ce' };

  constructor(props: RightToolbarProps) {
    super(props);
  }

  render() {
    const { disabled, graph, minimap, summary, onGraphClick, onSummaryClick, onMinimapClick, onSubmit } = this.props;
    return (
      <ToolbarRightContent>
        <Button title={'Graph'} style={graph ? RightToolbar.active : undefined} onClick={() => onGraphClick(graph)}>
          <Icon type="fa" name="th" />
        </Button>
        <Button
          title={'Minimap'}
          style={minimap ? RightToolbar.active : undefined}
          onClick={() => onMinimapClick(minimap)}
        >
          <Icon type="fa" name="map" />
        </Button>
        <Button
          title={'Summary'}
          style={summary ? RightToolbar.active : undefined}
          onClick={() => onSummaryClick(summary)}
        >
          <Icon type="fa" name="info" />
        </Button>
        <Button
          bsStyle={'link'}
          title={'Search'}
          style={{ borderLeft: '1px solid #d1d1d1', marginLeft: '10px' }}
          onClick={onSubmit}
          disabled={disabled}
        >
          <Icon type="pf" name="search" />
        </Button>
      </ToolbarRightContent>
    );
  }
}

export default RightToolbar;
