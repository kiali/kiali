import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { legendData, MeshLegendItem, MeshLegendItemRow } from './MeshLegendData';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

interface MeshLegendProps {
  closeLegend: () => void;
}

const legendBoxStyle = kialiStyle({
  width: '225px',
  backgroundColor: PFColors.BackgroundColor100,
  border: `1px solid ${PFColors.BorderColor100}`,
  overflowY: 'auto',
  zIndex: 3
});

const headerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  padding: '0.5rem 0 0.5rem 1rem',
  fontWeight: 'bold'
});

const bodyStyle = kialiStyle({
  padding: '0 0.5rem 1rem 1rem'
});

const keyStyle = kialiStyle({
  minWidth: '70px',
  width: '70px'
});

const legendItemStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  padding: '0.25rem 0.25rem 0 0.25rem'
});

const legendItemLabelStyle = kialiStyle({
  fontWeight: 'normal'
});

const legendColumnHeadingStyle = kialiStyle({
  fontWeight: 'bold',
  paddingTop: '1.25rem'
});

const legendLogoStyle = kialiStyle({
  width: '2rem',
  height: '2rem',
  marginBottom: '0.125rem'
});

export const MeshLegend: React.FC<MeshLegendProps> = (props: MeshLegendProps) => {
  const { t } = useKialiTranslation();

  const renderGraphLegendList = (legendData: MeshLegendItem[]): React.ReactNode => {
    return (
      <>
        {legendData.map((legendItem: MeshLegendItem) => (
          <div key={legendItem.title} className={legendColumnHeadingStyle}>
            {t(legendItem.title)}

            {legendItem.data.map((legendItemRow: MeshLegendItemRow) =>
              renderLegendIconAndLabel(legendItemRow, legendItem.isLogo)
            )}
          </div>
        ))}
      </>
    );
  };

  const renderLegendIconAndLabel = (legendItemRow: MeshLegendItemRow, isLogo?: boolean): React.ReactNode => {
    return (
      <div key={legendItemRow.icon} className={legendItemStyle}>
        <span className={keyStyle}>
          <img alt={legendItemRow.label} src={legendItemRow.icon} className={isLogo ? legendLogoStyle : ''} />
        </span>

        <span className={legendItemLabelStyle}>{t(legendItemRow.label)}</span>
      </div>
    );
  };

  return (
    <div className={legendBoxStyle} data-test="graph-legend">
      <div className={headerStyle}>
        <span>{t('Legend')}</span>
        <Tooltip content={t('Close Legend')}>
          <Button id="legend_close" variant={ButtonVariant.plain} onClick={props.closeLegend}>
            <KialiIcon.Close />
          </Button>
        </Tooltip>
      </div>

      <div className={bodyStyle}>{renderGraphLegendList(legendData)}</div>
    </div>
  );
};
