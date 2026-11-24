import * as React from 'react';
import {
  Grid,
  GridItem,
  Title,
  TitleSizes,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { PFColors } from 'components/Pf/PfColors';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import type { AIRequestKind, UsageValueKind } from 'types/Chatbot';
import { useKialiTranslation } from 'utils/I18nUtils';
import { buildMonthRangeOptions, buildWeekRangeOptions } from '../aiDashboardUtils';

// Sticks to the top of the consumption tab, which scrolls inside a padded container.
const headerStyle = kialiStyle({
  alignItems: 'center',
  backgroundColor: PFColors.BackgroundColor100,
  boxShadow: `0 calc(${PFSpacer.md} * -1) 0 0 ${PFColors.BackgroundColor100}`,
  marginBottom: PFSpacer.md,
  marginLeft: `calc(${PFSpacer.md} * -1)`,
  marginRight: `calc(${PFSpacer.md} * -1)`,
  marginTop: `calc(${PFSpacer.md} * -1)`,
  paddingBottom: PFSpacer.md,
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md,
  paddingTop: PFSpacer.md,
  position: 'sticky',
  top: 0,
  zIndex: 10
});

const rangeLabelStyle = kialiStyle({
  marginRight: PFSpacer.sm
});

export const AIConsumptionHeader: React.FC<{
  fromVal: number;
  onRangeChange: (fromVal: number, toVal: number) => void;
  onRequestKindChange: (kind: AIRequestKind) => void;
  onValueKindChange: (kind: UsageValueKind) => void;
  onWindowChange: (window: string) => void;
  requestKind: AIRequestKind;
  title: string;
  toVal: number;
  valueKind: UsageValueKind;
  window: string;
}> = ({
  fromVal,
  onRangeChange,
  onRequestKindChange,
  onValueKindChange,
  onWindowChange,
  requestKind,
  title,
  toVal,
  valueKind,
  window
}) => {
  const { t } = useKialiTranslation();
  const requestOptions: { [key: string]: string } = {
    all: t('All'),
    chat: t('Chat'),
    troubleshooting: t('Troubleshooting')
  };

  const windowOptions = React.useMemo(
    () => ({
      monthly: t('Monthly'),
      weekly: t('Weekly')
    }),
    [t]
  );

  const options = React.useMemo(
    () => (window === 'weekly' ? buildWeekRangeOptions(t) : buildMonthRangeOptions()),
    [t, window]
  );

  // "From" options should only include values <= toVal
  const fromOptions: { [key: string]: string } = {};
  options
    .filter(opt => opt.value <= toVal)
    .forEach(opt => {
      fromOptions[`t${opt.value}`] = opt.label;
    });

  // "To" options should only include values >= fromVal
  const toOptions: { [key: string]: string } = {};
  options
    .filter(opt => opt.value >= fromVal)
    .forEach(opt => {
      toOptions[`t${opt.value}`] = opt.label;
    });

  return (
    <Grid className={headerStyle}>
      <GridItem span={6}>
        <Title headingLevel="h1" size={TitleSizes.xl}>
          {title}
        </Title>
      </GridItem>
      <GridItem span={6}>
        <Toolbar id="ai-consumption-header-toolbar-group">
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }}>
              <ToolbarItem>
                <div data-test="ai-consumption-tokens-cost-toggle">
                  <ToggleGroup aria-label={t('Consumption metric')} isCompact>
                    <ToggleGroupItem
                      aria-label={t('Tokens')}
                      isSelected={valueKind === 'tokens'}
                      onClick={() => onValueKindChange('tokens')}
                      text={t('Tokens')}
                    />
                    <ToggleGroupItem
                      aria-label={t('Cost')}
                      isSelected={valueKind === 'cost'}
                      onClick={() => onValueKindChange('cost')}
                      text={t('Cost')}
                    />
                  </ToggleGroup>
                </div>
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <div data-test="ai-consumption-request-dd">
                  <ToolbarDropdown
                    id="ai-consumption-request-kind"
                    handleSelect={value => onRequestKindChange(value as AIRequestKind)}
                    label={requestOptions[requestKind] ?? requestKind}
                    options={requestOptions}
                    tooltip={t('Request type')}
                    value={requestKind}
                  />
                </div>
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <ToolbarDropdown
                  id="ai-consumption-window-dd"
                  handleSelect={value => onWindowChange(value)}
                  value={window}
                  label={windowOptions[window] ?? window}
                  options={windowOptions}
                  tooltip={t('Aggregation window')}
                />
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <span className={rangeLabelStyle}>{t('From:')}</span>
                <ToolbarDropdown
                  id="ai-consumption-from-dd"
                  handleSelect={value => onRangeChange(parseInt(value.slice(1), 10), toVal)}
                  value={`t${fromVal}`}
                  label={fromOptions[`t${fromVal}`] ?? ''}
                  options={fromOptions}
                  tooltip={t('Start date')}
                />
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <span className={rangeLabelStyle}>{t('To:')}</span>
                <ToolbarDropdown
                  id="ai-consumption-to-dd"
                  handleSelect={value => onRangeChange(fromVal, parseInt(value.slice(1), 10))}
                  value={`t${toVal}`}
                  label={toOptions[`t${toVal}`] ?? ''}
                  options={toOptions}
                  tooltip={t('End date')}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </GridItem>
    </Grid>
  );
};
