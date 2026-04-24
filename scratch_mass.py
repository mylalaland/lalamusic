import re

files = [
    'src/app/desktop/favorites/page.tsx'
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Typography
        content = content.replace("'Space_Grotesk'", "'Work_Sans'")
        content = content.replace("'Inter'", "'Noto_Serif'")

        # Colors & Accents for Favorites Page
        content = content.replace('text-[#ff59e3]', 'text-[var(--tertiary)]')
        content = content.replace('text-[#f1f3fc]', 'text-[var(--text-main)]')
        content = content.replace('text-[#72757d]', 'text-[var(--text-muted)]')
        content = content.replace('text-[#44484f]', 'text-[var(--text-muted)]')
        
        content = content.replace('bg-[#ff59e3]/10', 'bg-[var(--tertiary)]/10')
        content = content.replace('bg-[#1b2028]', 'bg-[var(--bg-container)]')
        content = content.replace('bg-[#0f141a]', 'bg-[var(--bg-surface)]')
        content = content.replace('bg-[#0a0e14]', 'bg-[var(--bg-surface)]')
        content = content.replace('bg-white/5', 'bg-[var(--bg-container-highest)]')
        
        content = content.replace('border-[#ff59e3]/20', 'border-[var(--tertiary)]/20')
        content = content.replace('border-white/5', 'border-[var(--border-light)]')
        
        content = re.sub(r'linear-gradient\(135deg, #ff59e3, #ff007f\)', 'var(--primary)', content)
        content = content.replace('boxShadow: \'0 0 20px rgba(255,89,227,0.2)\'', 'boxShadow: \'var(--shadow-floating)\'')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Replacements done for {filepath}.')
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
