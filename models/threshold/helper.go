package threshold

// Clean empty values in array
func delete_empty(s []string) []string {
	var r []string
	for _, str := range s {
		if str != "" {
			r = append(r, str)
		}
	}
	return r
}

//Compare given A value, operator and B value
func Compare(valueA int, operator string, valueB int) bool {
	switch operator {
	case ">":
		return valueA > valueB
	case ">=":
		return valueA >= valueB
	case "<=":
		return valueA <= valueB
	case "<":
		return valueA < valueB
	case "!=":
		return valueA != valueB
	default:
		return valueA == valueB
	}
}
