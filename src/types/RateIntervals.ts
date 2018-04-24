const RateIntervals = [['1m', '1 minute'], ['5m', '5 minutes'], ['10m', '10 minutes'], ['30m', '30 minutes']];

const mapIntervals: { [key: string]: string } = {};
RateIntervals.forEach(pair => (mapIntervals[pair[0]] = pair[1]));

export const getName = (key: string): string => mapIntervals[key];

export default RateIntervals;
