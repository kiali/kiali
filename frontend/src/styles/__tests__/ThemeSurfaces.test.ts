import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';
import { glassHighContrastSurfaceNest, highContrastNoShadowNest } from '../ThemeSurfaces';

describe('ThemeSurfaces', () => {
  it('defines glass and high-contrast nested selectors', () => {
    const nest = glassHighContrastSurfaceNest();

    expect(nest?.[`html.${PF_THEME_GLASS} &`]).toBeDefined();
    expect(nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`]).toBeDefined();
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { backdropFilter?: string }).backdropFilter).toContain('blur');
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
  });

  it('allows glass overrides', () => {
    const nest = glassHighContrastSurfaceNest({
      glass: { opacity: 0.9 }
    });

    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { opacity?: number }).opacity).toBe(0.9);
  });

  it('defines high-contrast no-shadow nest', () => {
    const nest = highContrastNoShadowNest();

    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
  });
});
