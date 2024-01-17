import sys, json;

labels=''
rawLabels=json.loads(sys.argv[1])['labels']
for rLabel in rawLabels:
      if len(labels) > 0:
        labels+=','
      labels+=rLabel['name'].encode("utf-8")
print labels