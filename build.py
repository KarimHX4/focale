"""Assemble src/ en un seul index.html autonome : python3 build.py"""
import pathlib
d = pathlib.Path(__file__).parent
h = (d / 'src/shell.html').read_text(encoding='utf-8')
for k, f in [('ENGINE', 'engine.js'), ('SAMPLES', 'samples.js'), ('APP', 'app.js')]:
    h = h.replace(f'/*__{k}__*/', (d / 'src' / f).read_text(encoding='utf-8'))
(d / 'index.html').write_text(h, encoding='utf-8')
print('index.html généré,', len(h), 'caractères')
