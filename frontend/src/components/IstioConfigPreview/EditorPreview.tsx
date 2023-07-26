import * as React from 'react';
import { AuthorizationPolicy, Sidecar } from 'types/IstioObjects';
import { AceValidations, jsYaml } from '../../types/AceValidations';
import AceEditor from 'react-ace';
import { aceOptions } from '../../types/IstioConfigDetails';
import { YAMLException } from 'js-yaml';
import { istioAceEditorStyle, istioValidationErrorStyle } from 'styles/AceEditorStyle';
import { Theme } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';

type PolicyItem = AuthorizationPolicy | Sidecar;

interface Props {
  yaml: string;
  onChange: (obj) => void;
  theme: string;
}

interface State {
  yaml: string;
  parsedValidations: AceValidations;
}

export class EditorPreviewComponent extends React.Component<Props, State> {
  aceEditorRef: React.RefObject<AceEditor>;
  constructor(props: Props) {
    super(props);
    this.state = { yaml: this.props.yaml, parsedValidations: { markers: [], annotations: [] } };
    this.aceEditorRef = React.createRef();
  }

  onChange = (value: string) => {
    const parsedValidations: AceValidations = {
      markers: [],
      annotations: []
    };
    this.setState({ yaml: value });
    try {
      jsYaml.safeLoadAll(value, (object: PolicyItem) => {
        this.setState({ parsedValidations });
        this.props.onChange(object);
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
        this.setState({ parsedValidations });
      }
    }
  };

  render() {
    const ace_theme = this.props.theme === Theme.Light ? 'eclipse' : 'twilight';
    return (
      <AceEditor
        ref={this.aceEditorRef}
        mode="yaml"
        theme={ace_theme}
        onChange={value => this.onChange(value)}
        height={'275px  '}
        width={'100%'}
        className={istioAceEditorStyle}
        wrapEnabled={true}
        setOptions={aceOptions}
        value={this.state.yaml}
        annotations={this.state.parsedValidations.annotations}
        markers={this.state.parsedValidations.markers}
      />
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    theme: state.globalState.theme
  };
};

export const EditorPreview = connect(mapStateToProps)(EditorPreviewComponent);
