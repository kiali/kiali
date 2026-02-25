package mcputil

import "fmt"

func FormatPercentRatio(ratio *float64) string {
	if ratio == nil {
		return "-"
	}
	return fmt.Sprintf("%.0f%%", (*ratio)*100)
}

func FormatCores(cores *float64) string {
	if cores == nil {
		return "-"
	}
	v := *cores
	if v == 0 {
		return "0"
	}
	if v < 1 {
		return fmt.Sprintf("%.0fm", v*1000)
	}
	if v < 10 {
		return fmt.Sprintf("%.2f", v)
	}
	return fmt.Sprintf("%.1f", v)
}

func FormatBinaryBytes(bytes *float64) string {
	if bytes == nil {
		return "-"
	}
	v := *bytes
	if v == 0 {
		return "0"
	}
	const unit = 1024
	if v < unit {
		return fmt.Sprintf("%.0fB", v)
	}
	div, exp := float64(unit), 0
	for n := v / unit; n >= unit && exp < 4; n /= unit {
		div *= unit
		exp++
	}
	suffix := []string{"KiB", "MiB", "GiB", "TiB", "PiB"}[exp]
	val := v / div
	if val < 10 {
		return fmt.Sprintf("%.2f%s", val, suffix)
	}
	if val < 100 {
		return fmt.Sprintf("%.1f%s", val, suffix)
	}
	return fmt.Sprintf("%.0f%s", val, suffix)
}
