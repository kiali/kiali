package mcputil

import (
	"fmt"
	"strings"
)

// TextTable renders a fixed-width text table.
// This is useful for chat UIs that don't support Markdown tables (GFM).
type TextTable struct {
	Indent     string
	Headers    []string
	Rows       [][]string
	AlignRight map[int]bool // column index -> align right
}

func (t TextTable) Render() string {
	if len(t.Headers) == 0 {
		return ""
	}
	colCount := len(t.Headers)
	widths := make([]int, colCount)

	cell := func(s string) string { return strings.TrimSpace(s) }

	for i, h := range t.Headers {
		widths[i] = max(widths[i], len(cell(h)))
	}
	for _, row := range t.Rows {
		for i := 0; i < colCount && i < len(row); i++ {
			widths[i] = max(widths[i], len(cell(row[i])))
		}
	}

	renderRow := func(row []string) string {
		parts := make([]string, colCount)
		for i := 0; i < colCount; i++ {
			val := ""
			if i < len(row) {
				val = cell(row[i])
			}
			if t.AlignRight != nil && t.AlignRight[i] {
				parts[i] = fmt.Sprintf("%*s", widths[i], val)
			} else {
				parts[i] = fmt.Sprintf("%-*s", widths[i], val)
			}
		}
		return t.Indent + strings.Join(parts, "  ") + "\n"
	}

	var b strings.Builder
	b.WriteString(renderRow(t.Headers))

	sepLen := 0
	for i := 0; i < colCount; i++ {
		sepLen += widths[i]
		if i > 0 {
			sepLen += 2
		}
	}
	b.WriteString(t.Indent + strings.Repeat("-", sepLen) + "\n")

	for _, r := range t.Rows {
		b.WriteString(renderRow(r))
	}
	return b.String()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
