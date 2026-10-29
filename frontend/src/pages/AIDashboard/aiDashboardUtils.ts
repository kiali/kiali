type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const getISOWeek = (date: Date): { week: number; year: number } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const monthShort = (date: Date): string => date.toLocaleString(undefined, { month: 'short' });

const yearShort = (date: Date): string => date.getFullYear().toString().slice(-2);

export const formatConsumptionRangeTitle = (
  translate: TranslateFn,
  win: string,
  fVal: number,
  tVal: number
): string => {
  const fDate = new Date(fVal);
  const tDate = new Date(tVal);

  if (win === 'weekly') {
    const fWeek = getISOWeek(fDate).week;
    const tWeek = getISOWeek(tDate).week;

    if (fVal === tVal) {
      return translate('AI Consumption Week {{week}} {{month}} {{year}}', {
        week: fWeek,
        month: monthShort(fDate),
        year: yearShort(fDate)
      });
    }
    return translate(
      'AI Consumption Week {{fromWeek}} {{fromMonth}} {{fromYear}} - Week {{toWeek}} {{toMonth}} {{toYear}}',
      {
        fromWeek: fWeek,
        fromMonth: monthShort(fDate),
        fromYear: yearShort(fDate),
        toWeek: tWeek,
        toMonth: monthShort(tDate),
        toYear: yearShort(tDate)
      }
    );
  }

  if (fVal === tVal) {
    return translate('AI Consumption {{month}} {{year}}', {
      month: monthShort(fDate),
      year: yearShort(fDate)
    });
  }
  return translate('AI Consumption {{fromMonth}} {{fromYear}} - {{toMonth}} {{toYear}}', {
    fromMonth: monthShort(fDate),
    fromYear: yearShort(fDate),
    toMonth: monthShort(tDate),
    toYear: yearShort(tDate)
  });
};

export const formatBudgetIntervalTitle = (translate: TranslateFn, interval: string): string => {
  if (interval === 'weekly') {
    return translate('Budget (weekly)');
  }
  if (interval === 'monthly') {
    return translate('Budget (monthly)');
  }
  return translate('Budget ({{interval}})', { interval });
};

export const formatWeekRangeOptionLabel = (translate: TranslateFn, date: Date, week: number): string =>
  translate('W{{week}} {{month}} {{year}}', {
    week,
    month: monthShort(date),
    year: yearShort(date)
  });

export const formatMonthRangeOptionLabel = (date: Date): string => `${monthShort(date)} ${yearShort(date)}`;

export const buildWeekRangeOptions = (translate: TranslateFn): { label: string; value: number }[] => {
  const options: { label: string; value: number }[] = [];
  const now = new Date();
  const current = new Date(now);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < 52; i++) {
    const d = new Date(current.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const { week } = getISOWeek(d);
    options.push({
      label: formatWeekRangeOptionLabel(translate, d, week),
      value: d.getTime()
    });
  }
  return options;
};

export const buildMonthRangeOptions = (): { label: string; value: number }[] => {
  const options: { label: string; value: number }[] = [];
  const now = new Date();
  const current = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));

  for (let i = 0; i < 24; i++) {
    const d = new Date(current);
    d.setMonth(current.getMonth() - i);
    options.push({
      label: formatMonthRangeOptionLabel(d),
      value: d.getTime()
    });
  }
  return options;
};

export const formatAICost = (value: number, currency = 'USD'): string =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
