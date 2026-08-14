import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

VOICE = "en-US-JennyNeural"
PHRASE_AUDIO_DIR = os.path.join("audio", "phrases")

def clean_text(text):
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text)
    return clean.strip()

async def generate_audio_file(text, output_path, sem):
    if not text:
        return False
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return True
    
    async with sem:
        for retry in range(3):
            try:
                communicate = edge_tts.Communicate(text, VOICE, rate="+0%")
                await communicate.save(output_path)
                print(f"[OK] {output_path}", flush=True)
                return True
            except Exception as e:
                if retry == 2:
                    print(f"[FAIL] {output_path}: {e}", flush=True)
                    return False
                await asyncio.sleep(1)

def extract_phrases_from_data_js():
    data_file = "data.js"
    if not os.path.exists(data_file):
        print("[ERROR] data.js not found!", flush=True)
        return []
    
    with open(data_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 查找 "phrasesData": [ ... ]
    match = re.search(r'"phrasesData"\s*:\s*(\[\s*\{.*?\}\s*\])', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception as e:
            print(f"[WARN] regex json parse failed: {e}, falling back to line parse...", flush=True)
    
    # 降级提取
    start_idx = content.find('"phrasesData"')
    if start_idx == -1:
        return []
    bracket_start = content.find('[', start_idx)
    # 匹配对应闭合括号
    depth = 0
    bracket_end = -1
    for i in range(bracket_start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                bracket_end = i + 1
                break
    
    if bracket_end != -1:
        json_str = content[bracket_start:bracket_end]
        return json.loads(json_str)
    
    return []

async def main():
    os.makedirs(PHRASE_AUDIO_DIR, exist_ok=True)
    phrases = extract_phrases_from_data_js()
    print(f"🎙️ 提取到 {len(phrases)} 条短语数据，开始生成语音素材...", flush=True)

    sem = asyncio.Semaphore(5) # 并发 5 个请求
    tasks = []

    for item in phrases:
        p_id = item.get("id")
        en_text = clean_text(item.get("en", ""))
        ex_text = clean_text(item.get("example", ""))

        if p_id and en_text:
            out_phrase = os.path.join(PHRASE_AUDIO_DIR, f"phrase_{p_id}.mp3")
            tasks.append(generate_audio_file(en_text, out_phrase, sem))

        if p_id and ex_text:
            out_ex = os.path.join(PHRASE_AUDIO_DIR, f"example_{p_id}.mp3")
            tasks.append(generate_audio_file(ex_text, out_ex, sem))

    print(f"📊 总共待处理任务数: {len(tasks)}", flush=True)
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"✨ 短语与例句语音素材生成完成！成功: {success_count}/{len(tasks)}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
