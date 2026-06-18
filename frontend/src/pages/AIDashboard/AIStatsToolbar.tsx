import React from "react";
import { Grid, GridItem, SelectList, SelectOption, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem, ToolbarItemVariant, TooltipPosition } from "@patternfly/react-core";
import { SimpleSelect } from "components/Select/SimpleSelect";
import { DurationDropdownComponent } from "components/Dropdown/DurationDropdown";
import { DurationInSeconds } from "types/Common";
import { useKialiTranslation } from "utils/I18nUtils";
import { TokenMetric } from "types/Chatbot";
import { ToolbarDropdown } from "components/Dropdown/ToolbarDropdown";

type AIStatsToolbarProps = {
    onFilterChange: (provider: string, tokenMetric: TokenMetric, duration: DurationInSeconds, step: DurationInSeconds) => void;
    providersOptions: string[];
};

// All candidate step sizes, from finest to coarsest.
const ALL_STEP_OPTIONS: { label: string; value: number }[] = [
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
    { value: 604800,  label: '7d'  },
];

/**
 * Returns the step options that make sense for the given window (in seconds).
 * A step is included when it produces between 10 and 100 buckets, ensuring
 * charts are neither too sparse nor too dense.
 */
const getStepOptions = (windowSecs: number): { label: string; value: number }[] =>
    ALL_STEP_OPTIONS.filter(({ value }) => {
        const buckets = windowSecs / value;
        return buckets >= 10 && buckets <= 100;
    });

export const AIStatsToolbar: React.FC<AIStatsToolbarProps> = ({providersOptions, onFilterChange}) => {
    const { t } = useKialiTranslation();
    const [tokenMetric, setTokenMetric] = React.useState<TokenMetric>('totalTokens');
    const [provider, setProvider] = React.useState<string>('');
    const [duration, setDuration] = React.useState<DurationInSeconds>(86400);
    const [step, setStep] = React.useState<DurationInSeconds>(3600);

    // Derive valid step options from the current window.
    const stepOptions = React.useMemo(() => getStepOptions(duration), [duration]);

    // ToolbarDropdown expects { [key: string]: string } — map seconds → label.
    const stepOptionsMap = React.useMemo(
        () => Object.fromEntries(stepOptions.map(o => [String(o.value), o.label])),
        [stepOptions]
    );

    // When the window changes, reset the step to the first valid option if the
    // current step is no longer in the list.
    React.useEffect(() => {
        if (stepOptions.length > 0 && !stepOptions.find(o => o.value === step)) {
            setStep(stepOptions[0].value);
        }
    }, [stepOptions, step]);

    // Sync default provider selection once options arrive from the parent (async load).
    React.useEffect(() => {
        if (providersOptions.length > 0 && !providersOptions.includes(provider)) {
            setProvider(providersOptions[0]);
        }
    }, [providersOptions, provider]);

    const handleFilterChange = (providerValue: string, tokenMetricValue: TokenMetric, durationValue: DurationInSeconds, stepValue: DurationInSeconds) => {
        setProvider(providerValue);
        setTokenMetric(tokenMetricValue);
        setDuration(durationValue);
        setStep(stepValue);
        onFilterChange(providerValue, tokenMetricValue, durationValue, stepValue);
    };
   
    return (
        <Grid hasGutter >
            <GridItem span={4}>                
                <Toolbar>
                <ToolbarContent>
                
                <ToolbarGroup>
                    <ToolbarItem variant={ToolbarItemVariant.label}>
                        Metric
                    </ToolbarItem>
        <ToolbarItem>
            <SimpleSelect
            selected={tokenMetric}
            onSelect={(value) => handleFilterChange(provider, value as TokenMetric, duration, step)}
            >
                <SelectList>
                    <SelectOption value="totalTokens">Total Tokens</SelectOption>
                    <SelectOption value="promptTokens">Prompt Tokens</SelectOption>
                    <SelectOption value="completionTokens">Completion Tokens</SelectOption>
                </SelectList>
              </SimpleSelect>
        </ToolbarItem>
        <ToolbarItem>
        <ToolbarItem variant={ToolbarItemVariant.label}>
                        Provider
                    </ToolbarItem>
            <SimpleSelect
            selected={provider}
            onSelect={(value) => handleFilterChange(value as string, tokenMetric, duration, step)}
            >
                <SelectList>
                    {providersOptions.map(providerOption => (
                        <SelectOption key={providerOption} value={providerOption}>
                            {providerOption.charAt(0).toUpperCase() + providerOption.slice(1)}
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
                <ToolbarItem variant={ToolbarItemVariant.label}>
                        Time Range
                </ToolbarItem>
                <ToolbarItem>
                <DurationDropdownComponent
                        id={'ai-stats-duration-dd'}
                        disabled={false}
                        duration={duration}
                        prefix={t('Last')}
                        setDuration={duration => handleFilterChange(provider, tokenMetric, duration, step)}
                        tooltip={t('Metric time period')}
                        tooltipPosition={TooltipPosition.top}
                        />
                </ToolbarItem>            
                <ToolbarItem variant={ToolbarItemVariant.label}>
                        Step
                </ToolbarItem>
                <ToolbarItem>
                    <ToolbarDropdown
                        id={'ai-stats-step-dropdown'}
                        handleSelect={value => handleFilterChange(provider, tokenMetric, duration, Number(value))}
                        value={step}
                        label={stepOptions.find(o => o.value === step)?.label ?? String(step)}
                        options={stepOptionsMap}
                        />                       
                </ToolbarItem>
            </ToolbarGroup>
                    </ToolbarContent>
                </Toolbar>
            </GridItem>
        </Grid>
    );
};