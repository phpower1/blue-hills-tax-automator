import os
import requests

def get_service_url(service_name):
    import subprocess
    result = subprocess.run([
        'gcloud', 'run', 'services', 'describe', service_name, 
        '--region', 'us-central1', 
        '--format', 'value(status.url)'
    ], capture_output=True, text=True, shell=True)
    return result.stdout.strip()

url = get_service_url('tax-automator-agent')
if url:
    print(f"Triggering processing at {url}/process_receipt")
    r = requests.post(
        f"{url}/process_receipt",
        headers={
            "ce-subject": "projects/dummy/databases/(default)/documents/receipts/xoft7lSsUoqNDMqWbX7W"
        }
    )
    print(r.status_code, r.text)
else:
    print("Failed to get URL")
