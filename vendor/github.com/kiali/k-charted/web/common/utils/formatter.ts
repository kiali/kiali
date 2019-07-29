type D3FormatFunc = (specifier: string) => (n: number | { valueOf(): number }) => string;

export const getFormatter = (d3Format: D3FormatFunc, unit: string) => {
  return (val: number): string => {
    // Round to dismiss float imprecision
    val = Math.round(val * 10000) / 10000;
    switch (unit) {
      case 'seconds':
        return formatSI(d3Format, val, 's');
      case 'bytes':
      case 'bytes-si':
        return formatDataSI(d3Format, val, 'B');
      case 'bytes-iec':
        return formatDataIEC(d3Format, val, 'B');
      case 'bitrate':
      case 'bitrate-si':
        return formatDataSI(d3Format, val, 'bit/s');
      case 'bitrate-iec':
        return formatDataIEC(d3Format, val, 'bit/s');
      default:
        // Fallback to default SI scaler:
        return formatDataSI(d3Format, val, unit);
    }
  };
};

const formatDataSI = (d3Format: D3FormatFunc, val: number, suffix: string): string => {
  return formatData(d3Format, val, 1000, ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']) + suffix;
};

const formatDataIEC = (d3Format: D3FormatFunc, val: number, suffix: string): string => {
  return formatData(d3Format, val, 1024, ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi']) + suffix;
};

const formatData = (d3Format: D3FormatFunc, val: number, threshold: number, units: string[]): string => {
  if (Math.abs(val) < threshold) {
    return val + ' ';
  }
  let u = -1;
  do {
    val /= threshold;
    ++u;
  } while (Math.abs(val) >= threshold && u < units.length - 1);
  return d3Format('~r')(val) + ' ' + units[u];
};

const formatSI = (d3Format: D3FormatFunc, val: number, suffix: string): string => {
  const fmt = d3Format('~s')(val);
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
