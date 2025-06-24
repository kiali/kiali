#!/bin/bash
# this file will run stern loggin binary on istio (upstream) or service mesh (downstream) containers + demo apps 

# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR"

run_stern() {
    local resource="$1"
    local namespace="$2"
    bash -c "exec -a sternLogs \"$SCRIPT_DIR/stern\" $resource $namespace --tail 0 --only-log-lines --max-log-requests 150 >> log.log 2>&1" &
}

run_stern "kiali" "-n istio-system"
run_stern "kiali" "-n kiali-operator"
run_stern "bookinfo" "-n istio-system" 
run_stern "istiod" "-n istio-system"
run_stern "istio-ingressgateway" "-n istio-system"
# log namespace per testcase? i.e. gherkin annotation with @bookinfo
# run_stern "server" "-A"
# run_stern "client" "-A"

echo "----------- end of the scenario ----------" >> log.log
