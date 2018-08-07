import * as Enum from '../Enum';

enum StringEnum {
  A = 'A',
  B = 'B',
  C = 'C',
  F = 'F'
}

enum IntegerEnum {
  A = 1,
  B = 2,
  C = 3,
  F = 6
}

enum MixedEnum {
  A = 'A',
  B = 2,
  C = 'C',
  F = 6
}

describe('Enum.fromValue', () => {
  it('works for string enums', () => {
    expect(Enum.fromValue(StringEnum, 'A', StringEnum.B)).toEqual(StringEnum.A);
  });
  it('works for integer enums', () => {
    expect(Enum.fromValue(IntegerEnum, 1, IntegerEnum.B)).toEqual(IntegerEnum.A);
  });
  it('works for mixed enums', () => {
    expect(Enum.fromValue(MixedEnum, 'A', MixedEnum.F)).toEqual(MixedEnum.A);
    expect(Enum.fromValue(MixedEnum, 2, MixedEnum.F)).toEqual(MixedEnum.B);
  });

  it('get default if not found', () => {
    expect(Enum.fromValue(StringEnum, 'X', StringEnum.B)).toEqual(StringEnum.B);
  });
});
