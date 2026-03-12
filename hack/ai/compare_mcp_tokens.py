import os
import sys
import json

def calc_diff(base, pr):
    if base == 0:
        return "0.0%" if pr == 0 else "+∞%"
    diff = ((pr - base) / base) * 100
    sign = "+" if diff > 0 else ""
    return f"{sign}{diff:.1f}%"

def main():
    if len(sys.argv) < 3:
        print("Usage: python compare_mcp_tokens.py <base_json> <pr_json>")
        sys.exit(1)

    base_file = sys.argv[1]
    pr_file = sys.argv[2]

    if not os.path.exists(base_file):
        print(f"Error: Base file '{base_file}' not found.")
        sys.exit(1)
        
    if not os.path.exists(pr_file):
        print(f"Error: PR file '{pr_file}' not found.")
        sys.exit(1)

    with open(base_file, 'r') as f:
        base_data = json.load(f)
    with open(pr_file, 'r') as f:
        pr_data = json.load(f)

    md_lines = []
    md_lines.append("## MCP Tokens Comparison\n")

    all_tools = set(base_data.keys()).union(set(pr_data.keys()))

    for tool in sorted(all_tools):
        md_lines.append(f"### {tool}\n")
        md_lines.append("| Description | Base Chars | PR Chars | Char Diff | Base Tokens (OpenAI) | PR Tokens | Token Diff |")
        md_lines.append("|---|---|---|---|---|---|---|")

        base_descs = base_data.get(tool, {})
        pr_descs = pr_data.get(tool, {})

        all_descs = set(base_descs.keys()).union(set(pr_descs.keys()))

        for desc in sorted(all_descs):
            b_stats = base_descs.get(desc, {})
            p_stats = pr_descs.get(desc, {})

            if "error" in b_stats or "error" in p_stats:
                b_err = b_stats.get("error", "N/A")
                p_err = p_stats.get("error", "N/A")
                md_lines.append(f"| {desc} | Error: {b_err} | Error: {p_err} | - | - | - | - |")
                continue

            b_chars = b_stats.get("characters", 0)
            p_chars = p_stats.get("characters", 0)
            b_toks = b_stats.get("tokens_openai", 0)
            p_toks = p_stats.get("tokens_openai", 0)

            char_diff = calc_diff(b_chars, p_chars)
            tok_diff = calc_diff(b_toks, p_toks)

            md_lines.append(f"| {desc} | {b_chars} | {p_chars} | {char_diff} | {b_toks} | {p_toks} | {tok_diff} |")

        md_lines.append("\n")

    print("\n".join(md_lines))

if __name__ == "__main__":
    main()
