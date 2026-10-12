import subprocess
import json
import re

for doc_id in ["10887212", "5482003", "10890057"]:
    cmd = ["google-chrome", "--headless", "--dump-dom", f"https://ieeexplore.ieee.org/document/{doc_id}/"]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    m = re.search(r'metadata\s*=\s*(\{.*?\});', res.stdout)
    if m:
        try:
            data = json.loads(m.group(1))
            print(f"ID {doc_id}: {data.get('title')}")
        except:
            print(f"ID {doc_id}: regex found but parse failed")
    else:
        # Search for documentTitle
        m2 = re.search(r'"documentTitle":"(.*?)"', res.stdout)
        if m2:
            print(f"ID {doc_id}: {m2.group(1)}")
        else:
            m3 = re.search(r'<meta property="og:title" content="(.*?)"', res.stdout)
            if m3:
                print(f"ID {doc_id} (og): {m3.group(1)}")
            else:
                print(f"ID {doc_id}: not found")
