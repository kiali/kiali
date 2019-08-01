# Running Kiali Operator E2E

Molecule is the default way to [test ansible operators](https://github.com/operator-framework/operator-sdk/blob/master/doc/ansible/dev/testing_guide.md) but not limited to it.


## Dependencies 
In order to deploy the depencencies run the following command `pip install -r requirements.txt` (considering that you are on kiali/operator/molecule path).


## Running Test Scenarios

Molecule ships a `default` test scenario which allows to run using `molecule test`. That will run the following stages

   - prepare (install stage) 
   - converge (test stage)
   - destroy stage (uinstall stage)

If you want to run just the prepare stage you can use `molecule prepare` and if you want to run the destroy stage run `molecule destroy`.

If you want to run without the destroy, you can run with `molecule test --destroy never`.


For other scenarios than default, you can run `molecule test -s scenario_name` where scenario name is configured on molecule.yml of scenario_name folder under the molecule folder.

Eg: `molecule test -s maistra-e2e` will run the multi-tenancy scenario.


For all the scenarios use `molecule test --all`.

For debugging use `molecule --debug  test` (it needs to be before the verb - test, prepare, destroy)
