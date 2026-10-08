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
import { UsageValueKind } from 'types/Chatbot';
import { useKialiTranslation } from 'utils/I18nUtils';

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

const WINDOW_OPTIONS_MAP: { [k: string]: string } = {
  weekly: 'Weekly',
  monthly: 'Monthly'
};

const getISOWeek = (date: Date): { year: number; week: number } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const getWeekOptions = (): { label: string; value: number }[] => {
  const options: { label: string; value: number }[] = [];
  const now = new Date();

  // Start with the Monday of the current week
  const current = new Date(now);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  current.setHours(0, 0, 0, 0);

  // Generate last 52 weeks
  for (let i = 0; i < 52; i++) {
    const d = new Date(current.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const { week } = getISOWeek(d);

    const monthStr = d.toLocaleString('en-US', { month: 'short' });
    const yearStr = d.getFullYear().toString().slice(-2);

    options.push({
      label: `W${week} ${monthStr} ${yearStr}`,
      value: d.getTime()
    });
  }
  return options;
};

const getMonthOptions = (): { label: string; value: number }[] => {
  const options: { label: string; value: number }[] = [];
  const now = new Date();
  const current = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));

  for (let i = 0; i < 24; i++) {
    const d = new Date(current);
    d.setMonth(current.getMonth() - i);

    const monthStr = d.toLocaleString('en-US', { month: 'short' });
    const yearStr = d.getFullYear().toString().slice(-2);

    options.push({
      label: `${monthStr} ${yearStr}`,
      value: d.getTime()
    });
  }
  return options;
};

export const AIConsumptionHeader: React.FC<{
  fromVal: number;
  onRangeChange: (fromVal: number, toVal: number) => void;
  onValueKindChange: (kind: UsageValueKind) => void;
  onWindowChange: (window: string) => void;
  title: string;
  toVal: number;
  valueKind: UsageValueKind;
  window: string;
}> = ({ fromVal, onRangeChange, onValueKindChange, onWindowChange, title, toVal, valueKind, window }) => {
  const { t } = useKialiTranslation();

  const options = window === 'weekly' ? getWeekOptions() : getMonthOptions();

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
                <ToolbarDropdown
                  id="ai-consumption-window-dd"
                  handleSelect={value => onWindowChange(value)}
                  value={window}
                  label={WINDOW_OPTIONS_MAP[window] ?? window}
                  options={WINDOW_OPTIONS_MAP}
                  tooltip={t('Aggregation window')}
                />
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <span style={{ marginRight: '0.5rem' }}>{t('From:')}</span>
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
                <span style={{ marginRight: '0.5rem' }}>{t('To:')}</span>
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
