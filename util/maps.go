package util

func RemoveNilValues(root interface{}) {
	if mRoot, isMap := root.(map[string]interface{}); isMap {
		for k, v := range mRoot {
			if v == nil {
				delete(mRoot, k)
			}
			if leaf, isLeafMap := v.(map[string]interface{}); isLeafMap {
				RemoveNilValues(leaf)
			}
		}
	}
}
