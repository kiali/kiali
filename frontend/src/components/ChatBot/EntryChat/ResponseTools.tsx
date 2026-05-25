import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Label, LabelGroup, Spinner } from '@patternfly/react-core';
import { BanIcon, CodeIcon, ExternalLinkAltIcon, InfoCircleIcon } from '@patternfly/react-icons';
import { KialiAppState } from 'store/Store';
import { Tool } from 'types/Chatbot';
import { ChatAIActions } from 'actions/ChatAIActions';

type ToolProps = {
  entryIndex: number;
  toolID: string;
};

const ToolLabel: React.FC<ToolProps> = ({ entryIndex, toolID }) => {
  const dispatch = useDispatch();

  const toolMap = useSelector((s: KialiAppState) => s.aiChat.chatHistory.getIn([entryIndex, 'tools', toolID])) as any;

  const tool: Tool | undefined = React.useMemo(() => toolMap?.toJS() as Tool, [toolMap]);

  const onClick = React.useCallback(() => {
    dispatch(ChatAIActions.setOpenTool({ chatEntryIndex: entryIndex, id: toolID }));
  }, [dispatch, entryIndex, toolID]);

  if (!tool) {
    return null;
  }

  const isError = tool.status === 'error';
  const isTruncated = tool.status === 'truncated';
  const hasUI = !!tool.uiResourceUri;
  const isRunning = tool.isRunning;

  let color: React.ComponentProps<typeof Label>['color'];
  let icon: React.ReactNode;

  if (tool.isDenied) {
    color = 'grey';
    icon = <BanIcon />;
  } else if (isError) {
    color = 'red';
    icon = <InfoCircleIcon />;
  } else if (isTruncated) {
    color = 'yellow';
    icon = <InfoCircleIcon />;
  } else if (hasUI) {
    color = 'blue';
    icon = <ExternalLinkAltIcon />;
  } else if (isRunning) {
    icon = <Spinner isInline />;
  } else {
    icon = <CodeIcon />;
  }

  return (
    <Label
      color={color}
      data-test={`ai-tool-label-${tool.name}`}
      icon={icon}
      onClick={onClick}
      textMaxWidth="16ch"
      variant={tool.isDenied ? undefined : 'outline'}
    >
      {tool.name}
    </Label>
  );
};

type ResponseToolsProps = {
  entryIndex: number;
};

const ResponseTools: React.FC<ResponseToolsProps> = ({ entryIndex }) => {
  const tools: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: KialiAppState) =>
    s.aiChat.chatHistory.getIn([entryIndex, 'tools'])
  ) as ImmutableMap<string, ImmutableMap<string, unknown>>;

  const completedTools = tools.filter(
    tool => !tool.get('isUserApproval') || !!tool.get('isApproved') || !!tool.get('isDenied')
  );

  return (
    <>
      <LabelGroup numLabels={4}>
        {completedTools
          .keySeq()
          .toArray()
          .map(toolID => (
            <ToolLabel entryIndex={entryIndex} key={toolID} toolID={toolID} />
          ))}
      </LabelGroup>
    </>
  );
};

export { ResponseTools };
