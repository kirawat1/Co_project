const { validatePassword } = require('../utils/validatePassword');

describe('validatePassword', () => {
  test('rejects password shorter than 8 chars', () => {
    expect(validatePassword('Abc1!')).not.toBeNull();
  });
  test('rejects password with no uppercase', () => {
    expect(validatePassword('abcdef1!')).not.toBeNull();
  });
  test('rejects password with no lowercase', () => {
    expect(validatePassword('ABCDEF1!')).not.toBeNull();
  });
  test('rejects password with no digit', () => {
    expect(validatePassword('Abcdefg!')).not.toBeNull();
  });
  test('rejects password with no special character', () => {
    expect(validatePassword('Abcdef1g')).not.toBeNull();
  });
  test('accepts valid password', () => {
    expect(validatePassword('Secure1!')).toBeNull();
  });
  test('accepts valid password with Thai-adjacent special chars', () => {
    expect(validatePassword('Hello1@world')).toBeNull();
  });
});
