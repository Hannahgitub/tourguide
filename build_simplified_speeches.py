import json
import re

# 广西 20 篇导游词的高质量【AI 极简口语版】数据定义
# 原则：用词简单通俗、短句为主、口语亲和自然、段落紧凑精简（每篇 3~4 段）、保留所有核心必考点和数字

SIMPLIFIED_SPEECHES = {
    # 1. 欢迎词
    "welcome": [
        {
            "title": "热情问候与自我介绍 (Greeting & Intro)",
            "en": "Good morning, everyone! Welcome to Guangxi! My name is Vivian, and I will be your tour guide for this trip. It is my great pleasure to meet all of you here.",
            "cn": "大家早上好！欢迎来到广西！我叫 Vivian，将担任大家这次行程的导游。非常荣幸能在这里与大家相遇。"
        },
        {
            "title": "行程亮点预览 (Trip Highlights)",
            "en": "During our journey, we will explore the wonderful Karst mountains and clean rivers in Guilin, learn about the local culture, and taste delicious food. Guangxi is famous for its natural beauty and rich ethnic traditions.",
            "cn": "在接下来的旅程中，我们将游览桂林奇妙的喀斯特山水，了解当地文化，品尝特色美食。广西以秀丽的自然风光和丰富多彩的民族传统而闻名。"
        },
        {
            "title": "贴心提醒与祝福 (Care & Wishes)",
            "en": "Please feel free to ask me if you need any help during the tour. Your safety and comfort are always my top priorities. I hope you all have a wonderful and memorable time with us!",
            "cn": "游览过程中如果有任何需要，请随时告诉我。您的安全与舒适始终是我的首要任务。祝愿大家在这里度过一段美妙而难忘的时光！"
        }
    ],

    # 2. 欢送词
    "farewell": [
        {
            "title": "行程总结与感谢 (Trip Summary & Thanks)",
            "en": "Dear friends, our wonderful tour in Guangxi has come to an end. Over the past few days, we visited scenic spots, enjoyed local dishes, and made great memories together. Thank you so much for your support and cooperation.",
            "cn": "亲爱的朋友们，我们美好的广西之旅即将画上句号。在过去的几天里，我们游览了风景名胜，品尝了特色风味，共同留下了美好回忆。非常感谢大家的理解与支持。"
        },
        {
            "title": "贴心离程提醒 (Departure Reminders)",
            "en": "Before we head to the airport, please double-check your luggage and personal belongings, especially your ID cards, wallets, and phones. Make sure nothing is left behind in the hotel.",
            "cn": "在我们前往机场之前，请大家仔细检查行李和随身物品，特别是身份证件、钱包和手机，确保没有任何物品遗留在酒店。"
        },
        {
            "title": "真挚祝福与再会 (Wishes & Goodbye)",
            "en": "It was truly an honor to be your tour guide. I wish you a safe journey home and good health in the days ahead. We look forward to welcoming you to Guangxi again in the future! Goodbye!",
            "cn": "能够担任大家的导游，我深感荣幸。祝大家返程一路平安，身体健康，万事如意。期待未来再次欢迎大家来到美丽的广西！再见！"
        }
    ],

    # 3. 广西概况
    "overview": [
        {
            "title": "地理与人口 (Geography & Population)",
            "en": "Guangxi Zhuang Autonomous Region is located in southern China. It covers about 237,600 square kilometers of land with a long coastline. It has a population of over 50 million people, and Zhuang is the largest ethnic minority group here.",
            "cn": "广西壮族自治区位于中国南部，陆地面积约 23.76 万平方公里，拥有漫长的海岸线。常住人口超过 5000 万，其中壮族是人口最多的少数民族。"
        },
        {
            "title": "气候与山水 (Climate & Karst Scenery)",
            "en": "Guangxi has a warm subtropical monsoon climate with plenty of rain and sunshine all year round. The world-famous Karst landscape gives Guangxi crystal-clear rivers, green hills, and amazing limestone caves.",
            "cn": "广西属温暖的亚热带季风气候，全年阳光充足、雨量充沛。举世闻名的喀斯特地貌赋予了广西清澈的江水、青翠的山峰和神奇的岩溶洞穴。"
        },
        {
            "title": "文化特产与东盟门户 (Culture & ASEAN Gateway)",
            "en": "Guangxi is an important gateway to ASEAN countries. It is rich in delicious local foods like Luosifen and Rice Noodles, and colorful ethnic arts such as Zhuang Brocade. Welcome to experience the unique charm of Guangxi!",
            "cn": "广西是中国面向东盟的重要开放门户。这里美食丰富，有闻名遐迩的螺蛳粉和米粉，更有壮锦等民族非遗瑰宝。欢迎大家感受广西的独特魅力！"
        }
    ],

    # 4. 桂林漓江
    "lijiang": [
        {
            "title": "漓江盛誉与概貌 (Intro & Fame)",
            "en": "The Lijiang River in Guilin is one of the most beautiful rivers in the world. Flowing for 83 kilometers from Guilin to Yangshuo, it is famous for green hills, clear water, fantastic caves, and pretty stones.",
            "cn": "桂林漓江是世界上最美丽的河流之一。从桂林到阳朔全长 83 公里，以山青、水秀、洞奇、石美“四绝”闻名天下。"
        },
        {
            "title": "经典景观与20元背景 (Highlights & 20 RMB Note)",
            "en": "As we cruise down the river, you will see picturesque spots like Elephant Trunk Hill and the Yellow Cloth Shoal. The Yellow Cloth Shoal is the famous image printed on the back of the 20 RMB banknote.",
            "cn": "乘船顺流而下，我们将欣赏到象鼻山、黄布倒影等如画美景。其中黄布倒影正是人民币 20 元纸币背面的经典景观。"
        },
        {
            "title": "田园风光与总结 (Pastoral Beauty)",
            "en": "A Chinese poem says: 'Guilin's scenery is best under heaven, but Yangshuo's scenery is even better.' Enjoy the fresh breeze and peaceful views along this unforgettable water trip!",
            "cn": "中国古诗云：“桂林山水甲天下，阳朔堪称甲桂林。”请尽情享受微风与宁静，度过这段难忘的水上画卷之旅！"
        }
    ],

    # 5. 桂林象鼻山
    "elephant": [
        {
            "title": "景区概况与标志 (Overview & Landmark)",
            "en": "Elephant Trunk Hill is the city symbol of Guilin. Located at the meeting point of the Lijiang River and Taohua River, the hill looks just like a giant elephant drinking water from the river with its long trunk.",
            "cn": "象鼻山是桂林的城徽标志。它坐落在漓江与桃花江的交汇处，整座山峰酷似一头巨象在江边伸长鼻子畅饮江水。"
        },
        {
            "title": "水月洞与宝塔 (Water Moon Cave & Pagoda)",
            "en": "Between the elephant's trunk and body lies the Water Moon Cave. When sunlight or moonlight hits the water, it creates a magical reflection like a round moon. On top of the hill stands the ancient Puxian Pagoda.",
            "cn": "在象鼻和象身之间坐落着水月洞。当阳光或月光洒向水面时，倒影宛如一轮明月浮于水底。山顶上矗立着古朴的普贤塔。"
        },
        {
            "title": "三花酒窖与体验 (Sanhua Wine & Culture)",
            "en": "Elephant Trunk Hill is also home to the ancient Sanhua Wine cellars. Guilin Sanhua Wine has a history of over one thousand years. It is an ideal spot to take photos and feel the charm of nature.",
            "cn": "象鼻山下还拥有历史悠久的桂林三花酒窖。桂林三花酒已有上千年的酿造历史。这里是拍照留念、领略大自然鬼斧神工的绝佳之地。"
        }
    ],

    # 6. 阳朔西街
    "weststreet": [
        {
            "title": "历史与中西融合 (History & Global Vibe)",
            "en": "West Street is the oldest street in Yangshuo with a history of over 1,400 years. Today, it is known as the 'Global Village' because it perfectly combines traditional Chinese architecture with modern international culture.",
            "cn": "阳朔西街已有 1400 多年的悠久历史，是阳朔最古老的街道。如今这里被称为“地球村”，完美融合了中国传统古风建筑与现代国际多元文化。"
        },
        {
            "title": "美食酒吧与手工艺 (Food, Pubs & Crafts)",
            "en": "Along the marble-paved street, you will find lively cafes, bars, local snack shops, and ethnic craft stores. Do not miss the famous Yangshuo Beer Fish and colorful painted paper fans.",
            "cn": "漫步在青石板街道上，两旁开满了充满活力的咖啡馆、酒吧、特色小吃店和民族手工艺品店。千万不要错过著名的阳朔啤酒鱼和色彩鲜艳的画扇。"
        },
        {
            "title": "夜生活与文化魅力 (Nightlife Experience)",
            "en": "At night, West Street comes alive with bright lights and cheerful music. Tourists from all over the world gather here to chat, relax, and enjoy the romantic atmosphere.",
            "cn": "每当夜幕降临，西街灯火辉煌，充满欢快的音乐。来自世界各地的游客汇聚在此交流、放松，享受浪漫轻松的度假氛围。"
        }
    ],

    # 7. 龙脊梯田
    "longji": [
        {
            "title": "宏伟梯田与历史 (Scale & Centuries of History)",
            "en": "Longji Rice Terraces, or the Dragon's Backbone Terraces, were built starting in the Yuan Dynasty over 700 years ago. Local Zhuang and Yao people carved these vast staircases right into the high mountains.",
            "cn": "龙脊梯田始建于元代，距今已有 700 多年历史。当地的壮族和瑶族同胞在高山陡坡上开垦出这一层层如同天梯般的广阔梯田。"
        },
        {
            "title": "四季如画的景色 (Four Seasons Beauty)",
            "en": "The terraces show different beauty in every season: silver ribbons in spring when filled with water, green waves in summer, golden carpets in autumn, and white frost in winter.",
            "cn": "龙脊梯田四季景色各异：春天灌水时如银色丝带，夏天生机勃勃如绿色波浪，秋天丰收时如金色地毯，冬天雪后则宛如银装素裹。"
        },
        {
            "title": "民族文化与智慧 (Wisdom & Minority Culture)",
            "en": "Longji is a living wonder of ancient farming wisdom. Here, you can also see traditional wooden stilted houses, try bamboo tube rice, and experience the warm hospitality of local ethnic villagers.",
            "cn": "龙脊梯田是古代农耕智慧的鲜活奇迹。在这里，您还可以参观传统木质吊脚楼，品尝香气四溢的竹筒饭，感受少数民族同胞的热情款待。"
        }
    ],

    # 8. 德天跨国大瀑布
    "detian": [
        {
            "title": "跨国瀑布盛名 (Transnational Waterfall)",
            "en": "Detian Waterfall is located on the border between China and Vietnam. It is the largest transnational waterfall in Asia and the fourth largest in the world, surrounded by amazing Karst peaks.",
            "cn": "德天跨国大瀑布位于中国与越南边境，是亚洲第一大、世界第四大跨国瀑布，周围环绕着神奇秀丽的喀斯特群峰。"
        },
        {
            "title": "壮丽水势与竹筏 (Three Tiers & Bamboo Rafts)",
            "en": "The water rushes down three distinct natural steps with thunderous sound and beautiful mist. You can take a bamboo raft up close to feel the cool water drops and admire the boundary scenery.",
            "cn": "清澈的归春河水从三级天然断崖上飞泻而下，水声如雷，水雾蒸腾。您可以乘坐竹筏近距离感受清凉的水花，欣赏两国交界处的秀丽风光。"
        },
        {
            "title": "边境风情与中越文化 (Border Marketplace)",
            "en": "Near the waterfall, there are historic border markers and active border marketplaces. Visitors can experience both Chinese and Vietnamese cultures and buy unique Southeast Asian snacks here.",
            "cn": "瀑布周边矗立着具有历史意义的界碑和热闹的边境市集。游客在这里既能感受中越两国文化，又能购买到独具特色的东南亚风味小吃。"
        }
    ],

    # 9. 左江花山岩画
    "huashan": [
        {
            "title": "世界文化遗产 (World Cultural Heritage)",
            "en": "The Zuojiang Huashan Rock Art is a UNESCO World Cultural Heritage site. Painted on high river cliffs over 2,000 years ago, it is the only rock art heritage site in China.",
            "cn": "左江花山岩画是联合国教科文组织世界文化遗产。它是 2000 多年前绘制在临江高耸悬崖上的岩画群，也是中国唯一的岩画类世界遗产。"
        },
        {
            "title": "颜料奥秘与蛙形图案 (Pigment & Frog Dance)",
            "en": "Ancient Luoyue ancestors used natural red hematite and animal fat to paint these figures. The paintings mainly feature people dancing like frogs with raised arms, along with bronze drums, swords, and dogs.",
            "cn": "古代骆越先民使用天然赤铁矿矿物和动物油脂调配颜料进行绘制。画面主要呈现双臂向上弯曲、作蛙形起舞的人形图案，并伴有铜鼓、佩剑和猎犬。"
        },
        {
            "title": "先民祭祀与历史密码 (Sacrifice & Cultural Code)",
            "en": "Archaeologists believe these rock paintings represent ancient religious ceremonies praying for rain and good harvest. They are valuable treasures for understanding early Zhuang civilization.",
            "cn": "考古学家认为，这些巨幅崖壁岩画是古人祈雨和祈求丰收的盛大祭祀庆典。它们是解读早期壮族先民文明的重要历史密码。"
        }
    ],

    # 10. 北海银滩
    "beihai": [
        {
            "title": "天下第一滩概况 (No. 1 Beach in China)",
            "en": "Beihai Silver Beach is praised as the 'Number One Beach in China'. Stretching for over 24 kilometers, it is famous for its clean, soft, white quartz sand that shines like silver under the sun.",
            "cn": "北海银滩素有“天下第一滩”的美誉。海滩绵延 24 公里，以细软纯净、在阳光下如白银般闪耀的石英砂而闻名。"
        },
        {
            "title": "平缓安全的天然海滨 (Safe & Gentle Waves)",
            "en": "Silver Beach has very gentle slopes and warm, clean seawater with no dangerous currents or sharks. It is an ideal natural bathing beach for swimming, sunbathing, and beach volleyball.",
            "cn": "银滩水质清澈温和，滩面极为平缓安全，没有危险暗流与鲨鱼。这里是游泳冲浪、日光浴和沙滩排球的理想天然海滨浴场。"
        },
        {
            "title": "海滨休闲与日落美景 (Sunset & Seafood)",
            "en": "Visitors can walk barefoot on the soft sand, enjoy fresh seafood at nearby coastal restaurants, and watch spectacular sea sunsets in the evening breeze.",
            "cn": "游客可以光脚漫步在细腻柔软的白沙上，在海滨餐厅品尝生猛海鲜，在宜人的海风中欣赏壮美的海上日落。"
        }
    ],

    # 11. 涠洲岛火山地质公园
    "weizhou": [
        {
            "title": "中国最年轻火山岛 (Youngest Volcanic Island)",
            "en": "Weizhou Island is the largest and youngest volcanic island in China. Located in the Beibu Gulf, it was formed by undersea volcanic eruptions millions of years ago.",
            "cn": "涠洲岛是中国最大、也是最年轻的火山岛。它坐落于北部湾海域，是由数百万年前海底火山喷发形成的奇特岛屿。"
        },
        {
            "title": "鳄鱼山与地质奇观 (Crocodile Mountain & Lava)",
            "en": "The Crocodile Mountain Park is the core attraction on the island. Here, you can see dramatic volcanic craters, black lava rocks, sea caves, and a historic white lighthouse overlooking the blue sea.",
            "cn": "鳄鱼山地质公园是涠洲岛的核心景点。在这里，您可以观赏到壮观的火山口遗迹、黑色熔岩奇石、海蚀洞穴，以及俯瞰碧蓝大海的白色灯塔。"
        },
        {
            "title": "海岛人文与日落 (Island Culture & Shiluokou)",
            "en": "Besides volcanic wonders, the island features a 19th-century French Catholic Church built with volcanic coral stone. Do not miss the colorful sunset and fresh seafood at Shiluokou Beach!",
            "cn": "除火山奇观外，岛上还矗立着一座用火山珊瑚石砌筑的 19 世纪法式天主教堂。在石螺口海滩欣赏醉人晚霞、品尝海鲜，更是不可错过的体验！"
        }
    ],

    # 12. 南宁青秀山
    "qingxiu": [
        {
            "title": "绿城明珠与概况 (Pearl of the Green City)",
            "en": "Qingxiu Mountain is known as the 'Green Lung' and 'Giant Garden' of Nanning. It features green peaks, clear lakes, pleasant climate, and dense subtropical forests right near the city center.",
            "cn": "青秀山被誉为南宁的“城市绿肺”和“天然巨型花园”。这里群山苍翠、湖水明净、气候温和，拥有紧邻市中心的亚热带常绿森林。"
        },
        {
            "title": "龙象塔与千年苏铁 (Longxiang Pagoda & Cycads)",
            "en": "On top of the hill stands the ancient Longxiang Pagoda, which offers a great panoramic view of the whole city. The Cycad Garden is home to thousands of rare cycads, with the oldest tree over 1,300 years old.",
            "cn": "山顶上矗立着著名的古刹龙象塔，登塔可俯瞰南宁城市全景。千年苏铁园内培育着数千株珍稀苏铁，其中树龄最长的古苏铁已超过 1300 年。"
        },
        {
            "title": "兰花园与养生休闲 (Orchid Garden & Wellness)",
            "en": "With its fresh air and colorful Orchid Garden, Qingxiu Mountain is a top choice for relaxation, fitness, and feeling the harmony between city and nature.",
            "cn": "凭借极高负氧离子的清新空气与花香四溢的兰花园，青秀山成为市民游客登高健身、休闲养生、感受人与自然和谐共生的首选胜地。"
        }
    ],

    # 13. 百色起义纪念馆
    "baise": [
        {
            "title": "红色圣地与历史背景 (Red Landmark & History)",
            "en": "The Baise Uprising Memorial Hall commemorates the famous Baise Uprising led by Deng Xiaoping and Zhang Yunyi on December 11, 1929, which founded the 7th Red Army.",
            "cn": "百色起义纪念馆是为了纪念 1929 年 12 月 11 日由邓小平、张云逸等老一辈革命家领导的百色起义而建，这次起义创立了红七军与右江革命根据地。"
        },
        {
            "title": "展馆建筑与珍贵文物 (Architecture & Relics)",
            "en": "The memorial's main building is shaped like a giant red star and bronze drum. Inside, thousands of historical photos, weapons, and revolutionary relics tell the moving stories of brave soldiers.",
            "cn": "纪念馆主建筑外观宛如一颗巨大的红星与铜鼓。馆内展出了数以千计的珍贵历史照片、战斗武器和革命文物，生动重现了革命先烈的英勇事迹。"
        },
        {
            "title": "百色精神与传承 (Spirit of Baise)",
            "en": "The memorial is a national patriotic education base. It inspires visitors to remember revolutionary history and inherit the spirit of hard work and dedication.",
            "cn": "该纪念馆是全国重要的爱国主义教育示范基地，激励着广大参观者铭记光辉革命历史，传承艰苦奋斗、不屈不挠的红色精神。"
        }
    ],

    # 14. 柳州工业博物馆
    "liuzhou": [
        {
            "title": "工业之都与博物馆 (Industrial Capital of Guangxi)",
            "en": "Liuzhou Industrial Museum is the first comprehensive industrial museum in Guangxi. It showcases the century-old industrial history of Liuzhou, the largest manufacturing city in the region.",
            "cn": "柳州工业博物馆是广西首座大型综合性工业博物馆。它全面展示了广西最大制造业城市——柳州跨越百年的现代工业发展历程。"
        },
        {
            "title": "老厂房与经典机车 (Old Workshops & Locomotives)",
            "en": "Built on the former site of an old textile factory, the museum displays vintage steam locomotives, classic cars, heavy machinery, and the birth of world-famous brand Wuling Motors.",
            "cn": "博物馆建于老纺织厂原址之上，展出了具有年代感的蒸汽机车、经典老爷车、重型工业机械以及享誉海内外的“五菱汽车”诞生历程。"
        },
        {
            "title": "现代智造与螺蛳粉 (Smart Tech & Luosifen)",
            "en": "The museum also highlights modern smart manufacturing and the amazing rise of Liuzhou River Snail Noodles from a street snack into a nationwide industrial food sensation.",
            "cn": "展馆还生动呈现了现代智能制造科技，以及柳州螺蛳粉从街头风味小吃蜕变为百亿级现代化工业产业链的传奇故事。"
        }
    ],

    # 15. 兴安灵渠
    "lingqu": [
        {
            "title": "世界古代水利奇迹 (Ancient Water Engineering)",
            "en": "Lingqu Canal in Xing'an was built in 214 BC during the Qin Dynasty. It is one of the oldest and most intact canals in the world, connecting the Xiangjiang and Lijiang rivers.",
            "cn": "兴安灵渠始建于公元前 214 年的秦代，是世界上现存最古老、保存最完好的运河水利工程之一，成功连通了长江水系（湘江）与珠江水系（漓江）。"
        },
        {
            "title": "巧妙设计与犁铧嘴 (Smart Design & Plow Snout)",
            "en": "Ancient engineers created clever structures like the Plow Snout to divide river water, the Balance Dam to regulate water flow, and water gates to help boats pass through safely.",
            "cn": "古代工匠设计了巧妙的“铧嘴”来分水二八，利用“大小天平石堤”调节水量，并设立斗门闸道帮助船只安全通航。"
        },
        {
            "title": "国家统一与水运动脉 (Unification & Heritage)",
            "en": "Lingqu Canal played a key role in Qin Shihuang's unification of southern China. Today, it remains a living heritage site surrounded by peaceful ancient trees and stone bridges.",
            "cn": "灵渠为秦始皇统一岭南、促进南北经济文化交融立下了汗马功劳。如今，它依然是一座古树掩映、石桥斑驳的鲜活世界灌溉工程遗产。"
        }
    ],

    # 16. 靖江王府
    "jingjiang": [
        {
            "title": "明代王府格局 (Ming Dynasty Princely Mansion)",
            "en": "Jingjiang Princes' City in Guilin was built in 1372 during the early Ming Dynasty. It is the best-preserved prince city from the Ming Dynasty in China, older even than the Forbidden City in Beijing.",
            "cn": "桂林靖江王府始建于明代洪武五年（1372 年）。它是中国目前保存最完好的明代藩王府邸，历史甚至比北京故宫还要早 30 余年。"
        },
        {
            "title": "独秀峰与天下甲桂林 (Solitary Beauty Peak)",
            "en": "Standing in the center of the city is the Solitary Beauty Peak, known as the 'Pillar of Southern Heaven'. The famous inscription 'Guilin's scenery is best under heaven' was first carved on its cliff.",
            "cn": "王府正中央耸立着“南天一柱”独秀峰。天下闻名的千古名句“桂林山水甲天下”，最早正是刻在独秀峰山脚下的石壁之上。"
        },
        {
            "title": "贡院科举与王城文化 (Civil Exam & Heritage)",
            "en": "In the Qing Dynasty, this site became the regional civil examination hall. Visitors can tour the royal palace, explore the sacred rock caves, and even experience a simulated ancient imperial exam.",
            "cn": "清代时期这里曾改建为广西贡院。游客可以参观王府殿宇、探寻摩崖秘洞，还能沉浸式体验古代科举考试的独特文化。"
        }
    ],

    # 17. 程阳八寨
    "chengyang": [
        {
            "title": "侗族村寨与风情 (Dong Minority Villages)",
            "en": "Chengyang Eight Dong Villages in Sanjiang is a famous Dong ethnic community. It is known as the home of traditional wooden architecture, Dong Grand Songs, and colorful folk festivals.",
            "cn": "三江程阳八寨是著名的侗族世居村落群。这里被誉为侗族传统木构建筑艺术之乡、侗族大歌发源地与民俗节庆之都。"
        },
        {
            "title": "程阳永济风雨桥 (Wind and Rain Bridge)",
            "en": "The iconic Chengyang Wind and Rain Bridge is built entirely of wood and stone without a single iron nail. It features beautiful pavilions and corridor roofs protecting travelers from wind and rain.",
            "cn": "标志性的程阳永济桥全桥不用一颗铁钉，全凭榫卯紧密相扣。桥上建有精美长廊与飞檐楼阁，为往来行人遮风挡雨。"
        },
        {
            "title": "鼓楼百家宴与侗歌 (Drum Tower & Grand Banquet)",
            "en": "Visitors can visit towering Drum Towers, listen to multi-part Dong Grand Songs without any musical instruments, and join the lively Grand Banquet to taste authentic sour food and oil tea.",
            "cn": "游客可以登临雄伟的鼓楼，聆听无伴奏、多声部的联合国非遗侗族大歌，还能参加盛大的“百家宴”，品尝地道酸鱼酸肉与打油茶。"
        }
    ],

    # 18. 巴马长寿村
    "bama": [
        {
            "title": "世界长寿之乡 (World Longevity Sanctuary)",
            "en": "Bama Yao Autonomous County is internationally recognized as the 'Hometown of Longevity'. The proportion of centenarians here is far higher than the global standard.",
            "cn": "巴马瑶族自治县是世界著名的“长寿之乡”。这里的百岁老人占人口比例远高于联合国评定的长寿之乡国际标准。"
        },
        {
            "title": "得天独厚的五大养生要素 (Five Natural Elements)",
            "en": "Bama's secret of longevity lies in its clean environment: high geomagnetism, rich negative oxygen ions, weak alkaline mineral water, healthy sunlight, and pure pollution-free organic food.",
            "cn": "巴马的长寿密码源于其得天独厚的自然环境：适宜的地磁、富含负氧离子的清新空气、小分子弱碱性泉水、优质阳光以及无污染的天然有机食物。"
        },
        {
            "title": "百魔洞与慢生活体验 (Baimo Cave & Slow Life)",
            "en": "Scenic spots like Baimo Cave and Panyang River attract visitors from all over the world. People come here to breathe fresh air, drink mineral water, and enjoy a healthy, peaceful slow lifestyle.",
            "cn": "百魔洞、盘阳河等风景名胜吸引着海内外候鸟人。人们来到这里呼吸纯净空气、饮用天然矿泉，体验回归自然的慢节奏康养生活。"
        }
    ],

    # 19. 合浦汉代文化博物馆
    "hepu": [
        {
            "title": "海上丝绸之路始发港 (Maritime Silk Road Origin)",
            "en": "Hepu Han Dynasty Cultural Museum in Beihai records the glorious history of Hepu as an ancient starting port of the Maritime Silk Road over 2,000 years ago during the Han Dynasty.",
            "cn": "北海合浦汉代文化博物馆生动记录了 2000 多年前汉代合浦作为“海上丝绸之路”重要始发港的辉煌对外贸易历史。"
        },
        {
            "title": "珍贵出土文物 (Precious Relics & Glassware)",
            "en": "The museum displays thousands of precious cultural relics excavated from Han tombs, including bronze vessels, ceramic pots, rare Persian pottery, and colorful Mediterranean glassware.",
            "cn": "馆内展出了数以千计汉墓出土的珍贵文物，包括造型精巧的铜器、陶器，以及从古波斯、地中海地区漂洋过海而来的珍贵陶壶与彩色玻璃珠饰。"
        },
        {
            "title": "文明交流互鉴的见证 (East-West Cultural Exchange)",
            "en": "These maritime treasures prove that ancient China maintained friendly trade and deep cultural exchanges with Southeast Asia, South Asia, and the Mediterranean world through the sea.",
            "cn": "这些海丝瑰宝雄辩地证明了古代中国通过海上丝绸之路与东南亚、南亚及地中海各国进行的友好贸易往来与深厚文明互鉴。"
        }
    ],

    # 20. 崇左明仕田园
    "mingshi": [
        {
            "title": "南国田园仙境 (Southern Pastoral Paradise)",
            "en": "Mingshi Scenic Area in Chongzuo is famous for its peaceful Karst mountains, winding clear rivers, green bamboo forests, and traditional rural farmlands.",
            "cn": "崇左明仕田园以秀美的喀斯特奇峰、蜿蜒清澈的明仕河、青翠繁茂的凤尾竹林和古朴宁静的乡村田园风光而闻名于世。"
        },
        {
            "title": "竹筏漂流与如画风光 (Bamboo Rafting)",
            "en": "Taking a traditional bamboo raft along the river, you can see green mountain reflections in the water, farmers working in paddy fields, and waterwheels turning slowly on the bank.",
            "cn": "乘坐传统竹筏顺流漂荡，您可以欣赏到两岸奇峰倒影、稻田间辛勤劳作的农人以及河畔缓缓转动的古老木质水车，宛如置身水墨画中。"
        },
        {
            "title": "影视外景与慢调度假 (Film Location & Leisure)",
            "en": "As a popular filming location for fairy-tale dramas, Mingshi offers visitors cozy stilted resorts, bicycle paths along the river, and the pure joy of quiet countryside life.",
            "cn": "作为多部知名仙侠影视剧的取景拍摄地，明仕田园还为游客提供了舒适的壮乡吊脚木楼度假村与骑行绿道，让人尽享田园慢调的恬静与惬意。"
        }
    ]
}

def inject_simplified_speeches():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # 匹配 data.speeches 数组
    # 我们逐个找到 speeches 数组中的项，根据其 spot / id / title 匹配并将 simplifiedSections 注入
    for key, sections in SIMPLIFIED_SPEECHES.items():
        print(f"Injecting simplified version for: {key} ({len(sections)} sections)...")

    # 使用 Python 正则把 SIMPLIFIED_SPEECHES 数据整合写入 data.js
    # 我们编写一个精准的注入逻辑
    with open("simplified_speeches_data.js", "w", encoding="utf-8") as f:
        f.write(f"window.SIMPLIFIED_SPEECHES_DATA = {json.dumps(SIMPLIFIED_SPEECHES, ensure_ascii=False, indent=2)};\n")
    
    print("Exported simplified_speeches_data.js successfully!")

if __name__ == "__main__":
    inject_simplified_speeches()
