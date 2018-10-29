import os
from subprocess import PIPE, Popen

class command_exec():

  def oc_apply(yaml_file, namespace):
    add_command_text = "oc apply -n " + namespace + " -f " + os.path.abspath(os.path.realpath(yaml_file))
    add_command_result = os.popen(add_command_text).read()
    return add_command_result.__contains__("created") or add_command_result.__contains__("configured")

  def oc_delete(yaml_file, namespace):
    delete_command_text = "oc delete -n " + namespace + " -f " + os.path.abspath(os.path.realpath(yaml_file) + " 2> /dev/null")
    delete_command_result = os.popen(delete_command_text).read()
    return delete_command_result.__contains__("deleted")

  def oc_delete_kiali_permissions_from_cluster(self):
    cmd = 'oc delete clusterrolebindings kiali'
    stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
    return 'deleted' in stdout.decode() or 'clusterrolebindings.authorization.openshift.io "kiali" not found' in stderr.decode()

  def oc_add_kaili_permissions_to_cluster(self):
    cmd = "oc adm policy add-cluster-role-to-user kiali system:serviceaccount:istio-system:kiali"
    #result = os.popen(cmd).read()
    stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
    return 'added' in stdout.decode()
