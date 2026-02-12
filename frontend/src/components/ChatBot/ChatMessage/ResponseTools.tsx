import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { Label, LabelGroup } from '@patternfly/react-core';
import { CodeIcon, InfoCircleIcon } from '@patternfly/react-icons';
import { Tool } from 'types/Chatbot';



type ToolProps = {
  tool: Tool | undefined;
  onClick: () => void;
};

const ToolLabel: React.FC<ToolProps> = ({ tool, onClick }) => {
  if (!tool) {
    return null;
  }

  const isError = tool.status === 'error';

  return (
    <Label
      color={isError ? 'red' : undefined}
      icon={isError ? <InfoCircleIcon /> : <CodeIcon />}
      onClick={onClick}
      textMaxWidth="16ch"
    >
      {tool.name}
    </Label>
  );
};

type ResponseToolsProps = {
  tools: ImmutableMap<string, Tool>;
  setToolModalOpen: (toolModalOpen: boolean) => void;
  setTool: (tool: Tool) => void;
};

export const ResponseTools: React.FC<ResponseToolsProps> = ({ tools, setToolModalOpen, setTool }) => {  
  const onClick = (tool: Tool) => {
    setToolModalOpen(true);
    setTool(tool);
  };
  return (
    <LabelGroup numLabels={4}>
      {tools.keySeq().map((toolID) => {
        const tool = tools.get(toolID);
        if (!tool) {
          return null;
        }
        return (
          <ToolLabel tool={tool} key={toolID} onClick={() => onClick(tool)} />
        );
      })}
    </LabelGroup>
  );
};
