export const ZoomOptions = {
  fitPadding: 25
};

export const safeFit = (cy: any) => {
  cy.fit('', ZoomOptions.fitPadding);
  if (cy.zoom() > 2.5) {
    cy.zoom(2.5);
    cy.center();
  }
};
