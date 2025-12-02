import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const buttonClick = (id: string): void => {
  cy.get(`button#${id}`).click();
};

const buttonPrepare = (id: string, active: boolean): void => {
  cy.waitForReact();

  // Check that button has a span.pf-v6-c-icon child with length 1
  cy.get(`button#${id} span.pf-v6-c-icon`)
    .should('have.length', '1');

  // Check if current state matches desired state by looking at pf-m-custom class
  cy.get(`button#${id} span.pf-v6-c-icon span.pf-v6-c-icon__content`).then($content => {
    const hasCustomClass = $content.hasClass('pf-m-custom');
    // If state doesn't match, click to toggle
    if (hasCustomClass !== active) {
      buttonClick(id);
    }
  });
};

const buttonState = (id: string, active: boolean): void => {
  cy.waitForReact();

  // Check that button has a span.pf-v6-c-icon child with length 1
  cy.get(`button#${id} span.pf-v6-c-icon`)
    .should('have.length', '1');

  // Inside span.pf-v6-c-icon, check if span.pf-v6-c-icon__content has pf-m-custom class
  if (active) {
    // Active: span should have both pf-v6-c-icon__content and pf-m-custom classes
    cy.get(`button#${id} span.pf-v6-c-icon span.pf-v6-c-icon__content`)
      .should('have.class', 'pf-m-custom');
  } else {
    // Inactive: span should have pf-v6-c-icon__content but NOT pf-m-custom
    cy.get(`button#${id} span.pf-v6-c-icon span.pf-v6-c-icon__content`)
      .should('not.have.class', 'pf-m-custom');
  }
};

// Need to Fix. aria-disabled is not the correct attribute to check if the button is enabled in PF6
Then('the toggle button {string} is enabled', (id: string) => {
  cy.get(`button#${id}`).should('be.enabled');
});

When('the button {string} is clicked', (id: string) => {
  buttonClick(id);
});

Then('the button {string} is active', (id: string) => {
  buttonState(id, true);
});

Then('the button {string} is not active', (id: string) => {
  buttonState(id, false);
});

Then('the {string} is turned on', (id: string) => {
  buttonPrepare(id, true);
});

Then('the {string} is turned off', (id: string) => {
  buttonPrepare(id, false);
});

Then('user can see the legend section', () => {
  cy.get("[data-test='graph-legend']").should('be.visible');
});

When('the Legend section is visible', () => {
  buttonClick('legend');
});

When('the cross is clicked', () => {
  cy.get('#legend_close').click();
});

Then('user cannot see the legend section', () => {
  cy.get("[data-test='graph-legend']").should('not.exist');
});
