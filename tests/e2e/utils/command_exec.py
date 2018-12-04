import os
from subprocess import PIPE, Popen

KIALI_ACCOUNT_NAME = 'kiali'

class command_exec():

  def oc_apply(yaml_file, namespace):
      add_command_text = "oc apply -n " + namespace + " -f " + yaml_file
      add_command_result = os.popen(add_command_text).read()
      return add_command_result.__contains__("created") or add_command_result.__contains__("configured")

  def oc_delete(yaml_file, namespace):
      delete_command_text = "oc delete -n " + namespace + " -f " + yaml_file 
      delete_command_result = os.popen(delete_command_text).read()
      return delete_command_result.__contains__("deleted")

  def oc_remove_cluster_role_rom_user_kiali(self):
      cmd = 'oc adm policy remove-cluster-role-from-user kiali system:serviceaccount:istio-system:{}'.format(KIALI_ACCOUNT_NAME)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'cluster role \"{}\" removed'.format(KIALI_ACCOUNT_NAME) in stdout.decode():
          return True
      else:
          print("Error remove-cluster-role-from-user for \"{}\": {}".format(KIALI_ACCOUNT_NAME, stderr.decode()))
          return False

  def oc_add_cluster_role_to_user_kiali(self):
      cmd = 'oc adm policy add-cluster-role-to-user kiali system:serviceaccount:istio-system:{}'.format(KIALI_ACCOUNT_NAME)
      stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
      if 'cluster role \"{}\" added'.format(KIALI_ACCOUNT_NAME) in stdout.decode():
          return True
      else:
          print("Error add-cluster-role-to-user for \"{}\": {}".format(KIALI_ACCOUNT_NAME, stderr.decode()))
          return False
