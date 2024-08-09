import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';
import { ConfigTable } from 'components/Table/ConfigTable';
import { dump } from 'js-yaml';
import { yamlDumpOptions } from 'types/IstioConfigDetails';
import { ConfigButtonsTargetPanel } from '../../../components/Mesh/ConfigButtonsTargetPanel';

interface TargetPanelConfigTableProps {
  configData: { [key: string]: string };
  targetName: string;
  width: string;
}

export const TargetPanelConfigTable: React.FC<TargetPanelConfigTableProps> = (props: TargetPanelConfigTableProps) => {
  const { t } = useKialiTranslation();
  const copyText = dump(props.configData, yamlDumpOptions);

  return (
    <>
      <ConfigButtonsTargetPanel copyText={copyText} targetName={props.targetName} />

      <ConfigTable label={t('Configuration')} configData={props.configData} width={props.width} />
    </>
  );
};
