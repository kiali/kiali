import * as React from 'react';
import { DurationInSeconds, I18N_NAMESPACE } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getName } from '../../utils/RateIntervals';
import { PFColors } from 'components/Pf/PfColors';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { RichDataPoint, VCLine } from 'types/VictoryChartInfo';
import { DirectionType } from './OverviewToolbar';
import { useTranslation } from 'react-i18next';

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

export const OverviewCardDataPlaneNamespace: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation(I18N_NAMESPACE);

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

  if (series.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          verticalAlign: 'top'
        }}
      >
        <div style={{ paddingTop: '0.5rem' }}>{`${t('No')} ${t(props.direction.toLowerCase())} ${t('traffic')}`}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: 130,
        verticalAlign: 'top'
      }}
    >
      <div>
        <></>
      </div>
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
    </div>
  );
};
