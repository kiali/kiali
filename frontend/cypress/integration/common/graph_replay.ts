import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user presses the Replay button', () => {
  cy.get('button[data-test="graph-replay-button"]').click();
});

Then('user sees the Replay Close button', () => {
  cy.get('button[data-test="graph-replay-close-button"]').should('be.visible');
});

Then('user presses the Play button', () => {
  cy.get('button[data-test="graph-replay-play-button"]').click();
});

Then('user sees the slider', () => {
  cy.get('div[id="replay-slider"]').should('be.visible');
});

Then('user presses the {string} speed button', speed => {
  cy.get(`button[data-test="speed-${speed}"]`).click();
});

Then('user presses the Pause button', () => {
  cy.get('button[data-test="graph-replay-pause-button"]').click();
});

When('user presses the Replay Close button', () => {
  cy.get('button[data-test="graph-replay-close-button"]').click();
});

Then('user no longer sees the slider', () => {
  cy.get('div[id="replay-slider"]').should('not.exist');
});
