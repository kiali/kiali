FROM quay.io/operator-framework/ansible-operator:v0.10.0

COPY roles/ ${HOME}/roles/
COPY playbooks/ ${HOME}/playbooks/
COPY watches.yaml ${HOME}/watches.yaml

# Add things required by the operator not available in the base ansible operator image
USER root
RUN pip install jmespath
USER 1001
