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

const editorContainerStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  marginTop: '0.5rem',
  overflow: 'hidden',
  $nest: {
    '& > section': {
      overflow: 'hidden'
    }
  }
});

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  folding: false,
  lineNumbers: 'off',
  minimap: { enabled: false },
  overviewRulerLanes: 0,
  renderLineHighlight: 'none',
  scrollBeyondLastLine: false,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    handleMouseWheel: false,
    horizontal: 'hidden',
    vertical: 'hidden'
  },
  wordWrap: 'on'
};

export const TargetPanelEditor: React.FC<TargetPanelEditorProps> = ({ configData, includeTitle, targetName }) => {
  const darkTheme = useKialiTheme() === Theme.DARK;
  const [editorHeight, setEditorHeight] = React.useState<string>('200px');

  let yaml = '';
  try {
    yaml = dump(configData || 'N/A', yamlDumpOptions);
  } catch {
    yaml = 'N/A';
  }

  const updateEditorHeight = (ed: editor.IStandaloneCodeEditor): void => {
    setEditorHeight(`${ed.getContentHeight()}px`);
  };

  const onEditorDidMount = (ed: editor.IStandaloneCodeEditor): void => {
    updateEditorHeight(ed);
    ed.onDidContentSizeChange(() => updateEditorHeight(ed));
  };

  return (
    <>
      <ConfigButtonsTargetPanel copyText={yaml} includeTitle={includeTitle} targetName={targetName} />

      <div className={editorContainerStyle} data-test="target-panel-editor">
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
