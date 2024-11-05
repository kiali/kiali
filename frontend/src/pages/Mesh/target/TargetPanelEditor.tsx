import * as React from 'react';
import AceEditor from 'react-ace';
import ReactAce from 'react-ace/lib/ace';
import { useKialiTheme } from '../../../utils/ThemeUtils';
import { Theme } from '../../../types/Common';
import { ConfigButtonsTargetPanel } from '../../../components/Mesh/ConfigButtonsTargetPanel';
import { AceOptions } from 'react-ace/types';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { yamlDumpOptions } from 'types/IstioConfigDetails';
import { dump } from 'js-yaml';

interface TargetPanelEditorProps {
  configData: unknown;
  targetName: string;
}

const aceOptions: AceOptions = {
  highlightActiveLine: false,
  highlightGutterLine: false,
  maxLines: Infinity,
  showLineNumbers: false,
  showPrintMargin: false
};

const aceEditorStyle = kialiStyle({
  marginTop: '0.5rem',
  backgroundColor: PFColors.BackgroundColor100,
  $nest: {
    '& .ace_gutter': {
      backgroundColor: PFColors.BackgroundColor100,
      borderRight: 0,
      left: '-1rem !important'
    },

    '& .ace_scroller': {
      left: '1rem !important'
    },

    '& .ace_cursor': {
      opacity: 0
    }
  }
});

export const TargetPanelEditor: React.FC<TargetPanelEditorProps> = (props: TargetPanelEditorProps) => {
  const darkTheme = useKialiTheme() === Theme.DARK;
  const aceEditorRef = React.useRef<ReactAce | null>(null);

  let yaml = '';
  try {
    yaml = dump(props.configData || 'N/A', yamlDumpOptions);
  } catch (error) {
    yaml = 'N/A';
  }

  return (
    <>
      <ConfigButtonsTargetPanel copyText={yaml} targetName={props.targetName} />

      <AceEditor
        ref={aceEditorRef}
        mode="yaml"
        theme={darkTheme ? 'twilight' : 'eclipse'}
        fontSize={'var(--kiali-global--font-size)'}
        width="100%"
        className={aceEditorStyle}
        wrapEnabled={true}
        readOnly={true}
        setOptions={aceOptions}
        value={yaml}
        showPrintMargin={false}
      />
    </>
  );
};
