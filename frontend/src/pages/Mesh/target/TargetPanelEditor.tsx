import * as React from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { useKialiTheme } from '../../../utils/ThemeUtils';
import { Theme } from '../../../types/Common';
import { ConfigButtonsTargetPanel } from '../../../components/Mesh/ConfigButtonsTargetPanel';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { yamlDumpOptions } from 'types/IstioConfigDetails';
import { dump } from 'js-yaml';

interface TargetPanelEditorProps {
  configData: unknown;
  includeTitle?: boolean;
  targetName: string;
}

const editorStyle = kialiStyle({
  marginTop: '0.5rem',
  backgroundColor: PFColors.BackgroundColor100
});

const LINE_HEIGHT = 19;
const EDITOR_PADDING = 10;

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  folding: false,
  lineNumbers: 'off',
  minimap: { enabled: false },
  overviewRulerLanes: 0,
  renderLineHighlight: 'none',
  scrollBeyondLastLine: false,
  wordWrap: 'on'
};

export const TargetPanelEditor: React.FC<TargetPanelEditorProps> = (props: TargetPanelEditorProps) => {
  const darkTheme = useKialiTheme() === Theme.DARK;

  let yaml = '';
  try {
    yaml = dump(props.configData || 'N/A', yamlDumpOptions);
  } catch (error) {
    yaml = 'N/A';
  }

  const lineCount = yaml.split('\n').length;
  const editorHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING;

  return (
    <>
      <ConfigButtonsTargetPanel copyText={yaml} includeTitle={props.includeTitle} targetName={props.targetName} />

      <div className={editorStyle} data-test="target-panel-editor">
        <Editor
          value={yaml}
          language="yaml"
          theme={darkTheme ? 'vs-dark' : 'light'}
          height={`${editorHeight}px`}
          options={{ ...editorOptions, readOnly: true, lineNumbers: 'off' }}
        />
      </div>
    </>
  );
};
