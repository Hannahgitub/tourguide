/**
 * 全真模拟考场模块 (Mock Exam Engine)
 * 自然淡绿风格 · 考官抽专题·考生选路线 · 纯英问答 · 标准答案查看
 */

(function () {
  'use strict';

  // 模拟考核心状态
  const examState = {
    stage: 0, // 0: 考前准备, 1: Part 1 专题, 2: Part 2 景区, 3: Part 3 问答, 4: Part 4 口译, 5: 考后报告
    timeRemaining: 300, // 每阶段 5 分钟 (300秒)
    timerInterval: null,
    stageStartTime: 0,
    recognition: null,

    // 各阶段数据
    part1: {
      category: '山水广西', // 抽取的专题类别
      selectedSpeech: null, // 考生从专题里自选的具体篇目/路线
      hintLevel: 0, // 0: 无, 1: 考纲速记, 2: 原文
      timeSpent: 0
    },
    part2: {
      scenic: null,
      hintLevel: 0,
      timeSpent: 0
    },
    part3: {
      questions: [],
      answers: {},
      scores: {},
      showAnswer: {}, // 是否展开查看标准答案
      timeSpent: 0
    },
    part4: {
      translations: [],
      answers: {},
      scores: {},
      showAnswer: {}, // 是否展开查看参考译文
      timeSpent: 0
    }
  };

  const STAGE_CONFIG = [
    { id: 0, title: '考前准备', subtitle: '了解规则并就绪' },
    { id: 1, title: '专题讲解', subtitle: '抽选专题·自选路线 (5分钟)' },
    { id: 2, title: '景区讲解', subtitle: '抽取景区·现场讲解 (5分钟)' },
    { id: 3, title: '知识问答', subtitle: '随机3题·语音/文本作答 (5分钟)' },
    { id: 4, title: '口译测试', subtitle: '英汉双向口译测试 (5分钟)' },
    { id: 5, title: '考生成绩单', subtitle: '全真模拟考核综合报告' }
  ];

  const TOPIC_CATEGORIES = [
    '山水广西',
    '民族广西',
    '历史广西',
    '风物广西',
    '长寿广西'
  ];

  // 初始化入口
  function initMockExam() {
    const container = document.getElementById('view-mock-exam');
    if (!container) return;
    renderExamLayout();
  }

  // 渲染总体考场布局
  function renderExamLayout() {
    const container = document.getElementById('view-mock-exam');
    if (!container) return;

    if (examState.stage === 0) {
      container.innerHTML = renderWelcomeView();
      bindWelcomeEvents();
      return;
    }

    if (examState.stage === 5) {
      container.innerHTML = renderReportView();
      bindReportEvents();
      return;
    }

    container.innerHTML = `
      <div class="mock-exam-container">
        <!-- 顶部状态栏: 步骤指示与5分钟倒计时 -->
        <div class="exam-top-bar">
          <div class="exam-steps-tracker">
            ${[1, 2, 3, 4].map(s => {
              const cfg = STAGE_CONFIG[s];
              let cls = 'exam-step-item';
              if (s === examState.stage) cls += ' active';
              else if (s < examState.stage) cls += ' completed';
              return `
                <div class="${cls}">
                  <span>${s < examState.stage ? '✓' : `0${s}`}</span>
                  <span>${cfg.title}</span>
                </div>
                ${s < 4 ? '<span class="exam-step-arrow">➔</span>' : ''}
              `;
            }).join('')}
          </div>

          <div class="exam-timer-wrapper">
            <div class="exam-timer-box ${examState.timeRemaining <= 60 ? 'warning' : ''}" id="exam-timer-box">
              <span class="exam-timer-icon">⏳</span>
              <span class="exam-timer-clock" id="exam-clock-text">${formatTime(examState.timeRemaining)}</span>
            </div>
          </div>
        </div>

        <!-- 阶段内容主体卡片 -->
        <div class="exam-main-card" id="exam-stage-content">
          ${renderCurrentStageContent()}
        </div>

        <!-- 底部流程控制栏 -->
        <div class="exam-footer-bar">
          <button class="btn-stage-action prev" id="btn-quit-exam">🚪 退出模拟考</button>
          <button class="btn-stage-action next" id="btn-next-stage">
            ${examState.stage === 4 ? '🏁 完成考核，查看成绩单' : '提前完成，进入下一部分 ➔'}
          </button>
        </div>
      </div>
    `;

    bindStageEvents();
  }

  // 格式化秒为 MM:SS
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // 1. 考前准备引导页
  function renderWelcomeView() {
    return `
      <div class="mock-exam-container">
        <div class="exam-welcome-card">
          <span class="exam-welcome-badge">GUANGXI TOUR GUIDE EXAM SIMULATOR</span>
          <h1 class="exam-welcome-title">🎓 外语导游资格考试 · 全真考场模拟</h1>
          <p class="exam-welcome-desc">
            严格依照全真口试考场流程。全流程包含 4 大环节，各环节独立倒计时 <strong>5 分钟（300秒）</strong>。支持考官抽签、自选线路、两级求助提示及全真智能打分。
          </p>

          <div class="exam-stages-grid">
            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>01. 专题讲解</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">考官随机抽取五大专题之一，考生自选该专题下的一条线路或篇目进行讲解。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>02. 景区讲解</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">抽取代表性景区进行现场英文讲解。支持考纲速记与双语原文两级提示。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>03. 知识问答</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">纯英文考官真题提问 3 题。支持语音/文字作答，即时打分并可查阅官方标准答案。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>04. 口译测试</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">英汉双向口译测试，支持原句标准发音听题，即时评测并可查看参考译文。</div>
            </div>
          </div>

          <button class="exam-start-btn" id="btn-start-simulation">
            🚀 准备就绪，开始模拟考试
          </button>
        </div>
      </div>
    `;
  }

  function bindWelcomeEvents() {
    const startBtn = document.getElementById('btn-start-simulation');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        startSimulation();
      });
    }
  }

  // 开始全流程模拟
  function startSimulation() {
    examState.stage = 1;
    examState.part1 = { category: '山水广西', selectedSpeech: null, hintLevel: 0, timeSpent: 0 };
    examState.part2 = { scenic: null, hintLevel: 0, timeSpent: 0 };
    examState.part3 = { questions: [], answers: {}, scores: {}, showAnswer: {}, timeSpent: 0 };
    examState.part4 = { translations: [], answers: {}, scores: {}, showAnswer: {}, timeSpent: 0 };

    // 抽签初始化
    drawPart1Category();
    drawPart2Scenic();
    drawPart3Questions();
    drawPart4Translations();

    // 开启第一阶段
    startStage(1);
  }

  // 启动某阶段计时
  function startStage(stageNumber) {
    examState.stage = stageNumber;
    examState.timeRemaining = 300; // 5分钟
    examState.stageStartTime = Date.now();

    if (examState.timerInterval) {
      clearInterval(examState.timerInterval);
    }

    examState.timerInterval = setInterval(() => {
      examState.timeRemaining--;

      const clockEl = document.getElementById('exam-clock-text');
      const boxEl = document.getElementById('exam-timer-box');
      if (clockEl) clockEl.textContent = formatTime(examState.timeRemaining);

      if (boxEl) {
        if (examState.timeRemaining <= 60) {
          boxEl.classList.add('warning');
        } else {
          boxEl.classList.remove('warning');
        }
      }

      if (examState.timeRemaining <= 0) {
        clearInterval(examState.timerInterval);
        handleStageTimeout();
      }
    }, 1000);

    renderExamLayout();
  }

  function handleStageTimeout() {
    recordCurrentStageTime();
    if (examState.stage < 4) {
      alert(`⏰ 本阶段 5 分钟时间已到，系统自动进入下一阶段！`);
      startStage(examState.stage + 1);
    } else {
      alert(`⏰ 模拟考试全部结束！正在生成您的考生成绩单...`);
      finishExam();
    }
  }

  function recordCurrentStageTime() {
    const elapsed = Math.min(300, Math.round((Date.now() - examState.stageStartTime) / 1000));
    if (examState.stage === 1) examState.part1.timeSpent = elapsed;
    else if (examState.stage === 2) examState.part2.timeSpent = elapsed;
    else if (examState.stage === 3) examState.part3.timeSpent = elapsed;
    else if (examState.stage === 4) examState.part4.timeSpent = elapsed;
  }

  // 抽题逻辑
  function drawPart1Category() {
    const idx = Math.floor(Math.random() * TOPIC_CATEGORIES.length);
    const cat = TOPIC_CATEGORIES[idx];
    examState.part1.category = cat;

    // 默认自选该专题下的第一个景点线路
    if (window.data && window.data.speeches) {
      const candidates = window.data.speeches.filter(s => s.category === cat);
      examState.part1.selectedSpeech = candidates.length > 0 ? candidates[0] : null;
    }
  }

  function drawPart2Scenic() {
    if (!window.data || !window.data.speeches) return;
    const scenics = window.data.speeches.filter(s => s.category === '景区讲解');
    if (scenics.length > 0) {
      const idx = Math.floor(Math.random() * scenics.length);
      examState.part2.scenic = scenics[idx];
    }
  }

  function drawPart3Questions() {
    if (!window.data || !window.data.questions) return;
    const all = [...window.data.questions];
    all.sort(() => 0.5 - Math.random());
    examState.part3.questions = all.slice(0, 3);
  }

  function drawPart4Translations() {
    if (!window.data || !window.data.translations) return;
    const c2eList = window.data.translations.filter(t => t.type === 'C2E' || t.tag === '汉译英');
    const e2cList = window.data.translations.filter(t => t.type === 'E2C' || t.tag === '英译中');

    c2eList.sort(() => 0.5 - Math.random());
    e2cList.sort(() => 0.5 - Math.random());

    examState.part4.translations = [
      c2eList[0] || window.data.translations[0],
      e2cList[0] || window.data.translations[1]
    ];
  }

  // 渲染当前阶段的核心内容
  function renderCurrentStageContent() {
    switch (examState.stage) {
      case 1:
        return renderPart1Content();
      case 2:
        return renderPart2Content();
      case 3:
        return renderPart3Content();
      case 4:
        return renderPart4Content();
      default:
        return '';
    }
  }

  // 阶段 1: 专题讲解 (考官抽专题，考生自选线路篇目)
  function renderPart1Content() {
    const category = examState.part1.category;
    const availableSpeeches = (window.data && window.data.speeches)
      ? window.data.speeches.filter(s => s.category === category)
      : [];
    const selected = examState.part1.selectedSpeech || availableSpeeches[0];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第一部分 · 占分 20%</span>
          <div class="exam-section-title">🎙️ 专题讲解 (Topic Presentation)</div>
          <div class="exam-section-subtitle">考官抽签指定专题，请在下方自选一条线路/篇目，并在5分钟内完成现场英文专题讲解。</div>
        </div>
      </div>

      <!-- 考官抽专题 -->
      <div class="lottery-box">
        <div class="lottery-title">🎲 考官现场抽签专题</div>
        <div class="lottery-result-text">
          <span>🌿</span>
          <span>${escapeHtml(category)}</span>
        </div>
        <button class="lottery-spin-btn" id="btn-redraw-part1-category">🔄 重新抽签专题</button>
      </div>

      <!-- 考生自选线路/篇目 -->
      <div>
        <div style="font-size: 14.5px; font-weight: 700; color: var(--exam-text-dark); margin-bottom: 8px;">
          👉 请考生从【${escapeHtml(category)}】中自选本次讲解的线路/篇目：
        </div>
        <div class="topic-routes-grid">
          ${availableSpeeches.map(s => {
            const isSelected = selected && (selected.id === s.id || selected.name === s.name);
            const theme = s.outline?.theme || (s.sections && s.sections[0] ? s.sections[0].title : '');
            return `
              <div class="topic-route-card ${isSelected ? 'selected' : ''}" data-speech-id="${escapeHtml(s.id || s.name)}">
                <div class="topic-route-name">
                  <span>🚩 ${escapeHtml(s.name || s.id)}</span>
                  ${isSelected ? '<span style="color: var(--exam-green-main); font-size: 12px; font-weight: 800;">✓ 已选</span>' : ''}
                </div>
                ${theme ? `<div class="topic-route-theme">💡 ${escapeHtml(theme)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 三级提示控制区 -->
      <div class="hint-control-bar">
        <div class="hint-status-badge">
          ${examState.part1.hintLevel === 0 ? '🔒 当前状态：模拟闭卷现场演讲' :
            examState.part1.hintLevel === 1 ? '💡 已开启 (1/3)：考纲速记与考点提示' :
            examState.part1.hintLevel === 2 ? '🧩 已开启 (2/3)：关键词遮挡填空版原文' :
            '📖 已开启 (3/3)：中英双语完整原文'}
        </div>
        <button class="btn-get-hint ${examState.part1.hintLevel === 1 ? 'level-2' : examState.part1.hintLevel === 2 ? 'level-3' : ''}" id="btn-hint-part1">
          ${examState.part1.hintLevel === 0 ? '💡 获取提示 (1/3 考纲速记)' :
            examState.part1.hintLevel === 1 ? '🧩 再次获取提示 (2/3 关键词遮挡版)' :
            examState.part1.hintLevel === 2 ? '📖 再次获取提示 (3/3 完整中英原文)' :
            '✔️ 已展示全部提示内容'}
        </button>
      </div>

      <!-- 提示展示容器 -->
      <div class="hint-display-area" id="part1-hint-area">
        ${renderSpeechHints(selected, examState.part1.hintLevel)}
      </div>
    `;
  }

  // 阶段 2: 景区讲解
  function renderPart2Content() {
    const scenic = examState.part2.scenic;
    if (!scenic) return '<div>正在抽取景区...</div>';

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第二部分 · 占分 30%</span>
          <div class="exam-section-title">🏞️ 景区讲解 (Scenic Presentation)</div>
          <div class="exam-section-subtitle">抽取代表性景区，模拟现场带领游客游览并进行中英文景点讲解。</div>
        </div>
      </div>

      <div class="lottery-box">
        <div class="lottery-title">🎲 抽签抽取景区</div>
        <div class="lottery-result-text">
          <span>📍</span>
          <span>${escapeHtml(scenic.name || scenic.id)}</span>
        </div>
        <button class="lottery-spin-btn" id="btn-redraw-part2">🔄 重新抽签景区</button>
      </div>

      <!-- 三级提示控制区 -->
      <div class="hint-control-bar">
        <div class="hint-status-badge">
          ${examState.part2.hintLevel === 0 ? '🔒 当前状态：模拟闭卷现场演讲' :
            examState.part2.hintLevel === 1 ? '💡 已开启 (1/3)：考纲速记与动线考点' :
            examState.part2.hintLevel === 2 ? '🧩 已开启 (2/3)：关键词遮挡填空版原文' :
            '📖 已开启 (3/3)：中英双语完整原文'}
        </div>
        <button class="btn-get-hint ${examState.part2.hintLevel === 1 ? 'level-2' : examState.part2.hintLevel === 2 ? 'level-3' : ''}" id="btn-hint-part2">
          ${examState.part2.hintLevel === 0 ? '💡 获取提示 (1/3 考纲速记)' :
            examState.part2.hintLevel === 1 ? '🧩 再次获取提示 (2/3 关键词遮挡版)' :
            examState.part2.hintLevel === 2 ? '📖 再次获取提示 (3/3 完整中英原文)' :
            '✔️ 已展示全部提示内容'}
        </button>
      </div>

      <!-- 提示展示容器 -->
      <div class="hint-display-area" id="part2-hint-area">
        ${renderSpeechHints(scenic, examState.part2.hintLevel)}
      </div>
    `;
  }

  // 通用提示渲染函数 (支持 3 级阶梯式提示)
  function renderSpeechHints(speech, hintLevel) {
    if (!speech || hintLevel === 0) return '';

    let html = '';
    // 提示 Level 1: 考纲速记 (仅在 hintLevel === 1 时显示，第二次提示时被遮挡版替换)
    if (hintLevel === 1 && speech.outline) {
      html += `
        <div class="hint-tier-card hint-tier-outline">
          <div class="hint-tier-header" style="color: #92400e;">
            <span>📋 1/3 考纲速记与动线考点 (${escapeHtml(speech.outline.theme || '核心框架')})</span>
            <span style="font-size: 11px; font-weight: normal; background: #fef3c7; padding: 2px 8px; border-radius: 10px;">速记大纲</span>
          </div>
          ${speech.outline.route && speech.outline.route.length ? `
            <div style="font-size: 12.5px; color: #b45309; font-weight: 700; margin-bottom: 10px; background: #fffdf5; padding: 6px 10px; border-radius: 6px; border: 1px dashed #fcd34d;">
              🚩 游览动线：${speech.outline.route.map(r => escapeHtml(r)).join(' ➔ ')}
            </div>
          ` : ''}
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            ${(speech.outline.nodes || []).map(node => `
              <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #fde68a;">
                <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 4px;">${escapeHtml(node.name || '')}</div>
                <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">${escapeHtml(node.en || '')}</div>
                <div style="font-size: 11px; color: #d97706; display: flex; flex-wrap: wrap; gap: 4px;">
                  ${(node.kws || []).map(k => `<span>🏷️ ${escapeHtml(k)}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 提示 Level 2: 关键词遮挡版原文 (仅在 hintLevel === 2 时显示，hintLevel === 3 时被完整原文替换)
    if (hintLevel === 2) {
      html += `
        <div class="hint-tier-card hint-tier-cloze">
          <div class="hint-tier-header" style="color: #0369a1;">
            <span>🧩 2/3 关键词遮挡版原文 (点击填空槽可偷看关键词)</span>
            <span style="font-size: 11px; font-weight: normal; background: #e0f2fe; padding: 2px 8px; border-radius: 10px; color: #0284c7;">挖空自测</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            ${(speech.sections || []).map(sec => `
              <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
                ${sec.title ? `<div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 6px;">${escapeHtml(sec.title)}</div>` : ''}
                <div style="font-size: 13.5px; color: #1e293b; line-height: 1.7; margin-bottom: 6px;">
                  ${generateClozeHtml(sec.en || '', speech)}
                </div>
                <div style="font-size: 12px; color: #64748b; line-height: 1.5;">${escapeHtml(sec.cn || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 提示 Level 3: 完整原文 (直接替换掉第二次的遮挡版，精简长度)
    if (hintLevel === 3) {
      html += `
        <div class="hint-tier-card hint-tier-fulltext">
          <div class="hint-tier-header" style="color: #166534;">
            <span>📖 3/3 完整导游词中英双语对照</span>
            <span style="font-size: 11px; font-weight: normal; background: #dcfce7; padding: 2px 8px; border-radius: 10px;">原文全览</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            ${(speech.sections || []).map(sec => `
              <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0;">
                ${sec.title ? `<div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 6px;">${escapeHtml(sec.title)}</div>` : ''}
                <div style="font-size: 13px; color: #1e293b; line-height: 1.6; margin-bottom: 6px;">${escapeHtml(sec.en || '')}</div>
                <div style="font-size: 12px; color: #64748b; line-height: 1.5;">${escapeHtml(sec.cn || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  // 生成关键词遮挡版 HTML (采用占位符安全替换，彻底防止 HTML 标签二次破坏)
  function generateClozeHtml(text, speech) {
    if (!text) return '';

    let rawKeywords = [];
    if (speech && speech.outline && speech.outline.nodes) {
      speech.outline.nodes.forEach(node => {
        if (node.kws) {
          node.kws.forEach(kw => {
            const enPart = kw.replace(/[\u4e00-\u9fa5]/g, '').trim();
            if (enPart.length >= 3) rawKeywords.push(enPart);
          });
        }
      });
    }

    const wordList = text.match(/[A-Za-z]{4,}/g) || [];
    const stopWords = new Set([
      'welcome', 'tourists', 'morning', 'afternoon', 'evening', 'because', 'however',
      'although', 'between', 'through', 'during', 'another', 'located', 'there', 'their',
      'which', 'where', 'about', 'these', 'those', 'first', 'second', 'today', 'please'
    ]);

    wordList.forEach(w => {
      if (!stopWords.has(w.toLowerCase()) && !rawKeywords.includes(w)) {
        rawKeywords.push(w);
      }
    });

    // 过滤去重并按长度降序排序
    const keywords = [...new Set(rawKeywords)]
      .filter(k => k && k.length >= 3 && !/^[0-9]+$/.test(k))
      .sort((a, b) => b.length - a.length);

    let workingText = text;
    const placeholderMap = [];

    keywords.slice(0, 25).forEach(kw => {
      if (!kw || kw.length < 3) return;
      const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedKw})\\b`, 'gi');
      workingText = workingText.replace(regex, match => {
        const ph = `__CLOZE_PH_${placeholderMap.length}__`;
        placeholderMap.push(match);
        return ph;
      });
    });

    let safeHtml = escapeHtml(workingText);

    // 将占位符安全转换为 HTML 标签
    placeholderMap.forEach((origWord, idx) => {
      const ph = `__CLOZE_PH_${idx}__`;
      const maskSpan = `<span class="cloze-mask-blank" title="点击翻看答案" data-kw="${escapeHtml(origWord)}">______</span>`;
      safeHtml = safeHtml.replace(ph, maskSpan);
    });

    return safeHtml;
  }

  // 阶段 3: 知识问答 (纯英文题目，提供查看标准答案)
  function renderPart3Content() {
    const questions = examState.part3.questions || [];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第三部分 · 占分 25%</span>
          <div class="exam-section-title">📝 知识问答考核 (Q&A Interview)</div>
          <div class="exam-section-subtitle">考官现场全英文提问 3 题。请录音或打字作答，系统将实时打分，作答后可查阅标准答案。</div>
        </div>
      </div>

      <div class="qa-exam-list">
        ${questions.map((q, idx) => {
          const userAns = examState.part3.answers[q.id] || '';
          const scoreInfo = examState.part3.scores[q.id];
          const isShowAnswer = !!examState.part3.showAnswer[q.id];

          return `
            <div class="qa-exam-card" data-qid="${q.id}">
              <div class="qa-exam-q-header">
                <span class="qa-exam-q-num">QUESTION 0${idx + 1}</span>
                <span style="font-size: 12px; color: var(--exam-green-main); background: var(--exam-green-light); padding: 2px 8px; border-radius: 6px; font-weight: 600;">
                  ${escapeHtml(q.officialCategory || q.category || '业务知识')}
                </span>
              </div>

              <!-- 纯英文题目展示 (无中文干扰) -->
              <div class="qa-exam-q-text-en">${escapeHtml(q.enQuestion || q.question || '')}</div>

              <div class="qa-exam-input-area">
                <textarea class="qa-exam-textarea" id="qa-input-${q.id}" placeholder="请点击下方麦克风录音作答或直接打字输入您的答案...">${escapeHtml(userAns)}</textarea>
                <div class="qa-exam-ctrls">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="qa-voice-btn" id="qa-voice-${q.id}" data-qid="${q.id}">
                      <span>🎙️</span> <span>语音输入</span>
                    </button>
                    <button class="btn-qa-eval" id="qa-eval-btn-${q.id}" data-qid="${q.id}">
                      🎯 实时打分评测
                    </button>
                  </div>
                  <button class="btn-toggle-answer" id="qa-toggle-ans-${q.id}" data-qid="${q.id}">
                    ${isShowAnswer ? '🙈 收起标准答案' : '📖 查看标准答案'}
                  </button>
                </div>
              </div>

              <!-- 打分评测反馈 -->
              <div class="qa-eval-box" id="qa-eval-box-${q.id}" style="${scoreInfo ? 'display:block;' : 'display:none;'}">
                ${scoreInfo ? renderEvalResult(scoreInfo) : ''}
              </div>

              <!-- 官方标准答案展示 -->
              <div class="qa-standard-answer-box" id="qa-std-ans-${q.id}" style="${isShowAnswer ? 'display:block;' : 'display:none;'}">
                <div class="qa-standard-title">
                  <span>📋 官方参考标准答案</span>
                  <span style="font-size: 11px; font-weight: normal; color: #166534;">Standard Answer</span>
                </div>
                <div class="qa-standard-text-en">${escapeHtml(q.enAnswer || q.answer || '')}</div>
                ${q.cnAnswer ? `<div class="qa-standard-text-cn">${escapeHtml(q.cnAnswer)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 阶段 4: 口译测试 (提供原音播放、打分与参考译文)
  function renderPart4Content() {
    const translations = examState.part4.translations || [];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第四部分 · 占分 25%</span>
          <div class="exam-section-title">🗣️ 口译测试 (Interpretation)</div>
          <div class="exam-section-subtitle">双向现场口译测试。点击喇叭听题并录入译文，支持智能要点打分与参考译文查看。</div>
        </div>
      </div>

      <div class="qa-exam-list">
        ${translations.map((t, idx) => {
          const userAns = examState.part4.answers[t.id] || '';
          const scoreInfo = examState.part4.scores[t.id];
          const isShowAnswer = !!examState.part4.showAnswer[t.id];
          const isC2E = (t.type === 'C2E' || t.tag === '汉译英');

          return `
            <div class="qa-exam-card" data-tid="${t.id}">
              <div class="qa-exam-q-header">
                <span class="qa-exam-q-num">TASK 0${idx + 1}</span>
                <span style="font-size: 12px; color: ${isC2E ? '#b45309' : '#166534'}; background: ${isC2E ? '#fef3c7' : '#dcfce7'}; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                  ${isC2E ? '🇨🇳 汉译英' : '🇬🇧 英译中'}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="font-size: 16px; font-weight: 800; color: var(--exam-text-dark);">${escapeHtml(t.src || '')}</div>
                <button class="action-btn" style="padding: 4px 10px; font-size: 12px;" onclick="window.MockExam.playTts('${escapeHtml(t.src || '')}', '${isC2E ? 'zh-CN' : 'en-US'}')">
                  🔊 朗读原句
                </button>
              </div>

              <div class="qa-exam-input-area">
                <textarea class="qa-exam-textarea" id="trans-input-${t.id}" placeholder="请说出或键入您的译文...">${escapeHtml(userAns)}</textarea>
                <div class="qa-exam-ctrls">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="qa-voice-btn" id="trans-voice-${t.id}" data-tid="${t.id}" data-lang="${isC2E ? 'en-US' : 'zh-CN'}">
                      <span>🎙️</span> <span>语音输入</span>
                    </button>
                    <button class="btn-qa-eval" id="trans-eval-btn-${t.id}" data-tid="${t.id}">
                      🎯 实时打分评测
                    </button>
                  </div>
                  <button class="btn-toggle-answer" id="trans-toggle-ans-${t.id}" data-tid="${t.id}">
                    ${isShowAnswer ? '🙈 收起参考译文' : '📖 查看参考译文'}
                  </button>
                </div>
              </div>

              <!-- 打分评测反馈 -->
              <div class="qa-eval-box" id="trans-eval-box-${t.id}" style="${scoreInfo ? 'display:block;' : 'display:none;'}">
                ${scoreInfo ? renderEvalResult(scoreInfo) : ''}
              </div>

              <!-- 参考译文展示 -->
              <div class="qa-standard-answer-box" id="trans-std-ans-${t.id}" style="${isShowAnswer ? 'display:block;' : 'display:none;'}">
                <div class="qa-standard-title">
                  <span>📖 官方参考译文</span>
                  <span style="font-size: 11px; font-weight: normal; color: #166534;">Reference Translation</span>
                </div>
                <div class="qa-standard-text-en" style="font-size: 14px; font-weight: 700; color: #166534;">${escapeHtml(t.ref || t.answer || '')}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 阶段 5: 考生成绩单报告
  function renderReportView() {
    const p3Scores = Object.values(examState.part3.scores || {});
    const avgP3 = p3Scores.length ? Math.round(p3Scores.reduce((a, b) => a + (b.score || 0), 0) / p3Scores.length) : 0;

    const p4Scores = Object.values(examState.part4.scores || {});
    const avgP4 = p4Scores.length ? Math.round(p4Scores.reduce((a, b) => a + (b.score || 0), 0) / p4Scores.length) : 0;

    const p1Base = Math.max(10, 20 - (examState.part1.hintLevel * 3));
    const p2Base = Math.max(15, 30 - (examState.part2.hintLevel * 4));
    const p3Base = Math.round((avgP3 / 100) * 25);
    const p4Base = Math.round((avgP4 / 100) * 25);
    const totalScore = Math.max(0, Math.min(100, p1Base + p2Base + p3Base + p4Base));

    const totalSeconds = (examState.part1.timeSpent || 0) + (examState.part2.timeSpent || 0) +
                         (examState.part3.timeSpent || 0) + (examState.part4.timeSpent || 0);

    let rankTag = '良好 (Passed)';
    let rankColor = 'var(--exam-green-main)';
    if (totalScore >= 85) { rankTag = '优秀 (Excellent)'; rankColor = '#16a34a'; }
    else if (totalScore < 60) { rankTag = '待加强 (Need Practice)'; rankColor = '#dc2626'; }

    return `
      <div class="mock-exam-container">
        <div class="exam-report-card">
          <div class="report-header">
            <span class="exam-welcome-badge">EXAM RESULT TRANSCRIPT</span>
            <h1 class="report-title">🎉 全真模拟考试 · 成绩综合评估报告</h1>
            <div class="report-score-badge" style="color: ${rankColor};">
              ${totalScore} <span style="font-size: 16px; font-weight: normal; color: var(--exam-text-muted);">/ 100分</span>
            </div>
            <div style="margin-top: 8px; font-weight: 700; color: ${rankColor}; font-size: 15px;">综合评定：${rankTag}</div>
          </div>

          <div class="report-grid">
            <div class="report-item-box">
              <div class="report-item-title">⏱️ 考试总耗时</div>
              <div class="report-item-val">${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒</div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">🎙️ Part 1 专题讲解</div>
              <div class="report-item-val" style="font-size: 14.5px;">
                ${escapeHtml(examState.part1.category)} · ${escapeHtml(examState.part1.selectedSpeech?.name || '')}
                <div style="font-size: 11.5px; color: var(--exam-text-muted); font-weight: normal; margin-top: 2px;">求助提示: ${examState.part1.hintLevel}次</div>
              </div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">🏞️ Part 2 景区讲解</div>
              <div class="report-item-val" style="font-size: 14.5px;">
                ${escapeHtml(examState.part2.scenic?.name || '')}
                <div style="font-size: 11.5px; color: var(--exam-text-muted); font-weight: normal; margin-top: 2px;">求助提示: ${examState.part2.hintLevel}次</div>
              </div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">📝 Part 3 知识问答得分</div>
              <div class="report-item-val">${avgP3}分 <span style="font-size: 12px; color: var(--exam-text-muted); font-weight: normal;">(折合 ${p3Base}/25分)</span></div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">🗣️ Part 4 口译测试得分</div>
              <div class="report-item-val">${avgP4}分 <span style="font-size: 12px; color: var(--exam-text-muted); font-weight: normal;">(折合 ${p4Base}/25分)</span></div>
            </div>
          </div>

          <div style="background: var(--exam-green-subtle); border-radius: 12px; padding: 18px; border: 1px solid var(--exam-green-border); margin-bottom: 24px;">
            <div style="font-weight: 800; font-size: 14px; color: var(--exam-text-dark); margin-bottom: 8px;">💡 考官备考点评与提升建议：</div>
            <ul style="font-size: 13px; color: var(--exam-text-muted); line-height: 1.7; padding-left: 20px; margin: 0;">
              <li><strong>专题与自选篇目：</strong>围绕专题核心主旨，突出景点的文化或自然特色，保持流畅的英文表达。</li>
              <li><strong>知识问答：</strong>全英文提问时抓准关键词，结构清晰（Firstly, Secondly, Finally），要点命中率是提分关键。</li>
              <li><strong>双向口译：</strong>注重听辨与第一反应，遇到复杂定语从句可拆分为短句传达。</li>
            </ul>
          </div>

          <div style="text-align: center; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
            <button class="exam-start-btn" id="btn-restart-exam">🔄 再来一套真题模拟</button>
            <button class="btn-stage-action prev" id="btn-back-to-home" style="padding: 13px 28px; font-size: 15px;">返回考前准备</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindReportEvents() {
    const restartBtn = document.getElementById('btn-restart-exam');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        startSimulation();
      });
    }

    const homeBtn = document.getElementById('btn-back-to-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        examState.stage = 0;
        renderExamLayout();
      });
    }
  }

  // 绑定各阶段内的交互事件
  function bindStageEvents() {
    // 提前进入下一阶段
    const nextBtn = document.getElementById('btn-next-stage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        recordCurrentStageTime();
        if (examState.stage < 4) {
          startStage(examState.stage + 1);
        } else {
          finishExam();
        }
      });
    }

    // 退出模拟考
    const quitBtn = document.getElementById('btn-quit-exam');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        if (confirm('确认退出本次模拟考试吗？当前作答进度将不会保存。')) {
          if (examState.timerInterval) clearInterval(examState.timerInterval);
          examState.stage = 0;
          renderExamLayout();
        }
      });
    }

    // Part 1: 重新抽专题
    const redrawP1Cat = document.getElementById('btn-redraw-part1-category');
    if (redrawP1Cat) {
      redrawP1Cat.addEventListener('click', () => {
        drawPart1Category();
        examState.part1.hintLevel = 0;
        renderExamLayout();
      });
    }

    // Part 1: 考生自选线路/篇目卡片点击
    const topicCards = document.querySelectorAll('.topic-route-card');
    topicCards.forEach(card => {
      card.addEventListener('click', () => {
        const speechId = card.getAttribute('data-speech-id');
        if (!speechId || !window.data || !window.data.speeches) return;
        const target = window.data.speeches.find(s => (s.id === speechId || s.name === speechId));
        if (target) {
          examState.part1.selectedSpeech = target;
          examState.part1.hintLevel = 0;
          renderExamLayout();
        }
      });
    });

    // Part 1: 获取提示 (最多3次)
    const hintP1 = document.getElementById('btn-hint-part1');
    if (hintP1) {
      hintP1.addEventListener('click', () => {
        if (examState.part1.hintLevel < 3) {
          examState.part1.hintLevel++;
          renderExamLayout();
        }
      });
    }

    // Part 2: 重新抽景区
    const redrawP2 = document.getElementById('btn-redraw-part2');
    if (redrawP2) {
      redrawP2.addEventListener('click', () => {
        drawPart2Scenic();
        examState.part2.hintLevel = 0;
        renderExamLayout();
      });
    }

    // Part 2: 获取提示 (最多3次)
    const hintP2 = document.getElementById('btn-hint-part2');
    if (hintP2) {
      hintP2.addEventListener('click', () => {
        if (examState.part2.hintLevel < 3) {
          examState.part2.hintLevel++;
          renderExamLayout();
        }
      });
    }

    // 遮挡关键词填空槽点击偷看/收起
    document.querySelectorAll('.cloze-mask-blank').forEach(blank => {
      blank.addEventListener('click', e => {
        e.stopPropagation();
        const kw = blank.getAttribute('data-kw');
        if (blank.classList.contains('revealed')) {
          blank.classList.remove('revealed');
          blank.textContent = '______';
        } else {
          blank.classList.add('revealed');
          blank.textContent = kw;
        }
      });
    });

    // Part 3: 问答语音输入、打分 & 查看标准答案
    (examState.part3.questions || []).forEach(q => {
      const textarea = document.getElementById(`qa-input-${q.id}`);
      if (textarea) {
        textarea.addEventListener('input', () => {
          examState.part3.answers[q.id] = textarea.value;
        });
      }

      // 实时打分
      const evalBtn = document.getElementById(`qa-eval-btn-${q.id}`);
      if (evalBtn) {
        evalBtn.addEventListener('click', () => {
          const text = (textarea ? textarea.value : '') || '';
          const target = q.enAnswer || q.answer || q.cnAnswer || '';
          const res = evaluateAnswer(text, target);
          if (res) {
            examState.part3.scores[q.id] = res;
            const evalBox = document.getElementById(`qa-eval-box-${q.id}`);
            if (evalBox) {
              evalBox.innerHTML = renderEvalResult(res);
              evalBox.style.display = 'block';
            }
          }
        });
      }

      // 语音输入
      const voiceBtn = document.getElementById(`qa-voice-${q.id}`);
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          toggleSpeechRecognition(`qa-input-${q.id}`, voiceBtn, 'en-US');
        });
      }

      // 查看标准答案切换
      const toggleAnsBtn = document.getElementById(`qa-toggle-ans-${q.id}`);
      if (toggleAnsBtn) {
        toggleAnsBtn.addEventListener('click', () => {
          examState.part3.showAnswer[q.id] = !examState.part3.showAnswer[q.id];
          const stdBox = document.getElementById(`qa-std-ans-${q.id}`);
          if (stdBox) {
            stdBox.style.display = examState.part3.showAnswer[q.id] ? 'block' : 'none';
          }
          toggleAnsBtn.textContent = examState.part3.showAnswer[q.id] ? '🙈 收起标准答案' : '📖 查看标准答案';
        });
      }
    });

    // Part 4: 口译语音输入、打分 & 查看参考译文
    (examState.part4.translations || []).forEach(t => {
      const textarea = document.getElementById(`trans-input-${t.id}`);
      if (textarea) {
        textarea.addEventListener('input', () => {
          examState.part4.answers[t.id] = textarea.value;
        });
      }

      // 实时打分
      const evalBtn = document.getElementById(`trans-eval-btn-${t.id}`);
      if (evalBtn) {
        evalBtn.addEventListener('click', () => {
          const text = (textarea ? textarea.value : '') || '';
          const target = t.ref || t.answer || '';
          const res = evaluateAnswer(text, target);
          if (res) {
            examState.part4.scores[t.id] = res;
            const evalBox = document.getElementById(`trans-eval-box-${t.id}`);
            if (evalBox) {
              evalBox.innerHTML = renderEvalResult(res);
              evalBox.style.display = 'block';
            }
          }
        });
      }

      // 语音输入
      const voiceBtn = document.getElementById(`trans-voice-${t.id}`);
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          const lang = voiceBtn.getAttribute('data-lang') || 'en-US';
          toggleSpeechRecognition(`trans-input-${t.id}`, voiceBtn, lang);
        });
      }

      // 查看参考译文切换
      const toggleAnsBtn = document.getElementById(`trans-toggle-ans-${t.id}`);
      if (toggleAnsBtn) {
        toggleAnsBtn.addEventListener('click', () => {
          examState.part4.showAnswer[t.id] = !examState.part4.showAnswer[t.id];
          const stdBox = document.getElementById(`trans-std-ans-${t.id}`);
          if (stdBox) {
            stdBox.style.display = examState.part4.showAnswer[t.id] ? 'block' : 'none';
          }
          toggleAnsBtn.textContent = examState.part4.showAnswer[t.id] ? '🙈 收起参考译文' : '📖 查看参考译文';
        });
      }
    });
  }

  function finishExam() {
    if (examState.timerInterval) clearInterval(examState.timerInterval);
    recordCurrentStageTime();
    examState.stage = 5;
    renderExamLayout();
  }

  // 智能答案要点打分算法
  function evaluateAnswer(userText, targetAnswer) {
    if (!userText || !userText.trim() || !targetAnswer) {
      return {
        score: 0,
        hitCount: 0,
        totalCount: 1,
        hitKeywords: [],
        missKeywords: ['(尚未检测到有效作答内容)']
      };
    }

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

  function renderEvalResult(result) {
    let color = 'var(--exam-green-main)';
    if (result.score < 50) color = '#dc2626';
    else if (result.score < 80) color = '#d97706';

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-weight: 700; color: var(--exam-text-dark);">🎯 智能匹配得分</span>
        <span style="font-size: 14px; font-weight: 800; color: ${color};">${result.score}分 (命中 ${result.hitCount}/${result.totalCount} 核心要素)</span>
      </div>
    `;

    if (result.hitKeywords && result.hitKeywords.length) {
      html += `<div style="font-size: 12px; margin-bottom: 4px; line-height: 1.6;">✅ <strong>命中要素:</strong> ${result.hitKeywords.slice(0, 8).map(k => `<span style="display:inline-block; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:1px 6px; border-radius:4px; margin:2px;">${escapeHtml(k)}</span>`).join('')}</div>`;
    }
    if (result.missKeywords && result.missKeywords.length) {
      html += `<div style="font-size: 12px; line-height: 1.6;">💡 <strong>建议对照补充:</strong> ${result.missKeywords.slice(0, 8).map(k => `<span style="display:inline-block; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:1px 6px; border-radius:4px; margin:2px;">${escapeHtml(k)}</span>`).join('')}</div>`;
    }

    return html;
  }

  // 语音识别控制
  function toggleSpeechRecognition(textareaId, buttonEl, lang) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器暂不支持实时语音识别，推荐使用 Chrome / Edge 浏览器。');
      return;
    }

    if (examState.recognition) {
      examState.recognition.stop();
      examState.recognition = null;
      buttonEl.classList.remove('recording');
      buttonEl.innerHTML = '<span>🎙️</span> <span>语音输入</span>';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    const textarea = document.getElementById(textareaId);
    let baseText = textarea ? textarea.value : '';

    recognition.onstart = () => {
      buttonEl.classList.add('recording');
      buttonEl.innerHTML = '<span>⏹️</span> <span>正在聆听...</span>';
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript && textarea) {
        textarea.value = (baseText ? baseText + ' ' : '') + finalTranscript;
        textarea.dispatchEvent(new Event('input'));
      }
    };

    recognition.onerror = (err) => {
      console.warn('Speech recognition error:', err);
      recognition.stop();
    };

    recognition.onend = () => {
      examState.recognition = null;
      buttonEl.classList.remove('recording');
      buttonEl.innerHTML = '<span>🎙️</span> <span>语音输入</span>';
    };

    examState.recognition = recognition;
    recognition.start();
  }

  // 朗读原句 (TTS)
  function playTts(text, lang) {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || 'en-US';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 暴露给全局
  window.MockExam = {
    init: initMockExam,
    playTts: playTts
  };

})();
