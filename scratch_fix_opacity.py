import os
import re

files = []
for r, d, fs in os.walk('src/app'):
    for f in fs:
        if f.endswith('.tsx'):
            files.append(os.path.join(r, f))

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace bg-[var(--something)]/num with bg-[color:var(--something)]/num
    content = re.sub(r'(bg|text|border|decoration)-\[var\((--[^)]+)\)\]/(\d+)', r'\1-[color:var(\2)]/\3', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
