// App Logic for Guangxi English Tour Guide Exam Platform
document.addEventListener('DOMContentLoaded', () => {
  const data = window.data || window.GUANGXI_DATA || {};

  // --- SPEECH SYNTHESIS ENGINE WITH WORD HIGHLIGHTING & US VOICE PRIORITY ---
  let activeSpeechContainer = null;
  let activeWordMap = [];

  function clearSpeechHighlights(containerEl) {
    const target = containerEl || activeSpeechContainer;
    if (target) {
      target.querySelectorAll('.word-token').forEach(el => {
        el.classList.remove('word-active', 'word-near');
      });
    }
  }

  function getBestUSVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang === 'en-US' || v.lang.includes('US') || v.name.includes('US')) ||
           voices.find(v => v.lang.startsWith('en')) || null;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function prepareContainerHighlight(containerEl, rawText) {
    if (!containerEl) return [];
    
    if (containerEl.dataset.tokenized === 'true') {
      const map = [];
      const spans = containerEl.querySelectorAll('.word-token');
      spans.forEach((span, idx) => {
        const start = parseInt(span.dataset.startChar || '0', 10);
        const end = parseInt(span.dataset.endChar || '0', 10);
        map.push({ index: idx, el: span, startChar: start, endChar: end });
      });
      return map;
    }

    const textToTokenize = rawText || containerEl.innerText || '';
    const regex = /(\b[a-zA-Z0-9'-]+\b)|([^\w\s]+)|(\s+)/g;
    let match;
    let htmlStr = '';
    let wordIdx = 0;

    const hasChildNodes = containerEl.children.length > 0;
    if (!hasChildNodes) {
      while ((match = regex.exec(textToTokenize)) !== null) {
        const textToken = match[0];
        const startChar = match.index;
        const endChar = startChar + textToken.length;

        if (match[1]) {
          const spanId = 'wt-' + Math.random().toString(36).substring(2, 7) + '-' + wordIdx;
          htmlStr += `<span class="word-token" id="${spanId}" data-start-char="${startChar}" data-end-char="${endChar}">${escapeHtml(textToken)}</span>`;
          wordIdx++;
        } else {
          htmlStr += escapeHtml(textToken);
        }
      }
      containerEl.innerHTML = htmlStr;
      containerEl.dataset.tokenized = 'true';

      const map = [];
      const spans = containerEl.querySelectorAll('.word-token');
      spans.forEach((span, idx) => {
        const start = parseInt(span.dataset.startChar || '0', 10);
        const end = parseInt(span.dataset.endChar || '0', 10);
        map.push({ index: idx, el: span, startChar: start, endChar: end });
      });
      return map;
    }

    return [];
  }

  function speakText(text, containerEl) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      clearSpeechHighlights();

      const rateElem = document.getElementById('speech-rate-select');
      const rate = rateElem ? parseFloat(rateElem.value || '1.0') : 1.0;
      
      let cleanText = (text || (containerEl ? containerEl.innerText : '')).replace(/<[^>]*>/g, '').replace(/^(English|Chinese)[:：\/\s]*/gi, '').trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = rate;

      const usVoice = getBestUSVoice();
      if (usVoice) utterance.voice = usVoice;

      if (containerEl) {
        activeSpeechContainer = containerEl;
        activeWordMap = prepareContainerHighlight(containerEl, cleanText);

        utterance.onboundary = (event) => {
          if ((event.name === 'word' || event.charIndex !== undefined) && activeWordMap.length > 0) {
            const charIdx = event.charIndex;
            let activeIndex = -1;

            for (let i = 0; i < activeWordMap.length; i++) {
              const item = activeWordMap[i];
              if (charIdx >= item.startChar && charIdx < item.endChar) {
                activeIndex = i;
                break;
              }
              if (charIdx < item.startChar && activeIndex === -1) {
                activeIndex = Math.max(0, i - 1);
                break;
              }
            }

            if (activeIndex === -1 && charIdx >= activeWordMap[activeWordMap.length - 1].endChar) {
              activeIndex = activeWordMap.length - 1;
            }

            if (activeIndex !== -1) {
              clearSpeechHighlights(containerEl);
              const minIdx = Math.max(0, activeIndex - 1);
              const maxIdx = Math.min(activeWordMap.length - 1, activeIndex + 1);

              for (let i = minIdx; i <= maxIdx; i++) {
                if (activeWordMap[i] && activeWordMap[i].el) {
                  if (i === activeIndex) {
                    activeWordMap[i].el.classList.add('word-active');
                  } else {
                    activeWordMap[i].el.classList.add('word-near');
                  }
                }
              }
            }
          }
        };

        utterance.onend = () => {
          clearSpeechHighlights(containerEl);
          activeSpeechContainer = null;
          activeWordMap = [];
        };

        utterance.onerror = () => {
          clearSpeechHighlights(containerEl);
          activeSpeechContainer = null;
          activeWordMap = [];
        };
      }

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

  const viewPhrases = document.getElementById('view-phrases');

  // Initial tab display: 背诵导游词
  subNavWrapper.style.display = 'block';
  viewSpeech.style.display = 'block';
  catFilterContainer.style.display = 'flex';
  spotChipsContainer.style.display = 'flex';
  
  function renderPhrasesView() {
    const container = document.getElementById('phrase-list-container');
    if (!container) return;
    container.innerHTML = '<div class="card" style="padding:20px; text-align:center; color:#666;">⚡ 导游高频短语速记库加载完成</div>';
  }

  renderPhrasesView();
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
    if (!data.speeches || data.speeches.length === 0) return;

    const matchingSpots = data.speeches.filter(sp => (sp.category || "特色物产") === currentCategory);
    const spotList = matchingSpots.length > 0 ? matchingSpots : data.speeches;
    
    // 自动将 currentSpotIndex 对齐到当前分类的第一篇导游词
    const currentInList = spotList.some(sp => data.speeches.findIndex(s => s.id === sp.id) === currentSpotIndex);
    if (!currentInList && spotList.length > 0) {
      currentSpotIndex = data.speeches.findIndex(s => s.id === spotList[0].id);
    }
    if (currentSpotIndex < 0 || currentSpotIndex >= data.speeches.length) {
      currentSpotIndex = 0;
    }

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

    renderSpeechView();
  }

  // --- RENDER TOPIC LECTURES VIEW (原知识卡) ---
  function renderCardsView() {
    const tabsContainer = document.getElementById('cards-category-tabs');
    const container = document.getElementById('cards-content-container');
    const cardsData = data.knowledgeCards || data.topicLectures || [];
    if (!tabsContainer || !container || cardsData.length === 0) return;

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
      const matchingCards = cardsData.filter(c => c.category === currentCardCategory);
      const cardItem = matchingCards.length > 0 ? matchingCards[0] : cardsData[0];

      if (!cardItem) return;

      // 1. 主卡片：专题标题、概述、逻辑链与考点词汇
      const headerCard = document.createElement('div');
      headerCard.className = 'card';
      headerCard.style.marginBottom = '16px';

      let logicChainHTML = '';
      if (cardItem.logicChain && cardItem.logicChain.length > 0) {
        logicChainHTML = `
          <div style="background: linear-gradient(135deg, #f6faf7 0%, #ebf5ee 100%); border: 1px dashed #c6e2ce; border-radius: 10px; padding: 14px 16px; margin-top: 14px; margin-bottom: 16px;">
            <div style="font-weight: 800; font-size: 14.5px; color: #2d7a4c; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              🧠 官方考点背诵逻辑链 (Mind Chain):
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
              ${cardItem.logicChain.map((step, idx) => `
                <span style="background: #ffffff; border: 1px solid #c6e2ce; color: #23613c; font-weight: 700; font-size: 12.5px; padding: 4px 11px; border-radius: 20px; box-shadow: 0 1px 3px rgba(45,122,76,0.06);">
                  ${idx + 1}. ${step}
                </span>
                ${idx < cardItem.logicChain.length - 1 ? '<span style="color: #88b897; font-size: 13px; font-weight: bold;">➔</span>' : ''}
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
        <span class="qa-tag-badge" style="background: #ebf5ee; color: #2d7a4c; border: 1px solid #c6e2ce;">《24广西英导词》源文件专题范文</span>
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
            const secCard = e.currentTarget.closest('.card');
            const enContainer = secCard ? secCard.querySelector('.speech-text-en') : null;
            const targetSec = cardItem.sections[idx];
            if (targetSec && targetSec.en) {
              speakText(targetSec.en, enContainer);
            }
          });
        });
      } else if (cardItem.enSentence) {
        // 兼容单句模式
        const secCard = document.createElement('div');
        secCard.className = 'card';
        secCard.style.marginBottom = '14px';
        secCard.innerHTML = `
          <div class="speech-text-en" style="font-size: 15px; color: #2d7a4c; background: #ebf5ee; border-left: 4px solid #2d7a4c; padding: 12px 14px; border-radius: 6px; margin-bottom: 12px;">
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
          const enContainer = secCard.querySelector('.speech-text-en');
          speakText(cardItem.enSentence, enContainer);
        });
      }
    }
  }

  function getFilteredPracticeList() {
    let list = [];
    if (currentPracticeCategory === "英汉双向口译") {
      list = (data.translations || []).map(t => ({
        type: t.type || 'E2C',
        tag: t.tag || (t.type === 'C2E' ? '汉译英' : '英译中'),
        cnQuestion: '',
        question: t.src || t.question || t.en || '',
        answer: t.ref || t.answer || t.cn || '',
        spot: '英汉双向口译真题178题'
      }));
    } else if (currentPracticeCategory.includes("应变")) {
      list = (data.questions || []).filter(q => (q.officialCategory || q.category || "").includes("应变"));
    } else if (currentPracticeCategory.includes("综合")) {
      list = (data.questions || []).filter(q => (q.officialCategory || q.category || "").includes("综合"));
    } else {
      list = (data.questions || []).filter(q => {
        const cat = q.officialCategory || q.category || "";
        return cat.includes("业务") || (!cat.includes("应变") && !cat.includes("综合"));
      });
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
    const numBadge = document.getElementById('practice-num-badge');
    const listenBtn = document.getElementById('btn-practice-listen');

    if (numBadge) {
      numBadge.textContent = `#${currentPracticeIndex + 1} / ${list.length}`;
    }

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

    // 英文在上，中文在下
    document.getElementById('practice-en-question').textContent = qItem.enQuestion || qItem.question;
    document.getElementById('practice-cn-question').textContent = qItem.cnQuestion || '';
    
    // 答案中英文对照
    let ansHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-weight:700; color:#2d7a4c; font-size:14px;">💡 参考答案 (Answer Reference)：</span>
        <button class="action-btn" id="btn-practice-listen-ans" style="padding:4px 12px; font-size:12.5px;">🔊 听英文答案</button>
      </div>
      <div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6;">${qItem.answer}</div>
    `;
    if (qItem.cnAnswer) {
      ansHTML += `<div style="white-space: pre-line; font-size: 14px; color: #475569; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; line-height: 1.6; font-weight: 500;">${qItem.cnAnswer}</div>`;
    }
    document.getElementById('practice-ref-text').innerHTML = ansHTML;
    document.getElementById('practice-ref-box').style.display = 'none';
    document.getElementById('practice-user-input').value = '';

    const btnListenAns = document.getElementById('btn-practice-listen-ans');
    if (btnListenAns) {
      btnListenAns.addEventListener('click', () => {
        const cleanAnsText = qItem.answer.replace(/<[^>]*>/g, '');
        const ansContainer = document.getElementById('practice-ref-text');
        speakText(cleanAnsText, ansContainer);
      });
    }
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
        shuffledPracticeQueue = [];
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
        
        let ansContentHTML = `<div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6;">${qa.answer}</div>`;
        if (qa.cnAnswer) {
          ansContentHTML += `<div style="white-space: pre-line; font-size: 14px; color: #475569; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; line-height: 1.6; font-weight: 500;">${qa.cnAnswer}</div>`;
        }

        const isC2E = qa.type === 'C2E' || qa.tag === '汉译英';
        const tagText = currentPracticeCategory === "英汉双向口译" ? (isC2E ? '🇨🇳➔🇺🇸 汉译英' : '🇺🇸➔🇨🇳 英译中') : (qa.spot || currentPracticeCategory);

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 2px 8px; border-radius: 4px; display: inline-block;">#${idx + 1}</span>
            <span class="qa-tag-badge" style="font-size: 12px; ${isC2E ? 'background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;' : 'background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;'}">${tagText}</span>
          </div>
          <h3 class="qa-question-title" style="font-size: 16.5px; margin-bottom: 4px; color: #1a1a1a; font-weight: 700; line-height: 1.4;">${qa.enQuestion || qa.question}</h3>
          ${qa.cnQuestion ? `<div style="font-size: 14px; color: #666; font-weight: 500; margin-bottom: 12px;">${qa.cnQuestion}</div>` : ''}
          
          <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; margin-top: 10px;">
            <button class="action-btn btn-qa-read" data-idx="${idx}">${isC2E ? '🔊 示范英文发音' : '🔊 听题'}</button>
            <button class="play-main-btn btn-qa-ans-toggle" data-idx="${idx}" style="padding: 5px 16px; font-size: 13px;">参考答案</button>
            <button class="action-btn btn-qa-read-ans" data-idx="${idx}">🔊 听答案</button>
          </div>

          <div class="ref-answer-box" id="ref-box-${idx}" style="display: none; margin-top: 12px;">
            <div class="ref-answer-title" style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 6px;">💡 参考答案 (Answer Reference)：</div>
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

      listContainer.querySelectorAll('.btn-qa-read-ans').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          speakText(list[i].answer);
        });
      });

      listContainer.querySelectorAll('.btn-qa-ans-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const box = document.getElementById(`ref-box-${i}`);
          if (box) {
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
          }
        });
      });
    }
  }

  // --- RENDER SKILLS VIEW (考试技巧) ---
  function renderSkillsView() {
    const tabsContainer = document.getElementById('skills-subject-tabs');
    const cardsContainer = document.getElementById('skills-cards-container');
    const skillsList = data.skillsBySubject || data.skillsSections || [];
    if (!tabsContainer || !cardsContainer || skillsList.length === 0) return;

    tabsContainer.innerHTML = '';
    skillsList.forEach(subObj => {
      const subjectName = subObj.subject || subObj.category || subObj.title || "备考技巧";
      const btn = document.createElement('button');
      btn.className = `cat-btn ${subjectName === currentSkillSubject ? 'active' : ''}`;
      btn.textContent = subjectName;
      btn.addEventListener('click', () => {
        currentSkillSubject = subjectName;
        document.querySelectorAll('#skills-subject-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSelectedSkillSubject();
      });
      tabsContainer.appendChild(btn);
    });

    renderSelectedSkillSubject();

    function renderSelectedSkillSubject() {
      cardsContainer.innerHTML = '';
      if (skillsList.length === 0) return;
      const selectedSub = skillsList.find(s => (s.subject || s.category || s.title) === currentSkillSubject) || skillsList[0];
      const subjectName = selectedSub.subject || selectedSub.category || selectedSub.title || "备考技巧";

      const headerCard = document.createElement('div');
      headerCard.className = 'card';
      headerCard.style.marginBottom = '16px';
      headerCard.style.background = '#faf8f5';
      headerCard.style.borderColor = '#e2d9cd';
      headerCard.innerHTML = `
        <h3 style="font-size: 18px; font-weight: 800; color: #2d7a4c; margin-bottom: 6px;">讲义官方专篇：${selectedSub.subject || ''}</h3>
        <p style="font-size: 13.5px; color: #555; line-height: 1.6;">${selectedSub.desc || selectedSub.title || ''}</p>
      `;
      cardsContainer.appendChild(headerCard);

      const itemList = selectedSub.items || selectedSub.tips || [];
      if (itemList.length === 0) return;

      if (selectedSub.subject === "万能句式") {
        itemList.forEach(item => {
          const itemCard = document.createElement('div');
          itemCard.className = 'card';
          itemCard.style.marginBottom = '14px';
          if (typeof item === 'string') {
            itemCard.innerHTML = `<div style="font-size: 14px; color: #333;">${item}</div>`;
          } else {
            itemCard.innerHTML = `
              <div style="font-weight: 700; font-size: 15.5px; color: #1a1a1a; margin-bottom: 10px;">• ${item.subtitle || ''}</div>
              <div style="font-size: 14.5px; color: #2d7a4c; background: #ebf5ee; border-left: 4px solid #2d7a4c; padding: 12px 16px; border-radius: 6px; font-weight: 500; font-family: monospace; margin-bottom: 10px; line-height: 1.6;">"${item.en || ''}"</div>
              <div style="font-size: 13.5px; color: #444; line-height: 1.6;">${item.cn || ''}</div>
            `;
          }
          cardsContainer.appendChild(itemCard);
        });
        return;
      }

      itemList.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'card';
        itemCard.style.marginBottom = '14px';

        if (typeof item === 'string') {
          itemCard.innerHTML = `
            <div style="font-size: 14.5px; color: #333; line-height: 1.8;">💡 ${item}</div>
          `;
        } else {
          let formattedText = item.content || '';
          formattedText = formattedText.replace(/^(01|02|03|04|05|06)\s*[\u4e00-\u9fa5]+/gm, '');
          formattedText = formattedText.replace(/章节指南与核心要点/g, '');

          formattedText = formattedText.replace(/"([^"]+)"/g, `
            <div style="font-size: 14.5px; color: #2d7a4c; background: #ebf5ee; border-left: 4px solid #2d7a4c; padding: 12px 16px; border-radius: 6px; font-weight: 500; font-family: monospace; margin: 10px 0; line-height: 1.6;">
              "$1"
            </div>
          `);
          
          formattedText = formattedText.replace(/\n/g, '<br>');

          itemCard.innerHTML = `
            <h4 style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; border-bottom: 2px solid #f0eae1; padding-bottom: 6px;">${item.subtitle || '核心要点'}</h4>
            <div style="font-size: 14.5px; color: #333; line-height: 1.8;">${formattedText}</div>
          `;
        }
        cardsContainer.appendChild(itemCard);
      });
    }
  }

  function renderSpeechView() {
    const container = document.getElementById('speech-cards-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!data.speeches || data.speeches.length === 0) {
      container.innerHTML = '<div class="card"><p style="color:#666;text-align:center;">暂无导游词数据。</p></div>';
      return;
    }

    let speech = data.speeches[currentSpotIndex];
    if (!speech) {
      currentSpotIndex = 0;
      speech = data.speeches[0];
    }

    // 1. 每篇导游词单独开一栏显示导游词总标题
    const headerCard = document.createElement('div');
    headerCard.className = 'card';
    headerCard.style.background = '#faf8f5';
    headerCard.style.borderLeft = '5px solid #2d7a4c';
    headerCard.style.marginBottom = '16px';
    headerCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <span class="qa-tag-badge" style="background: #ebf5ee; color: #2d7a4c; border: 1px solid #c6e2ce; margin-bottom: 6px; display: inline-block;">
            ${speech.category || '官方现场导游词'}
          </span>
          <h2 style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin-top: 4px;">${speech.name}</h2>
        </div>
        <span style="font-size: 13px; color: #666; font-weight: 600; background: #eee7dd; padding: 4px 12px; border-radius: 20px;">
          📖 共 ${speech.sections.length} 个讲解段落
        </span>
      </div>
      ${speech.image ? `
        <div style="margin-top: 14px; width: 100%; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <img src="${speech.image}" alt="${speech.name}" style="width: 100%; max-height: 360px; object-fit: cover; display: block; border-radius: 8px;" onerror="this.style.display='none'" />
        </div>
      ` : ''}
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
          const state = card.dataset.playState;
          const cleanText = sec.en.replace(/<[^>]*>/g, '');
          const enContainer = card.querySelector('.speech-text-en');

          if (state === 'playing') {
            window.speechSynthesis.cancel();
            card.dataset.playState = 'idle';
            btn.textContent = '示范朗读';
            clearSpeechHighlights(enContainer);
          } else {
            speakText(cleanText, enContainer);
            card.dataset.playState = 'playing';
            btn.textContent = '⏸ 暂停';
            
            const checkEnded = setInterval(() => {
              if (!window.speechSynthesis.speaking) {
                clearInterval(checkEnded);
                card.dataset.playState = 'idle';
                if (btn) btn.textContent = '示范朗读';
              }
            }, 300);
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
        filteredFiles = filteredFiles.filter(f => f.subCategory === currentResourceSubCategory);
      }

      filteredFiles.forEach(file => {
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
            <span class="resource-category" style="font-size: 12px; color: #2d7a4c; background: #ebf5ee; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${file.subCategory ? `${file.category} · ${file.subCategory}` : file.category}</span>
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
        } else if (tab === 'phrases') {
          subNavWrapper.style.display = 'none';
          if (viewPhrases) viewPhrases.style.display = 'block';
          renderPhrasesView();
        } else if (tab === 'resources') {
          subNavWrapper.style.display = 'none';
          viewResources.style.display = 'block';
          renderResourcesView();
        }
      });
    });

    // --- CHEATSHEET SUBNAV TOGGLE ---
    let currentCheatSubtab = 'topic';
    const btnCheatTopic = document.getElementById('btn-cheat-topic');
    const btnCheatSpot = document.getElementById('btn-cheat-spot');
    const btnCheatEmergency = document.getElementById('btn-cheat-emergency');
    if (btnCheatTopic && btnCheatSpot && btnCheatEmergency) {
      btnCheatTopic.addEventListener('click', () => {
        currentCheatSubtab = 'topic';
        btnCheatTopic.classList.add('active');
        btnCheatSpot.classList.remove('active');
        btnCheatEmergency.classList.remove('active');
        renderCheatsheetView();
      });
      btnCheatSpot.addEventListener('click', () => {
        currentCheatSubtab = 'spot';
        btnCheatSpot.classList.add('active');
        btnCheatTopic.classList.remove('active');
        btnCheatEmergency.classList.remove('active');
        renderCheatsheetView();
      });
      btnCheatEmergency.addEventListener('click', () => {
        currentCheatSubtab = 'emergency';
        btnCheatEmergency.classList.add('active');
        btnCheatTopic.classList.remove('active');
        btnCheatSpot.classList.remove('active');
        renderCheatsheetView();
      });
    }

    function renderCheatsheetView() {
      const container = document.getElementById('cheatsheet-content-container');
      if (!container) return;
      container.innerHTML = '';

      if (currentCheatSubtab === 'topic') {
        // 专题讲解万用模板卡片
        container.innerHTML = `
          <!-- 1. Universal 5-Step Block -->
          <div class="card" style="border-left: 5px solid #2d7a4c; margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #2d7a4c;">🎯 专题讲解Universal 5步积木法 (Universal 5-Step Block)</h3>
              <span class="qa-tag-badge" style="background:#ebf5ee; color:#2d7a4c; border:1px solid #c6e2ce;">时长 4~5 分钟 · 逻辑定型</span>
            </div>
            
            <div style="display: grid; gap: 12px; margin-top: 14px;">
              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 1: Hook & Welcome (破冰开场 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Dear tourists and friends, hello everyone! Welcome to beautiful Guangxi. Today, it’s my absolute pleasure to take you on a journey to explore <mark style="background:#fef08a; padding:1px 4px;">[the rich ethnic culture / longevity secrets]</mark> of this magical land."</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 2: Macro Overview & Significance (宏观定调与地位 - 60秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Guangxi, located in southern China, is blessed with <mark style="background:#fef08a; padding:1px 4px;">[ancient history / breath-taking karst landscapes]</mark>. What you are about to discover is not just scenery, but a living picture of human harmony with nature and culture."</div>
              </div>

              <div style="background: #ebf5ee; border: 1.5px dashed #a3d9b1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #25663e; font-size: 14px; margin-bottom: 4px;">Step 3: Core Highlights Breakdown (三大核心亮点拆解 - 120~150秒) ⚡重点套用词库</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"When speaking of <mark style="background:#fef08a; padding:1px 4px;">[专题名称]</mark>, there are 3 key highlights you cannot miss:<br>
                First of all, <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[亮点一: 历史沿革 / 12世居民族 / 喀斯特地貌]</mark>...<br>
                Secondly, <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[亮点二: 代表文化 / 名特风物 / 宜居环境]</mark>...<br>
                Last but not least, <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[亮点三: 现代发展 / 风味美食 / 乐观心态]</mark>..."</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 4: Interactive Guidance (现场互动与体验 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"As we walk along this journey, please feel free to take photos or immerse yourselves in local music. Can you feel the unique warmth and hospitality of Guangxi people?"</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 5: Theme Elevation & Closing (主题升华与结语 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"More than just a tourist destination, Guangxi's heritage is a silent historian. I hope this visit adds a brilliant highlight to your journey. Thank you all!"</div>
              </div>
            </div>
          </div>

          <!-- 2. 5大专题核心考点填空矩阵卡 -->
          <div class="card" style="padding: 22px;">
            <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 14px;">🧩 考纲5大专题“核心词汇速填矩阵” (填入Step 3)</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; text-align: left;">
                <thead>
                  <tr style="background: #ebf5ee; border-bottom: 2px solid #c6e2ce; color: #2d7a4c;">
                    <th style="padding: 10px; width: 15%;">抽中专题</th>
                    <th style="padding: 10px; width: 28%;">亮点一 (First of all...)</th>
                    <th style="padding: 10px; width: 28%;">亮点二 (Secondly...)</th>
                    <th style="padding: 10px; width: 29%;">亮点三 (Last but not least...)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(1) 历史广西</td>
                    <td style="padding: 12px 10px;"><strong>古今沿革与管辖</strong><br><span style="color:#555;">Since Qin Dynasty set up Guilin & Xiang Prefectures, formally part of China.</span></td>
                    <td style="padding: 12px 10px;"><strong>重大事件与英烈</strong><br><span style="color:#555;">Taiping Rebellion, Zhennan Pass Victory (Feng Zicai), Baise Uprising (Deng Xiaoping).</span></td>
                    <td style="padding: 12px 10px;"><strong>现代成就与枢纽</strong><br><span style="color:#555;">Frontier for China-ASEAN open cooperation and the Belt & Road Initiative.</span></td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #faf8f5;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(2) 民族广西</td>
                    <td style="padding: 12px 10px;"><strong>12世居民族共处</strong><br><span style="color:#555;">Home to 12 indigenous ethnic groups (Zhuang, Yao, Miao, Dong, etc.) in harmony.</span></td>
                    <td style="padding: 12px 10px;"><strong>建筑与民俗工艺</strong><br><span style="color:#555;">Zhuang stilted buildings, Dong Wind & Rain Bridges, Yao Long Drum Dance, Zhuang Brocade.</span></td>
                    <td style="padding: 12px 10px;"><strong>节日与非遗艺术</strong><br><span style="color:#555;">Zhuang March 3rd Song Fair, Dong Grand Songs (unaccompanied chorus), Panwang Festival.</span></td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(3) 风物广西</td>
                    <td style="padding: 12px 10px;"><strong>特色工艺美术</strong><br><span style="color:#555;">Handwoven Zhuang Brocade, embroidered balls, Hepu Horn Carvings, Yangshuo painted fans.</span></td>
                    <td style="padding: 12px 10px;"><strong>名特优产与名茶名酒</strong><br><span style="color:#555;">Yongfu Luohanguo, Wuzhou Liubao Tea, Guilin Sanhua Wine (rice-flavor liquor).</span></td>
                    <td style="padding: 12px 10px;"><strong>特色美食小吃</strong><br><span style="color:#555;">Guilin Rice Noodles, Liuzhou River Snail Noodles (螺蛳粉), Nanning Laoyou Noodles.</span></td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #faf8f5;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(4) 山水广西</td>
                    <td style="padding: 12px 10px;"><strong>喀斯特/丹霞奇观</strong><br><span style="color:#555;">World-class Karst peak forests & caves (Guilin), Danxia cliffs (Bajiao Village).</span></td>
                    <td style="padding: 12px 10px;"><strong>江河与滨海风光</strong><br><span style="color:#555;">Meandering Lijiang River, Yongjiang, Beihai Silver Beach & Weizhou Volcanic Island.</span></td>
                    <td style="padding: 12px 10px;"><strong>诗意文化内涵</strong><br><span style="color:#555;">"The river is like a green silk ribbon, and the mountains are like jade hairpins."</span></td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(5) 长寿广西</td>
                    <td style="padding: 12px 10px;"><strong>长寿之乡分布</strong><br><span style="color:#555;">World & Chinese Longevity Hometowns, led by Bama Yao Autonomous County.</span></td>
                    <td style="padding: 12px 10px;"><strong>生态环境奥秘</strong><br><span style="color:#555;">Pure air rich in negative oxygen ions, clear mineral water, pleasant mild climate.</span></td>
                    <td style="padding: 12px 10px;"><strong>饮食与生活心态</strong><br><span style="color:#555;">Light seasonal diet with coarse grains (sweet potatoes), peaceful & cheerful mindset.</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (currentCheatSubtab === 'spot') {
        // 景点讲解万用模板卡片
        container.innerHTML = `
          <!-- 1. Spot 5-Step Block -->
          <div class="card" style="border-left: 5px solid #2563eb; margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #2563eb;">🗺️ 景点讲解移步换景法 (Scenic Spot 5-Step Block)</h3>
              <span class="qa-tag-badge" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">时长 4~5 分钟 · 动线导览</span>
            </div>

            <div style="display: grid; gap: 12px; margin-top: 14px;">
              <div style="background: #faf8f5; border: 1px solid #e8dfd1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2563eb; font-size: 14px; margin-bottom: 4px;">Step 1: Welcome & Spot Overview (欢迎与景点定位 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Dear tourists, welcome to <mark style="background:#fef08a; padding:1px 4px;">[景点名称]</mark>! Located in <mark style="background:#fef08a; padding:1px 4px;">[Guilin/Nanning/Liuzhou]</mark>, this site is a national 5A-level scenic area, combining stunning natural beauty with deep cultural heritage."</div>
              </div>

              <div style="background: #faf8f5; border: 1px solid #e8dfd1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2563eb; font-size: 14px; margin-bottom: 4px;">Step 2: Features & Layout (景点特色与游览线索 - 45秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"What makes <mark style="background:#fef08a; padding:1px 4px;">[景点名称]</mark> unique is its <mark style="background:#fef08a; padding:1px 4px;">[Karst mountains / authentic Dong villages]</mark>. The scenic area is laid out along <mark style="background:#fef08a; padding:1px 4px;">[the river / lush hills]</mark>, offering a breathtaking view at every turn."</div>
              </div>

              <div style="background: #eff6ff; border: 1.5px dashed #93c5fd; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #1d4ed8; font-size: 14px; margin-bottom: 4px;">Step 3: Route & Core Landmarks (三大核心地标套用 - 120~150秒) ⚡重点套用路线</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Today, our tour route will take us downstream/along the path to explore 3 highlights:<br>
                First, we see <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标一, 如: Elephant Trunk Hill]</mark>, which gets its name because it resembles an elephant drinking water.<br>
                Next, we reach <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标二, 如: Nine-Horse Painting Hill]</mark>, famous for stone wall patterns.<br>
                Finally, we arrive at <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标三, 如: Huangbu Reflection]</mark>, printed on the 20-yuan RMB note."</div>
              </div>

              <div style="background: #faf8f5; border: 1px solid #e8dfd1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2563eb; font-size: 14px; margin-bottom: 4px;">Step 4: History & Interactive Guidance (历史诗句与照料互动 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Famous Tang poet Han Yu once praised this view: 'The river is like a green silk ribbon, and the mountains are like jade hairpins.' By the way, this is the best photo spot! Would you like me to take a photo of you? Please watch your step."</div>
              </div>

              <div style="background: #faf8f5; border: 1px solid #e8dfd1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2563eb; font-size: 14px; margin-bottom: 4px;">Step 5: Closing & Farewell (总结与致谢告别 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"This scenic area is not only a visual feast but a cradle of local culture. I hope today's tour leaves you with wonderful memories. Thank you and wish you a pleasant journey!"</div>
              </div>
            </div>
          </div>

          <!-- 2. 5大景点考纲词库矩阵卡 -->
          <div class="card" style="padding: 22px;">
            <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 14px;">📍 考纲5大景点“路线与地标速填矩阵” (填入Step 3)</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; text-align: left;">
                <thead>
                  <tr style="background: #eff6ff; border-bottom: 2px solid #bfdbfe; color: #1e40af;">
                    <th style="padding: 10px; width: 18%;">抽中景点</th>
                    <th style="padding: 10px; width: 22%;">概况特征 (Step 1&2)</th>
                    <th style="padding: 10px; width: 38%;">三大地标动线 (Step 3)</th>
                    <th style="padding: 10px; width: 22%;">诗句/历史/卡点 (Step 4)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(1) 桂林漓江景区</td>
                    <td style="padding: 12px 10px;">Origin: Mao'er Mtn, 164 km. Clear water like green silk ribbon.</td>
                    <td style="padding: 12px 10px;">1. <strong>象鼻山</strong>: Elephant drinking water.<br>2. <strong>九马画山</strong>: Wall patterns.<br>3. <strong>黄布倒影</strong>: 20-yuan RMB background.</td>
                    <td style="padding: 12px 10px;">Han Yu's poem: <em>"Green silk ribbon & jade hairpins"</em>. Xu Xiake traveled here.</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #faf8f5;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(2) 南宁青秀山</td>
                    <td style="padding: 12px 10px;">City green lung by Yongjiang River, 13.54 sq km, oxygen bar.</td>
                    <td style="padding: 12px 10px;">1. <strong>壮锦广场</strong>: Zhuang sculptures.<br>2. <strong>千年苏铁园</strong>: Relocation base.<br>3. <strong>龙象塔</strong>: Ming tower with skyline view.</td>
                    <td style="padding: 12px 10px;">Summer resort since Sui & Tang. Guanyin Temple; Folk Song Festival.</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(3) 两江四湖·象山</td>
                    <td style="padding: 12px 10px;">City-center water system: Lijiang/Taohua + 4 lakes + Xiangshan.</td>
                    <td style="padding: 12px 10px;">1. <strong>日月双塔</strong>: Copper Sun & Glazed Moon.<br>2. <strong>榕湖古南门</strong>: Historic city gate.<br>3. <strong>木龙湖宋城</strong>: Song Dynasty architecture.</td>
                    <td style="padding: 12px 10px;">Water system built in Song Dynasty. Brilliant romantic LED night views.</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #faf8f5;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(4) 柳州程阳八寨</td>
                    <td style="padding: 12px 10px;">8 Dong villages in Sanjiang. Wooden architectural marvels.</td>
                    <td style="padding: 12px 10px;">1. <strong>马鞍寨鼓楼</strong>: Village assembly landmark.<br>2. <strong>程阳风雨桥</strong>: Mortise & tenon (no nails).<br>3. <strong>百家宴</strong>: Sharing ethnic delicacies.</td>
                    <td style="padding: 12px 10px;">Dong Grand Song (unaccompanied chorus). Offer local Oil Tea to guests.</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 10px; font-weight: 700; color: #1a1a1a;">(5) 崇左花山岩画</td>
                    <td style="padding: 12px 10px;">UNESCO World Cultural Heritage Site along Zuo River.</td>
                    <td style="padding: 12px 10px;">1. <strong>明江游船</strong>: Scenic cruise along cliffs.<br>2. <strong>壁画岩面</strong>: Ochre frog dance & drums.<br>3. <strong>解密中心</strong>: Pigment technique center.</td>
                    <td style="padding: 12px 10px;">Ancient Luoyue ritual for rain. Red hematite pigment lasting 2,000+ yrs.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (currentCheatSubtab === 'emergency') {
        // 突发事件应答三步法卡片
        container.innerHTML = `
          <div class="card" style="border-left: 5px solid #16a34a; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #16a34a;">⚡ 现场突发问答“黄金三步法则” (Emergency Answering Model)</h3>
              <span class="qa-tag-badge" style="background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;">考场问答救命急救包</span>
            </div>

            <!-- 公式卡片 -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 20px; text-align: center;">
              <div style="font-size: 16px; font-weight: 800; color: #15803d;">突发事件英文万能公式</div>
              <div style="font-size: 15px; color: #166534; font-family: monospace; margin-top: 6px;">
                Answer = 1. Calm Down & Reassure (镇定安抚) + 2. Immediate Action (紧急处置) + 3. Follow-up & Record (跟进上报)
              </div>
            </div>

            <!-- 3大场景模板卡 -->
            <div style="display: grid; gap: 14px;">
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #fff;">
                <div style="font-weight: 700; color: #1a1a1a; font-size: 14.5px; margin-bottom: 6px;">场景 1: 游客中暑或突发疾病 (Medical Emergency)</div>
                <div style="font-size: 13.5px; color: #374151; font-family: monospace; line-height: 1.6;">
                  "<strong>First</strong>, I will stay calm and reassure the tourists to prevent panic.<br>
                  <strong>Then</strong>, I will immediately move the sick tourist to a shady, well-ventilated area, provide basic first aid, and call 120 for medical assistance.<br>
                  <strong>Finally</strong>, I will keep a detailed record of the incident and report to my travel agency."
                </div>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #fff;">
                <div style="font-weight: 700; color: #1a1a1a; font-size: 14.5px; margin-bottom: 6px;">场景 2: 游客在景区走失 (Lost Tourist)</div>
                <div style="font-size: 13.5px; color: #374151; font-family: monospace; line-height: 1.6;">
                  "<strong>First</strong>, I will count the group and confirm the missing person's physical features.<br>
                  <strong>Then</strong>, I will contact scenic security to broadcast a search message and inform local police if necessary.<br>
                  <strong>Afterwards</strong>, once found, I will check their condition and report to the agency."
                </div>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #fff;">
                <div style="font-weight: 700; color: #1a1a1a; font-size: 14.5px; margin-bottom: 6px;">场景 3: 景区临时关闭或天气恶劣 (Attraction Closure)</div>
                <div style="font-size: 13.5px; color: #374151; font-family: monospace; line-height: 1.6;">
                  "<strong>First</strong>, I will obtain official notices immediately and explain the situation to tourists to win their understanding.<br>
                  <strong>Then</strong>, I will quickly adjust the itinerary and provide an exciting alternative tour.<br>
                  <strong>Finally</strong>, I will make sure everyone is satisfied and update the agency."
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

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
            const ansEl = document.getElementById('practice-ref-box');
            speakText(item.answer, ansEl);
          } else {
            const qEl = document.getElementById('practice-en-question');
            speakText(item.question, qEl);
          }
        } else {
          const qEl = document.getElementById('practice-en-question');
          speakText(qEl ? qEl.textContent : '', qEl);
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


  // ==========================================
  // --- PHRASES MODULE (短语速记，严格隔离) ---
  // ==========================================
  let currentPhraseCategory = '全部专题';
  let currentPhraseIndex = 0;
  let phraseViewMode = 'card';
  let isPhraseRevealed = false;
  let phraseProgress = {};
  try {
    phraseProgress = JSON.parse(localStorage.getItem('guangxi_phrase_progress') || '{}');
  } catch (e) {
    phraseProgress = {};
  }

function getPhraseStatus(id) {
    const item = phraseProgress[id];
    if (!item) return { status: 'unlearned', remaining: 0 };
    if (typeof item === 'string') {
      if (item === 'mastered') return { status: 'mastered', remaining: 0 };
      if (item === 'vague') return { status: 'vague', remaining: 2 };
      if (item === 'again') return { status: 'again', remaining: 4 };
    }
    return item;
}

  function getFilteredPhrases() {
    const list = data.phrasesData || [];
    let base = list;
    if (currentPhraseCategory && currentPhraseCategory !== '全部专题') {
      base = list.filter(p => p.category === currentPhraseCategory);
    }

    if (phraseViewMode === 'list') {
      return base;
    }

    // 墨墨穿插重复算法：精准后置 5 位穿插调度
    const result = [];
    const pendingReview = [];

    base.forEach(p => {
      const st = getPhraseStatus(p.id);
      if (st.status === 'unlearned') {
        result.push(p);
      } else if (st.status === 'mastered') {
        if (st.remaining > 0) {
          pendingReview.push({ item: p, rem: st.remaining });
        }
      } else if (st.status === 'vague' || st.status === 'again') {
        const count = st.remaining > 0 ? st.remaining : (st.status === 'vague' ? 2 : 4);
        pendingReview.push({ item: p, rem: count });
      }
    });

    // 将需要复现的卡片，按 5 个卡片间隔均匀插入主序列中
    pendingReview.forEach(rev => {
      for (let i = 0; i < rev.rem; i++) {
        const insertIdx = Math.min(result.length, (i + 1) * 5);
        result.splice(insertIdx, 0, rev.item);
      }
    });

    return result.length > 0 ? result : base;
  }

  function updatePhraseStats() {
    const all = data.phrasesData || [];
    let mastered = 0;
    let review = 0;
    all.forEach(p => {
      const st = phraseProgress[p.id];
      if (st && st.status === 'mastered') mastered++;
      else if (st && (st.status === 'again' || st.status === 'vague')) review++;
    });
    const elM = document.getElementById('phrase-stat-mastered');
    const elR = document.getElementById('phrase-stat-review');
    const elT = document.getElementById('phrase-stat-total');
    if (elM) elM.textContent = mastered;
    if (elR) elR.textContent = review;
    if (elT) elT.textContent = all.length;
  }

  function renderPhrasesView() {
    updatePhraseStats();
    renderPhrasesCategoryTabs();
    
    const cardView = document.getElementById('phrase-main-card');
    const listView = document.getElementById('phrase-list-container');
    const btnCard = document.getElementById('btn-phrase-mode-card');
    const btnList = document.getElementById('btn-phrase-mode-list');

    if (phraseViewMode === 'card') {
      if (cardView) cardView.style.display = 'flex';
      if (listView) listView.style.display = 'none';
      if (btnCard) btnCard.classList.add('active');
      if (btnList) btnList.classList.remove('active');
      renderCurrentPhraseCard();
    } else {
      if (cardView) cardView.style.display = 'none';
      if (listView) listView.style.display = 'block';
      if (btnList) btnList.classList.add('active');
      if (btnCard) btnCard.classList.remove('active');
      renderPhraseList();
    }
  }

  function renderPhrasesCategoryTabs() {
    const container = document.getElementById('phrases-category-tabs');
    if (!container) return;
    container.innerHTML = '';
    const cats = data.phrasesCategories || ['全部专题'];

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '100%';

    const select = document.createElement('select');
    select.className = 'cat-select';
    select.style.width = '100%';
    select.style.padding = '8px 36px 8px 16px';
    select.style.fontSize = '14px';
    select.style.fontWeight = '700';
    select.style.color = '#2d7a4c';
    select.style.background = '#ebf5ee';
    select.style.border = '1px solid #c6e2ce';
    select.style.borderRadius = '20px';
    select.style.outline = 'none';
    select.style.cursor = 'pointer';
    select.style.appearance = 'none';
    select.style.webkitAppearance = 'none';

    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat === '全部专题' ? '📚 全部专题（点击切换）' : `📌 专题：${cat}`;
      if (cat === currentPhraseCategory) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      currentPhraseCategory = e.target.value;
      currentPhraseIndex = 0;
      isPhraseRevealed = false;
      renderPhrasesView();
    });

    const arrow = document.createElement('span');
    arrow.textContent = '▼';
    arrow.style.position = 'absolute';
    arrow.style.right = '14px';
    arrow.style.top = '50%';
    arrow.style.transform = 'translateY(-50%)';
    arrow.style.fontSize = '10px';
    arrow.style.color = '#2d7a4c';
    arrow.style.pointerEvents = 'none';

    wrapper.appendChild(select);
    wrapper.appendChild(arrow);
    container.appendChild(wrapper);
  }

  function renderCurrentPhraseCard() {
    const list = getFilteredPhrases();
    const tagBadge = document.getElementById('phrase-tag-badge');
    const counter = document.getElementById('phrase-card-counter');
    const enTitle = document.getElementById('phrase-en-title');
    const cnText = document.getElementById('phrase-cn-text');
    const exText = document.getElementById('phrase-example-text');
    const ansBox = document.getElementById('phrase-answer-box');
    const unrevealedActions = document.getElementById('phrase-unrevealed-actions');
    const revealedActions = document.getElementById('phrase-revealed-actions');

    if (!list || list.length === 0) {
      if (enTitle) enTitle.textContent = '暂无符合条件的短语';
      if (counter) counter.textContent = '0 / 0';
      if (ansBox) ansBox.style.display = 'none';
      return;
    }

    if (currentPhraseIndex >= list.length) currentPhraseIndex = 0;
    if (currentPhraseIndex < 0) currentPhraseIndex = list.length - 1;

    const item = list[currentPhraseIndex];
    const stObj = getPhraseStatus(item.id);
    let statusBadge = '';
    
    if (stObj.status === 'mastered') {
      statusBadge = stObj.remaining > 0 
        ? ` <span style="color:#16a34a;font-size:12px;">(已认识 · 还需巩固${stObj.remaining}次)</span>`
        : ' <span style="color:#16a34a;font-size:12px;">(已斩掉)</span>';
    } else if (stObj.status === 'again') {
      const labelText = stObj.isFirstTime ? '不认识' : '遗忘';
      statusBadge = ` <span style="color:#dc2626;font-size:12px;">(${labelText} · 穿插剩${stObj.remaining}次)</span>`;
    } else if (stObj.status === 'vague') {
      statusBadge = ` <span style="color:#d97706;font-size:12px;">(模糊 · 穿插剩${stObj.remaining}次)</span>`;
    }

    if (tagBadge) tagBadge.innerHTML = `${item.category}${statusBadge}`;
    if (counter) counter.textContent = `${currentPhraseIndex + 1} / ${list.length}`;
    if (enTitle) enTitle.textContent = item.en;
    if (cnText) cnText.textContent = item.cn;
        if (exText) {
      if (item.example) {
        exText.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div style="flex:1;">
              <span style="font-weight:700; color:#2d7a4c;">💡 例句：</span>
              <span id="phrase-example-sentence" style="color:#4b5563;">${item.example}</span>
            </div>
            <button class="action-btn" id="btn-phrase-example-speak" title="朗读例句" style="padding: 2px 8px; font-size: 13px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 12px; cursor: pointer; flex-shrink: 0;">🔊 读例句</button>
          </div>
        `;
        const btnExSpeak = document.getElementById('btn-phrase-example-speak');
        if (btnExSpeak) {
          btnExSpeak.addEventListener('click', () => {
            const exContainer = document.getElementById('phrase-example-sentence');
            speakText(item.example, exContainer);
          });
        }
      } else {
        exText.innerHTML = '';
      }
    }

    if (isPhraseRevealed) {
      if (ansBox) ansBox.style.display = 'block';
      if (unrevealedActions) unrevealedActions.style.display = 'none';
      if (revealedActions) revealedActions.style.display = 'flex';
    } else {
      if (ansBox) ansBox.style.display = 'none';
      if (unrevealedActions) unrevealedActions.style.display = 'flex';
      if (revealedActions) revealedActions.style.display = 'none';
    }
  }

  function renderPhraseList() {
    const container = document.getElementById('phrase-list-container');
    if (!container) return;
    container.innerHTML = '';
    const list = getFilteredPhrases();

    if (list.length === 0) {
      container.innerHTML = '<div class="card" style="text-align:center;color:#888;">暂无短语</div>';
      return;
    }

    list.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.style.padding = '16px';

      const stObj = getPhraseStatus(item.id);
      let badgeHTML = '<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:4px;font-size:12px;">未学习</span>';
      if (stObj.status === 'mastered') {
        badgeHTML = stObj.remaining > 0 
          ? `<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">✅ 认识(剩${stObj.remaining}次)</span>`
          : '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">✅ 绝杀已斩</span>';
      } else if (stObj.status === 'again') {
        const labelText = stObj.isFirstTime ? '不认识' : '遗忘';
        badgeHTML = `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">❌ ${labelText}(剩${stObj.remaining}次)</span>`;
      } else if (stObj.status === 'vague') {
        badgeHTML = `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">🤔 模糊(剩${stObj.remaining}次)</span>`;
      }

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
          <div>
            <span style="font-size:12px;color:#2d7a4c;background:#ebf5ee;padding:2px 6px;border-radius:4px;margin-right:8px;">${item.category}</span>
            ${badgeHTML}
          </div>
          <button class="action-btn btn-phrase-list-speak" data-en="${encodeURIComponent(item.en)}" style="padding:4px 10px;font-size:12px;">🔊 朗读</button>
        </div>
        <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${idx + 1}. ${item.en}</div>
        <div style="font-size:14.5px;color:#2d7a4c;font-weight:600;margin-bottom:8px;">${item.cn}</div>
        ${item.example ? `
          <div style="font-size:13px;color:#666;background:#faf8f5;padding:8px 12px;border-left:3px solid #d4c5b2;border-radius:4px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
              <span style="font-weight:700;color:#2d7a4c;">💡 例句：</span>
              <span class="phrase-list-example-text" style="color:#4b5563;">${item.example}</span>
            </div>
            <button class="action-btn btn-phrase-list-ex-speak" data-ex="${encodeURIComponent(item.example)}" style="padding:2px 8px;font-size:12px;background:#ebf5ee;border:1px solid #c6e2ce;color:#2d7a4c;border-radius:12px;cursor:pointer;flex-shrink:0;">🔊 读例句</button>
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-phrase-list-speak').forEach(btn => {
      btn.addEventListener('click', e => {
        const text = decodeURIComponent(e.currentTarget.getAttribute('data-en'));
        speakText(text);
      });
    });

    container.querySelectorAll('.btn-phrase-list-ex-speak').forEach(btn => {
      btn.addEventListener('click', e => {
        const text = decodeURIComponent(e.currentTarget.getAttribute('data-ex'));
        const card = e.currentTarget.closest('.card');
        const exEl = card ? card.querySelector('.phrase-list-example-text') : null;
        speakText(text, exEl);
      });
    });
  }

  function bindPhraseEvents() {
    const btnPhraseCard = document.getElementById('btn-phrase-mode-card');
    const btnPhraseList = document.getElementById('btn-phrase-mode-list');
    if (btnPhraseCard && btnPhraseList) {
      btnPhraseCard.addEventListener('click', () => {
        phraseViewMode = 'card';
        renderPhrasesView();
      });
      btnPhraseList.addEventListener('click', () => {
        phraseViewMode = 'list';
        renderPhrasesView();
      });
    }

    const btnPhraseSpeak = document.getElementById('btn-phrase-speak');
    if (btnPhraseSpeak) {
      btnPhraseSpeak.addEventListener('click', () => {
        const list = getFilteredPhrases();
        if (list.length > 0 && list[currentPhraseIndex]) {
          const cardEl = document.getElementById('phrase-en-title');
          speakText(list[currentPhraseIndex].en, cardEl);
        }
      });
    }

    const btnPhraseReveal = document.getElementById('btn-phrase-reveal');
    if (btnPhraseReveal) {
      btnPhraseReveal.addEventListener('click', () => {
        isPhraseRevealed = true;
        renderCurrentPhraseCard();
      });
    }

    function recordPhraseProgress(actionType) {
      const list = getFilteredPhrases();
      if (list.length > 0 && list[currentPhraseIndex]) {
        const item = list[currentPhraseIndex];
        const currentSt = getPhraseStatus(item.id);

        if (actionType === 'mastered') {
          if (currentSt.status === 'vague' || currentSt.status === 'again') {
            const nextRem = Math.max(0, currentSt.remaining - 1);
            phraseProgress[item.id] = {
              status: 'mastered',
              remaining: nextRem
            };
          } else {
            phraseProgress[item.id] = {
              status: 'mastered',
              remaining: 0
            };
          }
        } else if (actionType === 'vague') {
          // 如果此前已经是模糊/遗忘状态，再次模糊仅增加 1 次复现，上限为 3 次
          let rem = 2;
          if (currentSt.status === 'vague' || currentSt.status === 'again') {
            rem = Math.min(3, currentSt.remaining + 1);
          }
          phraseProgress[item.id] = {
            status: 'vague',
            remaining: rem
          };
        } else if (actionType === 'again') {
          const isFirst = (currentSt.status === 'unlearned');
          // 如果此前已经是模糊/遗忘状态，再次遗忘仅增加 1 次复现，上限为 5 次
          let rem = 4;
          if (currentSt.status === 'vague' || currentSt.status === 'again') {
            rem = Math.min(5, currentSt.remaining + 1);
          }
          phraseProgress[item.id] = {
            status: 'again',
            remaining: rem,
            isFirstTime: isFirst
          };
        }

        try {
          localStorage.setItem('guangxi_phrase_progress', JSON.stringify(phraseProgress));
        } catch (e) {}
      }
      isPhraseRevealed = false;
      currentPhraseIndex++;
      renderPhrasesView();
    }

    const btnPhraseAgain = document.getElementById('btn-phrase-again');
    if (btnPhraseAgain) btnPhraseAgain.addEventListener('click', () => recordPhraseProgress('again'));

    const btnPhraseVague = document.getElementById('btn-phrase-vague');
    if (btnPhraseVague) btnPhraseVague.addEventListener('click', () => recordPhraseProgress('vague'));

    const btnPhraseMastered = document.getElementById('btn-phrase-mastered');
    if (btnPhraseMastered) btnPhraseMastered.addEventListener('click', () => recordPhraseProgress('mastered'));

    const btnPhrasePrev = document.getElementById('btn-phrase-prev');
    if (btnPhrasePrev) {
      btnPhrasePrev.addEventListener('click', () => {
        isPhraseRevealed = false;
        currentPhraseIndex--;
        renderCurrentPhraseCard();
      });
    }

    const btnPhraseNext = document.getElementById('btn-phrase-next');
    if (btnPhraseNext) {
      btnPhraseNext.addEventListener('click', () => {
        isPhraseRevealed = false;
        currentPhraseIndex++;
        renderCurrentPhraseCard();
      });
    }

    const btnPhraseReset = document.getElementById('btn-phrase-reset');
    if (btnPhraseReset) {
      btnPhraseReset.addEventListener('click', () => {
        if (confirm('确定要重置所有短语的记忆进度吗？')) {
          phraseProgress = {};
          try {
            localStorage.removeItem('guangxi_phrase_progress');
          } catch (e) {}
          isPhraseRevealed = false;
          currentPhraseIndex = 0;
          renderPhrasesView();
        }
      });
    }
  }

    bindPhraseEvents();
  }
});
