import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const buttonClick = (id: string): void => {
  cy.get(`button#${id}`).click();
};

const buttonPrepare = (id: string, active: boolean): void => {
  cy.waitForReact();

  cy.get(`button#${id} .pf-v6-c-icon__content`)
    .should('have.length', '1')
    .then(el => {
      const isActive = el.hasClass('pf-m-custom');
      if (isActive !== active) {
        buttonClick(id);
      }
    });
};

const buttonState = (id: string, active: boolean): void => {
  cy.waitForReact();

  const selector = `button#${id} .pf-v6-c-icon__content`;
  cy.get(selector)
    .should('have.length', '1')
    .then(el => {
      if (active) {
        cy.wrap(el).should('have.class', 'pf-m-custom');
      } else {
        cy.wrap(el).should('not.have.class', 'pf-m-custom');
      }
    });
};

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
