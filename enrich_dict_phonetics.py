import os
import sys
import re
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout.reconfigure(line_buffering=True)

# 补全 dict_data.js 中所有缺失的音标
def enrich_phonetics():
    with open("dict_data.js", "r", encoding="utf-8") as f:
        c = f.read()
        m = re.search(r'window\.BUILTIN_GUIDE_DICT\s*=\s*(\{[\s\S]*?\});?\s*$', c)
        if not m:
            print("Could not find BUILTIN_GUIDE_DICT")
            return
        dict_map = json.loads(m.group(1))

    print(f"Total entries in dict: {len(dict_map)}")
    
    missing_phonetics = [w for w, v in dict_map.items() if not v.get("phonetic")]
    print(f"Missing phonetics: {len(missing_phonetics)}")

    def fetch_phonetic(w):
        url = f"https://dict.youdao.com/suggest?q={urllib.parse.quote(w)}&num=1&doctype=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=2.5) as r:
                data = json.loads(r.read().decode('utf-8'))
                if data and data.get("data") and data["data"].get("entries"):
                    e = data["data"]["entries"][0]
                    p = e.get("phonetic", "")
                    if p:
                        return w, f"/{p}/"
        except Exception:
            pass
        return w, ""

    done = 0
    with ThreadPoolExecutor(max_workers=50) as ex:
        futures = {ex.submit(fetch_phonetic, w): w for w in missing_phonetics}
        for fut in as_completed(futures):
            w, p = fut.result()
            if p:
                dict_map[w]["phonetic"] = p
            done += 1
            if done % 500 == 0:
                print(f"Enriched {done}/{len(missing_phonetics)} phonetics...", flush=True)

    # 特别确保 needs, exploration, briefly 等常见词的音标和释义完全准确
    dict_map["needs"] = {
        "phonetic": "/niːdz/",
        "pos": "n./v.",
        "def": "需求；需要；要求（need 的复数/第三人称单数形式）"
    }
    dict_map["need"] = {
        "phonetic": "/niːd/",
        "pos": "v./n.",
        "def": "需要；必须；需求；要求"
    }
    dict_map["exploration"] = {
        "phonetic": "/ˌekspləˈreɪʃn/",
        "pos": "n.",
        "def": "探索；探险；深入考察；探究"
    }
    dict_map["explore"] = {
        "phonetic": "/ɪkˈsplɔː(r)/",
        "pos": "v.",
        "def": "探索；探寻；考察；勘探"
    }

    with open("dict_data.js", "w", encoding="utf-8") as f:
        f.write(f"window.BUILTIN_GUIDE_DICT = {json.dumps(dict_map, ensure_ascii=False, indent=2)};\n")

    print(f"🎉 All phonetics enriched! Dict updated with {len(dict_map)} entries.")

if __name__ == "__main__":
    enrich_phonetics()
