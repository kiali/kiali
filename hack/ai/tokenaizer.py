import os
import sys
import json
import requests
import tiktoken

def count_tokens_and_chars(text_to_analyze, openai_encoder):
    """
    Takes a string and returns the character and token counts for OpenAI.
    """
    # 1. Count Characters
    num_chars = len(text_to_analyze)

    # 2. Count OpenAI Tokens
    openai_tokens = len(openai_encoder.encode(text_to_analyze))

    return num_chars, openai_tokens

def main():
    if len(sys.argv) < 3:
        print("Usage: python tokenaizer.py <path_to_json_file> <output_json_file>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)
        
    with open(input_file, 'r') as f:
        try:
            tasks = json.load(f)
        except json.JSONDecodeError:
            print(f"Error: File '{input_file}' is not valid JSON.")
            sys.exit(1)

    kiali_url = os.getenv("KIALI_URL", "http://localhost:20001").rstrip('/')
    
    # Initialize Encoders
    openai_encoder = tiktoken.get_encoding("cl100k_base")
    
    results = {}

    for tool_name, descriptions in tasks.items():
        results[tool_name] = {}
        for description, payload in descriptions.items():
            url = f"{kiali_url}/api/chat/mcp/{tool_name}"
            print(f"Processing: {tool_name} -> {description}")
            print(f"POST {url} with body: {json.dumps(payload)}")
            
            try:
                response = requests.post(url, json=payload)
                response.raise_for_status()
                
                # Analyze the response text
                response_text = response.text
                
                chars, openai_toks = count_tokens_and_chars(
                    response_text, openai_encoder
                )
                
                results[tool_name][description] = {
                    "characters": chars,
                    "tokens_openai": openai_toks
                }
                print(f"  -> Chars: {chars}, OpenAI: {openai_toks}")
                
            except requests.exceptions.RequestException as e:
                print(f"  -> Error making request: {e}")
                results[tool_name][description] = {
                    "error": str(e)
                }
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults successfully written to {output_file}")

if __name__ == "__main__":
    main()
