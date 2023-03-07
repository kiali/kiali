Feature: Kiali help dropdown verify

  User wants to verify the Kiali help about information
  
  Background: 
    Given user is at administrator perspective
    And user is at the "overivew" page
    When user clicks on Help Button

  @smoke    
  Scenario: Open Kiali help dropdown
    Then user can see all of the Help dropdown options
      | Documentation | View Debug Info | View Certificates Info | About |
    And the "Documentation" button has a link

  @smoke
  Scenario: User opens the View Debug Info section
    When user clicks on the "View Debug Info" button
    Then user sees the "Debug information" modal

  @smoke
  Scenario: User opens the View Certificates Info section
    When user clicks on the "View Certificates Info" button
    Then user sees the "Certificates information" modal
