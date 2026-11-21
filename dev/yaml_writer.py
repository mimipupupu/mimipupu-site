import json, os
from admin_schema import GROUPS, MULTILINE
P = json.load(open('parts_props.json'))
REPO = open('repo.txt').read().strip() if os.path.exists('repo.txt') else 'GITHUB_USERNAME/mimipupu-site'
def q(s): return json.dumps(s, ensure_ascii=False)
def widget(key):
    ed = P[key].get('editor')
    if key in MULTILINE: return 'text'
    return {'boolean':'boolean','int':'number','float':'number','number':'number','color':'color'}.get(ed,'string')
L = []
L.append('backend:\n  name: github\n  repo: %s\n  branch: main\n  commit_messages:\n    update: "Update site content"\n    uploadMedia: "Upload {{path}}"' % REPO)
L.append('site_url: https://mimipupu.netlify.app\ndisplay_url: https://mimipupu.netlify.app\nlogo_url: /img/bf9cc112bdd7f183e75e76914e23cc4a.png')
L.append('media_folder: public/img\npublic_folder: img')
L.append('collections:\n  - name: site\n    label: Website\n    editor: { preview: false }\n    files:')
def file_entry(name, label, fields_yaml):
    return '      - name: %s\n        label: %s\n        file: public/content/%s.json\n        format: json\n        fields:\n%s' % (name, q(label), name, fields_yaml)
# one entry per group so each opens as its own page; all edit the same content.json
for gk, glabel, flds in GROUPS:
    rows = []
    for key, label, hint in flds:
        w = widget(key)
        r = '              - { label: %s, name: %s, widget: %s' % (q(label), key, w)
        ed = P[key].get('editor')
        if w == 'number':
            r += ', value_type: %s' % ('int' if ed == 'int' else 'float')
            if 'min' in P[key]: r += ', min: %s' % P[key]['min']
            if 'max' in P[key]: r += ', max: %s' % P[key]['max']
        r += ', required: false'
        if hint: r += ', hint: %s' % q(hint)
        rows.append(r + ' }')
    fy = '          - label: %s\n            name: %s\n            widget: object\n            collapsed: false\n            fields:\n%s' % (q(glabel), gk, '\n'.join(rows))
    L.append(file_entry(gk, glabel, fy))
series = [('jjk','Jujutsu Kaisen'),('onepiece','One Piece'),('paragons','Paragons'),('marvel','Marvel'),('others','Others')]
opts = ', '.join('{ label: %s, value: %s }' % (q(l), v) for v, l in series)
works = '''          - label: "Prints"
            name: works
            widget: list
            summary: "{{fields.title}}"
            hint: "The order here is kept within each series. Drag to reorder."
            fields:
              - { label: "Title", name: title, widget: string }
              - { label: "Series", name: series, widget: select, options: [%s], default: others }
              - { label: "Image", name: image, widget: image, choose_url: false, hint: "JPG or WEBP, about 1200–2000 px tall" }
              - { label: "Shape", name: shape, widget: select, options: [portrait, landscape], default: portrait }
              - { label: "Image width ÷ height (optional)", name: ratio, widget: number, value_type: float, required: false, hint: "A4 portrait ≈ 0.707. Leave empty to use the default for the shape." }
              - { label: "Light background artwork", name: lightBg, widget: boolean, required: false, default: false }
              - { label: "Image description (for screen readers)", name: alt, widget: string, required: false }''' % opts
L.insert(len(L) - len(GROUPS) + 1, file_entry('prints', 'Prints / artworks', works))
os.makedirs('public/admin', exist_ok=True)
open('public/admin/config.yml', 'w').write('\n'.join(L) + '\n')
open('public/admin/index.html', 'w').write('''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mimipupu — Site admin</title>
<link rel="icon" type="image/png" href="/img/bf9cc112bdd7f183e75e76914e23cc4a.png">
</head>
<body>
<script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
''')
print('admin ok', REPO)
