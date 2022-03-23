export const fromValue = (enumType: any, value: any, defaultValue: any) => {
  const enumKey = Object.keys(enumType).find(key => enumType[key] === value);
  if (enumKey !== undefined) {
    return enumType[enumKey];
  }
  return defaultValue;
};
