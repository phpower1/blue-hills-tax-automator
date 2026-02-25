import subprocess
import json
import codecs

try:
    cmd = ['gcloud', 'logging', 'read', 'resource.type="cloud_run_revision" AND resource.labels.service_name="tax-automator-service"', '--limit=200', '--format=json']
    out = subprocess.check_output(cmd, shell=True)
    data = json.loads(out)
    with codecs.open("tax_service_logs.txt", "w", "utf-8") as f:
        for d in data:
            if 'textPayload' in d:
                f.write(f"[{d.get('timestamp')}] {d['textPayload']}\n")
    print("Logs written to tax_service_logs.txt")
except Exception as e:
    print(e)
