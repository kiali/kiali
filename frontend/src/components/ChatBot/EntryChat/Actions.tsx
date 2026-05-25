import React from 'react';
import { Button } from '@patternfly/react-core';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { router } from 'app/History';
import { KialiAppState } from 'store/Store';
import { Action } from 'types/Chatbot';
import { FileAttachment } from './FileAttachment';
import { useSelector } from 'react-redux';
import { Map as ImmutableMap } from 'immutable';

type ActionsProps = {
  entryIndex: number;
};

export const Actions: React.FC<ActionsProps> = ({ entryIndex }) => {
  const entryObject = useSelector((state: KialiAppState) =>
    state.aiChat.chatHistory.getIn([entryIndex])
  ) as ImmutableMap<string, unknown>;
  const alwaysNavigate = useSelector((state: KialiAppState) => state.aiChat.alwaysNavigate);
  const entry = entryObject.toJS();
  const fileAction = (entry.actions as Action[]).filter(action => action.kind === 'file');
  const navigationAction = (entry.actions as Action[]).filter(action => action.kind === 'navigation');

  const renderAction = (actions: Action[]): React.ReactNode => {
    return actions.map(action => (
      <Button
        icon={<ArrowRightIcon />}
        key={`chatbot_action_${action.title}`}
        onClick={() => router.navigate(action.payload)}
        variant="link"
        isInline
        data-testid={`chatbot-navigation-action-link-${action.title.toLowerCase().replace(/ /g, '-')}`}
      >
        {action.title}
      </Button>
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem 5rem' }}>
      {navigationAction.length > 0 && !alwaysNavigate && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem' }}
          data-testid="chatbot-navigation-action"
        >
          {renderAction(navigationAction)}
        </div>
      )}
      {fileAction.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
          {fileAction.map(action => (
            <FileAttachment
              key={action.fileName}
              fileName={action.fileName || ''}
              action={action}
              onSendMessage={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
