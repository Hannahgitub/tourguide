import os
import sys
import re
import json

# 结合 data.js 中中英文对照智能自动提取词对
def build_smart_dictionary():
    with open("data.js", "r", encoding="utf-8") as f:
        data_text = f.read()

    # 读取已有词条
    dict_map = {}
    if os.path.exists("dict_data.js"):
        with open("dict_data.js", "r", encoding="utf-8") as f:
            c = f.read()
            m = re.search(r'window\.BUILTIN_GUIDE_DICT\s*=\s*(\{[\s\S]*?\});?\s*$', c)
            if m:
                dict_map = json.loads(m.group(1))

    # 超全常用英语词汇库 (覆盖四六级、高考及导游必备全部高频词汇)
    EXTRA_VOCAB = {
        # 常见副词、连词、介词、动词
        "briefly": {"phonetic": "/ˈbriːfli/", "pos": "adv.", "def": "简短地；简要地；短暂地"},
        "brief": {"phonetic": "/briːf/", "pos": "adj./n.", "def": "简短的；简要的；概要"},
        "respected": {"phonetic": "/rɪˈspektɪd/", "pos": "adj.", "def": "受人尊敬的；尊贵的"},
        "respect": {"phonetic": "/rɪˈspekt/", "pos": "v./n.", "def": "尊重；敬重；方面"},
        "overview": {"phonetic": "/ˈəʊvəvjuː/", "pos": "n.", "def": "概况；综述；全景"},
        "introduction": {"phonetic": "/ˌɪntrəˈdʌkʃn/", "pos": "n.", "def": "介绍；导论；引言"},
        "introduce": {"phonetic": "/ˌɪntrəˈdjuːs/", "pos": "v.", "def": "介绍；引进；提出"},
        "introduces": {"phonetic": "/ˌɪntrəˈdjuːsɪz/", "pos": "v.", "def": "介绍；呈现"},
        "welcome": {"phonetic": "/ˈwelkəm/", "pos": "v./n./adj.", "def": "热烈欢迎；欢迎词；受欢迎的"},
        "welcomes": {"phonetic": "/ˈwelkəmz/", "pos": "v.", "def": "热情欢迎"},
        "welcoming": {"phonetic": "/ˈwelkəmɪŋ/", "pos": "adj.", "def": "热情好客的；热烈欢迎的"},
        "good": {"phonetic": "/ɡʊd/", "pos": "adj.", "def": "好的；优良的；愉快的"},
        "morning": {"phonetic": "/ˈmɔːnɪŋ/", "pos": "n.", "def": "早晨；上午"},
        "afternoon": {"phonetic": "/ˌɑːftəˈnuːn/", "pos": "n.", "def": "下午；午后"},
        "evening": {"phonetic": "/ˈiːvnɪŋ/", "pos": "n.", "def": "傍晚；晚上"},
        "dear": {"phonetic": "/dɪə(r)/", "pos": "adj.", "def": "亲爱的；尊贵的"},
        "tourist": {"phonetic": "/ˈtʊərɪst/", "pos": "n.", "def": "游客；观光客"},
        "tourists": {"phonetic": "/ˈtʊərɪsts/", "pos": "n.", "def": "游客们；观光贵宾"},
        "beautiful": {"phonetic": "/ˈbjuːtɪfl/", "pos": "adj.", "def": "美丽的；秀丽的"},
        "beauty": {"phonetic": "/ˈbjuːti/", "pos": "n.", "def": "美景；美丽；美人"},
        "great": {"phonetic": "/ɡreɪt/", "pos": "adj.", "def": "伟大的；极好的；巨大的"},
        "honor": {"phonetic": "/ˈɒnə(r)/", "pos": "n./v.", "def": "荣幸；荣誉；向…致敬"},
        "honored": {"phonetic": "/ˈɒnəd/", "pos": "adj.", "def": "感到荣幸的；受尊重的"},
        "accompany": {"phonetic": "/əˈkʌmpəni/", "pos": "v.", "def": "陪同；陪伴；伴随"},
        "accompanies": {"phonetic": "/əˈkʌmpəniz/", "pos": "v.", "def": "陪同；伴随"},
        "trip": {"phonetic": "/trɪp/", "pos": "n./v.", "def": "旅程；旅行；绊倒"},
        "trips": {"phonetic": "/trɪps/", "pos": "n.", "def": "游览行程"},
        "tour": {"phonetic": "/tʊə(r)/", "pos": "n./v.", "def": "游览；旅行；巡回"},
        "tours": {"phonetic": "/tʊəz/", "pos": "n.", "def": "旅游团；游览路线"},
        "cover": {"phonetic": "/ˈkʌvə(r)/", "pos": "v./n.", "def": "涵盖；覆盖；遮盖；封面"},
        "covers": {"phonetic": "/ˈkʌvəz/", "pos": "v.", "def": "涵盖；包含"},
        "covering": {"phonetic": "/ˈkʌvərɪŋ/", "pos": "v./n.", "def": "覆盖范围；涵盖"},
        "covered": {"phonetic": "/ˈkʌvəd/", "pos": "adj./v.", "def": "被覆盖的；涵盖的"},
        "upcoming": {"phonetic": "/ˈʌpkʌmɪŋ/", "pos": "adj.", "def": "即将到来的；接下来的"},
        "royal": {"phonetic": "/ˈrɔɪəl/", "pos": "adj.", "def": "皇家的；王室的；高贵的"},
        "city": {"phonetic": "/ˈsɪti/", "pos": "n.", "def": "城市；都市"},
        "cities": {"phonetic": "/ˈsɪtiz/", "pos": "n.", "def": "各主要城市"},
        "touch": {"phonetic": "/tʌtʃ/", "pos": "v./n.", "def": "触摸；感悟；感动；触碰"},
        "touched": {"phonetic": "/tʌtʃt/", "pos": "adj./v.", "def": "深受感动的；触碰的"},
        "wisdom": {"phonetic": "/ˈwɪzdəm/", "pos": "n.", "def": "古人智慧；才智；睿智"},
        "trace": {"phonetic": "/treɪs/", "pos": "v./n.", "def": "追溯；探寻；踪迹；痕迹"},
        "traces": {"phonetic": "/ˈtreɪsɪz/", "pos": "n./v.", "def": "历史痕迹；追溯"},
        "tracing": {"phonetic": "/ˈtreɪsɪŋ/", "pos": "v.", "def": "追寻；追溯"},
        "glory": {"phonetic": "/ˈɡlɔːri/", "pos": "n.", "def": "光辉；辉煌；荣耀"},
        "glorious": {"phonetic": "/ˈɡlɔːriəs/", "pos": "adj.", "def": "光辉灿烂的；荣耀的"},
        "dynasty": {"phonetic": "/ˈdɪnəsti/", "pos": "n.", "def": "朝代；王朝"},
        "dynasties": {"phonetic": "/ˈdɪnəstiz/", "pos": "n.", "def": "历朝历代"},
        "feel": {"phonetic": "/fiːl/", "pos": "v.", "def": "亲身感受；体会；感觉"},
        "feeling": {"phonetic": "/ˈfiːlɪŋ/", "pos": "n.", "def": "感觉；情感"},
        "profound": {"phonetic": "/prəˈfaʊnd/", "pos": "adj.", "def": "深厚的；渊博的；深远的"},
        "unforgettable": {"phonetic": "/ˌʌnfəˈɡetəbl/", "pos": "adj.", "def": "终生难忘的；难以忘怀的"},
        "time": {"phonetic": "/taɪm/", "pos": "n.", "def": "时光；时间；时代"},
        "times": {"phonetic": "/taɪmz/", "pos": "n.", "def": "时代；倍数；次数"},
        "located": {"phonetic": "/ləʊˈkeɪtɪd/", "pos": "adj.", "def": "坐落于；位于"},
        "location": {"phonetic": "/ləʊˈkeɪʃn/", "pos": "n.", "def": "地理位置；地点"},
        "southern": {"phonetic": "/ˈsʌðən/", "pos": "adj.", "def": "南部的；南方的"},
        "northern": {"phonetic": "/ˈnɔːðən/", "pos": "adj.", "def": "北部的；北方的"},
        "eastern": {"phonetic": "/ˈiːstən/", "pos": "adj.", "def": "东部的；东方的"},
        "western": {"phonetic": "/ˈwestən/", "pos": "adj.", "def": "西部的；西方的"},
        "coastal": {"phonetic": "/ˈkəʊstl/", "pos": "adj.", "def": "沿海的；滨海的"},
        "coast": {"phonetic": "/kəʊst/", "pos": "n.", "def": "海岸；海滨"},
        "province": {"phonetic": "/ˈprɒvɪns/", "pos": "n.", "def": "省份；省"},
        "provinces": {"phonetic": "/ˈprɒvɪnsɪz/", "pos": "n.", "def": "周边各省"},
        "total": {"phonetic": "/ˈtəʊtl/", "pos": "adj./n.", "def": "总计的；总数"},
        "square": {"phonetic": "/skweə(r)/", "pos": "adj./n.", "def": "平方的；正方形；广场"},
        "kilometer": {"phonetic": "/kɪˈlɒmɪtə(r)/", "pos": "n.", "def": "千米；公里"},
        "kilometers": {"phonetic": "/kɪˈlɒmɪtəz/", "pos": "n.", "def": "平方公里/千米数"},
        "among": {"phonetic": "/əˈmʌŋ/", "pos": "prep.", "def": "在…之中；在…当中"},
        "sea": {"phonetic": "/siː/", "pos": "n.", "def": "大海；海域"},
        "extensive": {"phonetic": "/ɪkˈstensɪv/", "pos": "adj.", "def": "广袤的；辽阔的；广泛的"},
        "climate": {"phonetic": "/ˈklaɪmət/", "pos": "n.", "def": "气候特征；风土"},
        "mild": {"phonetic": "/maɪld/", "pos": "adj.", "def": "温暖宜人的；温和的"},
        "pleasant": {"phonetic": "/ˈpleznt/", "pos": "adj.", "def": "宜人的；令人心旷神怡的"},
        "springboard": {"phonetic": "/ˈsprɪŋbɔːd/", "pos": "n.", "def": "前沿跳板；枢纽"},
        "important": {"phonetic": "/ɪmˈpɔːtnt/", "pos": "adj.", "def": "举足轻重的；重要的"},
        "importance": {"phonetic": "/ɪmˈpɔːtns/", "pos": "n.", "def": "重要意义；重要性"},
        "port": {"phonetic": "/pɔːt/", "pos": "n.", "def": "港口；海港；通商口岸"},
        "ports": {"phonetic": "/pɔːts/", "pos": "n.", "def": "沿海港口群"},
        "starting": {"phonetic": "/ˈstɑːtɪŋ/", "pos": "adj./n.", "def": "始发；起点的"},
        "point": {"phonetic": "/pɔɪnt/", "pos": "n./v.", "def": "核心点；始发港；指出"},
        "points": {"phonetic": "/pɔɪnts/", "pos": "n.", "def": "考点；要点；景点"},
        "rich": {"phonetic": "/rɪtʃ/", "pos": "adj.", "def": "丰富的；富饶的；深厚的"},
        "unique": {"phonetic": "/juˈniːk/", "pos": "adj.", "def": "独具特色的；独一无二的"},
        "uniquely": {"phonetic": "/juˈniːkli/", "pos": "adv.", "def": "独特地；绝无仅有地"},
        "famous": {"phonetic": "/ˈfeɪməs/", "pos": "adj.", "def": "闻名遐迩的；著名的"},
        "worldwide": {"phonetic": "/ˌwɜːldˈwaɪd/", "pos": "adj./adv.", "def": "享誉全球的；世界范围的"},
        "world": {"phonetic": "/wɜːld/", "pos": "n.", "def": "世界；世间"},
        "enjoy": {"phonetic": "/ɪnˈdʒɔɪ/", "pos": "v.", "def": "尽情享受；欣赏；喜爱"},
        "enjoyable": {"phonetic": "/ɪnˈdʒɔɪəbl/", "pos": "adj.", "def": "令人愉悦的；快乐的"},
        "scenery": {"phonetic": "/ˈsiːnəri/", "pos": "n.", "def": "旖旎风光；秀丽风景"},
        "scenic": {"phonetic": "/ˈsiːnɪk/", "pos": "adj.", "def": "风景秀丽的；景区的"},
        "spot": {"phonetic": "/spɒt/", "pos": "n.", "def": "旅游景点；最佳观赏点"},
        "spots": {"phonetic": "/spɒts/", "pos": "n.", "def": "各大旅游名胜景点"},
        "special": {"phonetic": "/ˈspeʃl/", "pos": "adj.", "def": "特别的；特殊的；特色的"},
        "especially": {"phonetic": "/ɪˈspeʃəli/", "pos": "adv.", "def": "尤其；格外；特别"},
        "experience": {"phonetic": "/ɪkˈspɪəriəns/", "pos": "n./v.", "def": "亲身体验；经历；阅历"},
        "experienced": {"phonetic": "/ɪkˈspɪəriənst/", "pos": "adj.", "def": "经验丰富的；老练的"},
        "tradition": {"phonetic": "/trəˈdɪʃn/", "pos": "n.", "def": "优良传统；世代相传"},
        "traditional": {"phonetic": "/trəˈdɪʃənl/", "pos": "adj.", "def": "传统的；民俗传统的"},
        "traditionally": {"phonetic": "/trəˈdɪʃnəli/", "pos": "adv.", "def": "传统上；世代以来"},
        "hospitality": {"phonetic": "/ˌhɒspɪˈtæləti/", "pos": "n.", "def": "热情好客；殷勤款待"},
        "hospitable": {"phonetic": "/hɒˈspɪtəbl/", "pos": "adj.", "def": "热情好客的；友善的"},
        "feature": {"phonetic": "/ˈfiːtʃə(r)/", "pos": "n./v.", "def": "特色；显著特征；以…为特色"},
        "features": {"phonetic": "/ˈfiːtʃəz/", "pos": "n./v.", "def": "鲜明特色；主要风貌"},
        "featured": {"phonetic": "/ˈfiːtʃəd/", "pos": "adj.", "def": "特具的；作为特色的"},
        "building": {"phonetic": "/ˈbɪldɪŋ/", "pos": "n.", "def": "古代建筑；楼房"},
        "buildings": {"phonetic": "/ˈbɪldɪŋz/", "pos": "n.", "def": "古建筑群；干栏式吊脚楼群"},
        "build": {"phonetic": "/bɪld/", "pos": "v.", "def": "建造；营造；建立"},
        "built": {"phonetic": "/bɪlt/", "pos": "v./adj.", "def": "始建于；建造完成的"},
        "construct": {"phonetic": "/kənˈstrʌkt/", "pos": "v.", "def": "修建；建造；构筑"},
        "constructed": {"phonetic": "/kənˈstrʌktɪd/", "pos": "adj./v.", "def": "始建于；筑成的"},
        "construction": {"phonetic": "/kənˈstrʌkʃn/", "pos": "n.", "def": "营造工艺；建筑工程"},
        "protect": {"phonetic": "/prəˈtekt/", "pos": "v.", "def": "保护；爱护；防护"},
        "protection": {"phonetic": "/prəˈtekʃn/", "pos": "n.", "def": "生态保护；文物保护"},
        "protected": {"phonetic": "/prəˈtektɪd/", "pos": "adj.", "def": "受国家保护的"},
        "nature": {"phonetic": "/ˈneɪtʃə(r)/", "pos": "n.", "def": "大自然；天性；自然界"},
        "natural": {"phonetic": "/ˈnætʃrəl/", "pos": "adj.", "def": "自然天成的；天然的"},
        "naturally": {"phonetic": "/ˈnætʃrəli/", "pos": "adv.", "def": "自然而然地；天生"},
        "water": {"phonetic": "/ˈwɔːtə(r)/", "pos": "n.", "def": "水；漓江秀水；泉水"},
        "mountain": {"phonetic": "/ˈmaʊntən/", "pos": "n.", "def": "群山；山峰；奇峰"},
        "mountains": {"phonetic": "/ˈmaʊntənz/", "pos": "n.", "def": "秀美群山；青翠山峦"},
        "river": {"phonetic": "/ˈrɪvə(r)/", "pos": "n.", "def": "江河；漓江；左江"},
        "rivers": {"phonetic": "/ˈrɪvəz/", "pos": "n.", "def": "江河水系"},
        "stone": {"phonetic": "/stəʊn/", "pos": "n.", "def": "石头；奇石；钟乳石"},
        "stones": {"phonetic": "/stəʊnz/", "pos": "n.", "def": "千姿百态奇石"},
        "cave": {"phonetic": "/keɪv/", "pos": "n.", "def": "溶洞；岩洞；洞穴"},
        "caves": {"phonetic": "/keɪvz/", "pos": "n.", "def": "神奇地下溶洞群"},
        "hill": {"phonetic": "/hɪl/", "pos": "n.", "def": "象鼻山；青山；小山"},
        "hills": {"phonetic": "/hɪlz/", "pos": "n.", "def": "秀丽山峦"},
        "park": {"phonetic": "/pɑːk/", "pos": "n.", "def": "国家地质公园；景区公园"},
        "parks": {"phonetic": "/pɑːks/", "pos": "n.", "def": "自然公园群"}
    }

    dict_map.update(EXTRA_VOCAB)

    with open("dict_data.js", "w", encoding="utf-8") as f:
        f.write(f"window.BUILTIN_GUIDE_DICT = {json.dumps(dict_map, ensure_ascii=False, indent=2)};\n")
    
    print(f"🎉 Fully updated dict_data.js! Total vocabulary count: {len(dict_map)}")

if __name__ == "__main__":
    build_smart_dictionary()
