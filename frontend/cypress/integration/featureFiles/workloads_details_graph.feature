@workload-details
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Workload Details page

  On the Workload Details page, the user should see the details of a workload as well as
  a minigraph for traffic going to and originating from the workload. In addition,
  there should be tabs for viewing workload specific traffic, inbound/outbound metrics, traces and Envoy information, including metrics.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/details-v1" located in the "" cluster

  @bookinfo-app
  @base
  Scenario: See minigraph for workload.
    Then user sees a minigraph