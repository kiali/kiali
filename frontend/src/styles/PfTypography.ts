// PatternFly typography variables are used to maintain consistency with the PF design system.
// Using PF CSS variables ensures that any changes made by PF are picked up when the PF version
// is updated. The preferred, standard way is in CSS styling. In those cases we can directly
// let CSS resolve the PF var. So, whenever possible use the PFFontSize and PFFontWeight enums below.

// Font sizes used by Kiali for CSS styling
// Reference: https://www.patternfly.org/design-foundations/typography
export enum PFFontSize {
  default = 'var(--pf-t--global--font--size--body--default)',
  large = 'var(--pf-t--global--font--size--body--lg)',
  small = 'var(--pf-t--global--font--size--body--sm)'
}

// Font weights used by Kiali for CSS styling
// Reference: https://www.patternfly.org/design-foundations/typography
export enum PFFontWeight {
  BodyBold = 'var(--pf-t--global--font--weight--body--bold)',
  BodyDefault = 'var(--pf-t--global--font--weight--body--default)',
  HeadingBold = 'var(--pf-t--global--font--weight--heading--bold)',
  HeadingDefault = 'var(--pf-t--global--font--weight--heading--default)'
}
