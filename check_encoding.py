import sys

# Read with surrogateescape to handle corrupt bytes
with open('app.js', 'r', encoding='utf-8', errors='surrogateescape') as f:
    content = f.read()

print(f'File length: {len(content)} chars')

# Find corrupt characters
corrupt_indices = [i for i, c in enumerate(content) if ord(c) > 0xD800 and ord(c) < 0xE000]
print(f'Corrupt positions: {len(corrupt_indices)}')
if corrupt_indices:
    print(f'First few: {corrupt_indices[:10]}')
    # Show context around first corrupt position
    idx = corrupt_indices[0]
    print(f'Context: {repr(content[max(0,idx-30):idx+30])}')

# Look for the marker
i1 = content.find('/* ===== PANTALLA 3:')
i2 = content.find('/* ===== PANTALLA 4:')
print(f'Ergo section: i1={i1}, i2={i2}')

if i1 != -1 and i2 != -1:
    print(f'Ergo block len: {i2-i1}')
    # Check for corruption in ergo section
    ergo_corrupt = [i for i, c in enumerate(content[i1:i2]) if ord(c) > 0xD800 and ord(c) < 0xE000]
    print(f'Corrupt bytes in ergo section: {len(ergo_corrupt)}')
