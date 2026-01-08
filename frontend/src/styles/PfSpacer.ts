// PatternFly spacing variables are used to maintain consistency with the PF design system.
// Using PF CSS variables ensures that any changes made by PF are picked up when the PF version
// is updated. The preferred, standard way is in CSS styling. In those cases we can directly
// let CSS resolve the PF var. So, whenever possible use the PFSpacer enum below.

// Spacers used by Kiali for CSS styling
// Reference: https://www.patternfly.org/design-foundations/spacers/#patternfly-spacers
export enum PFSpacer {
  // Extra small spacing
  xs = 'var(--pf-t--global--spacer--xs)',
  // Small spacing
  sm = 'var(--pf-t--global--spacer--sm)',
  // Medium spacing
  md = 'var(--pf-t--global--spacer--md)',
  // Large spacing
  lg = 'var(--pf-t--global--spacer--lg)',
  // Extra large spacing
  xl = 'var(--pf-t--global--spacer--xl)',
  // 2x extra large spacing
  '2xl' = 'var(--pf-t--global--spacer--2xl)',
  // 3x extra large spacing
  '3xl' = 'var(--pf-t--global--spacer--3xl)',
  // 4x extra large spacing
  '4xl' = 'var(--pf-t--global--spacer--4xl)'
}
