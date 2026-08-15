import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 选用微软最顶级的清晰、自然播音发音人
VOICE_SPEECH = "en-US-AriaNeural"       # 导游词：典雅、圆润、播音级美音
VOICE_QA_Q = "en-US-ChristopherNeural"  # 问答提问：沉稳考官音
VOICE_QA_A = "en-US-AriaNeural"         # 问答答案：清晰流畅考生/示范音
VOICE_INTERP = "en-US-JennyNeural"      # 口译：地道纯正标准英美双向音

RATE_SPEECH = "-4%"   # 导游词黄金语速：清晰不模糊，吐字饱满
RATE_QA = "-3%"
RATE_INTERP = "-3%"

semaphore = asyncio.Semaphore(5) # 控制并发数

async def generate_single_audio(text, output_path, voice, rate):
    if not text or len(text.strip()) == 0:
        return False
    
    # 如果已存在且文件正常则跳过
    if os.path.exists(output_path) and os.path.getsize(output_path) > 100:
        return True

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    async with semaphore:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate)
                await communicate.save(output_path)
                print(f"[OK] {output_path}", flush=True)
                return True
            except Exception as e:
                print(f"[Retry {attempt+1}] {output_path}: {e}", flush=True)
                await asyncio.sleep(1)
        print(f"[FAIL] {output_path}", flush=True)
        return False

async def main():
    tasks = []

    # 1. 导游词 189 个自然段
    if os.path.exists("speech_audio_tasks.json"):
        with open("speech_audio_tasks.json", "r", encoding="utf-8") as f:
            speeches = json.load(f)
        
        print(f"🎙️ 正在生成导游词全量音频 (共 {len(speeches)} 篇)...", flush=True)
        for sp in speeches:
            name = sp["name"]
            safe_name_gx = "广西 " + re.sub(r'[\\/:*?"<>|]', '_', name).strip()
            safe_name_direct = re.sub(r'[\\/:*?"<>|]', '_', name).strip()

            dir_gx = os.path.join("audio", safe_name_gx)
            dir_direct = os.path.join("audio", safe_name_direct)

            for sec in sp["sections"]:
                idx = sec["idx"]
                text = sec["text"]
                out_gx = os.path.join(dir_gx, f"section_{idx}.mp3")
                out_direct = os.path.join(dir_direct, f"section_{idx}.mp3")
                tasks.append(generate_single_audio(text, out_gx, VOICE_SPEECH, RATE_SPEECH))
                # 同时也生成直接名称目录，确保兼容
                tasks.append(generate_single_audio(text, out_direct, VOICE_SPEECH, RATE_SPEECH))

    # 2. 问答题 200 题全量题干与答案
    if os.path.exists("questions.json"):
        with open("questions.json", "r", encoding="utf-8") as f:
            questions = json.load(f)
        
        print(f"🎙️ 正在生成知识问答全量音频 (共 {len(questions)} 题)...", flush=True)
        for q in questions:
            q_id = q.get("id")
            # 题干英文
            q_en = q.get("enQuestion") or q.get("question") or ""
            # 清洗题干
            clean_q = re.sub(r'<[^>]+>', '', q_en).strip()
            if len(clean_q) > 0:
                out_q = os.path.join("audio", "questions", f"question_{q_id}.mp3")
                tasks.append(generate_single_audio(clean_q, out_q, VOICE_QA_Q, RATE_QA))

            # 答案英文
            a_en = q.get("enAnswer") or q.get("answer") or ""
            clean_a = re.sub(r'<[^>]+>', '', a_en).strip()
            if len(clean_a) > 0:
                out_a = os.path.join("audio", "questions", f"answer_{q_id}.mp3")
                tasks.append(generate_single_audio(clean_a, out_a, VOICE_QA_A, RATE_QA))

    # 3. 口译测试 178 题参考译文全量高清重塑
    if os.path.exists("translations.json"):
        with open("translations.json", "r", encoding="utf-8") as f:
            translations = json.load(f)
        
        print(f"🎙️ 正在生成口译测试全量音频 (共 {len(translations)} 题)...", flush=True)
        for t in translations:
            t_id = t.get("id")
            t_text = t.get("english") or t.get("answer") or t.get("target") or ""
            clean_t = re.sub(r'<[^>]+>', '', t_text).strip()
            if len(clean_t) > 0:
                out_t = os.path.join("audio", "translations", f"trans_{t_id}.mp3")
                tasks.append(generate_single_audio(clean_t, out_t, VOICE_INTERP, RATE_INTERP))

    print(f"⚡ 开始并发执行 {len(tasks)} 个音频生成任务...", flush=True)
    await asyncio.gather(*tasks)
    print("🎉 全部音频生成与升级完毕！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
