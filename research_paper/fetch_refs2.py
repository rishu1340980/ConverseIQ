import urllib.request
import json
import re

for doc_id in ["10887212", "5482003", "10890057"]:
    url = f"https://ieeexplore.ieee.org/rest/document/{doc_id}/toc"
    req = urllib.request.Request(f"https://ieeexplore.ieee.org/document/{doc_id}/", headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            meta_title = re.search(r'"title":"(.*?)"', content)
            authors = re.search(r'"authors":\[(.*?)\]', content)
            print(f"Doc {doc_id}: Title: {meta_title.group(1) if meta_title else 'N/A'}")
    except Exception as e:
        print(f"Doc {doc_id} Error: {e}")
