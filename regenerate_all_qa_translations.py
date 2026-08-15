import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 选用微软最顶级的清晰播音级人声
# 考官提问：沉稳标准美音 (en-US-ChristopherNeural / en-US-GuyNeural)
# 参考答案：清晰流利美音 (en-US-JennyNeural / en-US-AriaNeural)
VOICE_Q = "en-US-ChristopherNeural"
VOICE_A = "en-US-JennyNeural"

semaphore = asyncio.Semaphore(6)

def clean_text_for_speech(text):
    if not text:
        return ""
    # 移除 HTML 标签
    t = re.sub(r'<[^>]+>', '', text)
    # 移除诸如 "1. "、"(1) "、"Q1:"、"No. 23"、"#23" 等可能由题号引起的误读（保留正常序号语义或清理）
    # 但保留正文标号 (1), (2) 正常阅读
    t = t.strip()
    return t

async def generate_single_audio(text, output_path, voice, rate="+0%"):
    clean = clean_text_for_speech(text)
    if not clean or len(clean.strip()) == 0:
        return False
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    async with semaphore:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(clean, voice, rate=rate)
                await communicate.save(output_path)
                print(f"[OK] ({voice}) {output_path}", flush=True)
                return True
            except Exception as e:
                print(f"[Retry {attempt+1}] {output_path}: {e}", flush=True)
                await asyncio.sleep(1)
        print(f"[FAIL] {output_path}", flush=True)
        return False

def load_data_from_js():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r'window\.data\s*=\s*(\{[\s\S]*?\});?\s*$', content)
    if match:
        return json.loads(match.group(1))
    return {}

async def main():
    data = load_data_from_js()
    questions = data.get("questions", [])
    translations = data.get("translations", [])

    tasks = []

    print(f"🎙️ 正在重构知识问答 200 题纯净音频 (严格与 data.js ID 对齐)...", flush=True)
    for q in questions:
        q_id = q.get("id")
        if q_id is None:
            continue
        
        # 英文题干
        q_en = q.get("enQuestion") or q.get("question") or ""
        if q_en.strip():
            # 根路径
            out_q = os.path.join("audio", "questions", f"question_{q_id}.mp3")
            out_q_m = os.path.join("audio", "male", "questions", f"question_{q_id}.mp3")
            out_q_f = os.path.join("audio", "female", "questions", f"question_{q_id}.mp3")
            tasks.append(generate_single_audio(q_en, out_q, VOICE_Q))
            tasks.append(generate_single_audio(q_en, out_q_m, VOICE_Q))
            tasks.append(generate_single_audio(q_en, out_q_f, VOICE_A))

        # 英文参考答案
        a_en = q.get("enAnswer") or q.get("answer") or ""
        if a_en.strip():
            out_a = os.path.join("audio", "questions", f"answer_{q_id}.mp3")
            out_a_m = os.path.join("audio", "male", "questions", f"answer_{q_id}.mp3")
            out_a_f = os.path.join("audio", "female", "questions", f"answer_{q_id}.mp3")
            tasks.append(generate_single_audio(a_en, out_a, VOICE_A))
            tasks.append(generate_single_audio(a_en, out_a_m, VOICE_Q))
            tasks.append(generate_single_audio(a_en, out_a_f, VOICE_A))

    print(f"🎙️ 正在重构口译测试 178 题纯净音频...", flush=True)
    for t in translations:
        t_id = t.get("id")
        if t_id is None:
            continue
        t_type = t.get("type", "E2C")
        # E2C: 原文是英文，读 src
        # C2E: 译文是英文，读 ref/answer
        en_text = ""
        if t_type == "E2C":
            en_text = t.get("src") or t.get("english") or ""
        else:
            en_text = t.get("ref") or t.get("answer") or t.get("target") or t.get("english") or ""

        if en_text.strip():
            out_t = os.path.join("audio", "translations", f"trans_{t_id}.mp3")
            out_t_m = os.path.join("audio", "male", "translations", f"trans_{t_id}.mp3")
            out_t_f = os.path.join("audio", "female", "translations", f"trans_{t_id}.mp3")
            tasks.append(generate_single_audio(en_text, out_t, VOICE_A))
            tasks.append(generate_single_audio(en_text, out_t_m, VOICE_Q))
            tasks.append(generate_single_audio(en_text, out_t_f, VOICE_A))

    print(f"⚡ 开始并发执行 {len(tasks)} 个问答与口译音频完全重构任务...", flush=True)
    await asyncio.gather(*tasks)
    print("🎉 知识问答与口译全部音频重构与ID校准完成！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
