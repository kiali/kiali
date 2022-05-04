import * as React from 'react';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownSeparator,
  KebabToggle,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

export type OverviewNamespaceAction = {
  isGroup: boolean;
  isSeparator: boolean;
  isDisabled?: boolean;
  isExternal?: boolean;
  title?: string;
  children?: OverviewNamespaceAction[];
  action?: (namespace: string) => void;
};

type Props = {
  namespace: string;
  actions: OverviewNamespaceAction[];
};

type State = {
  isKebabOpen: boolean;
};

export class OverviewNamespaceActions extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isKebabOpen: false
    };
  }

  onKebabToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  renderTooltip = (key, position, msg, child): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{child}</div>
      </Tooltip>
    );
  };

  componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.isKebabOpen) {
      this.setState({
        isKebabOpen: false
      });
    }
  }

  render() {
    const namespaceActions = this.props.actions.map((action, i) => {
      if (action.isSeparator) {
        return <DropdownSeparator key={'separator_' + i} />;
      }
      if (action.isGroup && action.children) {
        return (
          <DropdownGroup
            key={'group_' + i}
            label={action.title}
            className="kiali-group-menu"
            children={action.children.map((subaction, j) => {
              const itemKey = 'subaction_' + i + '_' + j;
              const item = (
                <DropdownItem
                  key={itemKey}
                  isDisabled={subaction.isDisabled}
                  onClick={() => (subaction.action ? subaction.action(this.props.namespace) : undefined)}
                >
                  {subaction.title}
                </DropdownItem>
              );
              return subaction.isDisabled
                ? this.renderTooltip(
                    'tooltip_' + itemKey,
                    TooltipPosition.left,
                    'User does not have enough permission for this action',
                    item
                  )
                : item;
            })}
          />
        );
      } else if (action.title && action.action) {
        const item = (
          <DropdownItem
            key={'action_' + i}
            isDisabled={action.isDisabled}
            data-test={action['data-test']}
            onClick={() => (action.action ? action.action(this.props.namespace) : undefined)}
          >
            {action.title} {!!action.isExternal ? <ExternalLinkAltIcon /> : undefined}
          </DropdownItem>
        );
        return action.isDisabled
          ? this.renderTooltip(
              'tooltip_action_' + i,
              TooltipPosition.left,
              'User does not have enough permission for this action',
              item
            )
          : item;
      }
      return undefined;
    });
    return (
      <Dropdown
        toggle={<KebabToggle onToggle={this.onKebabToggle} />}
        dropdownItems={namespaceActions}
        isPlain={true}
        isOpen={this.state.isKebabOpen}
        position={'right'}
      />
    );
  }
}
