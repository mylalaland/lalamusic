import os
import re

replacements = {
    r'\bbg-black/90\b': 'bg-[var(--bg-surface)]/90',
    r'\bbg-black/80\b': 'bg-[var(--bg-surface)]/80',
    r'\bbg-black/60\b': 'bg-[var(--bg-surface)]/60',
    r'\bbg-black/40\b': 'bg-[var(--bg-container-high)]',
    r'\bbg-black/20\b': 'bg-[var(--bg-container)]',
    r'\bbg-black\b': 'analog-surface',
    
    r'\btext-white/80\b': 'text-[var(--text-main)]/80',
    r'\btext-white/60\b': 'text-[var(--text-muted)]',
    r'\btext-white\b': 'text-[var(--text-main)]',
    
    r'\bbg-gray-900\b': 'bg-[var(--bg-container)]',
    r'\bbg-gray-800\b': 'bg-[var(--bg-container-high)]',
    r'\bbg-gray-700\b': 'bg-[var(--bg-container-highest)]',
    
    r'\bborder-gray-900\b': 'border-[var(--border-light)]',
    r'\bborder-gray-800\b': 'border-[var(--border-strong)]',
    r'\bborder-gray-700\b': 'border-[var(--border-strong)]',
    
    r'\btext-gray-200\b': 'text-[var(--text-main)]',
    r'\btext-gray-300\b': 'text-[var(--text-main)]/80',
    r'\btext-gray-400\b': 'text-[var(--text-muted)]',
    r'\btext-gray-500\b': 'text-[var(--text-muted)]/80',
    r'\btext-gray-600\b': 'text-[var(--text-muted)]/60',
    
    r'\bborder-white/5\b': 'border-[var(--border-light)]',
    r'\bborder-white/10\b': 'border-[var(--border-light)]',
    r'\bborder-white/20\b': 'border-[var(--border-strong)]',
    
    r'\bbg-white/5\b': 'bg-[var(--bg-container-high)]',
    r'\bbg-white/10\b': 'bg-[var(--bg-container-highest)]',
    
    r'\btext-cyan-400\b': 'text-[var(--tertiary)]',
    r'\btext-blue-400\b': 'text-[var(--tertiary)]',
    r'\btext-blue-500\b': 'text-[var(--tertiary)]',
    
    r"font-\['Space_Grotesk'\]": "font-['Work_Sans']",
    r"font-\['Inter'\]": "font-['Noto_Serif']"
}

files = []
for r, d, fs in os.walk('src/app/mobile'):
    for f in fs:
        if f.endswith('.tsx'):
            files.append(os.path.join(r, f))

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
