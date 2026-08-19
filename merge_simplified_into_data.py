import json
import re
from build_simplified_speeches import SIMPLIFIED_SPEECHES

def merge_into_data():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # 提取 window.data 或 const data 对象
    match = re.search(r'window\.data\s*=\s*(\{[\s\S]*?\});?\s*$', content)
    if not match:
        print("Could not parse data object from data.js")
        return

    json_str = match.group(1)
    data = json.loads(json_str)
    speeches = data.get("speeches", [])
    print(f"Total speeches in data.js: {len(speeches)}")

    for sp in speeches:
        name = sp.get("name", "").lower()
        sp_id = sp.get("id", "").lower()
        title = sp.get("title", "")
        titleEn = sp.get("titleEn", "").lower()

        matched_key = None
        for k in SIMPLIFIED_SPEECHES.keys():
            if k in name or k in sp_id or k in titleEn:
                matched_key = k
                break
        
        # 特殊中文标题匹配兜底
        if not matched_key:
            target_str = f"{name} {sp_id} {title}"
            if "欢迎" in target_str: matched_key = "welcome"
            elif "欢送" in target_str: matched_key = "farewell"
            elif "概况" in target_str: matched_key = "overview"
            elif "漓江" in target_str: matched_key = "lijiang"
            elif "象鼻山" in target_str: matched_key = "elephant"
            elif "西街" in target_str: matched_key = "weststreet"
            elif "龙脊" in target_str: matched_key = "longji"
            elif "德天" in target_str: matched_key = "detian"
            elif "花山" in target_str: matched_key = "huashan"
            elif "银滩" in target_str: matched_key = "beihai"
            elif "涠洲" in target_str: matched_key = "weizhou"
            elif "青秀" in target_str: matched_key = "qingxiu"
            elif "百色" in target_str: matched_key = "baise"
            elif "工业" in target_str: matched_key = "liuzhou"
            elif "灵渠" in target_str: matched_key = "lingqu"
            elif "靖江" in target_str: matched_key = "jingjiang"
            elif "程阳" in target_str: matched_key = "chengyang"
            elif "巴马" in target_str: matched_key = "bama"
            elif "合浦" in target_str: matched_key = "hepu"
            elif "明仕" in target_str: matched_key = "mingshi"

        if matched_key and matched_key in SIMPLIFIED_SPEECHES:
            sp["simplifiedSections"] = SIMPLIFIED_SPEECHES[matched_key]
            print(f"Injected simplifiedSections for: {sp.get('name') or title} ({matched_key}) -> {len(sp['simplifiedSections'])} sections")
        else:
            print(f"WARNING: No matching simplified speech for {sp.get('name') or title}")

    # 写回 data.js
    new_content = f"window.data = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(new_content)

    print("🎉 Successfully injected simplifiedSections into all speeches in data.js!")

if __name__ == "__main__":
    merge_into_data()
