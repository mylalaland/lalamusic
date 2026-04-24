import re

with open('src/app/desktop/settings/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Typography
content = content.replace("'Space_Grotesk'", "'Work_Sans'")
content = content.replace("'Inter'", "'Noto_Serif'")

# Text Colors
content = content.replace('text-[#99f7ff]', 'text-[var(--tertiary)]')
content = content.replace('text-[#f1f3fc]', 'text-[var(--text-main)]')
content = content.replace('text-[#72757d]', 'text-[var(--text-muted)]')
content = content.replace('text-[#44484f]', 'text-[var(--text-muted)]')
content = content.replace('text-[#004145]', 'text-[var(--on-primary)]')
content = content.replace('text-red-400', 'text-red-500')

# Borders
content = content.replace('border-[#99f7ff]', 'border-[var(--tertiary)]')
content = content.replace('border-[#99f7ff]/30', 'border-[var(--tertiary)]')
content = content.replace('border-[#44484f]', 'border-[var(--border-strong)]')
content = content.replace('border-[#44484f]/50', 'border-[var(--border-light)]')
content = content.replace('border-[#44484f]/30', 'border-[var(--border-light)]')
content = content.replace('border-red-400/30', 'border-red-500/30')

# Backgrounds
content = content.replace('bg-[#99f7ff]', 'bg-[var(--tertiary)]')
content = content.replace('bg-[#99f7ff]/5', 'bg-[var(--tertiary)]/5')
content = content.replace('bg-[#99f7ff]/8', 'bg-[var(--tertiary)]/10')
content = content.replace('bg-[#1b2028]', 'bg-[var(--bg-container)]')
content = content.replace('bg-white/3', 'bg-[var(--bg-container-high)]')
content = content.replace('bg-red-400/10', 'bg-red-500/10')

# Underlines / Accents
content = content.replace('decoration-[#99f7ff]', 'decoration-[var(--tertiary)]')
content = content.replace('decoration-[#99f7ff]/30', 'decoration-[var(--tertiary)]')
content = content.replace('accent-[#99f7ff]', 'accent-[var(--tertiary)]')

# Linear Gradients and hardcoded rgba
content = re.sub(r'linear-gradient\(135deg, #99f7ff, #00f1fe\)', 'var(--primary)', content)
content = content.replace('#00f1fe', 'var(--primary)')
content = re.sub(r'rgba\(153,247,255,0\.\d+\)', 'var(--bg-container-high)', content)
content = content.replace('rgba(68,72,79,0.5)', 'var(--border-strong)')
content = content.replace('rgba(255,170,59,0.04)', 'var(--bg-container-high)')
content = content.replace('rgba(255,170,59,0.1)', 'var(--border-light)')

with open('src/app/desktop/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Replacements done.')
