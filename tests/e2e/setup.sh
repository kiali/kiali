#!/bin/bash

HOME=`pwd`

yum install python-virtualenv  -y

# Setup virtual environment
virtualenv .kiali-e2e
source .kiali-e2e/bin/activate

# Install base requirements
pip install -U pip
pip install -r requirements.txt

# Needed for RHEL7
cat /etc/os-release | grep -q "Red Hat Enterprise Linux"
if [ $? -eq "0" ]
then
    echo -e "\nInstalling RHEL dependencies..."
    pip install setuptools --upgrade
fi
