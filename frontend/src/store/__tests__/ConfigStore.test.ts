import { ColorScheme, ContrastMode, Language, Theme } from 'types/Common';
import { migratePersistedGlobalState } from '../ConfigStore';
import { INITIAL_GLOBAL_STATE } from '../../reducers/GlobalState';

describe('migratePersistedGlobalState', () => {
  it('migrates legacy theme light/dark to colorScheme', () => {
    const migrated = migratePersistedGlobalState({ theme: ColorScheme.DARK });

    expect(migrated.colorScheme).toBe(ColorScheme.DARK);
    expect(migrated.theme).toBe(Theme.DEFAULT);
  });

  it('preserves felt theme variant', () => {
    const migrated = migratePersistedGlobalState({ theme: Theme.FELT });

    expect(migrated.theme).toBe(Theme.FELT);
    expect(migrated.colorScheme).toBe(INITIAL_GLOBAL_STATE.colorScheme);
  });

  it('keeps stable contrast mode values', () => {
    const migrated = migratePersistedGlobalState({ contrastMode: ContrastMode.HIGH_CONTRAST });

    expect(migrated.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
  });

  it('preserves system color scheme preference', () => {
    const migrated = migratePersistedGlobalState({ colorScheme: ColorScheme.SYSTEM });

    expect(migrated.colorScheme).toBe(ColorScheme.SYSTEM);
  });

  it('preserves system contrast mode preference', () => {
    const migrated = migratePersistedGlobalState({ contrastMode: ContrastMode.SYSTEM });

    expect(migrated.contrastMode).toBe(ContrastMode.SYSTEM);
  });

  it('preserves system language preference', () => {
    const migrated = migratePersistedGlobalState({ language: Language.SYSTEM });

    expect(migrated.language).toBe(Language.SYSTEM);
  });

  it('resets invalid persisted language to the initial value', () => {
    const migrated = migratePersistedGlobalState({ language: 'fr' });

    expect(migrated.language).toBe(INITIAL_GLOBAL_STATE.language);
  });
});
