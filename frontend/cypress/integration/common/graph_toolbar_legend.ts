import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const ACTIVE_COLOR = 'rgb(0, 102, 204)';
const INACTIVE_COLOR = 'rgb(21, 21, 21)';

const buttonClick = (id: string): void => {
  cy.get(`button#${id}`).click();
};

const buttonPrepare = (id: string, active: boolean): void => {
  cy.waitForReact();

  cy.get(`button#${id} > span.pf-v6-c-icon`)
    .should('have.length', '1')
    .then(el => {
      cy.log(el.css('color'));
      if (el.css('color') !== (active ? ACTIVE_COLOR : INACTIVE_COLOR)) {
        buttonClick(id);
      }
    });
};

const buttonState = (id: string, active: boolean): void => {
  cy.waitForReact();

  cy.get(`button#${id} > span.pf-v6-c-icon`)
    .should('have.length', '1')
    .should('have.css', 'color', `${active ? ACTIVE_COLOR : INACTIVE_COLOR}`);
};

Then('the toggle button {string} is enabled', (id: string) => {
  cy.get(`button#${id}`).should('have.attr', 'aria-disabled', 'false');
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
