import os
import sys
import json
import re
import asyncio
import edge_tts

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

VOICE = "en-US-JennyNeural"
Q_AUDIO_DIR = os.path.join("audio", "questions")
T_AUDIO_DIR = os.path.join("audio", "translations")

def is_mostly_english(text):
    if not text:
        return False
    letters = len(re.findall(r'[a-zA-Z]', text))
    return letters >= 5

def clean_english_text(text):
    clean = re.sub(r'<[^>]+>', '', text)
    lines = clean.split('\n')
    en_lines = []
    for line in lines:
        if len(re.findall(r'[a-zA-Z]', line)) >= 3:
            en_lines.append(line.strip())
    res = ' '.join(en_lines).strip()
    return res

async def generate_audio(text, output_path):
    if not text:
        return False
    communicate = edge_tts.Communicate(text, VOICE, rate="+0%")
    await communicate.save(output_path)
    print(f"[OK] {output_path}", flush=True)
    return True

async def main():
    os.makedirs(Q_AUDIO_DIR, exist_ok=True)
    os.makedirs(T_AUDIO_DIR, exist_ok=True)

    # 1. 处理问答题 (questions.json)
    if os.path.exists("questions.json"):
        with open("questions.json", "r", encoding="utf-8") as f:
            questions = json.load(f)
        
        print(f"🎙️ 开始生成问答题英文音频 (共 {len(questions)} 题)...", flush=True)
        for q in questions:
            q_id = q.get("id")
            q_text = q.get("question", "")
            a_text = q.get("answer", "")

            # 题干如果是英文
            if is_mostly_english(q_text):
                clean_q = clean_english_text(q_text)
                out_q = os.path.join(Q_AUDIO_DIR, f"question_{q_id}.mp3")
                if not (os.path.exists(out_q) and os.path.getsize(out_q) > 0):
                    try:
                        await generate_audio(clean_q, out_q)
                    except Exception as e:
                        print(f"[FAIL] Q_question {q_id}: {e}", flush=True)

            # 答案中的英文
            if is_mostly_english(a_text):
                clean_a = clean_english_text(a_text)
                out_a = os.path.join(Q_AUDIO_DIR, f"answer_{q_id}.mp3")
                if not (os.path.exists(out_a) and os.path.getsize(out_a) > 0):
                    try:
                        await generate_audio(clean_a, out_a)
                    except Exception as e:
                        print(f"[FAIL] Q_answer {q_id}: {e}", flush=True)

    # 2. 处理中英互译 (translations.json)
    if os.path.exists("translations.json"):
        with open("translations.json", "r", encoding="utf-8") as f:
            translations = json.load(f)

        print(f"🎙️ 开始生成中英口译英文音频 (共 {len(translations)} 题)...", flush=True)
        for t in translations:
            t_id = t.get("id")
            t_type = t.get("type", "E2C")
            src = t.get("src", "")
            ref = t.get("ref", "")

            # E2C: src 是英文原句
            if t_type == 'E2C' and is_mostly_english(src):
                clean_t = clean_english_text(src)
                out_t = os.path.join(T_AUDIO_DIR, f"trans_{t_id}.mp3")
                if not (os.path.exists(out_t) and os.path.getsize(out_t) > 0):
                    try:
                        await generate_audio(clean_t, out_t)
                    except Exception as e:
                        print(f"[FAIL] Trans_E2C {t_id}: {e}", flush=True)

            # C2E: ref 是英文译文
            elif t_type == 'C2E' and is_mostly_english(ref):
                clean_t = clean_english_text(ref)
                out_t = os.path.join(T_AUDIO_DIR, f"trans_{t_id}.mp3")
                if not (os.path.exists(out_t) and os.path.getsize(out_t) > 0):
                    try:
                        await generate_audio(clean_t, out_t)
                    except Exception as e:
                        print(f"[FAIL] Trans_C2E {t_id}: {e}", flush=True)

    print("✨ 所有问答题与口译题音频生成完毕！", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
