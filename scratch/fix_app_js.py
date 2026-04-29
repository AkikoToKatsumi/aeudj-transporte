import sys

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find loadLista
start = -1
for i, line in enumerate(lines):
    if 'async function loadLista()' in line and i > 700:
        start = i
        break

if start != -1:
    # Look for the query inside the next 10 lines
    for i in range(start, start + 10):
        if '.from(\'votos\')' in lines[i]:
            # Replace lines from where the query starts to where it ends
            # Usually starts with const { data: votos, error } = await supabase
            q_start = i - 1
            q_end = i + 5 # .order('created_at');
            
            new_line = "  const { data: votos, error } = await supabase.functions.invoke('obtener-lista-segura');\n"
            lines[q_start:q_end+1] = [new_line]
            break

with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
