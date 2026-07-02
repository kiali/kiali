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
  const [editorHeight, setEditorHeight] = React.useState<string>('200px');

  let yaml = '';
  try {
    yaml = dump(props.configData || 'N/A', yamlDumpOptions);
  } catch {
    yaml = 'N/A';
  }

  const onEditorDidMount = (ed: editor.IStandaloneCodeEditor): void => {
    const lineHeight = ed.getOption(editor.EditorOption.lineHeight);
    const padding = ed.getOption(editor.EditorOption.padding);
    const lineCount = ed.getModel()?.getLineCount() ?? yaml.split('\n').length;
    const totalPadding = (padding.top ?? 0) + (padding.bottom ?? 0);
    setEditorHeight(`${lineCount * lineHeight + totalPadding}px`);
  };

  return (
    <>
      <ConfigButtonsTargetPanel copyText={yaml} includeTitle={props.includeTitle} targetName={props.targetName} />

      <div className={editorStyle} data-test="target-panel-editor">
        <Editor
          value={yaml}
          language="yaml"
          theme={darkTheme ? 'vs-dark' : 'light'}
          height={editorHeight}
          onMount={onEditorDidMount}
          options={{ ...editorOptions, readOnly: true, lineNumbers: 'off' }}
        />
      </div>
    </>
  );
};
