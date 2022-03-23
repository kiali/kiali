type D3FormatFunc = (specifier: string) => (n: number | { valueOf(): number }) => string;

export const getUnit = (d3Format: D3FormatFunc, unit: string, val: number) => {
  // Round to dismiss float imprecision
  val = Math.round(val * 10000) / 10000;
  var unitResult = '';
  switch (unit) {
    case 'seconds':
      unitResult = formatSI(d3Format, val, 's', true);
      break;
    case 'bytes':
    case 'bytes-si':
      unitResult = formatDataSI(d3Format, val, 'B', true);
      break;
    case 'bytes-iec':
      unitResult = formatDataIEC(d3Format, val, 'B', true);
      break;
    case 'bitrate':
    case 'bitrate-si':
      unitResult = formatDataSI(d3Format, val, 'bit/s', true);
      break;
    case 'bitrate-iec':
      unitResult = formatDataIEC(d3Format, val, 'bit/s', true);
      break;
    case 'connrate':
      unitResult = formatDataSI(d3Format, val, 'conn/s', true);
      break;
    case 'msgrate':
      unitResult = formatDataSI(d3Format, val, 'msg/s', true);
      break;
    default:
      // Fallback to default SI scaler:
      unitResult = formatDataSI(d3Format, val, unit, true);
      break;
  }
  return unitResult.split(' ')[1];
};

export const getFormatter = (d3Format: D3FormatFunc, unit: string, withUnit: boolean = false) => {
  return (val: number): string => {
    // Round to dismiss float imprecision
    val = Math.round(val * 10000) / 10000;
    switch (unit) {
      case 'seconds':
        return formatSI(d3Format, val, 's', withUnit);
      case 'bytes':
      case 'bytes-si':
        return formatDataSI(d3Format, val, 'B', withUnit);
      case 'bytes-iec':
        return formatDataIEC(d3Format, val, 'B', withUnit);
      case 'bitrate':
      case 'bitrate-si':
        return formatDataSI(d3Format, val, 'bit/s', withUnit);
      case 'bitrate-iec':
        return formatDataIEC(d3Format, val, 'bit/s', withUnit);
      case 'connrate':
        return formatDataSI(d3Format, val, 'conn/s', withUnit);
      case 'msgrate':
        return formatDataSI(d3Format, val, 'msg/s', withUnit);
      default:
        // Fallback to default SI scaler:
        return formatDataSI(d3Format, val, unit, withUnit);
    }
  };
};

const formatDataSI = (d3Format: D3FormatFunc, val: number, suffix: string, withUnit: boolean): string => {
  const formD = formatData(d3Format, val, 1000, ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'], withUnit);
  return withUnit ? formD + suffix : formD;
};

const formatDataIEC = (d3Format: D3FormatFunc, val: number, suffix: string, withUnit: boolean): string => {
  const formD = formatData(d3Format, val, 1024, ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'], withUnit);
  return withUnit ? formD + suffix : formD;
};

const formatData = (
  d3Format: D3FormatFunc,
  val: number,
  threshold: number,
  units: string[],
  withUnit: boolean
): string => {
  if (Math.abs(val) < threshold) {
    return val + ' ';
  }
  let u = -1;
  do {
    val /= threshold;
    ++u;
  } while (Math.abs(val) >= threshold && u < units.length - 1);
  const unit = d3Format('~r')(val);
  return withUnit ? unit + ' ' + units[u] : unit;
};

const formatSI = (d3Format: D3FormatFunc, val: number, suffix: string, withUnit: boolean): string => {
  const fmt = d3Format('~s')(val);
  let si = '';
  // Insert space before SI
  // "fmt" can be something like:
  // - "9k" => we want "9 kB"
  // - "9" => we want "9 B"
  for (let i = fmt.length - 1; i >= 0; i--) {
    const c = fmt.charAt(i);
    if (c >= '0' && c <= '9') {
      const res = fmt.substr(0, i + 1);
      return withUnit ? res + ' ' + si + suffix : res;
    }
    si = c + si;
  }
  // Weird: no number found?
  return withUnit ? fmt + suffix : fmt;
};
