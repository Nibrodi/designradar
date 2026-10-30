# Делает из VERSION и CHANGELOG.md кусок кода для app.js: номер версии и три последних записи.
import json,re,sys
v=open("VERSION").read().strip()
txt=open("CHANGELOG.md").read()
secs=re.findall(r"^## (\S+) — ([^\n]+)\n(.*?)(?=^## |\Z)",txt,re.S|re.M)
if not secs or secs[0][0]!=v: sys.exit("VERSION "+v+" не совпадает с первой записью CHANGELOG.md — добавь запись о версии")
out=[{"v":a,"date":b.strip(),"items":[l[2:].strip() for l in c.strip().splitlines() if l.startswith("- ")]} for a,b,c in secs[:3]]
print("const APP_VERSION=%s; const CHANGES=%s;"%(json.dumps(v),json.dumps(out,ensure_ascii=False)))
