import glob

for filepath in glob.glob('src/app/**/*.tsx', recursive=True):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if '#0a0e14' in content:
            content = content.replace("#0a0e14", "var(--bg-surface)")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Replaced in {filepath}')
            
    except Exception as e:
        pass
print("Done")
