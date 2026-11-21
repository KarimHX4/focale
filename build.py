"""Assemble src/ en un site statique autonome : python3 build.py
Produit index.html (application complète), sw.js (service worker versionné),
manifest.webmanifest et icon.svg à la racine (servis par GitHub Pages)."""
import hashlib, pathlib, shutil
d = pathlib.Path(__file__).parent
src = d / 'src'
parts = {k: (src / f).read_text(encoding='utf-8') for k, f in [('ENGINE', 'engine.js'), ('GLASSES', 'glasses.js'), ('HELP', 'help.js'), ('IO', 'io.js'), ('SAMPLES', 'samples.js'), ('APP', 'app.js')] if (src / f).exists()}
h = (src / 'shell.html').read_text(encoding='utf-8')
version = hashlib.sha1(''.join(parts.values()).encode() + h.encode()).hexdigest()[:8]
h = h.replace('__VERSION__', version)
for k, v in parts.items():
    h = h.replace(f'/*__{k}__*/', v)
(d / 'index.html').write_text(h, encoding='utf-8')
(d / 'sw.js').write_text((src / 'pwa/sw.js').read_text(encoding='utf-8').replace('__VERSION__', version), encoding='utf-8')
for f in ['manifest.webmanifest', 'icon.svg']:
    shutil.copy(src / 'pwa' / f, d / f)
print(f'Focale {version} : index.html ({len(h)} caractères), sw.js, manifest')
