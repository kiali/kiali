import * as React from 'react';
import { style } from 'typestyle';
import { Modal, Toolbar, ToolbarGroup, ToolbarItem, Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';

type FullScreenLogProps = {
  logText?: string;
  title: string;
  ref: React.RefObject<any>;
};

type FullScreenLogState = {
  show: boolean;
};

const modalStyle = style({
  width: '100',
  height: '100%'
});

const textAreaStyle = style({
  width: '100%',
  height: '93%',
  marginTop: '10px',
  overflow: 'auto',
  resize: 'none',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '11pt',
  padding: '10px',
  whiteSpace: 'pre',
  backgroundColor: '#003145'
});

export class FullScreenLogModal extends React.PureComponent<FullScreenLogProps, FullScreenLogState> {
  private readonly textareaRef;

  constructor(props: FullScreenLogProps) {
    super(props);
    this.textareaRef = React.createRef();
    this.state = { show: false };
  }

  open = () => {
    this.setState({ show: true });
  };

  close = () => {
    this.setState({ show: false });
  };

  componentDidUpdate(
    _prevProps: Readonly<FullScreenLogProps>,
    _prevState: Readonly<FullScreenLogState>,
    _snapshot?: any
  ) {
    if (this.textareaRef.current) {
      this.textareaRef.current.scrollTop = this.textareaRef.current.scrollHeight;
    }
  }

  renderToolbar = () => {
    return (
      <Toolbar>
        <ToolbarGroup>
          <ToolbarItem>
            <h2>{this.props.title}</h2>
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup style={{ marginLeft: 'auto' }}>
          <ToolbarItem>
            <Tooltip key="collapse_fs" position="top" content="Collapse full screen">
              <Button variant={ButtonVariant.link} onClick={this.close} isInline>
                <KialiIcon.Compress className={defaultIconStyle} />
              </Button>
            </Tooltip>
          </ToolbarItem>
        </ToolbarGroup>
      </Toolbar>
    );
  };

  render() {
    if (!this.state.show || !this.props.logText) {
      return null;
    }

    return (
      <Modal
        isSmall={false}
        isOpen={this.state.show}
        header={this.renderToolbar()}
        title=""
        className={modalStyle}
        showClose={false}
      >
        <textarea ref={this.textareaRef} value={this.props.logText} className={textAreaStyle} readOnly={true} />
      </Modal>
    );
  }
}
