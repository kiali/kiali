export const fromValue = <EnumType>(enumType: EnumType, value: any, defaultValue: any) => {
  const found: EnumType = enumType[value] as EnumType;
  if (found !== undefined) {
    return found;
  }
  return defaultValue;
};
