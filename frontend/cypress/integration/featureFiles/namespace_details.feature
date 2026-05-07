@namespace-details
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Namespace Details page

  On the Namespace Details page, the user should see an overview card with namespace
  attributes, a resources card with links and health breakdowns, labels, annotations,
  and a minigraph for traffic in the namespace.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "bookinfo" namespace

  @bookinfo-app
  @core-2
  @offline
  Scenario: See namespace detail overview
    Then user sees the namespace detail overview for "bookinfo"
    And user sees the title "bookinfo" in the namespace detail page

  @bookinfo-app
  @core-2
  @offline
  Scenario: See namespace details card attributes
    Then the details card has a "Status" entry
    And the details card has a "Type" entry
    And the details card has a "Mode" entry

  @bookinfo-app
  @core-2
  @offline
  Scenario: See namespace resources card
    Then user sees the "Resources" card
    And user sees resource links for "Applications"
    And user sees resource links for "Services"
    And user sees resource links for "Workloads"
    And user sees resource links for "Istio config"

  @bookinfo-app
  @core-2
  @offline
  Scenario: See namespace labels card
    Then user sees the "Labels" card

  @bookinfo-app
  @core-2
  @offline
  Scenario: See namespace annotations card
    Then user sees the "Annotations" card

  @bookinfo-app
  @core-2
  Scenario: See namespace minigraph
    Then user sees a minigraph
