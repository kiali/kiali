
@graph-display-user
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Display menu for non-admin users

  Non-admin user opens the Graph page and manipulates the graph

  Background:
    Given user is at limited user perspective

  # This is a regression test for this bug (https://github.com/kiali/kiali/issues/6185)
  # This is only multi-primary because that is the suite that has openid setup.
  @multi-cluster
  @multi-primary
  Scenario: Remote nodes should be restricted if user does not have access rights to a remote namespace
    When user graphs "bookinfo" namespaces
    Then the nodes located in the "west" cluster should be restricted
