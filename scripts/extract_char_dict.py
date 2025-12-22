#!/usr/bin/env python3
"""
Extract character dictionary from inference.yml and convert to JSON/TypeScript format.
The dictionary from inference.yml is used directly (index 0 = first character).
For CTC decoding, we need to add a blank token at index 0.
"""
import yaml
import json
import sys
from pathlib import Path

def extract_character_dict(yml_path: str, output_json: str = None, output_ts: str = None):
    """Extract character dictionary from inference.yml"""
    with open(yml_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # Extract character_dict from PostProcess section
    postprocess = config.get('PostProcess', {})
    char_dict = postprocess.get('character_dict', [])
    
    if not char_dict:
        raise ValueError(f"character_dict not found in {yml_path}")
    
    print(f"Found {len(char_dict)} characters in dictionary")
    print(f"First character (index 0 in YAML): '{char_dict[0]}'")
    print(f"Last character: '{char_dict[-1]}'")
    
    # For CTC: index 0 must be blank token
    # The YAML dictionary already starts with the blank character (U+3000 full-width space)
    # We use it directly - the first character IS the blank token
    ctc_dict = char_dict  # No prepending needed - first char is already blank
    
    # Save as JSON (for native code to load)
    if output_json:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(ctc_dict, f, ensure_ascii=False, indent=2)
        print(f"Saved JSON dictionary to {output_json}")
    
    # Save as TypeScript array (for TypeScript code if needed)
    if output_ts:
        with open(output_ts, 'w', encoding='utf-8') as f:
            f.write("// Character dictionary extracted from inference.yml\n")
            f.write("// Index 0 is the blank token (CTC requirement)\n")
            f.write("// Total characters: " + str(len(ctc_dict)) + "\n\n")
            f.write("export const CHARACTER_DICT: string[] = [\n")
            for i, char in enumerate(ctc_dict):
                # Escape special characters for TypeScript
                if char == "'":
                    escaped = "\\'"
                elif char == '"':
                    escaped = '\\"'
                elif char == "\\":
                    escaped = "\\\\"
                elif char == "\n":
                    escaped = "\\n"
                elif char == "\r":
                    escaped = "\\r"
                elif char == "\t":
                    escaped = "\\t"
                else:
                    escaped = char
                f.write(f"  '{escaped}',  // {i}\n")
            f.write("];\n")
        print(f"Saved TypeScript dictionary to {output_ts}")
    
    return ctc_dict

if __name__ == "__main__":
    yml_path = sys.argv[1] if len(sys.argv) > 1 else "android/src/main/assets/models/exported_rec/inference.yml"
    output_json = sys.argv[2] if len(sys.argv) > 2 else "android/src/main/assets/models/character_dict.json"
    output_ts = sys.argv[3] if len(sys.argv) > 3 else None
    
    extract_character_dict(yml_path, output_json, output_ts)

