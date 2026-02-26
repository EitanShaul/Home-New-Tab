import json
import base64
import os
from pathlib import Path

def convert_json_to_svgs(json_data, output_dir='svg_output'):
    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Iterate through JSON entries
    for key, svg_data in json_data.items():
        # Extract the base64 data (remove the data:image/svg+xml;base64, prefix)
        base64_data = svg_data.split('base64,')[1]
        
        # Decode base64 to bytes
        svg_bytes = base64.b64decode(base64_data)
        
        # Create output file path
        output_file = os.path.join(output_dir, f"{key}.svg")
        
        # Write SVG file
        with open(output_file, 'wb') as f:
            f.write(svg_bytes)
        
        print(f"Created: {output_file}")

def main():
    # Sample usage
    try:
        # Read JSON from file
        with open('icons.json', 'r') as f:
            json_data = json.load(f)
        
        # Convert JSON to SVG files
        convert_json_to_svgs(json_data)
        
        print("Conversion completed successfully!")
        
    except FileNotFoundError:
        print("Error: icons.json file not found")
    except json.JSONDecodeError:
        print("Error: Invalid JSON format")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()