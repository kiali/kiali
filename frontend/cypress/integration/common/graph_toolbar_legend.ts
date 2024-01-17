import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const buttonClick = (label: string): void => {
  cy.get(`button[aria-label="${label}"]`).click();
};

const buttonPrepare = (label: string, active: boolean): void => {
  cy.waitForReact();

  cy.getReact('Button', { props: { 'aria-label': `${label}` } })
    .should('have.length', '1')
    .getProps()
    .then(props => {
      if (props.isActive !== active) {
        buttonClick(label);
      }
    });
};

const buttonState = (label: string, active: boolean): void => {
  cy.waitForReact();

  cy.getReact('Button', { props: { 'aria-label': `${label}` } })
    .should('have.length', '1')
    .getProps('isActive')
    .should('eq', active);
};

Then('the toggle button {string} is enabled', (label: string) => {
  cy.get(`button[aria-label="${label}"]`).should('have.attr', 'aria-disabled', 'false');
});

When('the button {string} is clicked', (label: string) => {
  buttonClick(label);
});

Then('the button {string} is active', (label: string) => {
  buttonState(label, true);
});

Then('the button {string} is not active', (label: string) => {
  buttonState(label, false);
});

Then('the {string} is turned on', (label: string) => {
  buttonPrepare(label, true);
});

Then('the {string} is turned off', (label: string) => {
  buttonPrepare(label, false);
});

Then('user can see the legend section', () => {
  cy.get("[data-test='graph-legend']").should('be.visible');
});

When('the Legend section is visible', () => {
  buttonClick('Show Legend');
});

When('the cross is clicked', () => {
  cy.get('#legend_close').click();
});

Then('user cannot see the legend section', () => {
  cy.get("[data-test='graph-legend']").should('not.exist');
});
