from kiali import KialiClient
def main(): 
    module = AnsibleModule(
        argument_spec=dict(
            kiali_api_hostname= dict(
                default=os.environ.get('KIALI_HOSTNAME'), type='str'),
            
            kiali_api_port= dict(
                default=os.environ.get('KIALI_PORT'), type='int'),
            
            kiali_api_username=dict(
                default=os.environ.get('KIALI_USERNAME'), type='str'),

            kiali_api_password=dict(
                default=os.environ.get('KIALI_PASSWORD'), type='str'),

            
            kiali_api_swagger_address=dict(
                default=os.environ.get('KIALI_SWAGGER_ADDRESS'), type='str'),
                
            
            kiali_api_scheme= dict(required=False, type='str', choices=['https', 'http'], default='https'),

            kiali_api_auth_type = dict(required=False, type='str', choices=['https-user-password', 'no-auth'], default='https-user-password'),
            
            kiali_api_request= dict(required=True, type='dict'),

            
            kiali_api_verify_ssl=dict(required=False, type='bool', default=False),
        )
    )

    for arg in ['kiali_api_hostname', 'kiali_api_port', 'kiali_api_username', 'kiali_api_password']:
        if module.params[arg] in (None, ''):
            module.fail_json(msg="missing required argument: {}".format(arg))

    hostname       = module.params['kiali_api_hostname']
    port       = module.params['kiali_api_port']
    username   = module.params['kiali_api_username']
    password      = module.params['kiali_api_password']
    scheme  = module.params['kiali_api_scheme']
    auth_type  = module.params['kiali_api_auth_type']
    verify_ssl = module.params['kiali_api_verify_ssl']
    request = module.params['kiali_api_request']
    
    
    try:
        params = request['params']
    except KeyError:
          params = None

    try:
        path = request['path']
    except KeyError:
          path = None

    kiali_client = KialiClient(hostname=hostname, scheme=scheme, port=port, auth_type=auth_type, username=username, password=password, verify=verify_ssl)
    response = kiali_client.request(method_name=request['method_name'], path=path,  params=params)

    full_response = {'status_code': response.status_code, 'url': response.url, 'text': response.text,'elapsed_time': response.elapsed.total_seconds()}

    module.exit_json(**full_response)


# Import module bits
from ansible.module_utils.basic import *
if __name__ == "__main__":
    main()