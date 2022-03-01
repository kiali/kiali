describe('Graph page', () => {
  it('opens the graph page', () => {
    cy.visit('/console/graph/namespaces/?refresh=0');
  });
});
