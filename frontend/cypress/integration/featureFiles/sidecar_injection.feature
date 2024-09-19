@sidecar-injection
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Controlling sidecar injection
	In Istio, at installation it is possible to set a default policy for automatic sidecar
	injection. In addition to the default policy, automatic sidecar injection can be
	controlled at namespace level and also at deployment level for more specific control.
	Kiali should provide the needed controls to override the default policy at namespace
	and deployment levels. Annotations are used to override the default policy and
	Kiali should reflect these annotations.

	Background:
		Given user is at administrator perspective

	@sleep-app
	Scenario: Override the default policy for automatic sidecar injection by enabling it in a namespace
		Given a namespace without override configuration for automatic sidecar injection
		When I visit the overview page
		And user filters "sleep" namespace
		And I override the default automatic sidecar injection policy in the namespace to enabled
		Then I should see the override annotation for sidecar injection in the namespace as "enabled"

	@sleep-app
	Scenario: Switch the override configuration for automatic sidecar injection in a namespace to disabled
		Given a namespace which has override configuration for automatic sidecar injection
		And the override configuration for sidecar injection is "enabled"
		When I visit the overview page
		And user filters "sleep" namespace
		And I change the override configuration for automatic sidecar injection policy in the namespace to "disable" it
		Then I should see the override annotation for sidecar injection in the namespace as "disabled"

	@sleep-app
	Scenario: Switch the override configuration for automatic sidecar injection in a namespace to enabled
		Given a namespace which has override configuration for automatic sidecar injection
		And the override configuration for sidecar injection is "disabled"
		When I visit the overview page
		And user filters "sleep" namespace
		And I change the override configuration for automatic sidecar injection policy in the namespace to "enable" it
		Then I should see the override annotation for sidecar injection in the namespace as "enabled"

	@sleep-app
	Scenario: Switch to using the default policy for automatic sidecar injection in a namespace
		Given a namespace which has override configuration for automatic sidecar injection
		When I visit the overview page
		And user filters "sleep" namespace
		And I remove override configuration for sidecar injection in the namespace
		Then I should see no override annotation for sidecar injection in the namespace

	@sleep-app
	Scenario: Override the default policy for automatic sidecar injection by enabling it in a workload
		Given a workload without a sidecar
		And the workload does not have override configuration for automatic sidecar injection
		When I override the default policy for automatic sidecar injection in the workload to "enable" it
		Then the workload should get a sidecar

	@sleep-app
	Scenario: Override the default policy for automatic sidecar injection by disabling it in a workload
		Given a workload with a sidecar
		And the workload does not have override configuration for automatic sidecar injection
		When I override the default policy for automatic sidecar injection in the workload to "disable" it
		Then the sidecar of the workload should vanish

	@sleep-app
	Scenario: Switch the override configuration for automatic sidecar injection in a workload to disabled
		Given a workload with a sidecar
		And the workload has override configuration for automatic sidecar injection
		When I change the override configuration for automatic sidecar injection in the workload to "disable" it
		Then the sidecar of the workload should vanish

	@sleep-app
	Scenario: Switch the override configuration for automatic sidecar injection in a workload to enabled
		Given a workload without a sidecar
		And the workload has override configuration for automatic sidecar injection
		When I change the override configuration for automatic sidecar injection in the workload to "enable" it
		Then the workload should get a sidecar

	@sleep-app
	Scenario: Remove override configuration for automatic sidecar injection in a workload
		Given a workload with override configuration for automatic sidecar injection
		When I remove override configuration for sidecar injection in the workload
		Then I should see no override annotation for sidecar injection in the workload
