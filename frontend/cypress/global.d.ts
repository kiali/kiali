/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    selectAllNamespaces(): Chainable<any>;
  }
}
