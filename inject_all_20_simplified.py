import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 全套 20 篇导游词【AI 极简口语版】量身定制（每篇 3 个短小精悍口语化段落）
ALL_20_SIMPLIFIED = {
    "崇左 花山岩画": [
        {
            "title": "世界文化遗产 (World Heritage)",
            "en": "Zuojiang Huashan Rock Art is a UNESCO World Cultural Heritage site. Painted on high river cliffs over 2,000 years ago, it is the only rock art world heritage in China.",
            "cn": "左江花山岩画是世界文化遗产。它是 2000 多年前绘制在临江高耸崖壁上的奇观，也是中国唯一的岩画类世界遗产。"
        },
        {
            "title": "颜料与蛙形图案 (Pigment & Frog Figures)",
            "en": "Ancient Luoyue ancestors used red hematite and animal fat to paint. The paintings feature people dancing like frogs with raised arms, along with bronze drums and swords.",
            "cn": "古代骆越先民用赤铁矿粉和动物油脂调配颜料。画面主要呈现双臂上举、作蛙形起舞的人形，并伴有铜鼓与佩剑。"
        },
        {
            "title": "先民祭祀与历史密码 (Sacrifice & Civilization)",
            "en": "These grand paintings record ancient religious ceremonies praying for rain and good harvests. They are living treasures of early Zhuang civilization.",
            "cn": "这些巨幅岩画记录了古人祈雨和祈求丰收的盛大祭祀庆典，是了解早期壮族先民文明的鲜活瑰宝。"
        }
    ],

    "柳州 程阳八寨": [
        {
            "title": "侗寨风情与概况 (Dong Village Overview)",
            "en": "Chengyang Eight Dong Villages is a famous Dong ethnic community with over 800 years of history. It is the home of wooden architecture, Dong Grand Songs, and folk festivals.",
            "cn": "程阳八寨是著名的侗族古村落群，拥有 800 多年历史。这里是传统木构建筑艺术之乡与侗族大歌的摇篮。"
        },
        {
            "title": "程阳永济风雨桥 (Wind and Rain Bridge)",
            "en": "The iconic Chengyang Wind and Rain Bridge was built entirely of wood and stone without a single iron nail. Its lovely pavilions protect travelers from wind and rain.",
            "cn": "标志性的程阳永济风雨桥全桥不用一颗铁钉，全凭榫卯连接。桥上的飞檐楼阁能为往来行人遮风挡雨。"
        },
        {
            "title": "鼓楼百家宴与大歌 (Drum Tower & Grand Banquet)",
            "en": "Here, you can visit towering Drum Towers, listen to multi-part Dong Grand Songs without instruments, and join the lively Grand Banquet for sour fish and oil tea.",
            "cn": "在这里，您可以参观雄伟的鼓楼，聆听无伴奏的联合国非遗侗族大歌，还能参加百家宴品尝酸鱼与打油茶。"
        }
    ],

    "桂林 两江四湖象山": [
        {
            "title": "桂林城徽象鼻山 (City Symbol Elephant Trunk Hill)",
            "en": "Elephant Trunk Hill is the famous city symbol of Guilin. Standing where the Lijiang and Taohua rivers meet, it looks just like a giant elephant drinking river water.",
            "cn": "象鼻山是桂林的著名城徽。它矗立在漓江与桃花江交汇处，宛如一头巨象在江边伸鼻畅饮江水。"
        },
        {
            "title": "水月洞与普贤塔 (Water Moon Cave & Pagoda)",
            "en": "Between the trunk and body is the Water Moon Cave. Its clear reflection looks like a bright full moon floating on the water. On top of the hill stands the ancient Puxian Pagoda.",
            "cn": "象鼻与象身之间是水月洞，水面倒影如同一轮明月浮于水底。山顶上矗立着古朴的普贤塔。"
        },
        {
            "title": "两江四湖水系环城游 (Two Rivers & Four Lakes)",
            "en": "Guilin's Two Rivers and Four Lakes form a scenic water network around the city. Taking an evening boat tour offers dazzling bridge lights and romantic night views.",
            "cn": "桂林两江四湖构成了环城水系景观。夜晚乘船夜游，沿途桥梁流光溢彩，夜景如梦如幻。"
        }
    ],

    "桂林 漓江": [
        {
            "title": "百里漓江水墨画卷 (Lijiang River Overview)",
            "en": "The Lijiang River is one of the most picturesque rivers on Earth. Stretching 83 kilometers from Guilin to Yangshuo, it is praised for green hills, clear water, caves, and stones.",
            "cn": "漓江是世界上最美丽的河流之一。从桂林到阳朔全长 83 公里，以山青、水秀、洞奇、石美四大绝景闻名天下。"
        },
        {
            "title": "黄布倒影与20元人民币 (Yellow Cloth Shoal)",
            "en": "Cruising along the river, you will see the famous Yellow Cloth Shoal, which is the exact landscape printed on the back of the 20 RMB note. The reflections here are truly breathtaking.",
            "cn": "顺流乘船游览，您会看到著名的黄布倒影，这正是人民币 20 元纸币背面的风景图案，奇峰倒影令人叹为观止。"
        },
        {
            "title": "阳朔山水甲桂林 (Yangshuo Scenery)",
            "en": "As the ancient Chinese poem goes: 'Guilin's scenery is best under heaven, but Yangshuo's scenery is even better.' Enjoy the calm breeze and endless green peaks!",
            "cn": "正如古诗所云：“桂林山水甲天下，阳朔堪称甲桂林。”请尽情享受微风与两岸无尽的奇峰翠竹！"
        }
    ],

    "南宁 青秀山": [
        {
            "title": "绿城明珠青秀山 (Green Lung of Nanning)",
            "en": "Qingxiu Mountain is known as the 'Green Lung' and 'Giant Garden' of Nanning. It features green peaks, clear lakes, pleasant fresh air, and lush subtropical plants.",
            "cn": "青秀山被誉为南宁的“城市绿肺”与“天然大花园”。这里群山苍翠、湖水明净、空气清新，亚热带植物繁茂。"
        },
        {
            "title": "龙象塔与千年苏铁 (Longxiang Pagoda & Cycads)",
            "en": "On the top of the hill stands Longxiang Pagoda, offering a panoramic view of the whole city. The Cycad Garden protects thousands of rare cycad trees, some over 1,300 years old.",
            "cn": "山顶矗立着著名的龙象塔，登高可俯瞰南宁全城。千年苏铁园内培育着数千株珍稀苏铁，最长树龄超过 1300 年。"
        },
        {
            "title": "兰花香与养生休闲 (Orchid Garden & Wellness)",
            "en": "With its colorful Orchid Garden and high oxygen levels, Qingxiu Mountain is the best place in Nanning for hiking, relaxation, and enjoying clean nature.",
            "cn": "漫步在花香四溢的兰花园，呼吸高负氧离子的纯净空气，青秀山是休闲健步、亲近大自然的首选胜地。"
        }
    ],

    "广西 奇峰秀水之旅": [
        {
            "title": "山水线路特色 (Scenery Tour Highlights)",
            "en": "Welcome to the Karst Peak & Water Tour! This route connects the top natural wonders of Guangxi, including the Lijiang River, Elephant Trunk Hill, and Yangshuo Yulong River.",
            "cn": "欢迎开启奇峰秀水之旅！本条路线汇聚了广西最顶级的山水胜景，涵盖漓江、象鼻山以及阳朔遇龙河。"
        },
        {
            "title": "竹筏漂流与十里画廊 (Bamboo Rafting & Countryside)",
            "en": "On this trip, you can take a quiet bamboo raft down the Yulong River, ride bicycles along the Ten-Mile Gallery, and watch green peaks reflected in clear waters.",
            "cn": "在这趟行程中，您可以乘坐竹筏在遇龙河上随波漂荡，骑行游览十里画廊，欣赏奇峰倒影在碧水间的如画美景。"
        },
        {
            "title": "印象刘三姐山水实景 (Impression Sanjie Liu)",
            "en": "At night, we will enjoy the famous outdoor performance 'Impression Sanjie Liu', which turns the natural mountains and rivers into a giant glowing stage.",
            "cn": "夜晚，我们还将欣赏著名山水实景演出《印象·刘三姐》，天然山水化作流光溢彩的宏大舞台，令人难忘。"
        }
    ],

    "广西 喀斯特探秘之旅": [
        {
            "title": "喀斯特地貌奇观 (Karst Exploration Route)",
            "en": "Guangxi has the most typical Karst landscape in the world. This tour takes you deep into underground caverns, transnational waterfalls, and lush canyons.",
            "cn": "广西拥有世界上最典型的喀斯特地貌。本条探秘路线带您深入神秘地下溶洞、跨国大瀑布和葱郁的大峡谷。"
        },
        {
            "title": "德天瀑布与通灵峡谷 (Detian Waterfall & Tongling)",
            "en": "We will visit the roaring Detian Transnational Waterfall on the China-Vietnam border and hike through Tongling Grand Canyon with its hidden caves and rare plants.",
            "cn": "我们将游览中越边境上气势磅礴的德天跨国大瀑布，并徒步探索通灵大峡谷深处的古老溶洞与珍稀植物。"
        },
        {
            "title": "神奇地下溶洞群 (Limestone Cave Marvels)",
            "en": "Inside the limestone caves, stalactites and stalagmites formed over millions of years shine under colorful lights like underground crystal palaces.",
            "cn": "在神奇的石灰岩溶洞内，历经数百万年形成的钟乳石与石笋在灯光映衬下犹如一座座地下水晶宫殿。"
        }
    ],

    "广西北部湾滨海之旅": [
        {
            "title": "北部湾滨海风光 (Beibu Gulf Coastal Route)",
            "en": "This coastal tour connects Beihai Silver Beach, volcanic Weizhou Island, and ancient Maritime Silk Road ports along the sunny Beibu Gulf.",
            "cn": "本条滨海路线串联起北海银滩、火山岛涠洲岛以及北部湾畔古老的海上丝绸之路始发港。"
        },
        {
            "title": "银滩白沙与火山鳄鱼山 (Silver Beach & Weizhou Island)",
            "en": "Walk barefoot on the soft white sands of Silver Beach, and take a boat to Weizhou Island to admire volcanic craters, sea caves, and fresh ocean breezes.",
            "cn": "漫步在细腻如银的银滩白沙上，乘船前往涠洲岛探访火山口地质遗迹、海蚀洞穴，尽享清凉海风。"
        },
        {
            "title": "海鲜美食与海上日落 (Seafood & Ocean Sunset)",
            "en": "Enjoy delicious fresh seafood at coastal night markets and watch the glorious golden sunset sinking into the South China Sea.",
            "cn": "在海滨夜市品尝生猛美味的海鲜大餐，并在石螺口海滩欣赏金光闪耀的海上落日盛景。"
        }
    ],

    "广西 三月三风情之旅": [
        {
            "title": "壮族三月三盛会 (March 3rd Festival)",
            "en": "The March 3rd Song Festival is the most important traditional holiday for the Zhuang people. It is celebrated with singing fairs, bamboo dances, and folk banquets.",
            "cn": "壮族“三月三”是壮乡同胞最盛大的传统节日。人们以歌圩对唱、跳竹竿舞和摆设长桌宴来欢度佳节。"
        },
        {
            "title": "绣球与五色糯米饭 (Hydrangea & Colorful Rice)",
            "en": "Young people toss colorful handmade hydrangeas to express love and blessing. Everyone enjoys fragrant Five-Color Glutinous Rice dyed with natural plant extracts.",
            "cn": "青年男女通过抛绣球来传递爱意与祝福，大家还会品尝用天然植物萃取染色的喷香五色糯米饭。"
        },
        {
            "title": "非遗壮锦与民族歌舞 (Brocade & Folk Dancing)",
            "en": "Visitors can watch master weavers create beautiful Zhuang Brocade and join the happy circle dance around bonfires under the starry night sky.",
            "cn": "游客可以亲眼观摩非遗传承人织造绚丽的壮锦，并在星空下的篝火旁加入欢快的同心圆民俗打跳。"
        }
    ],

    "广西 桂北民族风情之旅": [
        {
            "title": "桂北多元民族聚居 (Northern Minority Route)",
            "en": "Northern Guangxi is home to Zhuang, Yao, Miao, and Dong people. This tour brings you to the famous Longji Terraces and Sanjiang Dong Villages.",
            "cn": "桂北地区聚居着壮、瑶、苗、侗等少数民族。本路线带您领略龙脊梯田与三江侗寨的迷人风采。"
        },
        {
            "title": "云端龙脊与风雨桥 (Longji Terraces & Bridge)",
            "en": "See the massive rice terraces rising into the clouds, and walk across the wooden Chengyang Wind and Rain Bridge built without a single nail.",
            "cn": "登临直入云霄的壮观龙脊梯田，走过不费一钉一铆、全凭榫卯相扣的程阳风雨桥。"
        },
        {
            "title": "侗族大歌与百家宴 (Dong Grand Song & Feast)",
            "en": "Listen to the heavenly multi-part Dong Grand Songs inside towering Drum Towers and share traditional oil tea and sour dishes at the Grand Banquet.",
            "cn": "在古老鼓楼内聆听天籁般的侗族大歌，并在盛大的百家宴上品尝地道的打油茶与酸食佳肴。"
        }
    ],

    "广西 桂西北民族风情之旅": [
        {
            "title": "桂西北世外桃源 (Northwestern Ethnic Paradise)",
            "en": "Northwestern Guangxi is known for dramatic Karst canyons, clean rivers, and unique Yao and Zhuang customs in Bama, Fengshan, and Donglan.",
            "cn": "桂西北以壮丽的喀斯特天坑峡谷、清澈江水以及巴马、凤山、东兰独特的瑶壮民俗而闻名。"
        },
        {
            "title": "瑶族长鼓舞与铜鼓文化 (Long Drum Dance & Bronze Drums)",
            "en": "Experience the energetic Yao Long Drum Dance and listen to the rhythmic beats of ancient bronze drums echoing through mountain villages.",
            "cn": "欣赏充满力量感的瑶族长鼓舞，聆听古老铜鼓在崇山峻岭间回荡的雄浑节奏。"
        },
        {
            "title": "康养山泉与长寿生活 (Clean Water & Slow Lifestyle)",
            "en": "Breathe pure mountain air, drink natural alkaline spring water, and experience the peaceful, healthy lifestyle of centenarians.",
            "cn": "呼吸纯净的山间负氧离子，饮用天然弱碱性泉水，亲身体验百岁寿星们宁静健康的慢调生活。"
        }
    ],

    "广西 历史文化名城之旅": [
        {
            "title": "千年历史名城 (Historical Cities Route)",
            "en": "Guangxi has a long and rich history. This route highlights ancient relics in Guilin, Xing'an Lingqu Canal, and Ming Dynasty Jingjiang Princes' City.",
            "cn": "广西历史底蕴深厚。本条路线聚焦桂林历史文化名城、兴安秦代灵渠以及明代靖江王府等千古遗存。"
        },
        {
            "title": "世界水利奇迹灵渠 (Lingqu Canal Marvel)",
            "en": "Lingqu Canal was built in 214 BC to connect the Yangtze and Pearl river systems, playing a vital role in unifying ancient China.",
            "cn": "兴安灵渠建于公元前 214 年，成功连通长江与珠江两大水系，为秦始皇统一岭南立下卓越功勋。"
        },
        {
            "title": "靖江王府与独秀峰 (Jingjiang Princes' Palace)",
            "en": "Explore China's best-preserved Ming princely palace under the Solitary Beauty Peak, where the famous phrase 'Guilin's scenery is best under heaven' was carved.",
            "cn": "探访独秀峰下保存最完好的明代藩王府邸，寻访千古名句“桂林山水甲天下”的最早摩崖石刻真迹。"
        }
    ],

    "广西 岭南文化之旅": [
        {
            "title": "岭南文化发祥与交融 (Lingnan Culture Route)",
            "en": "Lingnan culture combines ancient indigenous traditions with Central Plains civilization, famous for骑楼 Arcade streets, Cantonese opera, and trade.",
            "cn": "岭南文化融合了本土先民传统与中原文明，以独具特色的骑楼老街、粤剧戏曲以及商贸文明著称。"
        },
        {
            "title": "老街骑楼与海上丝路 (Arcade Streets & Maritime Silk Road)",
            "en": "Stroll down historic Arcade streets in Wuzhou and Beihai, and visit the Hepu Han Dynasty Museum to see relics from ancient global sea trade.",
            "cn": "漫步在梧州与北海的历史骑楼老街，走进合浦汉代博物馆品味古代跨海商贸交流的珍贵文物。"
        },
        {
            "title": "岭南饮食与早茶 (Cuisine & Morning Tea)",
            "en": "Taste authentic Lingnan snacks, Guilin rice noodles, and fresh seafood while enjoying the pleasant and open-minded cultural atmosphere.",
            "cn": "品尝地道的岭南特色小吃、桂林米粉与生猛海鲜，感受开放包容、兼收并蓄的岭南人文风情。"
        }
    ],

    "广西 骆越文化之旅": [
        {
            "title": "骆越文明源头 (Source of Luoyue Civilization)",
            "en": "Luoyue people are the ancient ancestors of the Zhuang ethnic group. This route follows the Zuojiang River to explore cliff art and bronze drum culture.",
            "cn": "骆越先民是壮族同胞的古老祖先。本路线沿着左江流域，探寻神秘的崖壁岩画与灿烂的青铜鼓文化。"
        },
        {
            "title": "左江花山岩画 (Zuojiang Huashan Rock Art)",
            "en": "Marvel at the UNESCO World Heritage Huashan Rock Art, painted over 2,000 years ago with red hematite showing frog-dancing figures.",
            "cn": "瞻仰世界文化遗产花山岩画，领略 2000 多年前骆越先民用赭红颜料在悬崖上描绘的蛙舞奇观。"
        },
        {
            "title": "青铜鼓与壮乡魂 (Bronze Drums & Zhuang Spirit)",
            "en": "Learn about bronze drums as symbols of tribal power and religious rites, and feel the ancient cultural roots alive in modern Guangxi.",
            "cn": "了解青铜鼓作为部落权力与祭祀神器的神圣地位，感受古老骆越文明在现代壮乡的传承与生机。"
        }
    ],

    "广西 长寿休闲之旅": [
        {
            "title": "世界长寿之乡 (World Longevity Homeland)",
            "en": "Bama Yao Autonomous County is internationally famous for its high number of centenarians and its pure, healthy natural environment.",
            "cn": "巴马瑶族自治县以百岁老人高比例和纯净天然的养生环境闻名于世，是著名的世界长寿之乡。"
        },
        {
            "title": "百魔洞与盘阳河 (Baimo Cave & Panyang River)",
            "en": "Breathe rich negative oxygen ions inside majestic Baimo Cave and stroll along the clean, turquoise waters of the Panyang River.",
            "cn": "在雄伟的百魔洞内呼吸充沛的负氧离子，漫步在清澈碧绿的盘阳河畔，身心舒畅。"
        },
        {
            "title": "慢生活与有机养生 (Slow Living & Healthy Diet)",
            "en": "Enjoy local organic hemp seed soup, sweet corn porridge, and join people from around the world living a quiet, healthy slow life.",
            "cn": "品尝当地天然火麻汤与香甜玉米粥，与来自各地的候鸟人一同感受回归自然的慢调健康生活。"
        }
    ],

    "广西 长寿康养之旅": [
        {
            "title": "天然五大长寿要素 (Five Natural Elements)",
            "en": "Bama's secret of long life comes from five natural elements: high geomagnetism, rich oxygen, weak alkaline water, healthy sunlight, and pure food.",
            "cn": "巴马长寿的秘诀源于五大天然要素：地磁适宜、富氧清新、弱碱小分子水、优质光照以及无污染食物。"
        },
        {
            "title": "水晶宫与百鸟岩 (Crystal Palace & Bird Cave)",
            "en": "Explore the underground wonders of the Crystal Palace cave and take a boat through the 'Three Days and Three Nights' water tunnel in Bainiao Cave.",
            "cn": "探访如梦似幻的地下水晶宫溶洞，乘船穿越百鸟岩水上溶洞体验“三日三夜”的时空光影变幻。"
        },
        {
            "title": "科学康养身心舒畅 (Scientific Wellness)",
            "en": "Experience herbal baths, meditation, and healthy organic meals to completely relax your body and recharge your energy.",
            "cn": "体验瑶药养生泡浴、冥想放松与天然有机药膳，让身心在大自然中得到彻底的舒缓与充电。"
        }
    ],

    "广西 长寿悦动之旅": [
        {
            "title": "运动与生态康养 (Active Outdoor Wellness)",
            "en": "This tour combines outdoor sports with longevity wellness, featuring mountain hiking, river kayaking, and forest trekking.",
            "cn": "本条路线将户外运动与长寿养生完美结合，涵盖山地徒步、碧波皮划艇与森林健走。"
        },
        {
            "title": "命河奇观与绿道骑行 (Minghe River & Greenways)",
            "en": "Hike up to overlook the natural 'Life' character formed by the winding Minghe River, and cycle along scenic greenways beside Karst hills.",
            "cn": "登高俯瞰盘阳河形成的天然草书“命”字河奇观，并在奇峰掩映的生态绿道上畅快骑行。"
        },
        {
            "title": "自然氧吧与活力焕发 (Forest Oxygen & Vitality)",
            "en": "Exercise in natural forest oxygen bars, drink fresh spring water, and feel full of energy and vitality after every active day.",
            "cn": "在天然森林氧吧中深呼吸运动，饮用甘甜山泉水，让充沛活力在山水运动中全面焕发。"
        }
    ],

    "广西 米粉之旅": [
        {
            "title": "广西三大名粉 (Three Famous Rice Noodles)",
            "en": "Guangxi is known as the Rice Noodle Capital of China. This foodie tour tastes the top three noodles: Guilin Rice Noodles, Liuzhou Snail Noodles, and Nanning Old Friend Noodles.",
            "cn": "广西是中国闻名遐迩的米粉大省。本条美食路线带您品尝三大名粉：桂林米粉、柳州螺蛳粉和南宁老友粉。"
        },
        {
            "title": "螺蛳粉与老友粉特色 (Snail & Old Friend Noodles)",
            "en": "Taste the spicy, sour, and savory Liuzhou Luosifen with river snail broth and pickled bamboo shoots, and enjoy the garlic-rich, appetizing Nanning Laoyou Noodles.",
            "cn": "品尝酸辣鲜香、螺蛳浓汤配酸笋的柳州螺蛳粉，体验蒜香浓郁、酸辣开胃的南宁老友粉。"
        },
        {
            "title": "桂林卤菜粉传统工艺 (Guilin Gravy Noodles)",
            "en": "Learn how authentic Guilin rice noodles are made with dry gravy, crispy pork slices, and rich bone soup. It is a true feast for your taste buds!",
            "cn": "了解正宗桂林米粉干拌卤菜、香脆锅烧与醇厚骨汤的传统制作工艺，尽享舌尖上的米粉盛宴！"
        }
    ],

    "广西 工艺品之旅": [
        {
            "title": "传统非遗手工艺 (Traditional Craftsmanship)",
            "en": "Guangxi boasts world-famous traditional handicrafts, including Zhuang Brocade, Qinzhou Nixing Pottery, Beihai South Pearls, and Hepu Horn Carving.",
            "cn": "广西拥有享誉海内外的传统非遗手工艺，涵盖壮锦、钦州坭兴陶、北海南珠以及合浦角雕。"
        },
        {
            "title": "四大名陶坭兴陶与壮锦 (Nixing Pottery & Brocade)",
            "en": "See how master potters carve fine clay without glaze to create color-changing Nixing Pottery, and watch colorful Zhuang Brocade woven by hand.",
            "cn": "观摩大师如何以优质陶土雕刻、无需上釉却能在窑变中呈现绚丽色彩的坭兴陶，欣赏手工织造的壮锦。"
        },
        {
            "title": "珍珠光华与民俗纪念 (South Pearls & Souvenirs)",
            "en": "Admire lustrous Beihai South Pearls and take home unique handmade crafts as memorable souvenirs of your wonderful journey in Guangxi.",
            "cn": "领略晶莹温润的北海南珠光彩，将独具匠心的非遗手工艺品带回家，作为广西之旅的美好纪念。"
        }
    ],

    "广西 茶文化之旅": [
        {
            "title": "千年茶韵茶船古道 (Tea Boat Ancient Road)",
            "en": "Guangxi has a rich tea heritage. This tour explores the history of Wuzhou Liubao Tea and the famous 'Tea Boat Ancient Road' shipping tea to Southeast Asia.",
            "cn": "广西茶文化源远流长。本路线探索梧州六堡茶千百年来通过“茶船古道”扬帆出海、远销东南亚的辉煌历史。"
        },
        {
            "title": "六堡茶红浓陈醇 (Liubao Dark Tea)",
            "en": "Liubao Tea is famous for its 'Red color, rich flavor, aging aroma, and mellow taste'. It grows more fragrant and beneficial to digestion the longer it is aged.",
            "cn": "六堡茶以“红、浓、陈、醇”四绝著称，陈化越久香气越浓郁，具有极佳的消食养生功效。"
        },
        {
            "title": "瑶族打油茶与茶道体验 (Yao Oil Tea & Tea Ceremony)",
            "en": "Try traditional Yao Oil Tea brewed with ginger, scallions, and tea leaves served with crispy rice, and enjoy a peaceful afternoon tea ceremony.",
            "cn": "品尝用生姜、葱头、茶叶捶打炒制、配以香脆米花米果的瑶族打油茶，享受恬静惬意的茶道时光。"
        }
    ]
}

def inject_all():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    idx = content.find("window.data = ")
    if idx == -1:
        print("Could not find window.data = ")
        return

    json_str = content[idx + len("window.data = "):].rstrip(";\n ")
    data = json.loads(json_str)
    speeches = data.get("speeches", [])
    print(f"Loaded {len(speeches)} speeches from data.js")

    matched_count = 0
    for sp in speeches:
        name = sp.get("name", "").strip()
        matched = None

        # 1. 直接精确匹配 name
        if name in ALL_20_SIMPLIFIED:
            matched = ALL_20_SIMPLIFIED[name]
        else:
            # 2. 模糊匹配
            for k, v in ALL_20_SIMPLIFIED.items():
                if k in name or name in k:
                    matched = v
                    break

        if matched:
            sp["simplifiedSections"] = matched
            matched_count += 1
            print(f"Matched '{name}' -> {len(matched)} simplified sections")
        else:
            print(f"WARNING: Unmatched speech: '{name}'")

    # 写回 data.js
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(f"window.data = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

    print(f"🎉 Fully injected simplifiedSections for ALL {matched_count}/{len(speeches)} speeches into data.js!")

if __name__ == "__main__":
    inject_all()
