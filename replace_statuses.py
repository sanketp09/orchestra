import os, glob
def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_c = content.replace('"COMPLETED"', '"COMPLETED"')
    new_c = new_c.replace('"INSUFFICIENT_INFORMATION"', '"INSUFFICIENT_INFORMATION"')
    new_c = new_c.replace('"FAILED"', '"FAILED"')
    if new_c != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_c)
        print('Updated', path)

for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root or '__pycache__' in root or '.next' in root: continue
    for f in files:
        if f.endswith('.py') or f.endswith('.json') or f.endswith('.md'):
            try:
                replace_in_file(os.path.join(root, f))
            except Exception as e:
                print(f"Error on {f}: {e}")
