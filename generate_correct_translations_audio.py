import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

VOICE = "en-US-JennyNeural"
RATE = "+0%"
OUT_DIR = os.path.join("audio", "translations")

def clean_text(text):
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text).strip()
    return clean

async def generate_item(sem, item_id, text, out_path):
    async with sem:
        if not text:
            print(f"[SKIP] Empty text for ID {item_id}", flush=True)
            return False
        try:
            communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
            await communicate.save(out_path)
            print(f"[OK] {item_id}: {text[:35]}...", flush=True)
            return True
        except Exception as e:
            print(f"[FAIL] {item_id}: {e}", flush=True)
            return False

async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with open("translations.json", "r", encoding="utf-8") as f:
        translations = json.load(f)

    print(f"🎙️ 正在精确生成 178 题口译音频 (目标目录: {OUT_DIR})...", flush=True)
    sem = asyncio.Semaphore(10)
    tasks = []

    for t in translations:
        t_id = t.get("id")
        t_type = t.get("type", "C2E")
        
        # 核心逻辑：汉译英朗读英文译文 ref，英译中朗读英文原题 src
        if t_type == "C2E":
            target_text = clean_text(t.get("ref", ""))
        else:
            target_text = clean_text(t.get("src", ""))

        out_path = os.path.join(OUT_DIR, f"trans_{t_id}.mp3")
        tasks.append(generate_item(sem, t_id, target_text, out_path))

    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"🎉 全部 178 题口译音频生成完毕！成功: {success_count}/{len(translations)}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
