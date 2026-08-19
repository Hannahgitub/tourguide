# -*- coding: utf-8 -*-
import asyncio
import os
import re
import json
import sys
import edge_tts
from build_all_20_comprehensive_simplified import get_all_20_speeches

sys.stdout.reconfigure(encoding='utf-8')

VOICE_MALE = "en-US-GuyNeural"
VOICE_FEMALE = "en-US-JennyNeural"

def clean_folder_name(name):
    clean = re.sub(r'[\\/:*?"<>|]', '_', name).strip()
    clean = re.sub(r'^广西\s*', '', clean)
    clean = re.sub(r'^广西', '', clean).strip()
    return clean

async def generate_single_audio(text, out_path, voice):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        return
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    clean_text = re.sub(r'<[^>]*>', '', text)
    clean_text = re.sub(r'^(English|Chinese)[:：/\s]*', '', clean_text, flags=re.IGNORECASE).strip()
    
    communicate = edge_tts.Communicate(clean_text, voice)
    await communicate.save(out_path)

async def generate_all_audio():
    speeches_dict = get_all_20_speeches()
    print(f"Total speeches to generate: {len(speeches_dict)}")
    
    tasks = []
    sem = asyncio.Semaphore(6) # 限制并发数
    
    async def worker(text, out_path, voice, desc):
        async with sem:
            for retry in range(3):
                try:
                    await generate_single_audio(text, out_path, voice)
                    print(f"✓ Generated: {desc}")
                    break
                except Exception as e:
                    print(f"✗ Failed {desc} (retry {retry+1}): {e}")
                    await asyncio.sleep(1)

    for spot_name, sections in speeches_dict.items():
        clean_name = clean_folder_name(spot_name)
        for idx, sec in enumerate(sections):
            en_text = sec["en"]
            # Male
            male_path = os.path.join("audio", "simplified", "male", clean_name, f"section_{idx}.mp3")
            tasks.append(worker(en_text, male_path, VOICE_MALE, f"[Male] {clean_name} sec_{idx}"))
            
            # Female
            female_path = os.path.join("audio", "simplified", "female", clean_name, f"section_{idx}.mp3")
            tasks.append(worker(en_text, female_path, VOICE_FEMALE, f"[Female] {clean_name} sec_{idx}"))

    print(f"Total audio tasks: {len(tasks)}")
    await asyncio.gather(*tasks)
    print("🎉 All simplified speech MP3s generated successfully!")

def update_data_js():
    speeches_dict = get_all_20_speeches()
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    idx = content.find("window.data = ")
    if idx == -1:
        print("Could not find window.data in data.js")
        return

    json_str = content[idx + len("window.data = "):].rstrip(";\n ")
    data = json.loads(json_str)
    speeches = data.get("speeches", [])

    injected = 0
    for sp in speeches:
        name = sp.get("name", "").strip()
        matched = None
        if name in speeches_dict:
            matched = speeches_dict[name]
        else:
            for k, v in speeches_dict.items():
                if k in name or name in k:
                    matched = v
                    break

        if matched:
            sp["simplifiedSections"] = matched
            injected += 1
            print(f"Updated simplifiedSections for '{name}' -> {len(matched)} standard sections")

    with open("data.js", "w", encoding="utf-8") as f:
        f.write(f"window.data = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

    print(f"🎉 Successfully injected comprehensive simplified sections for {injected}/{len(speeches)} speeches in data.js!")

if __name__ == "__main__":
    update_data_js()
    asyncio.run(generate_all_audio())
