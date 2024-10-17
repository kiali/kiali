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

Then('the toggle button {string} is enabled in the cytoscape graph', (label: string) => {
  cy.get(`button[aria-label="${label}"]`).should('have.attr', 'aria-disabled', 'false');
});

When('the button {string} is clicked in the cytoscape graph', (label: string) => {
  buttonClick(label);
});

Then('the button {string} is active in the cytoscape graph', (label: string) => {
  buttonState(label, true);
});

Then('the button {string} is not active in the cytoscape graph', (label: string) => {
  buttonState(label, false);
});

Then('the {string} is turned on in the cytoscape graph', (label: string) => {
  buttonPrepare(label, true);
});

Then('the {string} is turned off in the cytoscape graph', (label: string) => {
  buttonPrepare(label, false);
});

When('the Legend section is visible in the cytoscape graph', () => {
  buttonClick('Show Legend');
});
