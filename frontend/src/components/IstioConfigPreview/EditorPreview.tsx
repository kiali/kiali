import * as React from 'react';
import type { AuthorizationPolicy, Sidecar } from 'types/IstioObjects';
import { applyMonacoMarkers } from '../../types/AceValidations';
import type { MonacoInstance } from '../../types/AceValidations';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { MarkerSeverity } from 'monaco-editor';
import { YAMLException, loadAll } from 'js-yaml';
import { editorStyle } from 'styles/EditorStyle';
import { Theme } from '../../types/Common';
import type { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';

export type PolicyItem = AuthorizationPolicy | Sidecar;

type ReduxProps = {
  theme: string;
};

type Props = ReduxProps & {
  onChange: (obj: PolicyItem) => void;
  readOnly?: boolean;
  yaml: string;
};

export const EditorPreviewComponent: React.FC<Props> = (props: Props) => {
  const [yaml, setYaml] = React.useState<string>(props.yaml);
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<MonacoInstance | null>(null);

  const onChange = (value: string | undefined): void => {
    setYaml(value || '');

    try {
      loadAll(value || '', object => {
        clearMarkers();
        props.onChange(object as PolicyItem);
      });
    } catch (e) {
      if (e instanceof YAMLException) {
        const row = e.mark && e.mark.line ? e.mark.line : 0;
        const message = e.message ? e.message : '';

        if (monacoRef.current && editorRef.current) {
          applyMonacoMarkers(monacoRef.current, editorRef.current, [
            {
              startLineNumber: row + 1,
              startColumn: 1,
              endLineNumber: row + 2,
              endColumn: 1,
              severity: MarkerSeverity.Error,
              message
            }
          ]);
        }
      }
    }
  };

  const clearMarkers = (): void => {
    if (monacoRef.current && editorRef.current) {
      applyMonacoMarkers(monacoRef.current, editorRef.current, []);
    }
  };

  const onEditorDidMount = (ed: editor.IStandaloneCodeEditor, monaco: MonacoInstance): void => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    ed.onDidChangeModelContent(() => {
      onChange(ed.getValue());
    });
  };

  return (
    <div className={editorStyle} data-test="editor-preview">
      <Editor
        value={yaml}
        language="yaml"
        theme={props.theme === Theme.DARK ? 'vs-dark' : 'light'}
        height="275px"
        onMount={onEditorDidMount}
        options={{ readOnly: props.readOnly, wordWrap: 'on', scrollBeyondLastLine: false, glyphMargin: true }}
      />
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    theme: state.globalState.theme
  };
};

export const EditorPreview = connect(mapStateToProps)(EditorPreviewComponent);
