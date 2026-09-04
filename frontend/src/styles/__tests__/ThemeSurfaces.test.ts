import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';
import { contrastOverlayNest, contrastContentNest, contrastPanelNest } from '../ThemeSurfaces';

describe('ThemeSurfaces', () => {
  it('contrastOverlayNest defines sticky glass and high-contrast surfaces', () => {
    const nest = contrastOverlayNest();

    expect(nest?.[`html.${PF_THEME_GLASS} &`]).toBeDefined();
    expect(nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`]).toBeDefined();
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { backdropFilter?: string }).backdropFilter).toBe('none');
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { backgroundColor?: string }).backgroundColor).toBe(
      'var(--pf-t--global--background--color--sticky--default)'
    );
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { boxShadow?: string }).boxShadow).toBe(
      'var(--pf-t--global--box-shadow--glass--default)'
    );
  });

  it('allows glass and highContrast overrides (same keys replace)', () => {
    const nest = contrastOverlayNest({
      glass: { opacity: 0.9, boxShadow: 'none' },
      highContrast: { borderWidth: '2px' }
    });

    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { opacity?: number }).opacity).toBe(0.9);
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { boxShadow?: string }).boxShadow).toBe('none');
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { borderWidth?: string }).borderWidth).toBe('2px');
  });

  it('contrastContentNest is transparent under glass', () => {
    const nest = contrastContentNest();

    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { backgroundColor?: string }).backgroundColor).toBe('transparent');
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { boxShadow?: string }).boxShadow).toBe('none');
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { border?: string }).border).toBe('none');
  });

  it('contrastPanelNest removes soft shadows under high contrast', () => {
    const nest = contrastPanelNest();

    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
  });
});
