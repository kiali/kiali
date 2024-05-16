import * as React from 'react';
import { DurationInSeconds } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getName } from '../../utils/RateIntervals';
import { PFColors } from 'components/Pf/PfColors';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { RichDataPoint, VCLine } from 'types/VictoryChartInfo';
import { DirectionType } from './OverviewToolbar';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  direction: DirectionType;
  duration: DurationInSeconds;
  errorMetrics?: Metric[];
  metrics?: Metric[];
};

const showMetrics = (metrics: Metric[] | undefined): boolean => {
  // show metrics if metrics exists and some values at least are not zero
  if (metrics && metrics.length > 0 && metrics[0].datapoints.some(dp => Number(dp[1]) !== 0)) {
    return true;
  }

  return false;
};

const noTrafficStyle = kialiStyle({
  padding: '0.5rem 0',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
});

export const OverviewCardDataPlaneNamespace: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  let series: VCLine<RichDataPoint>[] = [];

  if (showMetrics(props.metrics)) {
    if (props.metrics && props.metrics.length > 0) {
      const data = toVCLine(props.metrics[0].datapoints, 'ops (Total)', PFColors.Info);
      series.push(data);
    }

    if (props.errorMetrics && props.errorMetrics.length > 0) {
      const dataErrors = toVCLine(props.errorMetrics[0].datapoints, 'ops (4xx+5xx)', PFColors.Danger);
      series.push(dataErrors);
    }
  }

  return (
    <div style={{ height: '100%' }}>
      {series.length > 0 && (
        <>
          <div
            style={{ paddingTop: '0.5rem' }}
            data-test={`sparkline-${props.direction.toLowerCase()}-duration-${getName(props.duration).toLowerCase()}`}
          >
            {`${t(props.direction)} ${t('traffic')}, ${getName(props.duration).toLowerCase()}`}
          </div>

          <SparklineChart
            name="traffics"
            height={85}
            showLegend={false}
            showYAxis={true}
            showXAxisValues={true}
            padding={{ top: 10, left: 30, right: 30, bottom: 30 }}
            tooltipFormat={dp => `${(dp.x as Date).toLocaleStringWithConditionalDate()}\n${dp.y.toFixed(2)} ${dp.name}`}
            series={series}
            labelName="ops"
          />
        </>
      )}

      {series.length === 0 && (
        <div className={noTrafficStyle}>{`${t('No')} ${t(props.direction.toLowerCase())} ${t('traffic')}`}</div>
      )}
    </div>
  );
};
