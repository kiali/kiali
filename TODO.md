todolist how to iprove skills located in  .claude/skills/regression*

- when creating github issue, the prefix [Flake] or [Regression] should be used. Each one will address different problem 

- in regression triage when triaging jenkins or fialed local run, the artifacts should be pulled same way into same place. in jenkins we run command "cypress:run:junit" and this command produces artifact in the kiali project folder that are archived later. if they are not available you can pull them from jenkins but into same place as they would exist if "cypress:run:junit" is executed. this way we can unify one flow independent on environment 

- 