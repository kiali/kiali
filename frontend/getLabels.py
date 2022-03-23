import sys, json;

labels=''
rawLabels=json.loads(sys.argv[1])['labels']
for rLabel in rawLabels:
  if rLabel['name'].startswith("kiali-bot"):
      if len(labels) > 0:
        labels+=','
      labels+=rLabel['name'].encode("utf-8")
print labels