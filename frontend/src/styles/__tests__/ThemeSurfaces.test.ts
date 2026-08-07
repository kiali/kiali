import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';
import { contrastNoShadowNest, contrastSurfaceNest } from '../ThemeSurfaces';

describe('ThemeSurfaces', () => {
  it('defines glass and high-contrast nested selectors', () => {
    const nest = contrastSurfaceNest();

    expect(nest?.[`html.${PF_THEME_GLASS} &`]).toBeDefined();
    expect(nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`]).toBeDefined();
    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { backdropFilter?: string }).backdropFilter).toBe('none');
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
  });

  it('allows glass and contrast overrides', () => {
    const nest = contrastSurfaceNest({
      glass: { opacity: 0.9 },
      contrast: { borderWidth: '2px' }
    });

    expect((nest?.[`html.${PF_THEME_GLASS} &`] as { opacity?: number }).opacity).toBe(0.9);
    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { borderWidth?: string }).borderWidth).toBe('2px');
  });

  it('defines high-contrast no-shadow nest', () => {
    const nest = contrastNoShadowNest();

    expect((nest?.[`html.${PF_THEME_HIGH_CONTRAST} &`] as { boxShadow?: string }).boxShadow).toBe('none');
  });
});
