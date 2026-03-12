import os
import sys
import json
import re

def main():
    if len(sys.argv) < 3:
        print("Usage: python render_mcp_readme.py <path_to_json_file> <path_to_readme_file>")
        sys.exit(1)
        
    json_file = sys.argv[1]
    readme_file = sys.argv[2]
    
    if not os.path.exists(json_file):
        print(f"Error: JSON file '{json_file}' not found.")
        sys.exit(1)
        
    if not os.path.exists(readme_file):
        print(f"Error: README file '{readme_file}' not found.")
        sys.exit(1)
        
    with open(json_file, 'r') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Error: File '{json_file}' is not valid JSON.")
            sys.exit(1)
            
    # Generate Markdown
    md_lines = []
    
    for tool_name, descriptions in data.items():
        md_lines.append(f"### {tool_name}\n")
        md_lines.append("| Description | Characters | Tokens (OpenAI) |")
        md_lines.append("|---|---|---|")
        
        for desc, stats in descriptions.items():
            if "error" in stats:
                md_lines.append(f"| {desc} | Error | {stats['error']} |")
            else:
                chars = stats.get("characters", "N/A")
                tokens = stats.get("tokens_openai", "N/A")
                md_lines.append(f"| {desc} | {chars} | {tokens} |")
                
        md_lines.append("\n")
        
    new_content = "\n".join(md_lines).strip()
    
    with open(readme_file, 'r') as f:
        readme_content = f.read()
        
    start_marker = "<!-- MCP-TOOLS-TOKENAIZER -->"
    end_marker = "<!-- MCP-TOOLS-TOKENAIZER-END -->"
    
    # Use regex to find and replace the content between markers
    pattern = re.compile(f"({start_marker}).*?({end_marker})", re.DOTALL)
    
    if not pattern.search(readme_content):
        print(f"Error: Markers '{start_marker}' and '{end_marker}' not found in {readme_file}")
        sys.exit(1)
        
    # Build the replacement string with the markers and the new content
    replacement = f"\\1\n\n{new_content}\n\n\\2"
    updated_readme = pattern.sub(replacement, readme_content)
    
    with open(readme_file, 'w') as f:
        f.write(updated_readme)
        
    print(f"Successfully updated {readme_file} with token data.")

if __name__ == "__main__":
    main()
