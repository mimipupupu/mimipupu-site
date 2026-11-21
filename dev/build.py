import json, re, subprocess, os
os.makedirs('public', exist_ok=True)
helmet=open('parts_helmet.html').read()
body=open('parts_body.html').read()
code=open('parts_code.js').read()
OLD='    const WORKS = ['
assert code.count(OLD)==1
code=code.replace(OLD, "    const WORKS = (Array.isArray(p.works) && p.works.length) ? p.works.filter((w) => w && w.image).map((w) => ({ title: w.title || '', series: w.series || 'others', img: w.image, alt: w.alt || w.title || '', cat: w.shape === 'landscape' ? 'horizontal' : 'portrait', ratio: Number(w.ratio) || (w.shape === 'landscape' ? 1.78 : 0.707), tone: w.lightBg ? '#F3E6D0' : '#1A1411' })) : [")
P=json.load(open('parts_props.json'))
fields={k:v for k,v in P.items() if not k.startswith('$')}
defaults={k:v.get('default') for k,v in fields.items()}
# content.json: keep an existing one (the admin edits it); only add new keys
from admin_schema import GROUPS, MULTILINE
os.makedirs('public/content', exist_ok=True)
for gk,_,flds in GROUPS:
    fp='public/content/%s.json'%gk
    cur=json.load(open(fp)) if os.path.exists(fp) else {}
    grp=cur.setdefault(gk,{})
    for f in flds: grp.setdefault(f[0], defaults[f[0]])
    json.dump(cur,open(fp,'w'),indent=2,ensure_ascii=False)
fp='public/content/prints.json'
if not os.path.exists(fp):
    W=json.load(open('/tmp/works.json'))
    json.dump({'works':[{k:v for k,v in w.items() if k!='desc'} for w in W['works']]},open(fp,'w'),indent=2,ensure_ascii=False)
FILES=[g[0] for g in GROUPS]+['prints']
json.dump(fields,open('public/fields.json','w'),indent=1,ensure_ascii=False)
subprocess.run(['/opt/npm-tools/node_modules/.bin/esbuild','src/entry.js','--bundle','--minify','--format=iife','--define:process.env.NODE_ENV="production"','--outfile=public/dc.js'],check=True,env={**os.environ,'NODE_PATH':'/opt/npm-tools/node_modules'})
app = "(function(){\nconst DCLogic = window.DC.DCLogic;\n" + code + """
const DEFAULTS = %s;
const start = (content) => {
  const flat = {};
  Object.entries(content || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(flat, v); else flat[k] = v;
  });
  const props = Object.assign({}, DEFAULTS, flat);
  window.DC.mount({ templateEl: document.getElementById('dc-tpl'), Component, props, container: document.getElementById('root') });
};
Promise.all(%s.map((n) => fetch('content/' + n + '.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : {}).catch(() => ({}))))
  .then((parts) => start(Object.assign({}, ...parts)));
})();
""" % (json.dumps(defaults, ensure_ascii=False), json.dumps(FILES))
open('public/app.js','w').write(app)
html_doc = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mimipupu — Illustration, character design &amp; commissions</title>
<meta name="description" content="Mimipupu (Lee Chi Xuan) — illustrator and character &amp; creature designer. Portfolio, art prints and commissions.">
<meta property="og:title" content="Mimipupu — Art &amp; Commissions">
<meta property="og:description" content="Illustration, character &amp; creature design. Commissions open.">
<meta property="og:image" content="img/bf9cc112bdd7f183e75e76914e23cc4a.png">
<link rel="icon" type="image/png" href="img/bf9cc112bdd7f183e75e76914e23cc4a.png">
%s
</head>
<body>
<div id="root"></div>
<template id="dc-tpl">%s</template>
<script src="dc.js"></script>
<script src="app.js"></script>
</body>
</html>
""" % (helmet, body)
open('public/index.html','w').write(html_doc)
print('ok', os.path.getsize('public/dc.js'), os.path.getsize('public/index.html'))

# ---- admin (Decap CMS) ----
import yaml_writer
