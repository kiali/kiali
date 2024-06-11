import * as React from 'react';
import { AuthorizationPolicy, Sidecar } from 'types/IstioObjects';
import { AceValidations } from '../../types/AceValidations';
import AceEditor from 'react-ace';
import { aceOptions } from '../../types/IstioConfigDetails';
import { YAMLException, loadAll } from 'js-yaml';
import { istioAceEditorStyle, istioValidationErrorStyle } from 'styles/AceEditorStyle';
import { Theme } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import ReactAce from 'react-ace/lib/ace';

export type PolicyItem = AuthorizationPolicy | Sidecar;

type ReduxProps = {
  theme: string;
};

type Props = ReduxProps & {
  onChange: (obj: PolicyItem) => void;
  yaml: string;
};

export const EditorPreviewComponent: React.FC<Props> = (props: Props) => {
  const [yaml, setYaml] = React.useState<string>(props.yaml);
  const [parsedValidations, setParsedValidations] = React.useState<AceValidations>({ markers: [], annotations: [] });

  const aceEditorRef = React.useRef<ReactAce | null>(null);

  const onChange = (value: string): void => {
    const parsedValidations: AceValidations = {
      markers: [],
      annotations: []
    };

    setYaml(value);

    try {
      loadAll(value, object => {
        setParsedValidations(parsedValidations);
        props.onChange(object as PolicyItem);
      });
    } catch (e) {
      if (e instanceof YAMLException) {
        const row = e.mark && e.mark.line ? e.mark.line : 0;
        const col = e.mark && e.mark.column ? e.mark.column : 0;
        const message = e.message ? e.message : '';

        parsedValidations.markers.push({
          startRow: row,
          startCol: 0,
          endRow: row + 1,
          endCol: 0,
          className: istioValidationErrorStyle,
          type: 'fullLine'
        });

        parsedValidations.annotations.push({
          row: row,
          column: col,
          type: 'error',
          text: message
        });

        setParsedValidations(parsedValidations);
      }
    }
  };

  return (
    <AceEditor
      ref={aceEditorRef}
      mode="yaml"
      theme={props.theme === Theme.DARK ? 'twilight' : 'eclipse'}
      onChange={value => onChange(value)}
      height={'275px'}
      width={'100%'}
      className={istioAceEditorStyle}
      wrapEnabled={true}
      setOptions={aceOptions}
      value={yaml}
      annotations={parsedValidations.annotations}
      markers={parsedValidations.markers}
    />
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    theme: state.globalState.theme
  };
};

export const EditorPreview = connect(mapStateToProps)(EditorPreviewComponent);
