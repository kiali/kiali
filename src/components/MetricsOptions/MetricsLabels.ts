export namespace MetricsLabels {
  export type PromLabel = string;
  export type LabelValues = { [key: string]: boolean };
  export type LabelName = 'Local version' | 'Remote app' | 'Remote version' | 'Response code';

  const tmpInboundLabels: [LabelName, PromLabel][] = [
    ['Local version', 'destination_version'],
    ['Remote app', 'source_app'],
    ['Remote version', 'source_version'],
    ['Response code', 'response_code']
  ];
  const tmpOutboundLabels: [LabelName, PromLabel][] = [
    ['Local version', 'source_version'],
    ['Remote app', 'destination_app'],
    ['Remote version', 'destination_version'],
    ['Response code', 'response_code']
  ];

  export const INBOUND_LABELS: Map<LabelName, PromLabel> = new Map<LabelName, PromLabel>(tmpInboundLabels);
  export const OUTBOUND_LABELS: Map<LabelName, PromLabel> = new Map<LabelName, PromLabel>(tmpOutboundLabels);
  export const REVERSE_INBOUND_LABELS: Map<PromLabel, LabelName> = new Map<PromLabel, LabelName>(
    tmpInboundLabels.map(arr => [arr[1], arr[0]] as [PromLabel, LabelName])
  );
  export const REVERSE_OUTBOUND_LABELS: Map<PromLabel, LabelName> = new Map<PromLabel, LabelName>(
    tmpOutboundLabels.map(arr => [arr[1], arr[0]] as [PromLabel, LabelName])
  );
  export const ALL_NAMES = tmpInboundLabels.map(arr => arr[0]);
}
