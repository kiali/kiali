from __future__ import (absolute_import, division, print_function)
__metaclass__ = type

ANSIBLE_METADATA = {
  'metadata_version': '1.1',
  'status': ['preview'],
  'supported_by': 'community'
}

# Process recursively the given value if it is a dict and remove all keys that have a None value
def strip_none(value):
  if isinstance(value, dict):
    dicts = {}
    for k,v in value.items():
      if isinstance(v, dict):
        dicts[k] = strip_none(v)
      elif v is not None:
        dicts[k] = v
    return dicts
  else:
    return value

# ---- Ansible filters ----
class FilterModule(object):
  def filters(self):
    return {
      'stripnone': strip_none
    }
