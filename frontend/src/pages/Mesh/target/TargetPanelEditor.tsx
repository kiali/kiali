import * as React from 'react';
import { dump } from 'js-yaml';
import { aceOptions, yamlDumpOptions } from 'types/IstioConfigDetails';
import { istioAceEditorStyle } from '../../../styles/AceEditorStyle';
import AceEditor from 'react-ace';
import ReactAce from 'react-ace/lib/ace';
import { useKialiTheme } from '../../../utils/ThemeUtils';
import { Theme } from '../../../types/Common';
import { ConfigButtonsTargetPanel } from '../../../components/Mesh/ConfigButtonsTargetPanel';

interface TargetPanelEditorProps {
  configMap: string;
  targetName: string;
}

export const TargetPanelEditor: React.FC<TargetPanelEditorProps> = (props: TargetPanelEditorProps) => {
  const darkTheme = useKialiTheme() === Theme.DARK;
  const copyText = dump(props.configMap, yamlDumpOptions);
  const aceEditorRef = React.useRef<ReactAce | null>(null);

  return (
    <>
      <ConfigButtonsTargetPanel copyText={copyText} targetName={props.targetName} />
      <AceEditor
        ref={aceEditorRef}
        mode="yaml"
        theme={darkTheme ? 'twilight' : 'eclipse'}
        width="100%"
        className={istioAceEditorStyle}
        wrapEnabled={true}
        readOnly={true}
        setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
        value={props.configMap}
      />
    </>
  );
};
