import os
from subprocess import PIPE, Popen
from utils.timeout import timeout
import time

KIALI_ACCOUNT_NAME = 'kiali-service-account'

class command_exec():

  def oc_apply(yaml_file, namespace):
    add_command_text = "oc apply -n " + namespace + " -f " + yaml_file
    stdout, stderr = Popen(add_command_text, shell=True, stdout=PIPE, stderr=PIPE).communicate()
    return "created" in stdout.decode() or "configure" in stdout.decode()

  def oc_delete(yaml_file, namespace):
    delete_command_text = "oc delete -n " + namespace + " -f " + yaml_file
    stdout, stderr = Popen(delete_command_text, shell=True, stdout=PIPE, stderr=PIPE).communicate()
    return "deleted" in stdout.decode()

  def oc_remove_cluster_role_rom_user_kiali(self):
      cmd = 'oc adm policy remove-cluster-role-from-user kiali system:serviceaccount:istio-system:{}'.format(KIALI_ACCOUNT_NAME)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'cluster role \"kiali\" removed' in stdout.decode():
          return True
      else:
          print("Error remove-cluster-role-from-user for \"{}\": {}".format(KIALI_ACCOUNT_NAME, stderr.decode()))
          return False

  def oc_add_cluster_role_to_user_kiali(self):
      cmd = 'oc adm policy add-cluster-role-to-user kiali system:serviceaccount:istio-system:{}'.format(KIALI_ACCOUNT_NAME)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'cluster role \"kiali\" added'.format(KIALI_ACCOUNT_NAME) in stdout.decode():
          return True
      else:
          print("Error add-cluster-role-to-user for \"{}\": {}".format(KIALI_ACCOUNT_NAME, stderr.decode()))
          return False

  def oc_get_kiali_configmap(self, file):
      cmd = 'oc get cm kiali -o yaml -n istio-system > {}'.format(file)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'not found' not in stdout.decode() and len(stderr.decode()) == 0:
          return True
      else:
          return False

  def oc_delete_kiali_config_map(self):
      cmd = 'oc delete cm kiali -n istio-system'
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'deleted' not in stdout.decode() or 'Error' in stderr.decode():
          return False

      return True

  def oc_create_kiali_config_map(self, file, remove_file = False):
      cmd = 'oc create -f {} -n istio-system'.format(file)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'created' not in stdout.decode() or 'Error' in stderr.decode():
          print ("{}".format(stderr.decode()))
          return False

      if remove_file:
          cmd = 'rm -f {}'.format (file)
          Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()

      return True


  def oc_delete_kiali_pod(self):
      cmd = "oc delete pod -n istio-system `oc get pods -n istio-system | grep kiali | awk '{print $1;}'`"
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'deleted' not in stdout.decode() or 'Error' in stderr.decode():
          return False

      return True

  def oc_wait_for_kiali_state(self, state):
      cmd = "oc get pods -n istio-system | grep kiali | awk '{print $3;}'"

      with timeout(seconds=120, error_message='Timed out waiting for Kiali state: {}'.format(state)):
          while True:
              stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
              if state in stdout.decode():
                  # Allow container time to init
                  time.sleep(3)
                  break

              time.sleep(2)

      return True
