// App Logic for Guangxi English Tour Guide Exam Platform
document.addEventListener('DOMContentLoaded', () => {
  const data = window.data || window.GUANGXI_DATA || {};

  // --- RESTORED TO EXACT INITIAL DELIVERED SPEECH SYNTHESIS ENGINE ---
  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const rateElem = document.getElementById('speech-rate-select');
      const rate = rateElem ? parseFloat(rateElem.value || '1.0') : 1.0;
      
      let cleanText = text.replace(/<[^>]*>/g, '').replace(/^(English|Chinese)[:：\/\s]*/gi, '').trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('您的浏览器暂不支持 SpeechSynthesis 语音合成。');
    }
  }

  // State
  let currentMainTab = 'interview';
  let currentCategory = '城市名胜';
  let currentSkillSubject = '万能句式';
  let currentResourceCategory = '英文景点与路线导游词';
  let currentResourceSubCategory = '城市名胜';
  let currentPracticeCategory = '业务规范问答';
  let currentCardCategory = '历史文化';
  let currentPracticeIndex = 0;
  let practiceHistory = []; // 历史栈：记录用户看过的题目索引序列
  let practiceViewMode = 'card'; // 'card' or 'list'
  let shuffledPracticeQueue = []; // 已打乱的题目索引队列
  let shuffleCategory = '';       // 上次 shuffle 时对应的分类

  let currentSpotIndex = 0;
  let isMaskedMode = false;

  // DOM elements
  const mainNavBtns = document.querySelectorAll('#main-nav-tabs .tab-btn');
  const subNavWrapper = document.getElementById('sub-nav-wrapper');
  const catFilterContainer = document.getElementById('cat-filter-container');
  const spotChipsContainer = document.getElementById('spot-chips-container');

  // Views
  const viewPractice = document.getElementById('view-practice');
  const viewCards = document.getElementById('view-cards');
  const viewSpeech = document.getElementById('view-speech');
  const viewSkills = document.getElementById('view-skills');
  const viewResources = document.getElementById('view-resources');

  // --- INITIALIZATION ---
  initCategoryFilters();
  renderSpotChips();
  renderPracticeView();
  renderCardsView();
  renderSpeechView();
  renderSkillsView();
  renderResourcesView();

  // Initial tab display: 背诵导游词
  subNavWrapper.style.display = 'block';
  viewSpeech.style.display = 'block';
  catFilterContainer.style.display = 'flex';
  spotChipsContainer.style.display = 'flex';
  
  bindEvents();

  // --- CATEGORY FILTERS ---
  function initCategoryFilters() {
    catFilterContainer.innerHTML = '';
    const cats = data.categories || ["城市名胜", "自然山水", "民族风情", "历史文化", "康养长寿", "特色物产"];
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        currentCategory = cat;
        document.querySelectorAll('#cat-filter-container .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSpotChips();
      });
      catFilterContainer.appendChild(btn);
    });
  }

  // --- SPOT CHIPS ---
  function renderSpotChips() {
    spotChipsContainer.innerHTML = '';
    const matchingSpots = data.speeches.filter(sp => (sp.category || "特色物产") === currentCategory);
    const spotList = matchingSpots.length > 0 ? matchingSpots : data.speeches;
    
    spotList.forEach(sp => {
      const globalIdx = data.speeches.findIndex(s => s.id === sp.id);
      const chip = document.createElement('div');
      chip.className = `spot-chip ${globalIdx === currentSpotIndex ? 'active' : ''}`;
      chip.textContent = sp.name;
      chip.addEventListener('click', () => {
        currentSpotIndex = globalIdx;
        document.querySelectorAll('#spot-chips-container .spot-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderSpeechView();
      });
      spotChipsContainer.appendChild(chip);
    });
  }

  // --- RENDER TOPIC LECTURES VIEW (原知识卡) ---
  function renderCardsView() {
    const tabsContainer = document.getElementById('cards-category-tabs');
    const container = document.getElementById('cards-content-container');
    if (!tabsContainer || !container || !data.knowledgeCards) return;

    const categories = ["历史文化", "民族风情", "特色物产", "自然山水", "康养长寿", "岭南海滨"];

    tabsContainer.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentCardCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        currentCardCategory = cat;
        document.querySelectorAll('#cards-category-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSelectedCardCategory();
      });
      tabsContainer.appendChild(btn);
    });

    renderSelectedCardCategory();

    function renderSelectedCardCategory() {
      container.innerHTML = '';
      const matchingCards = data.knowledgeCards.filter(c => c.category === currentCardCategory);
      const cardItem = matchingCards.length > 0 ? matchingCards[0] : data.knowledgeCards[0];

      if (!cardItem) return;

      // 1. 主卡片：专题标题、概述、逻辑链与考点词汇
      const headerCard = document.createElement('div');
      headerCard.className = 'card';
      headerCard.style.marginBottom = '16px';

      let logicChainHTML = '';
      if (cardItem.logicChain && cardItem.logicChain.length > 0) {
        logicChainHTML = `
          <div style="background: linear-gradient(135deg, #fffcf9 0%, #fff6ee 100%); border: 1px dashed #e5ccb4; border-radius: 10px; padding: 14px 16px; margin-top: 14px; margin-bottom: 16px;">
            <div style="font-weight: 800; font-size: 14.5px; color: #8c2522; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              🧠 官方考点背诵逻辑链 (Mind Chain):
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
              ${cardItem.logicChain.map((step, idx) => `
                <span style="background: #ffffff; border: 1px solid #e8d0b5; color: #7a2220; font-weight: 700; font-size: 12.5px; padding: 4px 11px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                  ${idx + 1}. ${step}
                </span>
                ${idx < cardItem.logicChain.length - 1 ? '<span style="color: #c9ab8d; font-size: 13px; font-weight: bold;">➔</span>' : ''}
              `).join('')}
            </div>
          </div>
        `;
      }

      let kwHTML = '';
      if (cardItem.keywords && cardItem.keywords.length > 0) {
        kwHTML = `
          <div style="margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 14px; color: #1a1a1a; margin-bottom: 8px;">📌 核心考点词汇与表达词组：</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${cardItem.keywords.map(k => `
                <span class="spot-chip active" style="font-size: 12.5px; font-weight: 500; border-radius: 6px; padding: 5px 11px; background: #f0eae1; border-color: #d6cbba; color: #333;">
                  <strong>${k.en}</strong> <span style="color: #666;">(${k.cn})</span>
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }

      headerCard.innerHTML = `
        <span class="qa-tag-badge" style="background: #fff5f5; color: #8c2522; border: 1px solid #f7dcd5;">《24广西英导词》源文件专题范文</span>
        <h3 style="font-size: 19px; font-weight: 800; color: #1a1a1a; margin-top: 6px; margin-bottom: 6px;">${cardItem.title}</h3>
        <p style="font-size: 13.5px; color: #666; line-height: 1.6;">${cardItem.desc}</p>
        
        ${logicChainHTML}
        ${kwHTML}
      `;
      container.appendChild(headerCard);

      // 2. 分自然段显示英文 + 中文（类似导游词页面）
      if (cardItem.sections && cardItem.sections.length > 0) {
        cardItem.sections.forEach((sec, idx) => {
          const secCard = document.createElement('div');
          secCard.className = 'card';
          secCard.style.marginBottom = '14px';

          secCard.innerHTML = `
            <div class="section-title" style="font-size: 16px; margin-bottom: 12px;">
              <span>📌</span> ${sec.title}
            </div>
            
            <div class="speech-text-en" style="font-size: 15px; color: #222; line-height: 1.7; margin-bottom: 12px;">
              ${sec.en}
            </div>
            
            <div class="speech-text-cn" style="font-size: 13.5px; color: #555; background-color: #faf8f5; padding: 12px 14px; border-left: 4px solid #d4c5b2; border-radius: 4px; margin-bottom: 14px; line-height: 1.6;">
              ${sec.cn}
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button class="action-btn btn-read-topic-sec" data-idx="${idx}" style="padding: 5px 14px; font-size: 13px;">
                🔊 朗读本段英文
              </button>
            </div>
          `;
          container.appendChild(secCard);
        });

        container.querySelectorAll('.btn-read-topic-sec').forEach(btn => {
          btn.addEventListener('click', e => {
            const idx = e.currentTarget.getAttribute('data-idx');
            const targetSec = cardItem.sections[idx];
            if (targetSec && targetSec.en) {
              speakText(targetSec.en);
            }
          });
        });
      } else if (cardItem.enSentence) {
        // 兼容单句模式
        const secCard = document.createElement('div');
        secCard.className = 'card';
        secCard.style.marginBottom = '14px';
        secCard.innerHTML = `
          <div class="speech-text-en" style="font-size: 15px; color: #8c2522; background: #fff5f5; border-left: 4px solid #8c2522; padding: 12px 14px; border-radius: 6px; margin-bottom: 12px;">
            "${cardItem.enSentence}"
          </div>
          <div class="speech-text-cn" style="font-size: 13.5px; color: #444; background: #faf8f5; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px;">
            ${cardItem.cnSentence}
          </div>
          <button class="action-btn btn-read-topic-sec" style="padding: 5px 14px; font-size: 13px;">
            🔊 示范发音/朗读
          </button>
        `;
        container.appendChild(secCard);
        secCard.querySelector('.btn-read-topic-sec').addEventListener('click', () => {
          speakText(cardItem.enSentence);
        });
      }
    }
  }

  // --- PRACTICE HELPERS (module-scope so button listeners can call them) ---
  function getFilteredPracticeList() {
    let list = [];
    if (currentPracticeCategory === "英汉双向口译") {
      list = data.translations.map(t => ({
        type: t.type || 'E2C',
        tag: t.tag || (t.type === 'C2E' ? '汉译英' : '英译中'),
        cnQuestion: '',
        question: t.src,
        answer: t.ref,
        spot: '英汉双向口译真题179题'
      }));
    } else if (currentPracticeCategory.includes("应变")) {
      list = data.questions.filter(q => q.officialCategory && q.officialCategory.includes("应变"));
    } else if (currentPracticeCategory.includes("综合")) {
      list = data.questions.filter(q => q.officialCategory && q.officialCategory.includes("综合"));
    } else {
      list = data.questions.filter(q => q.officialCategory && q.officialCategory.includes("业务"));
    }
    return list;
  }

  function renderCurrentPracticeCard() {
    const list = getFilteredPracticeList();
    if (list.length === 0) return;
    if (currentPracticeIndex >= list.length) currentPracticeIndex = 0;
    if (currentPracticeIndex < 0) currentPracticeIndex = list.length - 1;
    const qItem = list[currentPracticeIndex];

    const tagBadge = document.getElementById('practice-tag-badge');
    const listenBtn = document.getElementById('btn-practice-listen');

    if (tagBadge) {
      if (currentPracticeCategory === "英汉双向口译") {
        if (qItem.type === 'C2E' || qItem.tag === '汉译英') {
          tagBadge.textContent = '🇨🇳➔🇺🇸 汉译英 (口译考题)';
          tagBadge.style.background = '#fff7ed';
          tagBadge.style.color = '#c2410c';
          tagBadge.style.borderColor = '#ffedd5';
          if (listenBtn) listenBtn.textContent = '🔊 示范英文发音';
        } else {
          tagBadge.textContent = '🇺🇸➔🇨🇳 英译中 (口译考题)';
          tagBadge.style.background = '#eff6ff';
          tagBadge.style.color = '#1d4ed8';
          tagBadge.style.borderColor = '#dbeafe';
          if (listenBtn) listenBtn.textContent = '🔊 听英文原句';
        }
      } else {
        tagBadge.textContent = qItem.spot || currentPracticeCategory;
        tagBadge.style.background = '#f3f4f6';
        tagBadge.style.color = '#374151';
        tagBadge.style.borderColor = '#e5e7eb';
        if (listenBtn) listenBtn.textContent = '🔊 听题';
      }
    }

    document.getElementById('practice-en-question').textContent = qItem.question;
    document.getElementById('practice-cn-question').textContent = qItem.cnQuestion || '';
    let ansHTML = `<div style="white-space: pre-line; font-weight: 600; color: #2b6cb0;">${qItem.answer}</div>`;
    if (qItem.cnAnswer) {
      ansHTML += `<div style="white-space: pre-line; font-size: 13.5px; color: #555; margin-top: 8px; border-top: 1px dashed #cbd5e0; padding-top: 6px;">${qItem.cnAnswer}</div>`;
    }
    document.getElementById('practice-ref-text').innerHTML = ansHTML;
    document.getElementById('practice-ref-box').style.display = 'none';
    document.getElementById('practice-user-input').value = '';
  }

  // --- RENDER PRACTICE VIEW ---
  function renderPracticeView() {
    const tabsContainer = document.getElementById('practice-category-tabs');
    const mainCard = document.getElementById('practice-main-card');
    const listContainer = document.getElementById('practice-list-container');
    
    if (!tabsContainer || !mainCard || !listContainer) return;

    const categories = ["业务规范问答", "应变处理问答", "综合常识问答", "英汉双向口译"];

    tabsContainer.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentPracticeCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        currentPracticeCategory = cat;
        currentPracticeIndex = 0;
        practiceHistory = [];
        shuffledPracticeQueue = []; // 换分类时清空 shuffle 队列
        document.querySelectorAll('#practice-category-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (practiceViewMode === 'card') {
          renderCurrentPracticeCard();
        } else {
          renderPracticeList();
        }
      });
      tabsContainer.appendChild(btn);
    });

    if (practiceViewMode === 'card') {
      mainCard.style.display = 'block';
      listContainer.style.display = 'none';
      renderCurrentPracticeCard();
    } else {
      mainCard.style.display = 'none';
      listContainer.style.display = 'block';
      renderPracticeList();
    }

    function renderPracticeList() {
      listContainer.innerHTML = '';
      const list = getFilteredPracticeList();

      list.forEach((qa, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '14px';
        
        let ansContentHTML = `<div style="white-space: pre-line; font-weight: 600; color: #2b6cb0;">${qa.answer}</div>`;
        if (qa.cnAnswer) {
          ansContentHTML += `<div style="white-space: pre-line; font-size: 13.5px; color: #555; margin-top: 8px; border-top: 1px dashed #cbd5e0; padding-top: 6px;">${qa.cnAnswer}</div>`;
        }

        const isC2E = qa.type === 'C2E' || qa.tag === '汉译英';
        const tagText = currentPracticeCategory === "英汉双向口译" ? (isC2E ? '🇨🇳➔🇺🇸 汉译英' : '🇺🇸➔🇨🇳 英译中') : (qa.spot || currentPracticeCategory);

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12px; color: #999; font-weight: 700; letter-spacing: 0.5px;">#${idx + 1}</span>
            <span class="qa-tag-badge" style="font-size: 12px; ${isC2E ? 'background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;' : 'background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;'}">${tagText}</span>
          </div>
          <h3 class="qa-question-title" style="font-size: 16.5px; margin-bottom: 4px; color: #1a1a1a;">${qa.question}</h3>
          ${qa.cnQuestion ? `<div style="font-size: 14px; color: #666; font-weight: 500; margin-bottom: 12px;">${qa.cnQuestion}</div>` : ''}
          
          <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; margin-top: 10px;">
            <button class="action-btn btn-qa-read" data-idx="${idx}">${isC2E ? '🔊 示范英文发音' : '🔊 听题'}</button>
            <button class="play-main-btn btn-qa-ans-toggle" data-idx="${idx}" style="padding: 5px 14px; font-size: 13px;">参考答案</button>
          </div>

          <div class="ref-answer-box" id="ref-box-${idx}" style="display: none; margin-top: 10px;">
            <div class="ref-answer-title">参考答案：</div>
            <div class="ref-answer-text">${ansContentHTML}</div>
          </div>
        `;
        listContainer.appendChild(card);
      });

      listContainer.querySelectorAll('.btn-qa-read').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          speakText(list[i].question);
        });
      });

      listContainer.querySelectorAll('.btn-qa-ans-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const box = document.getElementById(`ref-box-${i}`);
          box.style.display = box.style.display === 'none' ? 'block' : 'none';
        });
      });
    }
  }

  function renderSkillsView() {
    const tabsContainer = document.getElementById('skills-subject-tabs');
    const cardsContainer = document.getElementById('skills-cards-container');
    if (!tabsContainer || !cardsContainer || !data.skillsBySubject) return;

    tabsContainer.innerHTML = '';
    data.skillsBySubject.forEach(subObj => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${subObj.subject === currentSkillSubject ? 'active' : ''}`;
      btn.textContent = subObj.subject;
      btn.addEventListener('click', () => {
        currentSkillSubject = subObj.subject;
        document.querySelectorAll('#skills-subject-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSelectedSkillSubject();
      });
      tabsContainer.appendChild(btn);
    });

    renderSelectedSkillSubject();

    function renderSelectedSkillSubject() {
      cardsContainer.innerHTML = '';
      const selectedSub = data.skillsBySubject.find(s => s.subject === currentSkillSubject) || data.skillsBySubject[0];

      const headerCard = document.createElement('div');
      headerCard.className = 'card';
      headerCard.style.marginBottom = '16px';
      headerCard.style.background = '#faf8f5';
      headerCard.style.borderColor = '#e2d9cd';
      headerCard.innerHTML = `
        <h3 style="font-size: 18px; font-weight: 800; color: #8c2522; margin-bottom: 6px;">讲义官方专篇：${selectedSub.subject}</h3>
        <p style="font-size: 13.5px; color: #555; line-height: 1.6;">${selectedSub.desc}</p>
      `;
      cardsContainer.appendChild(headerCard);

      if (selectedSub.subject === "万能句式") {
        selectedSub.items.forEach(item => {
          const itemCard = document.createElement('div');
          itemCard.className = 'card';
          itemCard.style.marginBottom = '14px';
          itemCard.innerHTML = `
            <div style="font-weight: 700; font-size: 15.5px; color: #1a1a1a; margin-bottom: 10px;">• ${item.subtitle}</div>
            <div style="font-size: 14.5px; color: #8c2522; background: #fff5f5; border-left: 4px solid #8c2522; padding: 12px 16px; border-radius: 6px; font-weight: 500; font-family: monospace; margin-bottom: 10px; line-height: 1.6;">"${item.en}"</div>
            <div style="font-size: 13.5px; color: #444; line-height: 1.6;">${item.cn}</div>
          `;
          cardsContainer.appendChild(itemCard);
        });
        return;
      }

      selectedSub.items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'card';
        itemCard.style.marginBottom = '14px';

        let formattedText = item.content || '';
        formattedText = formattedText.replace(/^(01|02|03|04|05|06)\s*[\u4e00-\u9fa5]+/gm, '');
        formattedText = formattedText.replace(/章节指南与核心要点/g, '');

        formattedText = formattedText.replace(/"([^"]+)"/g, `
          <div style="font-size: 14.5px; color: #8c2522; background: #fff5f5; border-left: 4px solid #8c2522; padding: 12px 16px; border-radius: 6px; font-weight: 500; font-family: monospace; margin: 10px 0; line-height: 1.6;">
            "$1"
          </div>
        `);
        
        formattedText = formattedText.replace(/\n/g, '<br>');

        itemCard.innerHTML = `
          <h4 style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; border-bottom: 2px solid #f0eae1; padding-bottom: 6px;">${item.subtitle}</h4>
          <div style="font-size: 14.5px; color: #333; line-height: 1.8;">${formattedText}</div>
        `;
        cardsContainer.appendChild(itemCard);
      });
    }
  }

  function renderSpeechView() {
    const container = document.getElementById('speech-cards-container');
    container.innerHTML = '';
    
    const speech = data.speeches[currentSpotIndex];
    if (!speech) return;

    // 1. 每篇导游词单独开一栏显示导游词总标题
    const headerCard = document.createElement('div');
    headerCard.className = 'card';
    headerCard.style.background = '#faf8f5';
    headerCard.style.borderLeft = '5px solid #8c2522';
    headerCard.style.marginBottom = '16px';
    headerCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <span class="qa-tag-badge" style="background: #fff5f5; color: #8c2522; border: 1px solid #f7dcd5; margin-bottom: 6px; display: inline-block;">
            ${speech.category || '官方现场导游词'}
          </span>
          <h2 style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin-top: 4px;">${speech.name}</h2>
        </div>
        <span style="font-size: 13px; color: #666; font-weight: 600; background: #eee7dd; padding: 4px 12px; border-radius: 20px;">
          📖 共 ${speech.sections.length} 个讲解段落
        </span>
      </div>
    `;
    container.appendChild(headerCard);

    // 2. 播放控制卡（放在标题下方）
    const controlCard = document.createElement('div');
    controlCard.className = 'audio-control-card';
    controlCard.style.marginBottom = '16px';
    controlCard.innerHTML = `
      <div class="audio-left">
        <button class="play-main-btn" id="btn-play-all">
          <span>🎧</span> <span id="play-btn-text">现场导览 (连续讲解)</span>
        </button>
      </div>
      <div class="audio-controls">
        <label style="font-size: 13px; color: #555;">语速:</label>
        <select class="speed-select" id="speech-rate-select">
          <option value="0.8">慢</option>
          <option value="1.0" selected>中</option>
          <option value="1.2">快</option>
        </select>
      </div>
    `;
    container.appendChild(controlCard);

    // 绑定"现场导览"按钮
    controlCard.querySelector('#btn-play-all').addEventListener('click', () => {
      if (speech && speech.sections) {
        const fullText = speech.sections.map(s => s.en).join(' ');
        speakText(fullText);
      }
    });

    // Smart keyword extractor: proper nouns (capitalized mid-sentence), numbers+units, long content words
    function extractKeywords(text) {
      const words = text.match(/\b[A-Za-z0-9'''-]+\b/g) || [];
      const stopwords = new Set([
        'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
        'is','are','was','were','be','been','have','has','had','do','does','did','will',
        'would','could','should','may','might','can','shall','that','this','these','those',
        'it','its','we','our','they','their','he','she','his','her','you','your','i','my',
        'as','if','so','not','no','all','each','some','any','more','also','then','than',
        'into','over','after','before','during','between','through','about','which','who',
        'what','when','where','how','both','one','two','three','first','second','third',
        'let','get','make','take','give','come','go','see','know','here','there','well',
        'very','just','now','still','even','only','such','many','much','other','most',
        'while','around','along','next','last','new','old','large','small','long','short',
      ]);
      const sentences = text.split(/(?<=[.!?])\s+/);
      const keywords = new Set();

      words.forEach((word, i) => {
        const clean = word.replace(/['''-]/g, '');
        if (clean.length < 4) return;
        const lower = clean.toLowerCase();
        if (stopwords.has(lower)) return;

        // 1. Numbers with units (e.g. 6621.6, 200, 4050)
        if (/^\d/.test(clean)) { keywords.add(word); return; }

        // 2. Proper nouns: capitalized but NOT at sentence start
        if (/^[A-Z]/.test(clean)) {
          // Find which position in its sentence
          const inSentence = sentences.some(s => {
            const wds = s.trim().split(/\s+/);
            return wds.indexOf(word) > 0; // not first word
          });
          if (inSentence || clean.length >= 5) { keywords.add(word); return; }
        }

        // 3. Long content words (adjectives/verbs/nouns, length >= 7)
        if (clean.length >= 7 && /[a-z]/.test(clean)) {
          keywords.add(word);
        }
      });

      return [...keywords];
    }

    speech.sections.forEach((sec, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.idx = idx;
      card.dataset.masked = 'false';
      card.dataset.playState = 'idle'; // idle | playing | paused

      function bindReadBtn() {
        const btn = card.querySelector('.btn-read-sec');
        if (!btn) return;
        btn.addEventListener('click', () => {
          const rateElem = document.getElementById('speech-rate-select');
          const rate = rateElem ? parseFloat(rateElem.value || '1.0') : 1.0;
          const state = card.dataset.playState;
          const cleanText = sec.en.replace(/<[^>]*>/g, '');

          if (state === 'idle') {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(cleanText);
            u.lang = 'en-US';
            u.rate = rate;
            u.onend = () => {
              card.dataset.playState = 'idle';
              const b = card.querySelector('.btn-read-sec');
              if (b) b.textContent = '示范朗读';
            };
            window.speechSynthesis.speak(u);
            card.dataset.playState = 'playing';
            btn.textContent = '⏸ 暂停';

          } else if (state === 'playing') {
            window.speechSynthesis.pause();
            card.dataset.playState = 'paused';
            btn.textContent = '▶ 重播';

          } else if (state === 'paused') {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(cleanText);
            u.lang = 'en-US';
            u.rate = rate;
            u.onend = () => {
              card.dataset.playState = 'idle';
              const b = card.querySelector('.btn-read-sec');
              if (b) b.textContent = '示范朗读';
            };
            window.speechSynthesis.speak(u);
            card.dataset.playState = 'playing';
            btn.textContent = '⏸ 暂停';
          }
        });
      }

      function renderCardContent(masked) {
        let enText = sec.en;
        if (masked) {
          const kws = extractKeywords(sec.en);
          kws.forEach(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const reg = new RegExp(`\\b${escaped}\\b`, 'g');
            enText = enText.replace(reg,
              `<span class="kw-masked" onclick="this.classList.toggle('revealed')">${kw}</span>`);
          });
        }

        // 按钮文字根据当前播放状态恢复
        const btnLabel = card.dataset.playState === 'playing' ? '⏸ 暂停'
                       : card.dataset.playState === 'paused'  ? '▶ 重播'
                       : '示范朗读';

        card.innerHTML = `
          <div class="section-title"><span>${sec.title}</span></div>
          <div class="speech-text-en">${enText}</div>
          ${sec.cn ? `<div class="speech-text-cn">${sec.cn}</div>` : ''}
          <div class="card-actions">
            <button class="action-btn btn-read-sec" data-idx="${idx}">${btnLabel}</button>
            <button class="action-btn btn-toggle-mask" data-idx="${idx}" style="${masked ? 'background:var(--primary-red);color:#fff;' : ''}">
              ${masked ? '显示原文' : '遮挡关键词'}
            </button>
          </div>
        `;

        // 每次重建 DOM 后立即重绑两个按钮的监听器
        bindReadBtn();
        card.querySelector('.btn-toggle-mask').addEventListener('click', () => {
          const nowMasked = card.dataset.masked === 'true';
          card.dataset.masked = (!nowMasked).toString();
          renderCardContent(!nowMasked);
        });
      }

      renderCardContent(false);
      container.appendChild(card);
    });

  }


  // --- RENDER RESOURCES VIEW ---
  function renderResourcesView() {
    const primaryTabsContainer = document.getElementById('resource-category-tabs');
    const secondaryTabsContainer = document.getElementById('resource-sub-tabs');
    const container = document.getElementById('resource-list-container');
    if (!primaryTabsContainer || !secondaryTabsContainer || !container || !data.fileList) return;
    
    const primaryCategories = data.resourceCategories || ["英文景点与路线导游词", "现场问答题库", "英汉双向口译题库", "备考技巧与词汇讲义"];
    const secondaryCategories = data.speechSubCategories || ["城市名胜", "自然山水", "民族风情", "历史文化", "康养长寿", "特色物产"];

    primaryTabsContainer.innerHTML = '';
    primaryCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentResourceCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        currentResourceCategory = cat;
        document.querySelectorAll('#resource-category-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSubTabsAndList();
      });
      primaryTabsContainer.appendChild(btn);
    });

    renderSubTabsAndList();

    function renderSubTabsAndList() {
      if (currentResourceCategory === "英文景点与路线导游词") {
        secondaryTabsContainer.style.display = 'flex';
        secondaryTabsContainer.innerHTML = '';
        secondaryCategories.forEach(subCat => {
          const chip = document.createElement('div');
          chip.className = `spot-chip ${subCat === currentResourceSubCategory ? 'active' : ''}`;
          chip.textContent = subCat;
          chip.addEventListener('click', () => {
            currentResourceSubCategory = subCat;
            document.querySelectorAll('#resource-sub-tabs .spot-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderFileList();
          });
          secondaryTabsContainer.appendChild(chip);
        });
      } else {
        secondaryTabsContainer.style.display = 'none';
        secondaryTabsContainer.innerHTML = '';
      }

      renderFileList();
    }

    function renderFileList() {
      container.innerHTML = '';
      
      let filteredFiles = data.fileList.filter(f => f.category === currentResourceCategory);
      if (currentResourceCategory === "英文景点与路线导游词") {
        filteredFiles = filteredFiles.filter(f => (f.subCategory || "特色物产") === currentResourceSubCategory);
      }

      const listToRender = filteredFiles.length > 0 ? filteredFiles : data.fileList.filter(f => f.category === currentResourceCategory);

      listToRender.forEach(file => {
        const item = document.createElement('div');
        item.className = 'resource-list-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '14px 18px';
        item.style.borderBottom = '1px solid #f0eae1';

        const fileUrl = file.url || `./materials/${file.fullName || file.name}`;

        item.innerHTML = `
          <div style="flex: 1; padding-right: 12px;">
            <div style="font-weight: 600; color: #1a1a1a; font-size: 15px; margin-bottom: 5px;">${file.name}</div>
            <span class="resource-category" style="font-size: 12px; color: #8c2522; background: #fff5f5; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${file.subCategory ? `${file.category} · ${file.subCategory}` : file.category}</span>
          </div>
          <div>
            <a href="${fileUrl}" target="_blank" download="${file.fullName || file.name}" class="play-main-btn" style="padding: 6px 20px; font-size: 13.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              下载
            </a>
          </div>
        `;
        container.appendChild(item);
      });
    }
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    mainNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        mainNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        
        if (tab === 'practice') {
          subNavWrapper.style.display = 'none';
          viewPractice.style.display = 'block';
          renderPracticeView();
        } else if (tab === 'cards') {
          subNavWrapper.style.display = 'none';
          viewCards.style.display = 'block';
          renderCardsView();
        } else if (tab === 'skills') {
          subNavWrapper.style.display = 'none';
          viewSkills.style.display = 'block';
          renderSkillsView();
        } else if (tab === 'interview') {
          // 背诵导游词 VIEW
          subNavWrapper.style.display = 'block';
          viewSpeech.style.display = 'block';
          catFilterContainer.style.display = 'flex';
          spotChipsContainer.style.display = 'flex';
          renderSpotChips();
          renderSpeechView();
        } else if (tab === 'resources') {
          subNavWrapper.style.display = 'none';
          viewResources.style.display = 'block';
          renderResourcesView();
        }
      });
    });

    // --- PRACTICE MODE TOGGLE (卡片翻页 VS 全量题库列表) ---
    const btnModeCard = document.getElementById('btn-mode-card');
    const btnModeList = document.getElementById('btn-mode-list');
    
    if (btnModeCard && btnModeList) {
      btnModeCard.addEventListener('click', () => {
        practiceViewMode = 'card';
        btnModeCard.classList.add('active');
        btnModeList.classList.remove('active');
        renderPracticeView();
      });

      btnModeList.addEventListener('click', () => {
        practiceViewMode = 'list';
        btnModeList.classList.add('active');
        btnModeCard.classList.remove('active');
        renderPracticeView();
      });
    }

    // --- PRACTICE AUDIO & NAV ---
    const btnPracticeListen = document.getElementById('btn-practice-listen');
    if (btnPracticeListen) {
      btnPracticeListen.addEventListener('click', () => {
        const list = getFilteredPracticeList();
        if (list.length > 0 && currentPracticeIndex < list.length) {
          const item = list[currentPracticeIndex];
          if (item.type === 'C2E' || item.tag === '汉译英') {
            speakText(item.answer);
          } else {
            speakText(item.question);
          }
        } else {
          const text = document.getElementById('practice-en-question').textContent;
          speakText(text);
        }
      });
    }

    document.getElementById('btn-practice-toggle-ans').addEventListener('click', () => {
      const box = document.getElementById('practice-ref-box');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-practice-prev').addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (practiceHistory.length > 0) {
        currentPracticeIndex = practiceHistory.pop();
        renderCurrentPracticeCard();
      }
    });

    document.getElementById('btn-practice-next').addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      const list = getFilteredPracticeList();
      if (list.length <= 1) { renderCurrentPracticeCard(); return; }

      // 若队列为空或分类已切换，重新 shuffle
      if (shuffledPracticeQueue.length === 0 || shuffleCategory !== currentPracticeCategory) {
        shuffleCategory = currentPracticeCategory;
        // Fisher-Yates shuffle，排除当前题
        const indices = list.map((_, i) => i).filter(i => i !== currentPracticeIndex);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledPracticeQueue = indices;
      }

      practiceHistory.push(currentPracticeIndex);
      currentPracticeIndex = shuffledPracticeQueue.shift(); // 从队列头部取
      renderCurrentPracticeCard();
    });

    // btn-play-all 已在 renderSpeechView 里就地绑定，此处无需重复绑定
  }
});
