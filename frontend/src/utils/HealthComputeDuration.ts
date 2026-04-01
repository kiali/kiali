import { DurationInSeconds } from 'types/Common';
import { durationLabelToSeconds, serverConfig, toValidDuration } from 'config/ServerConfig';

/**
 * Raw health compute duration label from the server (health_config.compute.duration).
 * Matches a CRD enum value and the time-range dropdown labels. Before config is loaded,
 * falls back to the server default window.
 */
export const getHealthComputeDurationLabel = (): string => serverConfig.healthConfig.compute?.duration?.trim() ?? '5m';

/**
 * Seconds for Redux / API: same as the dropdown entry for the configured health duration.
 * If the label is unknown (should not happen for a valid CR) or filtered out of the dropdown
 * (e.g. TSDB retention), falls back via toValidDuration.
 */
export const healthComputeDurationValidSeconds = (): DurationInSeconds => {
  const sec = durationLabelToSeconds(getHealthComputeDurationLabel());
  if (sec === undefined) {
    return toValidDuration(300);
  }
  if (serverConfig.durations[sec]) {
    return sec;
  }
  return toValidDuration(sec);
};
