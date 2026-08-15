// App Logic for Guangxi English Tour Guide Exam Platform
document.addEventListener('DOMContentLoaded', () => {
  const data = window.data || window.GUANGXI_DATA || {};

  // --- SPEECH SYNTHESIS & AUDIO DUAL ENGINE WITH GC PROTECTION ---
  let activeSpeechContainer = null;
  let activeWordMap = [];
  window._activeUtterance = null; // 全局强引用防止 V8 GC 强制干掉 utterance
  const staticAudioPlayer = new Audio();
  let currentPlayingCard = null;
  let activeTourController = null;
  let globalTourSessionId = 0; // 记录当前活跃的连续导览控制器

  staticAudioPlayer.muted = false;
  staticAudioPlayer.volume = 1.0;

  function stopAllAudio(options = { resetTour: true }) {
    globalTourSessionId++;
    if (staticAudioPlayer) {
      staticAudioPlayer.pause();
      staticAudioPlayer.currentTime = 0;
      staticAudioPlayer.ontimeupdate = null;
      staticAudioPlayer.muted = false;
      staticAudioPlayer.volume = 1.0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    window._activeUtterance = null;
    clearSpeechHighlights();

    if (options && options.resetTour && activeTourController) {
      activeTourController.reset();
    }

    if (currentPlayingCard) {
      currentPlayingCard.dataset.playState = 'idle';
      currentPlayingCard.classList.remove('reading-active');
      const en = currentPlayingCard.querySelector('.speech-text-en');
      const b = currentPlayingCard.querySelector('.btn-read-sec');
      if (b) b.textContent = '示范朗读';
      currentPlayingCard = null;
    }
  }

  function clearSpeechHighlights(containerEl) {
    const target = containerEl || activeSpeechContainer;
    if (target) {
      target.querySelectorAll('.word-token').forEach(el => {
        el.classList.remove('word-active', 'word-near');
      });
    }
  }

  // 预热 Web Speech API 声音库
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  function getBestVoiceByGender(preferredGender = 'male') {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const candidateVoices = enVoices.length ? enVoices : voices;

    const isMalePreferred = (preferredGender || 'male').toLowerCase() === 'male';

    // 女性音色常见关键词与人名（覆盖 Windows Edge, Chrome, macOS, iOS 等）
    const femaleKeywords = [
      'female', 'jenny', 'zira', 'samantha', 'victoria', 'karen', 'eva', 'cathy',
      'susan', 'ana', 'aria', 'hazel', 'stephanie', 'sonia', 'julie', 'alva', 'steffi'
    ];
    // 男性音色常见关键词与人名
    const maleKeywords = [
      'male', 'david', 'guy', 'ryan', 'alex', 'daniel', 'fred', 'george', 'richard',
      'mark', 'tom', 'oliver', 'rishi', 'thomas', 'steffan', 'james', 'brian'
    ];

    const targetKeywords = isMalePreferred ? maleKeywords : femaleKeywords;
    const oppositeKeywords = isMalePreferred ? femaleKeywords : maleKeywords;

    // 1. 查找包含目标性别关键词且为美音 en-US 的声音（如 Microsoft David 或 Microsoft Guy）
    let matched = candidateVoices.find(v => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      const isUS = lang === 'en-us' || lang.includes('us') || name.includes('us') || name.includes('united states');
      return isUS && targetKeywords.some(kw => name.includes(kw));
    });
    if (matched) return matched;

    // 2. 查找包含目标性别关键词的任何英文声音（如 Google UK English Male）
    matched = candidateVoices.find(v => {
      const name = (v.name || '').toLowerCase();
      return targetKeywords.some(kw => name.includes(kw));
    });
    if (matched) return matched;

    // 3. 严格排除对方性别关键词的声音，优先取美音
    matched = candidateVoices.find(v => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      const isUS = lang === 'en-us' || lang.includes('us') || name.includes('us');
      return isUS && !oppositeKeywords.some(kw => name.includes(kw));
    });
    if (matched) return matched;

    // 4. 排除对方性别关键词的任何英文声音
    matched = candidateVoices.find(v => {
      const name = (v.name || '').toLowerCase();
      return !oppositeKeywords.some(kw => name.includes(kw));
    });
    if (matched) return matched;

    // 5. 回退到任意美音或英文声音
    return candidateVoices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      return lang === 'en-us' || lang.includes('us') || name.includes('us');
    }) || candidateVoices[0] || null;
  }

  function getAudioSettings() {
    const voiceElem = document.querySelector('.audio-control-card #speech-voice-select') || 
                      document.getElementById('speech-voice-select');
    const rateElem = document.querySelector('.audio-control-card #speech-rate-select') || 
                     document.getElementById('speech-rate-select');

    let voiceGender = (voiceElem && voiceElem.value) 
      ? voiceElem.value 
      : (localStorage.getItem('tour_speech_voice') || 'male');

    let rate = (rateElem && rateElem.value) 
      ? parseFloat(rateElem.value) 
      : parseFloat(localStorage.getItem('tour_speech_rate') || '1.0');

    if (!voiceGender || (voiceGender !== 'male' && voiceGender !== 'female')) {
      voiceGender = 'male';
    }
    if (isNaN(rate) || rate <= 0) rate = 1.0;
    return { voiceGender, rate };
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function prepareContainerHighlight(containerEl, rawText) {
    if (!containerEl) return [];
    
    // 如果已经 tokenized 并且包含有效 span 则直接复用
    const existingSpans = containerEl.querySelectorAll('.word-token');
    if (containerEl.dataset.tokenized === 'true' && existingSpans.length > 0) {
      const map = [];
      existingSpans.forEach((span, idx) => {
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

  function speakText(text, containerEl, onEndCallback, isFromTour = false) {
    if (!('speechSynthesis' in window)) {
      alert('当前浏览器不支持 SpeechSynthesis 语音合成。建议使用 Chrome 或 Edge 浏览器。');
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }

    const cleanText = (text || (containerEl ? containerEl.innerText : ''))
      .replace(/<[^>]*>/g, '')
      .replace(/^(English|Chinese)[:：/\s]*/gi, '')
      .trim();

    if (!cleanText) {
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const audioSettings = getAudioSettings();
      const rate = audioSettings.rate;
      const voiceGender = audioSettings.voiceGender;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      window._activeUtterance = utterance;

      const targetVoice = getBestVoiceByGender(voiceGender);
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      utterance.lang = targetVoice ? targetVoice.lang : 'en-US';
      utterance.rate = rate;

      let isFinished = false;
      const handleEnd = () => {
        if (isFinished) return;
        isFinished = true;
        clearSpeechHighlights(containerEl);
        if (containerEl) {
          const parentCard = containerEl.closest('.card');
          if (parentCard) parentCard.classList.remove('reading-active');
        }
        activeSpeechContainer = null;
        activeWordMap = [];
        window._activeUtterance = null;
        if (typeof onEndCallback === 'function') onEndCallback();
      };

      utterance.onerror = (err) => {
        console.warn('[TTS Error]', err);
        if (isFromTour && err && err.error !== 'interrupted') {
          stopAllAudio();
        } else {
          handleEnd();
        }
      };

      if (containerEl) {
        activeSpeechContainer = containerEl;
        activeWordMap = prepareContainerHighlight(containerEl, cleanText);
        const parentCard = containerEl.closest('.card');
        if (parentCard) parentCard.classList.add('reading-active');

        utterance.onboundary = (event) => {
          if (event.name === 'word' || event.charIndex !== undefined) {
            const charIdx = event.charIndex;
            let activeIndex = -1;
            for (let i = 0; i < activeWordMap.length; i++) {
              if (charIdx >= activeWordMap[i].startChar && charIdx < activeWordMap[i].endChar) {
                activeIndex = i;
                break;
              }
              if (charIdx < activeWordMap[i].startChar && activeIndex === -1) {
                activeIndex = Math.max(0, i - 1);
                break;
              }
            }
            if (activeIndex === -1 && activeWordMap.length > 0) {
              activeIndex = activeWordMap.length - 1;
            }
            if (activeIndex !== -1 && activeWordMap[activeIndex]) {
              clearSpeechHighlights(containerEl);
              activeWordMap[activeIndex].el.classList.add('word-active');
              if (activeIndex > 0 && activeWordMap[activeIndex - 1]) {
                activeWordMap[activeIndex - 1].el.classList.add('word-near');
              }
              if (activeIndex + 1 < activeWordMap.length && activeWordMap[activeIndex + 1]) {
                activeWordMap[activeIndex + 1].el.classList.add('word-near');
              }
            }
          }
        };
      }

      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch(err) {
      console.error('[Speak Error]', err);
      if (typeof onEndCallback === 'function') onEndCallback();
    }
  }

  function playAudioOrTTS(audioUrl, fallbackText, containerEl, onEndCallback, isFromTour = false) {
    if (!isFromTour) {
      stopAllAudio({ resetTour: true });
    }
    
    if (!audioUrl) {
      speakText(fallbackText, containerEl, onEndCallback, isFromTour);
      return;
    }

    const rate = getAudioSettings().rate;

    let hasFallbackHandled = false;
    const triggerFallback = () => {
      if (hasFallbackHandled) return;
      hasFallbackHandled = true;
      speakText(fallbackText, containerEl, onEndCallback, isFromTour);
    };

    let hasFinished = false;
    const handleEnd = () => {
      if (hasFinished) return;
      hasFinished = true;
      if (staticAudioPlayer) {
        staticAudioPlayer.ontimeupdate = null;
      }
      clearSpeechHighlights(containerEl);
      if (containerEl) {
        const parentCard = containerEl.closest('.card');
        if (parentCard) parentCard.classList.remove('reading-active');
      }
      if (typeof onEndCallback === 'function') onEndCallback();
    };

    if (containerEl) {
      activeSpeechContainer = containerEl;
      activeWordMap = prepareContainerHighlight(containerEl, fallbackText);
      const parentCard = containerEl.closest('.card');
      if (parentCard) parentCard.classList.add('reading-active');

      // 实时计算时间进度，在原音频基础上驱动高光跟随
      staticAudioPlayer.ontimeupdate = () => {
        if (!activeWordMap || activeWordMap.length === 0 || !staticAudioPlayer.duration) return;
        const progress = Math.max(0, Math.min(1, staticAudioPlayer.currentTime / staticAudioPlayer.duration));
        const activeIndex = Math.min(
          Math.floor(progress * activeWordMap.length),
          activeWordMap.length - 1
        );
        if (activeIndex >= 0 && activeIndex < activeWordMap.length) {
          clearSpeechHighlights(containerEl);
          activeWordMap[activeIndex].el.classList.add('word-active');
          if (activeIndex > 0 && activeWordMap[activeIndex - 1]) {
            activeWordMap[activeIndex - 1].el.classList.add('word-near');
          }
          if (activeIndex + 1 < activeWordMap.length && activeWordMap[activeIndex + 1]) {
            activeWordMap[activeIndex + 1].el.classList.add('word-near');
          }
        }
      };
    }

    staticAudioPlayer.src = audioUrl;
    staticAudioPlayer.playbackRate = rate; // 在原音频基础上倍速播放
    staticAudioPlayer.onended = handleEnd;
    staticAudioPlayer.onerror = triggerFallback;

    const playPromise = staticAudioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        if (err && err.name === 'AbortError') return;
        triggerFallback();
      });
    }
  }

  function playSmartAudio(audioUrl, fallbackText, containerEl, onEndCallback) {
    stopAllAudio();
    const rate = getAudioSettings().rate;

    const handleEnd = () => {
      clearSpeechHighlights(containerEl);
      if (typeof onEndCallback === 'function') onEndCallback();
    };

    if (audioUrl) {
      staticAudioPlayer.src = audioUrl;
      staticAudioPlayer.playbackRate = rate;
      staticAudioPlayer.onended = handleEnd;
      staticAudioPlayer.onerror = () => {
        speakText(fallbackText, containerEl, onEndCallback);
      };

      staticAudioPlayer.play().catch(err => {
        console.warn('[Audio] 静态 MP3 播放异常，自动降级至 Web Speech:', err);
        staticAudioPlayer.onerror();
      });
    } else {
      speakText(fallbackText, containerEl, onEndCallback);
    }
  }


  // State
  let currentMainTab = 'interview';
  let currentCategory = '历史广西';
  let currentSkillSubject = '万能句式';
  let currentResourceCategory = '英文景点与路线导游词';
  let currentResourceSubCategory = '景区讲解';
  
  // 知识问答状态
  let currentPracticeCategory = '业务规范问答';
  let currentCardCategory = '历史文化';
  let currentPracticeIndex = 0;
  let practiceHistory = []; // 历史栈：记录用户看过的题目索引序列
  let practiceViewMode = 'card'; // 'card' or 'list'
  let shuffledPracticeQueue = []; // 已打乱的题目索引队列
  let shuffleCategory = '';       // 上次 shuffle 时对应的分类

  // 口译测试状态 (独立拆出)
  let currentInterpCategory = '全部口译'; // '全部口译' | '汉译英' | '英译中'
  let currentInterpIndex = 0;
  let interpHistory = [];
  let interpViewMode = 'card'; // 'card' or 'list'

  let currentSpotIndex = 0;        // 专题导游词当前索引
  let currentScenicIndex = 0;      // 景区讲解当前索引
  let currentCustomTopicIndex = 0;  // 专题自选当前索引
  let isMaskedMode = false;

  // --- 专题自选配置与持久化存储 ---
  const TOPIC_CATEGORIES = ["历史广西", "民族广西", "风物广西", "山水广西", "长寿广西"];
  const STORAGE_KEY_CUSTOM_TOPICS = 'gx_custom_selected_topics_v1';
  let customSelectedTopics = {}; // 结构: { "历史广西": "广西 历史文化名城之旅", ... }

  function loadCustomSelectedTopics() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_TOPICS);
      if (stored) {
        customSelectedTopics = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse custom selected topics', e);
      customSelectedTopics = {};
    }

    // 默认兜底：每个大专题默认选中第一篇
    TOPIC_CATEGORIES.forEach(cat => {
      const available = (data.speeches || []).filter(sp => sp.category === cat);
      if (available.length > 0) {
        if (!customSelectedTopics[cat] || !available.some(sp => (sp.id || sp.name) === customSelectedTopics[cat])) {
          customSelectedTopics[cat] = available[0].id || available[0].name;
        }
      }
    });
  }

  function saveCustomSelectedTopics() {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TOPICS, JSON.stringify(customSelectedTopics));
    } catch (e) {
      console.warn('Failed to save custom selected topics', e);
    }
  }

  function setTopicSelected(cat, speechIdentifier) {
    customSelectedTopics[cat] = speechIdentifier;
    saveCustomSelectedTopics();
  }

  function isTopicSelected(cat, speechIdentifier) {
    return customSelectedTopics[cat] === speechIdentifier;
  }

  function getCustomSpeechList() {
    const list = [];
    TOPIC_CATEGORIES.forEach(cat => {
      const selectedId = customSelectedTopics[cat];
      const found = (data.speeches || []).find(sp => sp.category === cat && ((sp.id || sp.name) === selectedId));
      if (found) {
        list.push(found);
      } else {
        const fallback = (data.speeches || []).find(sp => sp.category === cat);
        if (fallback) list.push(fallback);
      }
    });
    return list;
  }

  // 净化专题导游词名称（去除多余的“广西”前缀）
  function formatSpeechDisplayName(sp) {
    if (!sp) return '';
    let name = typeof sp === 'string' ? sp : (sp.name || sp.id || '');
    const cat = typeof sp === 'object' ? sp.category : '';
    if (cat !== '景区讲解') {
      name = name.replace(/^广西\s*/, '').replace(/^广西/, '').trim();
    }
    return name;
  }

  // 获取导游词分段音频绝对/相对路径（优先匹配对应性别的高清 Neural 播音级音频）
  function getSpeechAudioUrl(sp, secIdx, gender = null) {
    const activeGender = gender || getAudioSettings().voiceGender || 'male';
    const rawName = (typeof sp === 'string' ? sp : (sp.name || sp.id || '')).replace(/[\\/:*?"<>|]/g, '_').trim();
    const cleanName = rawName.replace(/^广西\s*/, '').replace(/^广西/, '').trim();
    return `audio/${activeGender}/${encodeURIComponent(cleanName)}/section_${secIdx}.mp3`;
  }

  // DOM elements
  const mainNavBtns = document.querySelectorAll('#main-nav-tabs .tab-btn');
  const subNavWrapper = document.getElementById('sub-nav-wrapper');
  const customTopicHeaderContainer = document.getElementById('custom-topic-header-container');
  const catFilterContainer = document.getElementById('cat-filter-container');
  const spotChipsContainer = document.getElementById('spot-chips-container');

  // Views
  const viewPractice = document.getElementById('view-practice');
  const viewInterpreting = document.getElementById('view-interpreting');
  const viewCards = document.getElementById('view-cards');
  const viewSpeech = document.getElementById('view-speech');
  const viewSkills = document.getElementById('view-skills');
  const viewResources = document.getElementById('view-resources');
  const viewCheatsheet = document.getElementById('view-cheatsheet');

  // --- INITIALIZATION ---
  loadCustomSelectedTopics();
  initCategoryFilters();
  renderSpotChips();
  renderPracticeView();
  renderInterpretingView();
  renderCardsView();
  renderSpeechView();
  renderSkillsView();
  renderResourcesView();

  const viewPhrases = document.getElementById('view-phrases');

  // Initial tab display: 专题讲解 (interview)
  subNavWrapper.style.display = 'block';
  viewSpeech.style.display = 'block';
  if (customTopicHeaderContainer) customTopicHeaderContainer.style.display = 'none';
  catFilterContainer.style.display = 'flex';
  spotChipsContainer.style.display = 'flex';
  
  function renderPhrasesView() {
    const container = document.getElementById('phrase-list-container');
    if (!container) return;
    container.innerHTML = '<div class="card" style="padding:20px; text-align:center; color:#666;">⚡ 导游高频短语速记库加载完成</div>';
  }

  renderPhrasesView();
  bindEvents();

  // --- CATEGORY FILTERS (For 专题讲解 5大专题) ---
  function initCategoryFilters() {
    catFilterContainer.innerHTML = '';
    catFilterContainer.style.display = 'flex';
    const cats = data.categories || ["历史广西", "民族广西", "风物广西", "山水广西", "长寿广西"];
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        stopAllAudio();
        currentCategory = cat;
        document.querySelectorAll('#cat-filter-container .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSpotChips();
      });
      catFilterContainer.appendChild(btn);
    });
  }

  // --- 渲染「专题自选」顶部的 5 篇组合管理卡片 (在纯净无底色容器中) ---
  function renderCustomTopicPicker() {
    if (!customTopicHeaderContainer) return;
    customTopicHeaderContainer.innerHTML = '';
    customTopicHeaderContainer.style.display = 'block';

    const pickerCard = document.createElement('div');
    pickerCard.className = 'custom-picker-card';
    pickerCard.style.marginBottom = '12px';

    pickerCard.innerHTML = `
      <div class="custom-picker-header">
        <div>
          <span class="qa-tag-badge" style="background:#eef8f1; color:#2d7a4c; border:1px solid #c6e2ce; font-weight:700; margin-bottom:4px; display:inline-block;">🎯 我的 5 篇专题备考组合</span>
          <div style="font-size:13.5px; color:#556b5c; margin-top:2px;">考纲要求 5 大专题各主备 1 篇 · 您可在此一键调配或在「专题讲解」中点击 ⭐ 替换</div>
        </div>
        <button class="action-btn" id="btn-toggle-custom-panel" style="font-size:12.5px; padding:4px 12px; background:#fff; border:1px solid #cee0d2; color:#2d7a4c;">
          ⚙️ 调整 5 篇组合 <span id="custom-panel-arrow">▼</span>
        </button>
      </div>
      <div class="custom-picker-grid" id="custom-picker-grid" style="display:none;">
        ${TOPIC_CATEGORIES.map(cat => {
          const allInCat = (data.speeches || []).filter(sp => sp.category === cat);
          const curSelected = customSelectedTopics[cat] || (allInCat[0] ? (allInCat[0].id || allInCat[0].name) : '');
          return `
            <div class="custom-topic-item">
              <span class="custom-topic-cat-badge">${cat}</span>
              <select class="custom-topic-select" data-category="${cat}">
                ${allInCat.map(sp => {
                  const idOrName = sp.id || sp.name;
                  const isSel = idOrName === curSelected;
                  const displayName = formatSpeechDisplayName(sp);
                  return `<option value="${escapeHtml(idOrName)}" ${isSel ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
                }).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // 绑定折叠与下拉切换事件
    const toggleBtn = pickerCard.querySelector('#btn-toggle-custom-panel');
    const gridEl = pickerCard.querySelector('#custom-picker-grid');
    const arrowEl = pickerCard.querySelector('#custom-panel-arrow');
    if (toggleBtn && gridEl) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = gridEl.style.display === 'none';
        gridEl.style.display = isHidden ? 'grid' : 'none';
        if (arrowEl) arrowEl.textContent = isHidden ? '▲' : '▼';
      });
    }

    pickerCard.querySelectorAll('.custom-topic-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const cat = e.target.getAttribute('data-category');
        const val = e.target.value;
        stopAllAudio();
        setTopicSelected(cat, val);
        
        // 若当前查看的正是这个分类的导游词，自动更新 currentCustomTopicIndex
        const targetGlobalIdx = data.speeches.findIndex(s => (s.id || s.name) === val);
        if (targetGlobalIdx !== -1) {
          currentCustomTopicIndex = targetGlobalIdx;
        }
        renderSpotChips();
      });
    });

    customTopicHeaderContainer.appendChild(pickerCard);
  }

  // --- SPOT CHIPS (支持 专题自选、景区讲解 与 专题讲解) ---
  function renderSpotChips() {
    spotChipsContainer.innerHTML = '';
    if (!data.speeches || data.speeches.length === 0) return;

    if (currentMainTab === 'scenic') {
      // 景区讲解模式：做成和专题一样的分段选择器风格（图一风格）
      if (customTopicHeaderContainer) customTopicHeaderContainer.style.display = 'none';
      catFilterContainer.style.display = 'flex';
      spotChipsContainer.style.display = 'none';

      catFilterContainer.innerHTML = '';
      const scenicSpots = data.speeches.filter(sp => sp.category === "景区讲解");
      const spotList = scenicSpots.length > 0 ? scenicSpots : data.speeches;

      const currentInList = spotList.some(sp => data.speeches.findIndex(s => s.id === sp.id) === currentScenicIndex);
      if (!currentInList && spotList.length > 0) {
        currentScenicIndex = data.speeches.findIndex(s => s.id === spotList[0].id);
      }
      if (currentScenicIndex < 0 || currentScenicIndex >= data.speeches.length) {
        currentScenicIndex = 0;
      }

      spotList.forEach(sp => {
        const globalIdx = data.speeches.findIndex(s => s.id === sp.id);
        const btn = document.createElement('button');
        btn.className = `cat-btn ${globalIdx === currentScenicIndex ? 'active' : ''}`;
        btn.textContent = sp.name;
        btn.addEventListener('click', () => {
          stopAllAudio();
          currentScenicIndex = globalIdx;
          document.querySelectorAll('#cat-filter-container .cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderSpeechView();
        });
        catFilterContainer.appendChild(btn);
      });
    } else if (currentMainTab === 'custom-interview') {
      // 专题自选模式：上面展示纯净管理面板，下面展示 5 篇自选 Chips（无多余广西前缀）
      catFilterContainer.style.display = 'none';
      spotChipsContainer.style.display = 'flex';
      renderCustomTopicPicker();

      const customList = getCustomSpeechList();
      
      const currentInList = customList.some(sp => data.speeches.findIndex(s => s.id === sp.id) === currentCustomTopicIndex);
      if (!currentInList && customList.length > 0) {
        currentCustomTopicIndex = data.speeches.findIndex(s => s.id === customList[0].id);
      }
      if (currentCustomTopicIndex < 0 || currentCustomTopicIndex >= data.speeches.length) {
        currentCustomTopicIndex = data.speeches.findIndex(s => s.id === customList[0].id);
      }

      customList.forEach(sp => {
        const globalIdx = data.speeches.findIndex(s => s.id === sp.id);
        const chip = document.createElement('div');
        chip.className = `spot-chip ${globalIdx === currentCustomTopicIndex ? 'active' : ''}`;
        const prefix = (sp.category || '').replace('广西', '');
        const cleanName = formatSpeechDisplayName(sp);
        chip.innerHTML = `<span>【${prefix}】${cleanName}</span><span class="chip-star-icon">⭐</span>`;
        chip.addEventListener('click', () => {
          stopAllAudio();
          currentCustomTopicIndex = globalIdx;
          document.querySelectorAll('#spot-chips-container .spot-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          renderSpeechView();
        });
        spotChipsContainer.appendChild(chip);
      });
    } else {
      // 专题讲解模式：展示当前专题分类下的 3 条路线，并高亮已选入自选库的篇目（无多余广西前缀）
      if (customTopicHeaderContainer) customTopicHeaderContainer.style.display = 'none';
      catFilterContainer.style.display = 'flex';
      spotChipsContainer.style.display = 'flex';
      initCategoryFilters();

      const matchingSpots = data.speeches.filter(sp => (sp.category || "自然山水") === currentCategory);
      const spotList = matchingSpots.length > 0 ? matchingSpots : data.speeches;
      
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
        const isSelected = isTopicSelected(currentCategory, sp.id || sp.name);
        const cleanName = formatSpeechDisplayName(sp);
        chip.innerHTML = `<span>${cleanName}</span>${isSelected ? '<span class="chip-star-icon">⭐</span>' : ''}`;
        chip.addEventListener('click', () => {
          stopAllAudio();
          currentSpotIndex = globalIdx;
          document.querySelectorAll('#spot-chips-container .spot-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          renderSpeechView();
        });
        spotChipsContainer.appendChild(chip);
      });
    }

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
        stopAllAudio();
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
                <span class="spot-chip active" style="font-size: 12.5px; font-weight: 500; border-radius: 6px; padding: 5px 11px; background: #e5f0e7; border-color: #c6e2ce; color: #233328;">
                  <strong>${k.en}</strong> <span style="color: #556b5c;">(${k.cn})</span>
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
            ${sec.title ? `
            <div class="section-title" style="font-size: 16px; margin-bottom: 12px;">
              <span>📌</span> ${sec.title}
            </div>` : ''}
            
            <div class="speech-text-en" style="font-size: 15px; color: #222; line-height: 1.7; margin-bottom: 12px;">
              ${sec.en}
            </div>
            
            <div class="speech-text-cn" style="font-size: 13.5px; color: #2e4436; background-color: #f4f9f5; padding: 12px 14px; border-left: 4px solid #a8caaf; border-radius: 4px; margin-bottom: 14px; line-height: 1.6;">
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
          <div class="speech-text-cn" style="font-size: 13.5px; color: #2e4436; background: #f4f9f5; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px;">
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

  // ==========================================
  // --- 知识问答模块 (PRACTICE MODULE) ---
  // ==========================================
  function getFilteredPracticeList() {
    let list = [];
    if (currentPracticeCategory.includes("应变")) {
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
      tagBadge.textContent = qItem.spot || currentPracticeCategory;
      tagBadge.style.background = '#f3f4f6';
      tagBadge.style.color = '#374151';
      tagBadge.style.borderColor = '#e5e7eb';
    }

    if (listenBtn) {
      listenBtn.style.display = 'inline-flex';
      listenBtn.textContent = '🔊';
      listenBtn.title = '听题';
    }

    // 英文在上，中文在下
    const enQElem = document.getElementById('practice-en-question');
    const cnQElem = document.getElementById('practice-cn-question');
    if (enQElem) enQElem.textContent = qItem.enQuestion || qItem.question;
    if (cnQElem) cnQElem.textContent = qItem.cnQuestion || '';
    
    let ansHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
        <div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6; flex: 1;">${qItem.answer}</div>
        <button class="action-btn" id="btn-practice-listen-ans" title="听英文答案" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>
      </div>
    `;
    if (qItem.cnAnswer) {
      ansHTML += `<div style="white-space: pre-line; font-size: 14px; color: #475569; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; line-height: 1.6; font-weight: 500;">${qItem.cnAnswer}</div>`;
    }
    const refTextEl = document.getElementById('practice-ref-text');
    const refBoxEl = document.getElementById('practice-ref-box');
    if (refTextEl) refTextEl.innerHTML = ansHTML;
    if (refBoxEl) refBoxEl.style.display = 'none';

    const userInput = document.getElementById('practice-user-input');
    if (userInput) userInput.value = '';

    const evalBox = document.getElementById('practice-eval-result');
    if (evalBox) { evalBox.style.display = 'none'; evalBox.innerHTML = ''; }
    if (typeof stopPracticeSpeech === 'function') stopPracticeSpeech();

    const btnListenAns = document.getElementById('btn-practice-listen-ans');
    if (btnListenAns) {
      btnListenAns.addEventListener('click', () => {
        const cleanAnsText = qItem.answer.replace(/<[^>]*>/g, '');
        const audioUrl = qItem.id ? `audio/questions/answer_${qItem.id}.mp3` : ''; playAudioOrTTS(audioUrl, cleanAnsText, refTextEl);
      });
    }
  }

  function renderPracticeView() {
    const tabsContainer = document.getElementById('practice-category-tabs');
    const mainCard = document.getElementById('practice-main-card');
    const listContainer = document.getElementById('practice-list-container');
    
    if (!tabsContainer || !mainCard || !listContainer) return;

    const categories = ["业务规范问答", "应变处理问答", "综合常识问答"];

    tabsContainer.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentPracticeCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        stopAllAudio();
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

        let ansContentHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6; flex: 1;">${qa.answer}</div>
            <button class="action-btn btn-qa-read-ans" data-idx="${idx}" title="听英文答案" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>
          </div>
        `;
        if (qa.cnAnswer) {
          ansContentHTML += `<div style="white-space: pre-line; font-size: 14px; color: #475569; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; line-height: 1.6; font-weight: 500;">${qa.cnAnswer}</div>`;
        }

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 2px 8px; border-radius: 4px; display: inline-block;">#${idx + 1}</span>
            <span class="qa-tag-badge" style="font-size: 12px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb;">${qa.spot || currentPracticeCategory}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px;">
            <h3 class="qa-question-title" style="font-size: 16.5px; margin-bottom: 0; color: #1a1a1a; font-weight: 700; line-height: 1.4; flex: 1;">${qa.enQuestion || qa.question}</h3>
            <button class="action-btn btn-qa-read" data-idx="${idx}" title="听题" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>
          </div>
          ${qa.cnQuestion ? `<div style="font-size: 14px; color: #666; font-weight: 500; margin-bottom: 12px;">${qa.cnQuestion}</div>` : ''}
          
          <div style="display: flex; gap: 10px; margin-bottom: 8px; margin-top: 10px;">
            <button class="play-main-btn btn-qa-ans-toggle" data-idx="${idx}" style="padding: 5px 20px; font-size: 13px;">参考答案</button>
          </div>

          <div class="ref-answer-box" id="ref-box-${idx}" style="display: none; margin-top: 12px;">
            <div class="ref-answer-text">${ansContentHTML}</div>
          </div>
        `;
        listContainer.appendChild(card);
      });

      listContainer.querySelectorAll('.btn-qa-read').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const audioUrl = list[i].id ? `audio/questions/question_${list[i].id}.mp3` : ''; playAudioOrTTS(audioUrl, list[i].question);
        });
      });

      listContainer.querySelectorAll('.btn-qa-read-ans').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const audioUrl = list[i].id ? `audio/questions/answer_${list[i].id}.mp3` : ''; playAudioOrTTS(audioUrl, list[i].answer);
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

  // ==========================================
  // --- 口译测试模块 (INTERPRETATION MODULE) ---
  // ==========================================
  function getFilteredInterpList() {
    const raw = data.translations || [];
    if (currentInterpCategory === '汉译英') {
      return raw.filter(t => t.type === 'C2E' || t.tag === '汉译英');
    } else if (currentInterpCategory === '英译中') {
      return raw.filter(t => t.type === 'E2C' || t.tag === '英译中');
    }
    return raw;
  }

  function renderCurrentInterpCard() {
    const list = getFilteredInterpList();
    if (list.length === 0) return;
    if (currentInterpIndex >= list.length) currentInterpIndex = 0;
    if (currentInterpIndex < 0) currentInterpIndex = list.length - 1;
    const item = list[currentInterpIndex];

    const isC2E = item.type === 'C2E' || item.tag === '汉译英';
    const numBadge = document.getElementById('interp-num-badge');
    const tagBadge = document.getElementById('interp-tag-badge');
    const questionTextEl = document.getElementById('interp-question-text');
    const listenQBtn = document.getElementById('btn-interp-listen-q');
    const refTextEl = document.getElementById('interp-ref-text');
    const refBoxEl = document.getElementById('interp-ref-box');
    const userInput = document.getElementById('interp-user-input');

    if (numBadge) {
      numBadge.textContent = `#${currentInterpIndex + 1} / ${list.length}`;
    }

    if (tagBadge) {
      if (isC2E) {
        tagBadge.textContent = '🇨🇳➔🇺🇸 汉译英真题';
        tagBadge.style.background = '#fff7ed';
        tagBadge.style.color = '#c2410c';
        tagBadge.style.borderColor = '#ffedd5';
      } else {
        tagBadge.textContent = '🇺🇸➔🇨🇳 英译中真题';
        tagBadge.style.background = '#eff6ff';
        tagBadge.style.color = '#1d4ed8';
        tagBadge.style.borderColor = '#dbeafe';
      }
    }

    const qText = item.src || item.question || item.en || '';
    const ansText = item.ref || item.answer || item.cn || '';

    if (questionTextEl) {
      questionTextEl.textContent = qText;
    }

    if (listenQBtn) {
      // 中文源句绝不播放音频；只有英译中（英文原题）才显示播放按钮
      if (isC2E) {
        listenQBtn.style.display = 'none';
      } else {
        listenQBtn.style.display = 'inline-flex';
        listenQBtn.title = '听英文原题发音';
      }
    }

    let refContentHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
        <div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6; flex: 1;">${ansText}</div>
        ${isC2E ? `<button class="action-btn" id="btn-interp-listen-ans" title="听英文参考译文发音" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>` : ''}
      </div>
    `;
    if (refTextEl) refTextEl.innerHTML = refContentHTML;
    if (refBoxEl) refBoxEl.style.display = 'none';
    if (userInput) userInput.value = '';

    const btnListenAns = document.getElementById('btn-interp-listen-ans');
    if (btnListenAns && isC2E) {
      btnListenAns.addEventListener('click', () => {
        const audioUrl = item.id ? `audio/translations/trans_${item.id}.mp3` : '';
        playAudioOrTTS(audioUrl, ansText, refTextEl);
      });
    }
  }

  function renderInterpretingView() {
    const tabsContainer = document.getElementById('interp-category-tabs');
    const mainCard = document.getElementById('interp-main-card');
    const listContainer = document.getElementById('interp-list-container');
    
    if (!tabsContainer || !mainCard || !listContainer) return;

    const categories = ["全部口译", "汉译英", "英译中"];

    tabsContainer.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentInterpCategory ? 'active' : ''}`;
      btn.textContent = cat === '全部口译' ? `全部真题 (178题)` : cat;
      btn.addEventListener('click', () => {
        stopAllAudio();
        currentInterpCategory = cat;
        currentInterpIndex = 0;
        interpHistory = [];
        document.querySelectorAll('#interp-category-tabs .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (interpViewMode === 'card') {
          renderCurrentInterpCard();
        } else {
          renderInterpList();
        }
      });
      tabsContainer.appendChild(btn);
    });

    if (interpViewMode === 'card') {
      mainCard.style.display = 'block';
      listContainer.style.display = 'none';
      renderCurrentInterpCard();
    } else {
      mainCard.style.display = 'none';
      listContainer.style.display = 'block';
      renderInterpList();
    }

    function renderInterpList() {
      listContainer.innerHTML = '';
      const list = getFilteredInterpList();

      list.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '14px';

        const isC2E = item.type === 'C2E' || item.tag === '汉译英';
        const qText = item.src || item.question || item.en || '';
        const ansText = item.ref || item.answer || item.cn || '';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 2px 8px; border-radius: 4px; display: inline-block;">#${idx + 1}</span>
            <span class="qa-tag-badge" style="font-size: 12px; ${isC2E ? 'background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;' : 'background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;'}">${isC2E ? '🇨🇳➔🇺🇸 汉译英' : '🇺🇸➔🇨🇳 英译中'}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
            <h3 class="qa-question-title" style="font-size: 16.5px; margin-bottom: 0; color: #1a1a1a; font-weight: 700; line-height: 1.5; flex: 1;">${qText}</h3>
            ${!isC2E ? `<button class="action-btn btn-interp-list-read" data-idx="${idx}" title="听英文原题" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>` : ''}
          </div>
          
          <div style="display: flex; gap: 10px; margin-bottom: 8px; margin-top: 10px;">
            <button class="play-main-btn btn-interp-ans-toggle" data-idx="${idx}" style="padding: 5px 20px; font-size: 13px;">参考译文</button>
          </div>

          <div class="ref-answer-box" id="interp-ref-box-${idx}" style="display: none; margin-top: 12px;">
            <div class="ref-answer-text">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <div style="white-space: pre-line; font-size: 15px; font-weight: 700; color: #1e3a8a; line-height: 1.6; flex: 1;">${ansText}</div>
                ${isC2E ? `<button class="action-btn btn-interp-list-read-ans" data-idx="${idx}" title="听英文参考译文" style="padding: 4px 10px; font-size: 15px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>` : ''}
              </div>
            </div>
          </div>
        `;
        listContainer.appendChild(card);
      });

      listContainer.querySelectorAll('.btn-interp-list-read').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const curItem = list[i];
          const audioUrl = curItem.id ? `audio/translations/trans_${curItem.id}.mp3` : '';
          const cardEl = btn.closest('.card');
          const titleEl = cardEl ? cardEl.querySelector('.qa-question-title') : null;
          playAudioOrTTS(audioUrl, curItem.src || curItem.question || curItem.en || '', titleEl);
        });
      });

      listContainer.querySelectorAll('.btn-interp-list-read-ans').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const curItem = list[i];
          const audioUrl = curItem.id ? `audio/translations/trans_${curItem.id}.mp3` : '';
          const cardEl = btn.closest('.card');
          const ansEl = cardEl ? cardEl.querySelector('.ref-answer-text') : null;
          playAudioOrTTS(audioUrl, curItem.ref || curItem.answer || curItem.cn || '', ansEl);
        });
      });

      listContainer.querySelectorAll('.btn-interp-ans-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = e.currentTarget.getAttribute('data-idx');
          const box = document.getElementById(`interp-ref-box-${i}`);
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
        stopAllAudio();
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
      headerCard.style.background = '#f6faf7';
      headerCard.style.borderColor = '#c6e2ce';
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
            <h4 style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; border-bottom: 2px solid #dce7de; padding-bottom: 6px;">${item.subtitle || '核心要点'}</h4>
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

    const activeIdx = (currentMainTab === 'scenic') 
      ? currentScenicIndex 
      : ((currentMainTab === 'custom-interview') ? currentCustomTopicIndex : currentSpotIndex);

    let speech = data.speeches[activeIdx];
    if (!speech) {
      speech = data.speeches[0];
    }

    // 1. 每篇导游词单独开一栏显示导游词总标题
    const isTopicSpeech = TOPIC_CATEGORIES.includes(speech.category);
    const isCurSelected = isTopicSpeech && isTopicSelected(speech.category, speech.id || speech.name);

    const headerCard = document.createElement('div');
    headerCard.className = 'card';
    headerCard.style.background = '#f6faf7';
    headerCard.style.borderLeft = '5px solid #2d7a4c';
    headerCard.style.marginBottom = '16px';
    headerCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom: 6px;">
            <span class="qa-tag-badge" style="background: #ebf5ee; color: #2d7a4c; border: 1px solid #c6e2ce; display: inline-block;">
              ${speech.category || '官方现场导游词'}
            </span>
            ${isTopicSpeech ? `
              <button class="btn-mark-custom ${isCurSelected ? 'is-selected' : 'not-selected'}" id="btn-toggle-custom-mark" title="${isCurSelected ? '当前篇目已是该专题自选' : '点击设为该专题自选篇目'}">
                ${isCurSelected ? `★ 已设为【${speech.category}】自选背诵` : `☆ 设为【${speech.category}】自选背诵`}
              </button>
            ` : ''}
          </div>
          <h2 style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin-top: 4px;">${formatSpeechDisplayName(speech)}</h2>
        </div>
        <span style="font-size: 13px; color: #23613c; font-weight: 600; background: #e2ebe3; padding: 4px 12px; border-radius: 20px;">
          📖 共 ${speech.sections.length} 个讲解段落
        </span>
      </div>
      ${speech.image ? `
        <div style="margin-top: 14px; width: 100%; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <img src="${speech.image}" alt="${speech.name}" style="width: 100%; max-height: 360px; object-fit: cover; display: block; border-radius: 8px;" onerror="this.style.display='none'" />
        </div>
      ` : ''}
    `;

    // 绑定自选标记按钮事件
    const markBtn = headerCard.querySelector('#btn-toggle-custom-mark');
    if (markBtn && isTopicSpeech) {
      markBtn.addEventListener('click', () => {
        stopAllAudio();
        setTopicSelected(speech.category, speech.id || speech.name);
        renderSpotChips();
      });
    }

    container.appendChild(headerCard);

    // 2. 播放控制卡（放在标题下方）
    const savedVoice = localStorage.getItem('tour_speech_voice') || 'male';
    const savedRate = localStorage.getItem('tour_speech_rate') || '1.0';

    const controlCard = document.createElement('div');
    controlCard.className = 'audio-control-card';
    controlCard.style.marginBottom = '16px';
    controlCard.innerHTML = `
      <div class="audio-left">
        <button class="play-main-btn" id="btn-play-all">
          <span>🎧</span> <span id="play-btn-text">全篇讲解</span>
        </button>
      </div>
      <div class="audio-controls">
        <div class="audio-control-item">
          <label style="font-size: 13px; color: #555;">音色:</label>
          <select class="voice-select" id="speech-voice-select" title="选择朗读音色">
            <option value="male"${savedVoice === 'male' ? ' selected' : ''}>男声 (Male)</option>
            <option value="female"${savedVoice === 'female' ? ' selected' : ''}>女声 (Female)</option>
          </select>
        </div>
        <div class="audio-control-item">
          <label style="font-size: 13px; color: #555;">语速:</label>
          <select class="speed-select" id="speech-rate-select" title="选择朗读倍速">
            <option value="0.75"${savedRate === '0.75' ? ' selected' : ''}>0.75x</option>
            <option value="0.9"${savedRate === '0.9' ? ' selected' : ''}>0.9x</option>
            <option value="1.0"${savedRate === '1.0' ? ' selected' : ''}>1.0x</option>
            <option value="1.1"${savedRate === '1.1' ? ' selected' : ''}>1.1x</option>
            <option value="1.2"${savedRate === '1.2' ? ' selected' : ''}>1.2x</option>
            <option value="1.5"${savedRate === '1.5' ? ' selected' : ''}>1.5x</option>
          </select>
        </div>
      </div>
    `;

    const voiceSelectEl = controlCard.querySelector('#speech-voice-select');
    if (voiceSelectEl) {
      voiceSelectEl.addEventListener('change', (e) => {
        const val = e.target.value;
        try {
          localStorage.setItem('tour_speech_voice', val);
        } catch (_) {}

        if (tourState === 'playing') {
          playContinuousSection(continuousTourIndex, globalTourSessionId);
        } else if (currentPlayingCard) {
          const btn = currentPlayingCard.querySelector('.btn-read-sec');
          if (btn && currentPlayingCard.dataset.playState === 'playing') {
            const idx = parseInt(currentPlayingCard.dataset.idx || '0', 10);
            const sec = speech.sections[idx];
            if (sec) {
              const cleanText = sec.en.replace(/<[^>]*>/g, '').replace(/^(English|Chinese)[:：/\s]*/gi, '').trim();
              const enContainer = currentPlayingCard.querySelector('.speech-text-en');
              const audioUrl = getSpeechAudioUrl(speech, idx, val);
              const resetState = () => {
                currentPlayingCard.dataset.playState = 'idle';
                currentPlayingCard.classList.remove('reading-active');
                if (btn) btn.textContent = '示范朗读';
                clearSpeechHighlights(enContainer);
                currentPlayingCard = null;
              };
              playAudioOrTTS(audioUrl, cleanText, enContainer, resetState, true);
            }
          }
        }
      });
    }

    const rateSelectEl = controlCard.querySelector('#speech-rate-select');
    if (rateSelectEl) {
      rateSelectEl.addEventListener('change', (e) => {
        const val = e.target.value;
        const rateNum = parseFloat(val) || 1.0;
        try {
          localStorage.setItem('tour_speech_rate', val);
        } catch (_) {}
        if (staticAudioPlayer) {
          staticAudioPlayer.playbackRate = rateNum; // 在原音频基础上倍速播放
        }
      });
    }

    container.appendChild(controlCard);

    // 3. 速记大纲与动线流程图卡片 (Mindflow & Keywords)
    if (speech.outline) {
      const outline = speech.outline;
      const outlineCard = document.createElement('div');
      outlineCard.className = 'speech-outline-card';
      
      let routeHtml = '';
      if (outline.route && outline.route.length > 0) {
        routeHtml = `
          <div class="outline-route-flow">
            <span class="outline-route-label">🧭 行程动线:</span>
            ${outline.route.map((step, sIdx) => `
              <span class="route-step-node"><span class="step-num">${sIdx + 1}</span>${escapeHtml(step)}</span>
              ${sIdx < outline.route.length - 1 ? '<span class="route-arrow">➔</span>' : ''}
            `).join('')}
          </div>
        `;
      }

      let nodesHtml = '';
      if (outline.nodes && outline.nodes.length > 0) {
        nodesHtml = `
          <div class="outline-nodes-list">
            ${outline.nodes.map(node => `
              <div class="outline-node-card">
                <div class="outline-node-title-row">
                  <span class="outline-node-title">${escapeHtml(node.name || '')}</span>
                  ${node.en ? `<span class="outline-node-en">${escapeHtml(node.en)}</span>` : ''}
                </div>
                <div class="outline-kw-tags">
                  ${(node.kws || []).map(kw => `<span class="outline-kw-pill">🏷️ ${escapeHtml(kw)}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      outlineCard.innerHTML = `
        <div class="speech-outline-header" id="outline-header-toggle">
          <div class="outline-header-left">
            <span class="outline-badge">考纲速记</span>
            <span class="outline-title-text">📋 导游词动线流程与考点关键词</span>
            ${outline.theme ? `<span class="outline-theme-tag">${escapeHtml(outline.theme)}</span>` : ''}
          </div>
          <button class="outline-toggle-btn" id="btn-outline-collapse">
            <span id="outline-toggle-icon">▲</span> <span id="outline-toggle-text">收起大纲</span>
          </button>
        </div>
        <div class="speech-outline-body" id="outline-body-content">
          ${routeHtml}
          ${nodesHtml}
        </div>
      `;

      // 折叠/展开交互
      const toggleHeader = outlineCard.querySelector('#outline-header-toggle');
      const toggleBtn = outlineCard.querySelector('#btn-outline-collapse');
      const bodyContent = outlineCard.querySelector('#outline-body-content');
      const toggleIcon = outlineCard.querySelector('#outline-toggle-icon');
      const toggleText = outlineCard.querySelector('#outline-toggle-text');

      const handleToggle = (e) => {
        if (e.target && e.target.closest('#btn-outline-collapse') && e.currentTarget !== toggleBtn) return;
        const isCollapsed = bodyContent.style.display === 'none';
        bodyContent.style.display = isCollapsed ? 'block' : 'none';
        toggleIcon.textContent = isCollapsed ? '▲' : '▼';
        toggleText.textContent = isCollapsed ? '收起大纲' : '展开大纲';
      };

      if (toggleHeader) toggleHeader.addEventListener('click', handleToggle);
      if (toggleBtn) toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); handleToggle(e); });

      container.appendChild(outlineCard);
    }

    // 绑定"全篇讲解"（简洁模式：全篇讲解 <-> 停止讲解，从头开始）
    let tourState = 'idle'; // 'idle' | 'playing'
    let continuousTourIndex = 0;
    const playAllBtn = controlCard.querySelector('#btn-play-all');
    const playBtnText = controlCard.querySelector('#play-btn-text');
    const playBtnIcon = playAllBtn.querySelector('span:first-child');

    function updatePlayAllBtn(state) {
      tourState = state;
      if (state === 'playing') {
        if (playBtnIcon) playBtnIcon.textContent = '⏹';
        if (playBtnText) playBtnText.textContent = '停止讲解';
      } else {
        if (playBtnIcon) playBtnIcon.textContent = '🎧';
        if (playBtnText) playBtnText.textContent = '全篇讲解';
      }
      playAllBtn.style.background = '';
      playAllBtn.style.borderColor = '';
    }

    activeTourController = {
      reset: () => {
        tourState = 'idle';
        continuousTourIndex = 0;
        updatePlayAllBtn('idle');
        container.querySelectorAll('.card').forEach(c => {
          c.classList.remove('reading-active');
        });
      }
    };

    function playContinuousSection(secIdx, sessionId) {
      if (tourState !== 'playing' || sessionId !== globalTourSessionId) return;
      if (!speech || !speech.sections || secIdx >= speech.sections.length) {
        stopAllAudio();
        return;
      }

      continuousTourIndex = secIdx;
      container.querySelectorAll('.card').forEach(c => {
        c.classList.remove('reading-active');
      });

      const targetCard = container.querySelector(`.card[data-idx="${secIdx}"]`);
      if (targetCard) {
        targetCard.classList.add('reading-active');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const sec = speech.sections[secIdx];
      const cleanText = sec.en.replace(/<[^>]*>/g, '').replace(/^(English|Chinese)[:：/\s]*/gi, '').trim();
      const enContainer = targetCard ? targetCard.querySelector('.speech-text-en') : null;

      const onSectionEnd = () => {
        if (tourState !== 'playing' || sessionId !== globalTourSessionId) return;
        setTimeout(() => {
          if (tourState === 'playing' && sessionId === globalTourSessionId) {
            playContinuousSection(secIdx + 1, sessionId);
          }
        }, 400);
      };

      const audioUrl = getSpeechAudioUrl(speech, secIdx);
      playAudioOrTTS(audioUrl, cleanText, enContainer, onSectionEnd, true);
    }

    playAllBtn.addEventListener('click', () => {
      if (tourState === 'playing') {
        stopAllAudio();
      } else {
        stopAllAudio();
        const sessionId = globalTourSessionId;
        tourState = 'playing';
        updatePlayAllBtn('playing');
        continuousTourIndex = 0;
        playContinuousSection(0, sessionId);
      }
    });

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
      card.dataset.playState = 'idle'; // idle | playing

      function bindReadBtn() {
        const btn = card.querySelector('.btn-read-sec');
        if (!btn) return;
        btn.addEventListener('click', () => {
          const state = card.dataset.playState;
          if (state === 'playing') {
            stopAllAudio();
            return;
          }

          stopAllAudio();
          currentPlayingCard = card;
          card.dataset.playState = 'playing';
          card.classList.add('reading-active');
          btn.textContent = '⏹ 停止朗读';

          const cleanText = sec.en.replace(/<[^>]*>/g, '').replace(/^(English|Chinese)[:：/\s]*/gi, '').trim();
          const enContainer = card.querySelector('.speech-text-en');

          const resetState = () => {
            card.dataset.playState = 'idle';
            card.classList.remove('reading-active');
            if (btn) btn.textContent = '示范朗读';
            clearSpeechHighlights(enContainer);
            if (currentPlayingCard === card) {
              currentPlayingCard = null;
            }
          };

          const audioUrl = getSpeechAudioUrl(speech, idx);
          playAudioOrTTS(audioUrl, cleanText, enContainer, resetState, true);
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
        const btnLabel = card.dataset.playState === 'playing' ? '⏹ 停止朗读' : '示范朗读';

        card.innerHTML = `
          ${sec.title ? `<div class="section-title"><span>${sec.title}</span></div>` : ''}
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
    const secondaryCategories = data.speechSubCategories || ["景区讲解", "自然山水", "民族风情", "历史文化", "康养长寿", "特色物产"];

    primaryTabsContainer.innerHTML = '';
    primaryCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat === currentResourceCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        stopAllAudio();
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
        stopAllAudio();
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
        stopAllAudio();
        const tab = btn.getAttribute('data-tab');
        mainNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
        stopAllAudio();
        
        if (tab === 'practice') {
          subNavWrapper.style.display = 'none';
          viewPractice.style.display = 'block';
          renderPracticeView();
        } else if (tab === 'interpreting') {
          subNavWrapper.style.display = 'none';
          if (viewInterpreting) viewInterpreting.style.display = 'block';
          renderInterpretingView();
        } else if (tab === 'cards') {
          subNavWrapper.style.display = 'none';
          viewCards.style.display = 'block';
          renderCardsView();
        } else if (tab === 'skills') {
          subNavWrapper.style.display = 'none';
          viewSkills.style.display = 'block';
          renderSkillsView();
        } else if (tab === 'interview') {
          // 专题讲解 VIEW
          currentMainTab = 'interview';
          subNavWrapper.style.display = 'block';
          viewSpeech.style.display = 'block';
          catFilterContainer.style.display = 'flex';
          spotChipsContainer.style.display = 'flex';
          renderSpotChips();
          renderSpeechView();
        } else if (tab === 'custom-interview') {
          // 专题自选 VIEW
          currentMainTab = 'custom-interview';
          subNavWrapper.style.display = 'block';
          viewSpeech.style.display = 'block';
          catFilterContainer.style.display = 'none';
          spotChipsContainer.style.display = 'flex';
          renderSpotChips();
          renderSpeechView();
        } else if (tab === 'scenic') {
          // 景区讲解 VIEW
          currentMainTab = 'scenic';
          subNavWrapper.style.display = 'block';
          viewSpeech.style.display = 'block';
          catFilterContainer.style.display = 'none';
          spotChipsContainer.style.display = 'flex';
          renderSpotChips();
          renderSpeechView();
        } else if (tab === 'phrases') {
          subNavWrapper.style.display = 'none';
          if (viewPhrases) viewPhrases.style.display = 'block';
          renderPhrasesView();
        } else if (tab === 'cheatsheet') {
          subNavWrapper.style.display = 'none';
          if (viewCheatsheet) viewCheatsheet.style.display = 'block';
          renderCheatsheetView();
        } else if (tab === 'resources') {
          subNavWrapper.style.display = 'none';
          viewResources.style.display = 'block';
          renderResourcesView();
        } else if (tab === 'mock-exam') {
          subNavWrapper.style.display = 'none';
          const viewMockExam = document.getElementById('view-mock-exam');
          if (viewMockExam) viewMockExam.style.display = 'block';
          if (window.MockExam && typeof window.MockExam.init === 'function') {
            window.MockExam.init();
          }
        }
      });
    });

    // --- CHEATSHEET SUBNAV TOGGLE ---
    let currentCheatSubtab = 'outline';
    const btnCheatOutline = document.getElementById('btn-cheat-outline');
    const btnCheatTopic = document.getElementById('btn-cheat-topic');
    const btnCheatSpot = document.getElementById('btn-cheat-spot');
    const btnCheatEmergency = document.getElementById('btn-cheat-emergency');
    const cheatBtns = [
      { btn: btnCheatOutline, key: 'outline' },
      { btn: btnCheatTopic, key: 'topic' },
      { btn: btnCheatSpot, key: 'spot' },
      { btn: btnCheatEmergency, key: 'emergency' }
    ];

    cheatBtns.forEach(item => {
      if (item.btn) {
        item.btn.addEventListener('click', () => {
        stopAllAudio();
          currentCheatSubtab = item.key;
          cheatBtns.forEach(b => { if (b.btn) b.btn.classList.remove('active'); });
          item.btn.classList.add('active');
          renderCheatsheetView();
        });
      }
    });

    renderCheatsheetView();

    function renderCheatsheetView() {
      const container = document.getElementById('cheatsheet-content-container');
      if (!container) return;
      container.innerHTML = '';

      if (currentCheatSubtab === 'outline') {
        // 官方考纲与考法 (完整权威版)
        container.innerHTML = `
          <!-- 1. 考试方式与时长概览 -->
          <div class="card" style="border-left: 5px solid #2d7a4c; margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #2d7a4c;">📋 一、考试方式与时长 (Exam Method & Duration)</h3>
              <span class="qa-tag-badge" style="background:#ebf5ee; color:#2d7a4c; border:1px solid #c6e2ce; font-weight:700;">现场面试 · 室内模拟讲解与知识问答</span>
            </div>
            
            <p style="font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 14px;">
              现场考试采取<strong>室内模拟讲解</strong>与<strong>知识问答</strong>的形式。考生须在规定时间内完成全部考核环节，考试结束后考评员根据考生现场综合表现独立评分。
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; flex-wrap:wrap; gap:8px;">
                <strong style="color: #166534; font-size: 16px;">🌐 外语类考生 (英语现场面试)</strong>
                <span style="background: #2d7a4c; color: #ffffff; font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 6px;">考试总时长 20 分钟</span>
              </div>
              <div style="font-size: 13.5px; color: #166534; line-height: 1.7;">
                考核流程包含：<strong>① 英文专题线路讲解</strong>（5分钟） + <strong>② 英文旅游景区讲解</strong>（5分钟） + <strong>③ 英文知识问答</strong>（5分钟） + <strong>④ 口译测试</strong>（中译外/外译中各1题 5分钟）。
              </div>
            </div>
          </div>

          <!-- 2. 考试内容与四大考核板块 (2x2 对齐网格) -->
          <div class="card" style="margin-bottom: 20px; padding: 22px;">
            <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 14px;">🎯 二、现场考试考核内容与考查重点</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
              <!-- 第1行: 专题线路 + 景区讲解 -->
              <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14.5px; margin-bottom: 6px;">1. 专题线路讲解 (5分钟)</div>
                <div style="font-size: 13px; color: #57534e; line-height: 1.6;">系统机考随机抽取1个专题，考生自选1条线路。考查宏观总结概括、行程安排与主要景点元素。</div>
              </div>
              <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14.5px; margin-bottom: 6px;">2. 旅游景区讲解 (5分钟)</div>
                <div style="font-size: 13px; color: #57534e; line-height: 1.6;">系统机考随机抽取1个国家AAAAA级景区。考查景区概况、特色、游览动线、代表性景观与讲解礼仪。</div>
              </div>

              <!-- 第2行: 知识问答 + 口译测试 -->
              <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14.5px; margin-bottom: 6px;">3. 知识问答 (3道题 / 5分钟)</div>
                <div style="font-size: 13px; color: #57534e; line-height: 1.6;">考评员现场提问：① 服务规范问答 + ② 应变能力问答（常见问题/突发事件） + ③ 综合知识问答。</div>
              </div>
              <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14.5px; margin-bottom: 6px;">4. 口译测试 (外语类专有)</div>
                <div style="font-size: 13px; color: #57534e; line-height: 1.6;">考官即时提问，随机抽取英译汉与汉译英双向现场口译各1题，考查双语即时转换与听辨应用能力。</div>
              </div>
            </div>
          </div>

          <!-- 3. 专题线路讲解考核规则与全景范围详表 -->
          <div class="card" style="margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a;">🗺️ 1. 专题线路讲解·官方考纲全景对照 (6大专题 · 18条线路)</h3>
              <span class="qa-tag-badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;">抽取1个专题 · 自选1条线路 · 5分钟</span>
            </div>
            
            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #854d0e; line-height: 1.6;">
              💡 <strong>讲解要求：</strong>考生应紧扣专题进行总结概括，并根据所选线路的<strong>行程安排</strong>和<strong>主要景点（元素）</strong>进行讲解，要求内容准确、结构完整、条理清晰、表达流畅（讲解时长 5 分钟）。
            </div>

            <!-- (1) 历史广西 -->
            <div style="border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
              <div style="background: #ebf5ee; padding: 10px 16px; border-bottom: 1px solid #d1fae5; display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #25663e; font-size: 15px;">（1）历史广西</strong>
                <span style="font-size: 12px; color: #2d7a4c;">考查历史沿革、重大事件、历史人物、发展格局与成就</span>
              </div>
              <div style="padding: 14px 16px; display: grid; gap: 10px; background: #fff; font-size: 13.5px;">
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                  <strong style="color: #1e3a8a;">线路一：历史文化名城之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>桂林市 ➔ 柳州市 ➔ 北海市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>桂林市独秀峰·王城景区、兴安灵渠景区、柳州市柳侯公园、合浦汉代文化博物馆等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                  <strong style="color: #1e3a8a;">线路二：骆越文化之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>南宁市 ➔ 崇左市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>广西壮族自治区博物馆、广西民族博物馆、崇左市壮族博物馆、崇左市花山岩画景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                  <strong style="color: #1e3a8a;">线路三：岭南文化之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>梧州市 ➔ 玉林市 ➔ 贵港市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>梧州骑楼城—龙母庙景区、梧州粤剧保护与传承基地、容州古城、桂平有理村采茶戏等。</span>
                </div>
              </div>
            </div>

            <!-- (2) 民族广西 -->
            <div style="border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
              <div style="background: #ebf5ee; padding: 10px 16px; border-bottom: 1px solid #d1fae5; display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #25663e; font-size: 15px;">（2）民族广西</strong>
                <span style="font-size: 12px; color: #2d7a4c;">考查12个世居民族分布及文学/文艺/工艺/体育/建筑/民俗/饮食/非遗</span>
              </div>
              <div style="padding: 14px 16px; display: grid; gap: 10px; background: #fff; font-size: 13.5px;">
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #10b981;">
                  <strong style="color: #065f46;">线路一：三月三风情之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>南宁市 ➔ 崇左市 ➔ 百色市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>南宁市民歌湖国际音乐小镇、伊岭岩风景区、崇左市明仕旅游度假区、靖西旧州景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #10b981;">
                  <strong style="color: #065f46;">线路二：桂北民族风情之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>龙胜各族自治县 ➔ 三江侗族自治县 ➔ 融水苗族自治县</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>龙胜龙脊梯田景区、程阳八寨景区、三江月也侗寨景区、梦呜苗寨民俗文化体验园等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #10b981;">
                  <strong style="color: #065f46;">线路三：刘三姐歌谣文化之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>桂林市 ➔ 柳州市 ➔ 河池市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>桂林经典刘三姐大观园景区、桂林阳朔大榕树景区、柳州市立鱼峰风景区、河池市宜州刘三姐故里旅游区等。</span>
                </div>
              </div>
            </div>

            <!-- (3) 风物广西 -->
            <div style="border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
              <div style="background: #ebf5ee; padding: 10px 16px; border-bottom: 1px solid #d1fae5; display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #25663e; font-size: 15px;">（3）风物广西</strong>
                <span style="font-size: 12px; color: #2d7a4c;">考查工艺品、土特产、名茶名酒、中药材/中成药、特色美食水果</span>
              </div>
              <div style="padding: 14px 16px; display: grid; gap: 10px; background: #fff; font-size: 13.5px;">
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                  <strong style="color: #92400e;">线路一：广西米粉之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>南宁市 ➔ 柳州市 ➔ 桂林市</span><br>
                  <span style="color: #4b5563;">• <strong>主要元素：</strong>南宁老友粉、柳州螺蛳粉、桂林米粉等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                  <strong style="color: #92400e;">线路二：广西茶文化之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>梧州市 ➔ 贵港市 ➔ 南宁市 ➔ 防城港市</span><br>
                  <span style="color: #4b5563;">• <strong>主要元素：</strong>梧州六堡茶、桂平西山茶、横州茉莉花茶、防城金花茶等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                  <strong style="color: #92400e;">线路三：广西工艺品之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>北海市 ➔ 钦州市 ➔ 南宁市 ➔ 百色市</span><br>
                  <span style="color: #4b5563;">• <strong>主要元素：</strong>合浦珍珠、钦州坭兴陶、壮锦、绣球等。</span>
                </div>
              </div>
            </div>

            <!-- (4) 山水广西 -->
            <div style="border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
              <div style="background: #ebf5ee; padding: 10px 16px; border-bottom: 1px solid #d1fae5; display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #25663e; font-size: 15px;">（4）山水广西</strong>
                <span style="font-size: 12px; color: #2d7a4c;">考查喀斯特/丹霞地貌、江河与滨海景观及历史文化价值</span>
              </div>
              <div style="padding: 14px 16px; display: grid; gap: 10px; background: #fff; font-size: 13.5px;">
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #06b6d4;">
                  <strong style="color: #0e7490;">线路一：喀斯特探秘之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>桂林市 ➔ 河池市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>桂林两江四湖·象山景区、桂林芦笛景区、桂林漓江景区、环江木论喀斯特生态旅游景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #06b6d4;">
                  <strong style="color: #0e7490;">线路二：北部湾滨海之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>北海市 ➔ 钦州市 ➔ 防城港市</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>北海银滩景区、北海涠洲岛、钦州三娘湾景区、江山半岛白浪滩旅游景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #06b6d4;">
                  <strong style="color: #0e7490;">线路三：奇峰秀水之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>阳朔县 ➔ 蒙山县 ➔ 金秀瑶族自治县</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>阳朔遇龙河国家旅游度假区、天书侠谷景区、大瑶山盘王界景区等。</span>
                </div>
              </div>
            </div>

            <!-- (5) 长寿广西 -->
            <div style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
              <div style="background: #ebf5ee; padding: 10px 16px; border-bottom: 1px solid #d1fae5; display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #25663e; font-size: 15px;">（5）长寿广西</strong>
                <span style="font-size: 12px; color: #2d7a4c;">考查广西长寿之乡分布、生态环境密码与长寿养生文化</span>
              </div>
              <div style="padding: 14px 16px; display: grid; gap: 10px; background: #fff; font-size: 13.5px;">
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #8b5cf6;">
                  <strong style="color: #5b21b6;">线路一：长寿康养之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>巴马瑶族自治县 ➔ 东兰县 ➔ 凤山县</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>巴马盘阳河景区（包括百魔洞景区、百鸟岩景区、赐福湖）、巴马水晶宫景区、东兰红水河第一湾景区、凤山县三门海景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #8b5cf6;">
                  <strong style="color: #5b21b6;">线路二：长寿悦动之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>凌云县 ➔ 乐业县</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>凌云环浩坤湖山水生态体验区、凌云茶山金字塔景区、乐业大石围天坑群景区等。</span>
                </div>
                <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #8b5cf6;">
                  <strong style="color: #5b21b6;">线路三：长寿休闲之旅</strong><br>
                  <span style="color: #4b5563;">• <strong>行程安排：</strong>平桂区 ➔ 八步区 ➔ 昭平县</span><br>
                  <span style="color: #4b5563;">• <strong>主要景点：</strong>贺州姑婆山景区、贺州西溪森林温泉度假村、黄姚古镇景区等。</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. 旅游景区讲解考核规则与5大5A景区 -->
          <div class="card" style="margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a;">🏛️ 2. 旅游景区讲解·官方考纲范围 (国家 AAAAA 级旅游景区)</h3>
              <span class="qa-tag-badge" style="background:#ebf5ee; color:#2d7a4c; border:1px solid #c6e2ce; font-weight:700;">随机抽取1个 · 时长5分钟</span>
            </div>
            
            <p style="font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 14px;">
              主要考查考生对广西国家 AAAAA 级旅游景区的知识储备与应用。考生在考试系统中<strong>随机抽取下列 5 个旅游景区中的 1 个</strong>，根据景区的<strong>概况、特色、游览线路、代表性景观</strong>等，自行组织讲解词进行现场模拟导游讲解（讲解时长 5 分钟，要求内容准确、结构完整、条理清晰、表达流畅）。
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <div style="background: #f6faf7; border: 1.5px solid #c6e2ce; border-radius: 8px; padding: 14px 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 4px;">🏞️</div>
                <strong style="color: #25663e; font-size: 14.5px;">南宁市青秀山旅游区</strong>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">壮锦广场 · 千年苏铁园 · 龙象塔</div>
              </div>

              <div style="background: #f6faf7; border: 1.5px solid #c6e2ce; border-radius: 8px; padding: 14px 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 4px;">🏮</div>
                <strong style="color: #25663e; font-size: 14.5px;">柳州市程阳八寨景区</strong>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">程阳风雨桥 · 马鞍寨鼓楼 · 百家宴</div>
              </div>

              <div style="background: #f6faf7; border: 1.5px solid #c6e2ce; border-radius: 8px; padding: 14px 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 4px;">🚣</div>
                <strong style="color: #25663e; font-size: 14.5px;">桂林漓江景区</strong>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">象鼻山 · 九马画山 · 黄布倒影</div>
              </div>

              <div style="background: #f6faf7; border: 1.5px solid #c6e2ce; border-radius: 8px; padding: 14px 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 4px;">🌙</div>
                <strong style="color: #25663e; font-size: 14.5px;">桂林市两江四湖·象山景区</strong>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">日月双塔 · 榕湖古南门 · 象山水月</div>
              </div>

              <div style="background: #f6faf7; border: 1.5px solid #c6e2ce; border-radius: 8px; padding: 14px 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 4px;">🎨</div>
                <strong style="color: #25663e; font-size: 14.5px;">崇左市花山岩画景区</strong>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">世界文化遗产 · 赭红蛙形岩画 · 骆越祭祀</div>
              </div>
            </div>
          </div>

          <!-- 5. 知识问答考核大纲与国家规范 -->
          <div class="card" style="margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a;">💡 3. 知识问答·考查规范与考核类别 (考评员现场提问 3 题 / 5分钟)</h3>
              <span class="qa-tag-badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700;">现场提问 · 当场回答 · 5分钟</span>
            </div>
            <p style="font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 12px;">
              知识问答主要考查考生对<strong>导游服务规范、应变能力和综合知识</strong>的掌握程度及应用能力。考评员现场提问 3 个问题，考生当场回答，时间为 5 分钟（外语类考生内容与中文类相同，考评员现场提问）。
            </p>
            
            <div style="display: grid; gap: 14px;">
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background: #fff;">
                <div style="font-weight: 700; color: #1e3a8a; font-size: 14.5px; margin-bottom: 6px;">（1）服务规范问答 (Service Standards)</div>
                <div style="font-size: 13px; color: #4b5563; line-height: 1.7;">
                  主要考查考生对国家及行业标准规范的掌握程度与实际运用能力：<br>
                  • 《导游服务规范》（GB/T 15971—2023）<br>
                  • 《旅行社出境旅游服务规范》（GB/T 31386—2015）<br>
                  • 《导游领队引导文明旅游规范》（LB/T 039—2015）<br>
                  • 《旅行社老年旅游服务要求》（GB/T 47540—2026）<br>
                  <span style="color: #25663e; font-weight: 600;">核心考查点：</span>关于导游服务要求、入境游导游特别要求、出境游领队服务特别要求、导游领队引导文明旅游规范、老年旅游者服务要求的掌握程度与运用能力。
                </div>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background: #fff;">
                <div style="font-weight: 700; color: #065f46; font-size: 14.5px; margin-bottom: 6px;">（2）应变能力问答 (Emergency Response)</div>
                <div style="font-size: 13px; color: #4b5563; line-height: 1.7;">
                  主要考查考生对《导游服务规范》（GB/T 15971—2023）的<strong>突发事件和常见问题</strong>的应对能力（如游客走失、突发疾病、交通事故、火灾、治安事件、证件与行李丢失、天气突变、游客投诉与矛盾化解等）。
                </div>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background: #fff;">
                <div style="font-weight: 700; color: #92400e; font-size: 14.5px; margin-bottom: 6px;">（3）综合知识问答 (Comprehensive Knowledge)</div>
                <div style="font-size: 13px; color: #4b5563; line-height: 1.7;">
                  主要考查考生对<strong>国际、国内时政热点以及经济、社会、文化旅游</strong>等方面知识的掌握程度；对<strong>广西壮族自治区地理、历史、文化、经济、交通、物产和旅游</strong>等方面知识的掌握程度。
                </div>
              </div>
            </div>
          </div>

          <!-- 6. 口译测试 (外语类考生专有) -->
          <div class="card" style="margin-bottom: 20px; padding: 22px; border-left: 5px solid #3b82f6;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #1e3a8a;">🌐 4. 口译测试 (外语类考生专有环节)</h3>
              <span class="qa-tag-badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; font-weight:700;">抽题 2 题 · 5分钟 · 20分</span>
            </div>
            
            <p style="font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 12px;">
              口译测试主要考查外语类考生在<strong>中文与外语之间的口头互译能力</strong>。考生在考试系统中随机抽取<strong>“中译外”</strong>和<strong>“外译中”</strong>试题各 1 题，考评员现场提问，考生当场回答，时间为 5 分钟。
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
                <strong style="color: #1e40af; font-size: 14px;">🇨🇳➔🌐 中译外 (1 题 · 10分)</strong>
                <div style="font-size: 12.5px; color: #64748b; margin-top: 4px;">考官朗读中文导游短句/段落，考生即时口译为地道英文。</div>
              </div>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
                <strong style="color: #1e40af; font-size: 14px;">🌐➔🇨🇳 外译中 (1 题 · 10分)</strong>
                <div style="font-size: 12.5px; color: #64748b; margin-top: 4px;">考官朗读英文导游语段/景点介绍，考生即时口译为规范中文。</div>
              </div>
            </div>
          </div>

          <!-- 7. 三、分值比例 (100分制权威对照) -->
          <div class="card" style="padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #1a1a1a;">📊 三、外语类现场考试分值比例 (100 分制)</h3>
              <span class="qa-tag-badge" style="background:#ebf5ee; color:#2d7a4c; border:1px solid #c6e2ce; font-weight:700;">满分 100 分 · 评分细则</span>
            </div>

            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; text-align: left;">
                <thead>
                  <tr style="background: #ebf5ee; border-bottom: 2px solid #c6e2ce; color: #2d7a4c;">
                    <th style="padding: 12px 14px; width: 45%;">考核项目 / 环节</th>
                    <th style="padding: 12px 14px; width: 25%; text-align: center;">分值</th>
                    <th style="padding: 12px 14px; width: 30%;">考查核心与要点</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 10px 14px; font-weight: 600;">1. 礼貌仪态</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">5 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">着装得体、仪态大方、导游手势礼仪规范</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #fafaf9;">
                    <td style="padding: 10px 14px; font-weight: 600;">2. 语言表达及语法</td>
                    <td style="padding: 10px 14px; text-align: center; color: #e11d48; font-weight: 800; font-size: 15px;">25 分 ⭐</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">发音纯正流畅、语法准确规范、词汇表达地道丰富</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 10px 14px; font-weight: 600;">3. 专题线路讲解 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">15 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">宏观总结概括、行程安排、主要景点与元素整合</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #fafaf9;">
                    <td style="padding: 10px 14px; font-weight: 600;">4. 旅游景区讲解 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">15 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">5A景区概况、移步换景、三大地标动线与文化特色</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 10px 14px; font-weight: 600;">5. 服务规范问答题 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">10 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">国家导游规范、出入境接待、文明引导、老年服务</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #fafaf9;">
                    <td style="padding: 10px 14px; font-weight: 600;">6. 应变能力问答题 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">5 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">常见问题与突发事件黄金三步法处理（安抚/处置/上报）</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1;">
                    <td style="padding: 10px 14px; font-weight: 600;">7. 综合知识问答题 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #2d7a4c; font-weight: 700;">5 分</td>
                    <td style="padding: 10px 14px; color: #666; font-size: 12.5px;">时政热点、广西区情历史文化、风物旅游综合常识</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f0eae1; background: #f0fdf4;">
                    <td style="padding: 10px 14px; font-weight: 600; color: #166534;">8. 口译测试：中译外 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #166534; font-weight: 700;">10 分</td>
                    <td style="padding: 10px 14px; color: #166534; font-size: 12.5px;">中文导游语段现场即时口译为规范地道英文</td>
                  </tr>
                  <tr style="border-bottom: 2px solid #c6e2ce; background: #f0fdf4;">
                    <td style="padding: 10px 14px; font-weight: 600; color: #166534;">9. 口译测试：外译中 (1 题)</td>
                    <td style="padding: 10px 14px; text-align: center; color: #166534; font-weight: 700;">10 分</td>
                    <td style="padding: 10px 14px; color: #166534; font-size: 12.5px;">英文导游语段现场即时口译为流畅准确中文</td>
                  </tr>
                  <tr style="background: #ebf5ee; font-weight: 800;">
                    <td style="padding: 12px 14px; color: #1e3a8a;">总分合计</td>
                    <td style="padding: 12px 14px; text-align: center; color: #1e3a8a; font-size: 16px;" colspan="2">100 分</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (currentCheatSubtab === 'topic') {
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
                  <tr style="border-bottom: 1px solid #dce7de; background: #f6faf7;">
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
                  <tr style="border-bottom: 1px solid #dce7de; background: #f6faf7;">
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
          <div class="card" style="border-left: 5px solid #2d7a4c; margin-bottom: 20px; padding: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
              <h3 style="font-size: 18px; font-weight: 800; color: #2d7a4c;">🗺️ 景点讲解移步换景法 (Scenic Spot 5-Step Block)</h3>
              <span class="qa-tag-badge" style="background:#ebf5ee; color:#2d7a4c; border:1px solid #c6e2ce;">时长 4~5 分钟 · 动线导览</span>
            </div>

            <div style="display: grid; gap: 12px; margin-top: 14px;">
              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 1: Welcome & Spot Overview (欢迎与景点定位 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Dear tourists, welcome to <mark style="background:#fef08a; padding:1px 4px;">[景点名称]</mark>! Located in <mark style="background:#fef08a; padding:1px 4px;">[Guilin/Nanning/Liuzhou]</mark>, this site is a national 5A-level scenic area, combining stunning natural beauty with deep cultural heritage."</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 2: Features & Layout (景点特色与游览线索 - 45秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"What makes <mark style="background:#fef08a; padding:1px 4px;">[景点名称]</mark> unique is its <mark style="background:#fef08a; padding:1px 4px;">[Karst mountains / authentic Dong villages]</mark>. The scenic area is laid out along <mark style="background:#fef08a; padding:1px 4px;">[the river / lush hills]</mark>, offering a breathtaking view at every turn."</div>
              </div>

              <div style="background: #ebf5ee; border: 1.5px dashed #a3d9b1; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #25663e; font-size: 14px; margin-bottom: 4px;">Step 3: Route & Core Landmarks (三大核心地标套用 - 120~150秒) ⚡重点套用路线</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Today, our tour route will take us downstream/along the path to explore 3 highlights:<br>
                First, we see <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标一, 如: Elephant Trunk Hill]</mark>, which gets its name because it resembles an elephant drinking water.<br>
                Next, we reach <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标二, 如: Nine-Horse Painting Hill]</mark>, famous for stone wall patterns.<br>
                Finally, we arrive at <mark style="background:#dbeafe; color:#1e40af; padding:1px 4px;">[地标三, 如: Huangbu Reflection]</mark>, printed on the 20-yuan RMB note."</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 4: History & Interactive Guidance (历史诗句与照料互动 - 30秒)</div>
                <div style="font-size: 13.5px; color: #222; font-family: monospace;">"Famous Tang poet Han Yu once praised this view: 'The river is like a green silk ribbon, and the mountains are like jade hairpins.' By the way, this is the best photo spot! Would you like me to take a photo of you? Please watch your step."</div>
              </div>

              <div style="background: #f6faf7; border: 1px solid #d4e8da; border-radius: 8px; padding: 12px 16px;">
                <div style="font-weight: 700; color: #2d7a4c; font-size: 14px; margin-bottom: 4px;">Step 5: Closing & Farewell (总结与致谢告别 - 30秒)</div>
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
                  <tr style="background: #ebf5ee; border-bottom: 2px solid #c6e2ce; color: #2d7a4c;">
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
                  <tr style="border-bottom: 1px solid #dce7de; background: #f6faf7;">
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
                  <tr style="border-bottom: 1px solid #dce7de; background: #f6faf7;">
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
      btnPracticeListen.addEventListener('click', () => {
        const list = getFilteredPracticeList();
        if (list.length > 0 && currentPracticeIndex < list.length) {
          const item = list[currentPracticeIndex];
          const qEl = document.getElementById('practice-en-question');
          const qText = item.enQuestion || item.question || (qEl ? qEl.textContent : '');
          const audioUrl = item.id ? `audio/questions/question_${item.id}.mp3` : '';
          playAudioOrTTS(audioUrl, qText, qEl);
        }
      });

    document.getElementById('btn-practice-toggle-ans').addEventListener('click', () => {
      const box = document.getElementById('practice-ref-box');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-practice-prev').addEventListener('click', () => {
      stopAllAudio();
      if (practiceHistory.length > 0) {
        currentPracticeIndex = practiceHistory.pop();
        renderCurrentPracticeCard();
      }
    });

    document.getElementById('btn-practice-next').addEventListener('click', () => {
      stopAllAudio();
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

    // --- INTERPRETATION EVENTS (独立口译测试交互) ---
    const btnInterpCard = document.getElementById('btn-interp-card');
    const btnInterpList = document.getElementById('btn-interp-list');
    
    if (btnInterpCard && btnInterpList) {
      btnInterpCard.addEventListener('click', () => {
        interpViewMode = 'card';
        btnInterpCard.classList.add('active');
        btnInterpList.classList.remove('active');
        renderInterpretingView();
      });

      btnInterpList.addEventListener('click', () => {
        interpViewMode = 'list';
        btnInterpList.classList.add('active');
        btnInterpCard.classList.remove('active');
        renderInterpretingView();
      });
    }

    
    const btnInterpListenQ = document.getElementById('btn-interp-listen-q');
    if (btnInterpListenQ) {
      btnInterpListenQ.addEventListener('click', () => {
        const list = getFilteredInterpList();
        if (list.length === 0 || currentInterpIndex >= list.length) return;
        const item = list[currentInterpIndex];
        const isC2E = item.type === 'C2E' || item.tag === '汉译英';
        if (!isC2E) {
          // 英译中时，播放生成的英文原题高清音频
          const audioUrl = item.id ? `audio/translations/trans_${item.id}.mp3` : '';
          const qEl = document.getElementById('interp-question-text');
          playAudioOrTTS(audioUrl, item.src || item.question || item.en || '', qEl);
        }
      });
    }

    const btnInterpToggleAns = document.getElementById('btn-interp-toggle-ans');
    if (btnInterpToggleAns) {
      btnInterpToggleAns.addEventListener('click', () => {
        const box = document.getElementById('interp-ref-box');
        if (box) {
          box.style.display = box.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    const btnInterpPrev = document.getElementById('btn-interp-prev');
    if (btnInterpPrev) {
      btnInterpPrev.addEventListener('click', () => {
        stopAllAudio();
        const list = getFilteredInterpList();
        if (list.length === 0) return;
        if (interpHistory.length > 0) {
          currentInterpIndex = interpHistory.pop();
        } else {
          currentInterpIndex = (currentInterpIndex - 1 + list.length) % list.length;
        }
        renderCurrentInterpCard();
      });
    }

    const btnInterpNext = document.getElementById('btn-interp-next');
    if (btnInterpNext) {
      btnInterpNext.addEventListener('click', () => {
        stopAllAudio();
        const list = getFilteredInterpList();
        if (list.length === 0) return;
        interpHistory.push(currentInterpIndex);
        currentInterpIndex = (currentInterpIndex + 1) % list.length;
        renderCurrentInterpCard();
      });
    }

    // 口译语音输入与答案校正绑定
    const btnInterpMic = document.getElementById('btn-interp-mic');
    const interpTextarea = document.getElementById('interp-user-input');
    let interpRecognition = null;
    let isInterpRecording = false;
    let interpBaseText = '';
    let interpSessionFinal = '';
    let interpSessionInterim = '';

    function triggerInterpEvaluation(userText) {
      const evalBox = document.getElementById('interp-eval-result');
      if (!evalBox) return;

      const list = getFilteredInterpList();
      const curItem = list[currentInterpIndex];
      if (!curItem || !userText || !userText.trim()) {
        evalBox.style.display = 'none';
        return;
      }

      const refAns = curItem.ref || curItem.answer || curItem.cn || '';
      const result = evaluateUserAnswerAgainstRef(userText, refAns);
      if (!result || result.totalCount === 0) {
        evalBox.style.display = 'none';
        return;
      }

      let color = '#16a34a';
      if (result.score < 50) color = '#dc2626';
      else if (result.score < 80) color = '#d97706';

      let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 700; color: #1e293b;">🎯 译文准确度与要点校对</span>
          <span style="font-size: 14px; font-weight: 800; color: ${color};">${result.score}分 (匹配 ${result.hitCount}/${result.totalCount} 核心词句)</span>
        </div>
      `;

      if (result.hitKeywords.length) {
        html += `<div style="font-size: 12px; margin-bottom: 4px; line-height: 1.6;">✅ <strong>命中核心点:</strong> ${result.hitKeywords.slice(0, 10).map(k => `<span style="display:inline-block; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:1px 6px; border-radius:4px; margin:2px;">${k}</span>`).join('')}</div>`;
      }
      if (result.missKeywords.length) {
        html += `<div style="font-size: 12px; line-height: 1.6;">💡 <strong>建议对照补充:</strong> ${result.missKeywords.slice(0, 10).map(k => `<span style="display:inline-block; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:1px 6px; border-radius:4px; margin:2px;">${k}</span>`).join('')}</div>`;
      }

      evalBox.innerHTML = html;
      evalBox.style.display = 'block';
    }

    if (interpTextarea) {
      interpTextarea.addEventListener('input', () => {
        triggerInterpEvaluation(interpTextarea.value);
      });
    }

    function stopInterpRecording() {
      if (!isInterpRecording) return;
      isInterpRecording = false;
      if (interpRecognition) {
        try { interpRecognition.stop(); } catch(e){}
      }
      // 停止录音时，确保最新识别的有效文本（包括末尾临时分段）固化在输入框中，绝不丢失
      if (interpTextarea) {
        const fullFinal = (interpSessionFinal + ' ' + interpSessionInterim).trim();
        if (fullFinal) {
          const prefix = interpBaseText ? interpBaseText + (interpBaseText.endsWith(' ') || interpBaseText.endsWith('\n') ? '' : ' ') : '';
          interpTextarea.value = prefix + fullFinal;
        }
        triggerInterpEvaluation(interpTextarea.value);
      }
      const icon = document.getElementById('interp-mic-icon');
      const text = document.getElementById('interp-mic-text');
      if (icon) icon.textContent = '🎤';
      if (text) text.textContent = '语音口译';
      if (btnInterpMic) {
        btnInterpMic.style.background = '#ebf5ee';
        btnInterpMic.style.borderColor = '#c6e2ce';
        btnInterpMic.style.color = '#2d7a4c';
      }
    }

    if (btnInterpMic && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      interpRecognition = new SpeechRecognition();
      interpRecognition.continuous = true;
      interpRecognition.interimResults = true;
      interpRecognition.maxAlternatives = 1;

      interpRecognition.onstart = () => {
        isInterpRecording = true;
        const icon = document.getElementById('interp-mic-icon');
        const text = document.getElementById('interp-mic-text');
        if (icon) icon.textContent = '🔴';
        if (text) text.textContent = '正在录音...';
        btnInterpMic.style.background = '#fef2f2';
        btnInterpMic.style.borderColor = '#fca5a5';
        btnInterpMic.style.color = '#dc2626';
      };

      interpRecognition.onresult = (event) => {
        let curFinal = '';
        let curInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            curFinal += res[0].transcript + ' ';
          } else {
            curInterim += res[0].transcript;
          }
        }

        if (curFinal) {
          interpSessionFinal += curFinal;
        }
        interpSessionInterim = curInterim;

        if (interpTextarea) {
          const prefix = interpBaseText ? interpBaseText + (interpBaseText.endsWith(' ') || interpBaseText.endsWith('\n') ? '' : ' ') : '';
          interpTextarea.value = prefix + (interpSessionFinal + curInterim).trim();
          triggerInterpEvaluation(interpTextarea.value);
        }
      };

      interpRecognition.onerror = (event) => {
        console.warn('[Interp Mic Error]', event.error);
        if (event.error === 'not-allowed') {
          alert('麦克风权限未开启，请在浏览器地址栏左侧允许使用麦克风。');
        }
        stopInterpRecording();
      };

      interpRecognition.onend = () => {
        if (isInterpRecording) {
          stopInterpRecording();
        }
      };

      btnInterpMic.addEventListener('click', () => {
        if (isInterpRecording) {
          stopInterpRecording();
        } else {
          try {
            const list = getFilteredInterpList();
            const cur = list[currentInterpIndex] || {};
            const isC2E = cur.type === 'C2E' || cur.tag === '汉译英';
            interpRecognition.lang = isC2E ? 'en-US' : 'zh-CN';
            interpBaseText = interpTextarea ? interpTextarea.value.trim() : '';
            interpSessionFinal = '';
            interpSessionInterim = '';
            interpRecognition.start();
          } catch (e) {
            console.warn('[Interp Mic Error]', e);
          }
        }
      });
    }


  // ==========================================
  // --- PHRASES MODULE (短语速记，严格隔离) ---
  // ==========================================
  let currentPhraseCategory = '全部专题';
  let currentPhraseIndex = 0;
  let phraseViewMode = 'card';
  let isPhraseRevealed = false;
  let phraseHistory = []; // 记录用户实际刷过的短语历史
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
    if (tagBadge) tagBadge.textContent = item.category;
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
            <button class="action-btn" id="btn-phrase-example-speak" title="朗读例句" style="width: 26px; height: 26px; padding: 0; font-size: 13px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform 0.15s;">🔊</button>
          </div>
        `;
        const btnExSpeak = document.getElementById('btn-phrase-example-speak');
        if (btnExSpeak) {
          btnExSpeak.addEventListener('click', () => {
            const exContainer = document.getElementById('phrase-example-sentence');
            const audioUrl = item.id ? `audio/phrases/example_${item.id}.mp3` : '';
            playAudioOrTTS(audioUrl, item.example, exContainer);
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
          <button class="action-btn btn-phrase-list-speak" data-id="${item.id}" data-en="${encodeURIComponent(item.en)}" style="padding:4px 10px;font-size:12px;">🔊 朗读</button>
        </div>
        <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${idx + 1}. ${item.en}</div>
        <div style="font-size:14.5px;color:#2d7a4c;font-weight:600;margin-bottom:8px;">${item.cn}</div>
        ${item.example ? `
          <div style="font-size:13px;color:#666;background:#faf8f5;padding:8px 12px;border-left:3px solid #d4c5b2;border-radius:4px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
              <span style="font-weight:700;color:#2d7a4c;">💡 例句：</span>
              <span class="phrase-list-example-text" style="color:#4b5563;">${item.example}</span>
            </div>
            <button class="action-btn btn-phrase-list-ex-speak" data-id="${item.id}" data-ex="${encodeURIComponent(item.example)}" title="朗读例句" style="width: 24px; height: 24px; padding: 0; font-size: 12px; background: #ebf5ee; border: 1px solid #c6e2ce; color: #2d7a4c; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">🔊</button>
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-phrase-list-speak').forEach(btn => {
      btn.addEventListener('click', e => {
        const pId = e.currentTarget.getAttribute('data-id');
        const text = decodeURIComponent(e.currentTarget.getAttribute('data-en'));
        const audioUrl = pId ? `audio/phrases/phrase_${pId}.mp3` : '';
        playAudioOrTTS(audioUrl, text);
      });
    });

    container.querySelectorAll('.btn-phrase-list-ex-speak').forEach(btn => {
      btn.addEventListener('click', e => {
        const pId = e.currentTarget.getAttribute('data-id');
        const text = decodeURIComponent(e.currentTarget.getAttribute('data-ex'));
        const card = e.currentTarget.closest('.card');
        const exEl = card ? card.querySelector('.phrase-list-example-text') : null;
        const audioUrl = pId ? `audio/phrases/example_${pId}.mp3` : '';
        playAudioOrTTS(audioUrl, text, exEl);
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
          const item = list[currentPhraseIndex];
          const cardEl = document.getElementById('phrase-en-title');
          const audioUrl = item.id ? `audio/phrases/phrase_${item.id}.mp3` : '';
          playAudioOrTTS(audioUrl, item.en, cardEl);
        }
      });
    }

    function revealAndPlayCurrentPhrase() {
      if (isPhraseRevealed) return;
      isPhraseRevealed = true;
      renderCurrentPhraseCard();

      // 翻转后自动播放短语音频
      const list = getFilteredPhrases();
      if (list.length > 0 && list[currentPhraseIndex]) {
        const item = list[currentPhraseIndex];
        const cardEl = document.getElementById('phrase-en-title');
        const audioUrl = item.id ? `audio/phrases/phrase_${item.id}.mp3` : '';
        playAudioOrTTS(audioUrl, item.en, cardEl);
      }
    }

    const unrevealedZone = document.getElementById('phrase-unrevealed-actions');
    if (unrevealedZone) {
      unrevealedZone.addEventListener('click', () => {
        revealAndPlayCurrentPhrase();
      });
    }

    const btnPhraseReveal = document.getElementById('btn-phrase-reveal');
    if (btnPhraseReveal) {
      btnPhraseReveal.addEventListener('click', (e) => {
        e.stopPropagation();
        revealAndPlayCurrentPhrase();
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
      stopAllAudio();
      phraseHistory.push(currentPhraseIndex);
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
        stopAllAudio();
        const list = getFilteredPhrases();
        if (phraseHistory.length > 0) {
          currentPhraseIndex = phraseHistory.pop();
        } else {
          currentPhraseIndex = (currentPhraseIndex - 1 + list.length) % list.length;
        }
        isPhraseRevealed = false;
        renderCurrentPhraseCard();
      });
    }

    const btnPhraseNext = document.getElementById('btn-phrase-next');
    if (btnPhraseNext) {
      btnPhraseNext.addEventListener('click', () => {
        stopAllAudio();
        isPhraseRevealed = false;
        currentPhraseIndex++;
        renderCurrentPhraseCard();
      });
    }

    const btnPhraseReset = document.getElementById('btn-phrase-reset');
    if (btnPhraseReset) {
      btnPhraseReset.addEventListener('click', () => {
        if (confirm('确定要重置所有短语的记忆进度吗？')) {
          stopAllAudio();
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
    initPracticeSpeechRecognition();

    let practiceRecognition = null;
    let isPracticeListening = false;
    let userWantsPracticeListening = false;
    let practiceBaseText = '';
    let practiceSessionFinal = '';
    let practiceSessionInterim = '';

    function initPracticeSpeechRecognition() {
      const micBtn = document.getElementById('btn-practice-mic');
      const textarea = document.getElementById('practice-user-input');
      if (!micBtn || !textarea) return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        micBtn.title = '当前浏览器不支持原生语音识别，建议使用 Chrome 或 Edge 浏览器';
        micBtn.style.opacity = '0.6';
        micBtn.addEventListener('click', () => {
          alert('当前浏览器未检测到原生语音识别支持，请使用 Google Chrome 或 Microsoft Edge 浏览器。');
        });
        return;
      }

      micBtn.addEventListener('click', () => {
        if (userWantsPracticeListening) {
          stopPracticeSpeech();
        } else {
          startPracticeSpeech();
        }
      });

      textarea.addEventListener('input', () => {
        triggerAnswerEvaluation(textarea.value);
      });
    }

    function startPracticeSpeech() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('当前浏览器不支持语音识别，推荐使用 Google Chrome 或 Microsoft Edge。');
        return;
      }

      if (!practiceRecognition) {
        practiceRecognition = new SpeechRecognition();
        practiceRecognition.continuous = true;
        practiceRecognition.interimResults = true;
        practiceRecognition.maxAlternatives = 1;

        practiceRecognition.onstart = () => {
          isPracticeListening = true;
          updateMicBtnState(true);
        };

        practiceRecognition.onresult = (event) => {
          let curFinal = '';
          let curInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              curFinal += res[0].transcript + ' ';
            } else {
              curInterim += res[0].transcript;
            }
          }

          if (curFinal) {
            practiceSessionFinal += curFinal;
          }
          practiceSessionInterim = curInterim;

          const textarea = document.getElementById('practice-user-input');
          if (textarea) {
            const prefix = practiceBaseText ? practiceBaseText + (practiceBaseText.endsWith(' ') || practiceBaseText.endsWith('\n') ? '' : ' ') : '';
            textarea.value = prefix + (practiceSessionFinal + curInterim).trim();
            triggerAnswerEvaluation(textarea.value);
          }
        };

        practiceRecognition.onerror = (event) => {
          console.warn('Practice speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            const micBtn = document.getElementById('btn-practice-mic');
            if (micBtn) {
              micBtn.title = '麦克风权限未开启，请在浏览器地址栏左侧勾选“允许麦克风”';
            }
            userWantsPracticeListening = false;
            stopPracticeSpeech();
          }
        };

        practiceRecognition.onend = () => {
          isPracticeListening = false;
          if (userWantsPracticeListening) {
            setTimeout(() => {
              if (userWantsPracticeListening && !isPracticeListening) {
                try { practiceRecognition.start(); } catch(e){}
              }
            }, 150);
          } else {
            updateMicBtnState(false);
          }
        };
      }

      const list = getFilteredPracticeList();
      const qItem = list[currentPracticeIndex];
      let lang = 'en-US';
      if (qItem && (qItem.type === 'E2C' || qItem.tag === '英译中')) {
        lang = 'zh-CN';
      }
      practiceRecognition.lang = lang;

      const textarea = document.getElementById('practice-user-input');
      practiceBaseText = textarea ? textarea.value.trim() : '';
      practiceSessionFinal = '';
      practiceSessionInterim = '';
      userWantsPracticeListening = true;
      try {
        practiceRecognition.start();
      } catch(e) {
        console.warn("Speech recognition already active:", e);
      }
    }

    function stopPracticeSpeech() {
      userWantsPracticeListening = false;
      isPracticeListening = false;
      if (practiceRecognition) {
        try { practiceRecognition.stop(); } catch(e){}
      }
      const textarea = document.getElementById('practice-user-input');
      if (textarea) {
        const fullFinal = (practiceSessionFinal + ' ' + practiceSessionInterim).trim();
        if (fullFinal) {
          const prefix = practiceBaseText ? practiceBaseText + (practiceBaseText.endsWith(' ') || practiceBaseText.endsWith('\n') ? '' : ' ') : '';
          textarea.value = prefix + fullFinal;
        }
        triggerAnswerEvaluation(textarea.value);
      }
      updateMicBtnState(false);
    }

    function updateMicBtnState(listening) {
      const micIcon = document.getElementById('practice-mic-icon');
      const micLabel = document.getElementById('practice-mic-text');
      const micBtn = document.getElementById('btn-practice-mic');
      if (!micBtn) return;

      if (listening) {
        micBtn.style.background = '#fef2f2';
        micBtn.style.borderColor = '#fca5a5';
        micBtn.style.color = '#dc2626';
        if (micIcon) micIcon.textContent = '🔴';
        if (micLabel) micLabel.textContent = '正在录音...';
      } else {
        micBtn.style.background = '#ebf5ee';
        micBtn.style.borderColor = '#c6e2ce';
        micBtn.style.color = '#2d7a4c';
        if (micIcon) micIcon.textContent = '🎤';
        if (micLabel) micLabel.textContent = '语音作答';
      }
    }

    function triggerAnswerEvaluation(userText) {
      const evalBox = document.getElementById('practice-eval-result');
      if (!evalBox) return;

      const list = getFilteredPracticeList();
      const qItem = list[currentPracticeIndex];
      if (!qItem || !userText || !userText.trim()) {
        evalBox.style.display = 'none';
        return;
      }

      const refAns = qItem.answer || '';
      const result = evaluateUserAnswerAgainstRef(userText, refAns);
      if (!result || result.totalCount === 0) {
        evalBox.style.display = 'none';
        return;
      }

      let color = '#16a34a';
      if (result.score < 50) color = '#dc2626';
      else if (result.score < 80) color = '#d97706';

      let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 700; color: #1e293b;">🎯 答案要点匹配度</span>
          <span style="font-size: 14px; font-weight: 800; color: ${color};">${result.score}分 (命中 ${result.hitCount}/${result.totalCount} 核心要素)</span>
        </div>
      `;

      if (result.hitKeywords.length) {
        html += `<div style="font-size: 12px; margin-bottom: 4px; line-height: 1.6;">✅ <strong>已命中要素:</strong> ${result.hitKeywords.slice(0, 10).map(k => `<span style="display:inline-block; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:1px 6px; border-radius:4px; margin:2px;">${k}</span>`).join('')}</div>`;
      }
      if (result.missKeywords.length) {
        html += `<div style="font-size: 12px; line-height: 1.6;">💡 <strong>建议补充:</strong> ${result.missKeywords.slice(0, 10).map(k => `<span style="display:inline-block; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:1px 6px; border-radius:4px; margin:2px;">${k}</span>`).join('')}</div>`;
      }

      evalBox.innerHTML = html;
      evalBox.style.display = 'block';
    }

    function evaluateUserAnswerAgainstRef(userText, targetAnswer) {
      if (!userText || !targetAnswer) return null;

      const cleanUser = userText.trim().toLowerCase();
      const cleanAns = targetAnswer.replace(/<[^>]*>/g, '').toLowerCase();

      const isChinese = /[\u4e00-\u9fa5]/.test(cleanAns);

      let keywords = [];
      if (isChinese) {
        const matches = cleanAns.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        keywords = [...new Set(matches)];
      } else {
        const stopWords = new Set([
          'the','a','an','and','or','but','is','are','was','were','be','been','being',
          'in','on','at','to','for','with','by','about','against','between','into','through',
          'during','before','after','above','below','from','up','down','of','off','over','under',
          'this','that','these','those','it','its','they','them','their','you','your','we','our'
        ]);
        const words = cleanAns.match(/[a-zA-Z0-9'-]+/g) || [];
        const filtered = words.filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));
        keywords = [...new Set(filtered.map(w => w.toLowerCase()))];
      }

      if (keywords.length === 0) return null;

      const hitKeywords = [];
      const missKeywords = [];

      keywords.forEach(kw => {
        if (cleanUser.includes(kw)) {
          hitKeywords.push(kw);
        } else {
          missKeywords.push(kw);
        }
      });

      const score = Math.round((hitKeywords.length / keywords.length) * 100);
      return {
        score,
        hitCount: hitKeywords.length,
        totalCount: keywords.length,
        hitKeywords,
        missKeywords
      };
    }
  }
});

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAllAudio();
  });
