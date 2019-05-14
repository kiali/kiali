describe('Should check a complex regexp name', () => {
  const regexp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

  it('should check valid name', () => {
    const result = 'valid-name.namespace'.search(regexp);
    expect(result).toBe(0);
  });

  it('should check an invalid name', () => {
    let result = 'Invalid-name.namespace'.search(regexp);
    expect(result).toBe(-1);

    result = '-invalid-name.namespace'.search(regexp);
    expect(result).toBe(-1);

    result = 'invalid-name.namespace-'.search(regexp);
    expect(result).toBe(-1);

    result = 'invalid-name.namespace.'.search(regexp);
    expect(result).toBe(-1);
  });
});
