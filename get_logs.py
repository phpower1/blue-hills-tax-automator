import subprocess
import json
import codecs

try:
    cmd = ['gcloud', 'logging', 'read', 'resource.type="cloud_run_revision" AND resource.labels.service_name="receipt-processor"', '--limit=200', '--format=json']
    out = subprocess.check_output(cmd, shell=True)
    data = json.loads(out)
    with codecs.open("clean_logs.txt", "w", "utf-8") as f:
        for d in data:
            if 'textPayload' in d:
                f.write(f"[{d.get('timestamp')}] {d['textPayload']}\n")
    print("Logs written to clean_logs.txt")
except Exception as e:
    print(e)
