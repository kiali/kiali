import { And, Then } from '@badeball/cypress-cucumber-preprocessor';

And("cluster badge for {string} cluster should be visible",(cluster:string)=>{
    cy.get("#pfbadge-C").parent().contains(cluster).should("be.visible");
});
