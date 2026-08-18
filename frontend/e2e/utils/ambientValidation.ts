/** Ambient L7 validation codes — baseline bookinfo should not produce these warnings. */

const ambientL7ValidationCodes = new Set([
  'KIA0109',
  'KIA0110',
  'KIA0210',
  'KIA0211',
  'KIA0212',
  'KIA1109',
  'KIA1110',
  'KIA1111',
  'KIA1112',
  'KIA1113',
  'KIA1114',
  'KIA1115',
  'KIA1116',
  'KIA1117',
  'KIA1317'
]);

export const collectAmbientL7Warnings = (validations: Record<string, unknown> | undefined): string[] => {
  const found: string[] = [];
  Object.keys(validations ?? {}).forEach(gvk => {
    const byName =
      (validations?.[gvk] as Record<string, { checks?: Array<{ code?: string; message?: string }> }>) ?? {};
    Object.keys(byName).forEach(nameKey => {
      const entry = byName[nameKey];
      const checks = entry?.checks ?? [];
      checks.forEach(check => {
        if (check.code && ambientL7ValidationCodes.has(check.code)) {
          found.push(`${gvk}/${nameKey}: ${check.code} ${check.message ?? ''}`.trim());
        }
      });
    });
  });
  return found;
};
