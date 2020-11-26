package kubernetes

// Root of ConfigDump
type ConfigDump struct {
	Configs []interface{} `json:"configs"`
}

func (cd *ConfigDump) GetConfig(objectType string) map[string]interface{} {
	for _, configRaw := range cd.Configs {
		conf, ok := configRaw.(map[string]interface{})
		if !ok {
			continue
		}

		configType, ok := conf["@type"]
		if !ok {
			continue
		}

		if configType == objectType {
			return conf
		}
	}
	return nil
}
