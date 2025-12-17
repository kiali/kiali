// PatternFly typography variables are used to maintain consistency with the PF design system.
// Using PF CSS variables ensures that any changes made by PF are picked up when the PF version
// is updated. The preferred, standard way is in CSS styling. In those cases we can directly
// let CSS resolve the PF var. So, whenever possible use the PFFontSize and PFFontWeight enums below.

// Font sizes used by Kiali for CSS styling
// Reference: https://www.patternfly.org/design-foundations/typography
export enum PFFontSize {
  size12 = '12px',
  size14 = '14px',
  size16 = '16px'
}

// Font weights used by Kiali for CSS styling
// Reference: https://www.patternfly.org/design-foundations/typography
export enum PFFontWeight {
  Regular = 400,
  Semibold = 600,
  Bold = 700
}
