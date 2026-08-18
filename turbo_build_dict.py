import os
import sys
import re
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def get_all_words_from_data_js():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    raw_words = re.findall(r'\b[A-Za-z][A-Za-z\'-]*[A-Za-z]\b|\b[A-Za-z]\b', content)
    words_set = set()
    for w in raw_words:
        w_clean = w.lower().strip("'-")
        if len(w_clean) >= 2 and not w_clean.isdigit():
            words_set.add(w_clean)
    
    return sorted(list(words_set))

def fetch_word_definition(word):
    url = f"https://dict.youdao.com/suggest?q={urllib.parse.quote(word)}&num=1&doctype=json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and data.get("data") and data["data"].get("entries"):
                entry = data["data"]["entries"][0]
                phonetic = f"/{entry['phonetic']}/" if entry.get("phonetic") else ""
                explain = entry.get("explain", "")
                
                pos_match = re.match(r'^([a-z]+\.)\s*(.*)', explain)
                if pos_match:
                    pos = pos_match.group(1)
                    definition = pos_match.group(2)
                else:
                    pos = ""
                    definition = explain
                
                return word, {
                    "phonetic": phonetic,
                    "pos": pos,
                    "def": definition or explain
                }
    except Exception:
        pass
    return word, None

def main():
    words = get_all_words_from_data_js()
    print(f"Total target words: {len(words)}")
    
    existing_dict = {}
    if os.path.exists("dict_data.js"):
        with open("dict_data.js", "r", encoding="utf-8") as f:
            c = f.read()
            m = re.search(r'window\.BUILTIN_GUIDE_DICT\s*=\s*(\{[\s\S]*?\});?\s*$', c)
            if m:
                try:
                    existing_dict = json.loads(m.group(1))
                except Exception:
                    pass

    need_fetch = [w for w in words if w not in existing_dict or not existing_dict[w].get("def")]
    print(f"Need to fetch: {len(need_fetch)} words")
    
    success = 0
    with ThreadPoolExecutor(max_workers=60) as executor:
        futures = {executor.submit(fetch_word_definition, w): w for w in need_fetch}
        for future in as_completed(futures):
            w, info = future.result()
            if info and info["def"]:
                existing_dict[w] = info
                success += 1
                if success % 200 == 0:
                    print(f"Fetched {success}/{len(need_fetch)} words...", flush=True)

    with open("dict_data.js", "w", encoding="utf-8") as f:
        f.write(f"window.BUILTIN_GUIDE_DICT = {json.dumps(existing_dict, ensure_ascii=False, indent=2)};\n")
    
    print(f"🎉 Complete! dict_data.js now has {len(existing_dict)} total vocabulary entries!")

if __name__ == "__main__":
    main()
