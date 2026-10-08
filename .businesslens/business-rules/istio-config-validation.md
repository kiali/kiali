---
appliesTo:
- type: entity
  id: istio-config
  facts: [Validation]
references:
- kind: code
  role: implementation
  target: business/istio_validations.go
- kind: code
  role: implementation
  target: business/checkers/authorization_policies_checker.go
- kind: code
  role: implementation
  target: controller/validations.go
---

# Every Istio config object carries Kiali's validation findings

Kiali checks every Istio config object against the rest of the mesh — missing hosts, subsets or service accounts, conflicting gateways, uncovered workloads and many more — and reports each problem as an error, warning or info with its code. It rechecks everything at the validation interval and after each change, never reports ignored validation codes or checks an object annotated to skip them, and checks nothing when the interval is zero.
