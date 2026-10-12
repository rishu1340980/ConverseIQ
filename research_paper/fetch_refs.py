import urllib.request
import re

urls = [
    ("10474352", "https://ieeexplore.ieee.org/abstract/document/10474352"),
    ("10887212", "https://ieeexplore.ieee.org/document/10887212/"),
    ("11658588", "https://ieeexplore.ieee.org/abstract/document/11658588/"),
    ("5482003", "https://ieeexplore.ieee.org/document/5482003/"),
    ("10890057", "https://ieeexplore.ieee.org/document/10890057/")
]

for doc_id, url in urls:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            title = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
            print(f"ID {doc_id}: {title.group(1) if title else 'No title'}")
    except Exception as e:
        print(f"ID {doc_id} Error: {e}")
