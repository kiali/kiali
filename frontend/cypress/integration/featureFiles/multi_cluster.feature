Feature: Kiali Overview page

  User opens the Overview page and sees the bookinfo apps across both clusters.

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @overview-page
  @multi-cluster
  Scenario: See "bookinfo" in "east" and "west" clusters
    Then user sees the "bookinfo" namespace card in cluster "east"
    And user sees the "bookinfo" namespace card in cluster "west"
