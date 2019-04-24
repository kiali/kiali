import { format } from 'd3-format';

export const getFormatter = (unit: string) => {
  return (val: number): string => {
    // Round to dismiss float imprecision
    val = Math.round(val * 10000) / 10000;
    switch (unit) {
      case 'seconds':
        return formatSI(val, 's');
      case 'bytes':
      case 'bytes-si':
        return formatDataSI(val, 'B');
      case 'bytes-iec':
        return formatDataIEC(val, 'B');
      case 'bitrate':
      case 'bitrate-si':
        return formatDataSI(val, 'bit/s');
      case 'bitrate-iec':
        return formatDataIEC(val, 'bit/s');
      default:
        // Fallback to default SI scaler:
        return formatDataSI(val, unit);
    }
  };
};

const formatDataSI = (val: number, suffix: string): string => {
  return formatData(val, 1000, ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']) + suffix;
};

const formatDataIEC = (val: number, suffix: string): string => {
  return formatData(val, 1024, ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi']) + suffix;
};

const formatData = (val: number, threshold: number, units: string[]): string => {
  if (Math.abs(val) < threshold) {
    return val + ' ';
  }
  let u = -1;
  do {
    val /= threshold;
    ++u;
  } while (Math.abs(val) >= threshold && u < units.length - 1);
  return format('~r')(val) + ' ' + units[u];
};

const formatSI = (val: number, suffix: string): string => {
  const fmt = format('~s')(val);
  let si = '';
  // Insert space before SI
  // "fmt" can be something like:
  // - "9k" => we want "9 kB"
  // - "9" => we want "9 B"
  for (let i = fmt.length - 1; i >= 0; i--) {
    const c = fmt.charAt(i);
    if (c >= '0' && c <= '9') {
      return fmt.substr(0, i + 1) + ' ' + si + suffix;
    }
    si = c + si;
  }
  // Weird: no number found?
  return fmt + suffix;
};
