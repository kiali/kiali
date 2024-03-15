#!/bin/bash

##########################################################
#
# Defines some simple functions for logging messages.
#
##########################################################

# to make our own log messages standout
errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}
