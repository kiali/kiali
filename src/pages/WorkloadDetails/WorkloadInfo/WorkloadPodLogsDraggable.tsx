import * as React from 'react';
import { Button, Icon } from 'patternfly-react';
import Draggable from 'react-draggable';
import { style } from 'typestyle';
import { Pod } from '../../../types/IstioObjects';
import WorkloadPodLogs from './WorkloadPodLogs';

export interface WorkloadPodLogsProps {
  namespace: string;
  pods: Pod[];
  onClose: () => void;
}

const draggable = style({
  width: '75%',
  height: '600px',
  top: '-300px',
  right: '0',
  position: 'absolute',
  zIndex: 9999
});

export default class WorkloadPodLogsDraggable extends React.Component<WorkloadPodLogsProps> {
  constructor(props: WorkloadPodLogsProps) {
    super(props);
  }

  render() {
    return (
      <Draggable handle="#wpl_header">
        <div className={`modal-content ${draggable}`}>
          <div id="wpl_header" className="modal-header">
            <Button className="close" bsClass="" onClick={this.props.onClose}>
              <Icon title="Close" type="pf" name="close" />
            </Button>
            <span className="modal-title">Pod Logs</span>
          </div>
          <WorkloadPodLogs namespace={this.props.namespace} pods={this.props.pods} />
        </div>
      </Draggable>
    );
  }
}
