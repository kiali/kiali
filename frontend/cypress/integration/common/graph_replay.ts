import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Before(() => {
  // Copied from overview.ts.  This prevents cypress from stopping on errors unrelated to the tests.
  // There can be random failures due timeouts/loadtime/framework that throw browser errors.  This
  // prevents a CI failure due something like a "slow".  There may be a better way to handle this.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

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
