import React from "react";
import { Grid, GridItem, SelectList, SelectOption, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem, ToolbarItemVariant } from "@patternfly/react-core";
import { SimpleSelect } from "components/Select/SimpleSelect";
import { DurationInSeconds } from "types/Common";
import { useKialiTranslation } from "utils/I18nUtils";
import { TokenMetric } from "types/Chatbot";
import { ToolbarDropdown } from "components/Dropdown/ToolbarDropdown";

type AIStatsToolbarProps = {
    duration: DurationInSeconds;
    onFilterChange: (provider: string, tokenMetric: TokenMetric, duration: DurationInSeconds, step: DurationInSeconds) => void;
    provider: string;
    providersOptions: string[];
    step: DurationInSeconds;
    tokenMetric: TokenMetric;
};

// Duration options for the time-range picker — stored as seconds.
export const ALL_DURATION_OPTIONS: { label: string; value: number }[] = [
    { value: 300,     label: 'Last 5m'  },
    { value: 900,     label: 'Last 15m' },
    { value: 1800,    label: 'Last 30m' },
    { value: 3600,    label: 'Last 1h'  },
    { value: 10800,   label: 'Last 3h'  },
    { value: 21600,   label: 'Last 6h'  },
    { value: 43200,   label: 'Last 12h' },
    { value: 86400,   label: 'Last 1d'  },
    { value: 604800,  label: 'Last 7d'  },
    { value: 2592000, label: 'Last 30d' },
];

const DURATION_OPTIONS_MAP: { [k: string]: string } =
    Object.fromEntries(ALL_DURATION_OPTIONS.map(o => [String(o.value), o.label]));

// All candidate step sizes, from finest to coarsest.
export const ALL_STEP_OPTIONS: { label: string; value: number }[] = [
    { value: 60,      label: '1m'  },
    { value: 120,     label: '2m'  },
    { value: 300,     label: '5m'  },
    { value: 600,     label: '10m' },
    { value: 900,     label: '15m' },
    { value: 1800,    label: '30m' },
    { value: 3600,    label: '1h'  },
    { value: 7200,    label: '2h'  },
    { value: 10800,   label: '3h'  },
    { value: 21600,   label: '6h'  },
    { value: 43200,   label: '12h' },
    { value: 86400,   label: '1d'  },
];

const STEP_OPTIONS_MAP: { [k: string]: string } =
    Object.fromEntries(ALL_STEP_OPTIONS.map(o => [String(o.value), o.label]));

/**
 * Returns the smallest step that yields at most 20 data points for the given
 * window. Used as the automatic default when the user changes the time range.
 */
export const getDefaultStep = (windowSecs: number): number => {
    const minStepSecs = windowSecs / 20;
    const match = ALL_STEP_OPTIONS.find(o => o.value >= minStepSecs);
    return match?.value ?? ALL_STEP_OPTIONS[ALL_STEP_OPTIONS.length - 1].value;
};

export const AIStatsToolbar: React.FC<AIStatsToolbarProps> = ({
    duration,
    onFilterChange,
    provider,
    providersOptions,
    step,
    tokenMetric,
}) => {
    const { t } = useKialiTranslation();

    // Step options >= current window duration are disabled (would produce ≤ 1 bucket).
    const disabledStepKeys = React.useMemo(
        () => ALL_STEP_OPTIONS.filter(o => o.value >= duration).map(o => String(o.value)),
        [duration]
    );

    return (
        <Grid hasGutter>
            <GridItem span={4}>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarGroup>
                            <ToolbarItem variant={ToolbarItemVariant.label}>Metric</ToolbarItem>
                            <ToolbarItem>
                                <SimpleSelect
                                    selected={tokenMetric}
                                    onSelect={value => onFilterChange(provider, value as TokenMetric, duration, step)}
                                >
                                    <SelectList>
                                        <SelectOption value="totalTokens">Total Tokens</SelectOption>
                                        <SelectOption value="promptTokens">Prompt Tokens</SelectOption>
                                        <SelectOption value="completionTokens">Completion Tokens</SelectOption>
                                    </SelectList>
                                </SimpleSelect>
                            </ToolbarItem>
                            <ToolbarItem variant={ToolbarItemVariant.label}>Provider</ToolbarItem>
                            <ToolbarItem>
                                <SimpleSelect
                                    selected={provider}
                                    onSelect={value => onFilterChange(value as string, tokenMetric, duration, step)}
                                >
                                    <SelectList>
                                        {providersOptions.map(p => (
                                            <SelectOption key={p} value={p}>
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </SelectOption>
                                        ))}
                                    </SelectList>
                                </SimpleSelect>
                            </ToolbarItem>
                        </ToolbarGroup>
                    </ToolbarContent>
                </Toolbar>
            </GridItem>
            <GridItem span={8}>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarGroup>
                            <ToolbarItem variant={ToolbarItemVariant.label}>Time Range</ToolbarItem>
                            <ToolbarItem>
                                <ToolbarDropdown
                                    id="ai-stats-duration-dd"
                                    handleSelect={value => {
                                        const newDuration = Number(value);
                                        const newStep = getDefaultStep(newDuration);
                                        onFilterChange(provider, tokenMetric, newDuration, newStep);
                                    }}
                                    value={duration}
                                    label={ALL_DURATION_OPTIONS.find(o => o.value === duration)?.label ?? String(duration)}
                                    options={DURATION_OPTIONS_MAP}
                                    tooltip={t('Metric time period')}
                                />
                            </ToolbarItem>
                            <ToolbarItem variant={ToolbarItemVariant.label}>Step</ToolbarItem>
                            <ToolbarItem>
                                <ToolbarDropdown
                                    id="ai-stats-step-dropdown"
                                    handleSelect={value => onFilterChange(provider, tokenMetric, duration, Number(value))}
                                    value={step}
                                    label={ALL_STEP_OPTIONS.find(o => o.value === step)?.label ?? String(step)}
                                    options={STEP_OPTIONS_MAP}
                                    disabledKeys={disabledStepKeys}
                                />
                            </ToolbarItem>
                        </ToolbarGroup>
                    </ToolbarContent>
                </Toolbar>
            </GridItem>
        </Grid>
    );
};
