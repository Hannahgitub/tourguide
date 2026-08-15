import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 选用微软最顶级的自然播音级人声
# 男声: en-US-GuyNeural (沉稳典雅纯正美音男声)
# 女声: en-US-JennyNeural (清晰明亮播音美音女声)
VOICE_MALE = "en-US-GuyNeural"
VOICE_FEMALE = "en-US-JennyNeural"

# 基础原速（吐字饱满，原声基准）
RATE_BASE = "+0%"

semaphore = asyncio.Semaphore(6)

async def generate_single_audio(text, output_path, voice, rate=RATE_BASE):
    if not text or len(text.strip()) == 0:
        return False
    
    if os.path.exists(output_path) and os.path.getsize(output_path) > 200:
        return True

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    async with semaphore:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate)
                await communicate.save(output_path)
                print(f"[OK] ({voice}) {output_path}", flush=True)
                return True
            except Exception as e:
                print(f"[Retry {attempt+1}] {output_path}: {e}", flush=True)
                await asyncio.sleep(1)
        print(f"[FAIL] {output_path}", flush=True)
        return False

def extract_speeches():
    # 尝试从 speech_audio_tasks.json 读取
    if os.path.exists("speech_audio_tasks.json"):
        try:
            with open("speech_audio_tasks.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Error loading speech_audio_tasks.json:", e)
    return []

async def main():
    tasks = []

    # 1. 读取导游词
    speeches = extract_speeches()
    print(f"🎙️ 正在准备导游词音频任务 (共 {len(speeches)} 篇)...", flush=True)
    for sp in speeches:
        name = sp.get("name") or sp.get("id") or ""
        clean_name = re.sub(r'^[广西\s]+', '', name).strip()
        safe_clean_name = re.sub(r'[\\/:*?"<>|]', '_', clean_name).strip()
        safe_raw_name = re.sub(r'[\\/:*?"<>|]', '_', name).strip()

        for sec in sp.get("sections", []):
            idx = sec.get("idx", 0)
            en_text = sec.get("en") or sec.get("text") or ""
            clean_text = re.sub(r'<[^>]+>', '', en_text).strip()
            clean_text = re.sub(r'^(English|Chinese)[:：/\s]*', '', clean_text, flags=re.IGNORECASE).strip()

            if not clean_text:
                continue

            # 男声音频
            out_male_clean = os.path.join("audio", "male", safe_clean_name, f"section_{idx}.mp3")
            out_male_raw = os.path.join("audio", "male", safe_raw_name, f"section_{idx}.mp3")
            tasks.append(generate_single_audio(clean_text, out_male_clean, VOICE_MALE))
            if safe_clean_name != safe_raw_name:
                tasks.append(generate_single_audio(clean_text, out_male_raw, VOICE_MALE))

            # 女声音频
            out_female_clean = os.path.join("audio", "female", safe_clean_name, f"section_{idx}.mp3")
            out_female_raw = os.path.join("audio", "female", safe_raw_name, f"section_{idx}.mp3")
            tasks.append(generate_single_audio(clean_text, out_female_clean, VOICE_FEMALE))
            if safe_clean_name != safe_raw_name:
                tasks.append(generate_single_audio(clean_text, out_female_raw, VOICE_FEMALE))

            # 默认兼容路径 (男声/女声)
            out_default = os.path.join("audio", safe_clean_name, f"section_{idx}.mp3")
            tasks.append(generate_single_audio(clean_text, out_default, VOICE_MALE))

    print(f"⚡ 开始并发执行 {len(tasks)} 个高质量男女音色音频生成任务...", flush=True)
    await asyncio.gather(*tasks)
    print("🎉 导游词播音级男女双音色音频库全部生成完成！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
