"""Assemble src/ en un site statique autonome : python3 build.py
Produit index.html (application complète, autonome), assistant.js (module facultatif), sw.js (service worker versionné),
manifest.webmanifest et icon.svg à la racine (servis par GitHub Pages)."""
import hashlib, pathlib, shutil
d = pathlib.Path(__file__).parent
src = d / 'src'
parts = {k: (src / f).read_text(encoding='utf-8') for k, f in [('ENGINE', 'engine.js'), ('GLASSES', 'glasses.js'), ('GLASSTH', 'glassth.js'), ('HELP', 'help.js'), ('IO', 'io.js'), ('SAMPLES', 'samples.js'), ('PDF', 'pdf.js'), ('APP', 'app.js'), ('REPORT', 'report.js')] if (src / f).exists()}
h = (src / 'shell.html').read_text(encoding='utf-8')
asst = (src / 'assistant.js').read_text(encoding='utf-8') if (src / 'assistant.js').exists() else ''
version = hashlib.sha1(''.join(parts.values()).encode() + h.encode() + asst.encode()).hexdigest()[:8]
h = h.replace('__VERSION__', version)
for k, v in parts.items():
    h = h.replace(f'/*__{k}__*/', v)
(d / 'index.html').write_text(h, encoding='utf-8')
# module facultatif : l'assistant est un fichier séparé, chargé seulement à la demande
if (src / 'assistant.js').exists():
    (d / 'assistant.js').write_text(f'/* Focale {version} — module assistant facultatif */\n' + (src / 'assistant.js').read_text(encoding='utf-8'), encoding='utf-8')
(d / 'sw.js').write_text((src / 'pwa/sw.js').read_text(encoding='utf-8').replace('__VERSION__', version), encoding='utf-8')
for f in ['manifest.webmanifest', 'icon.svg']:
    shutil.copy(src / 'pwa' / f, d / f)
print(f'Focale {version} : index.html ({len(h)} caractères), sw.js, manifest')
