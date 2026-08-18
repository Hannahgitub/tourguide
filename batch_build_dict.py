import os
import sys
import re
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

# 强制不缓冲标准输出
sys.stdout.reconfigure(line_buffering=True)

def extract_clean_words():
    with open("data.js", "r", encoding="utf-8") as f:
        text = f.read()

    # 提取所有英文词汇
    tokens = re.findall(r'\b[a-zA-Z][a-zA-Z\'-]*[a-zA-Z]\b|\b[a-zA-Z]\b', text)
    cleaned = set()
    for t in tokens:
        w = t.lower().strip("'-")
        if len(w) >= 2 and not w.isdigit():
            cleaned.add(w)
    return sorted(list(cleaned))

def fetch_single_word(word):
    url = f"https://dict.youdao.com/suggest?q={urllib.parse.quote(word)}&num=1&doctype=json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=2.5) as r:
            data = json.loads(r.read().decode('utf-8'))
            if data and data.get("data") and data["data"].get("entries"):
                e = data["data"]["entries"][0]
                phonetic = f"/{e['phonetic']}/" if e.get("phonetic") else ""
                explain = e.get("explain", "")
                
                pos_m = re.match(r'^([a-z]+\.)\s*(.*)', explain)
                if pos_m:
                    pos = pos_m.group(1)
                    definition = pos_m.group(2)
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

def run():
    words = extract_clean_words()
    print(f"Total words in data.js: {len(words)}", flush=True)

    # 读取已有词条
    result_dict = {}
    if os.path.exists("dict_data.js"):
        with open("dict_data.js", "r", encoding="utf-8") as f:
            c = f.read()
            m = re.search(r'window\.BUILTIN_GUIDE_DICT\s*=\s*(\{[\s\S]*?\});?\s*$', c)
            if m:
                try:
                    result_dict = json.loads(m.group(1))
                except Exception:
                    pass

    missing = [w for w in words if w not in result_dict or not result_dict[w].get("def")]
    print(f"Already have: {len(result_dict)}, Missing: {len(missing)}", flush=True)

    # 分批并发抓取
    batch_size = 50
    for i in range(0, len(missing), batch_size):
        batch = missing[i:i+batch_size]
        with ThreadPoolExecutor(max_workers=30) as ex:
            futures = [ex.submit(fetch_single_word, w) for w in batch]
            for fut in futures:
                w, info = fut.result()
                if info and info["def"]:
                    result_dict[w] = info
        
        # 实时保存，防止中断丢失
        with open("dict_data.js", "w", encoding="utf-8") as f:
            f.write(f"window.BUILTIN_GUIDE_DICT = {json.dumps(result_dict, ensure_ascii=False, indent=2)};\n")
        
        print(f"Progress: {min(i+batch_size, len(missing))}/{len(missing)} (Total in dict: {len(result_dict)})", flush=True)

    print(f"DONE! dict_data.js has {len(result_dict)} words!", flush=True)

if __name__ == "__main__":
    run()
