import os
import sys
import re
import json
import urllib.request
import urllib.parse
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 1. 提取 data.js 中的所有英文单词
def get_all_words_from_data_js():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # 提取所有英文单词
    raw_words = re.findall(r'\b[A-Za-z][A-Za-z\'-]*[A-Za-z]\b|\b[A-Za-z]\b', content)
    words_set = set()
    for w in raw_words:
        w_clean = w.lower().strip("'")
        if len(w_clean) >= 2 and not w_clean.isdigit():
            words_set.add(w_clean)
    
    print(f"Extracted {len(words_set)} unique English words from data.js")
    return sorted(list(words_set))

# 2. 查询词典 API (有道/百度等无CORS限制的后端抓取)
def fetch_word_definition(word):
    url = f"https://dict.youdao.com/suggest?q={urllib.parse.quote(word)}&num=1&doctype=json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and data.get("data") and data["data"].get("entries"):
                entry = data["data"]["entries"][0]
                phonetic = f"/{entry['phonetic']}/" if entry.get("phonetic") else ""
                explain = entry.get("explain", "")
                
                # 提取词性
                pos_match = re.match(r'^([a-z]+\.)\s*(.*)', explain)
                if pos_match:
                    pos = pos_match.group(1)
                    definition = pos_match.group(2)
                else:
                    pos = ""
                    definition = explain
                
                return {
                    "phonetic": phonetic,
                    "pos": pos,
                    "def": definition or explain
                }
    except Exception as e:
        pass
    return None

def main():
    words = get_all_words_from_data_js()
    
    # 读取已有的 dict_data.js
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

    print(f"Existing entries: {len(existing_dict)}")
    
    # 填充缺失的单词
    total = len(words)
    count = 0
    added = 0
    for w in words:
        count += 1
        if w in existing_dict and existing_dict[w].get("def"):
            continue
        
        # 尝试查询
        info = fetch_word_definition(w)
        if info and info["def"]:
            existing_dict[w] = info
            added += 1
            if added % 50 == 0:
                print(f"[{count}/{total}] Added '{w}': {info['def'][:20]}...", flush=True)
        time.sleep(0.02)

    # 导出完整的 dict_data.js
    with open("dict_data.js", "w", encoding="utf-8") as f:
        f.write(f"window.BUILTIN_GUIDE_DICT = {json.dumps(existing_dict, ensure_ascii=False, indent=2)};\n")
    
    print(f"🎉 Complete! dict_data.js now has {len(existing_dict)} total vocabulary entries!")

if __name__ == "__main__":
    main()
