/**
 * 全真模拟考场模块 (Mock Exam Engine)
 * 独立隔离，不影响其他已有功能模块
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
    recordingId: null,

    // 各阶段数据
    part1: {
      topic: null,
      hintLevel: 0, // 0: 无, 1: 考纲速记, 2: 原文
      timeSpent: 0
    },
    part2: {
      scenic: null,
      selectedRoute: '',
      hintLevel: 0,
      timeSpent: 0
    },
    part3: {
      questions: [],
      answers: {},
      scores: {},
      timeSpent: 0
    },
    part4: {
      translations: [],
      answers: {},
      scores: {},
      timeSpent: 0
    }
  };

  const STAGE_CONFIG = [
    { id: 0, title: '考前准备', subtitle: '了解规则并就绪' },
    { id: 1, title: '专题讲解', subtitle: '抽选专题·即兴表达 (5分钟)' },
    { id: 2, title: '景区讲解', subtitle: '抽取景区·选择线路 (5分钟)' },
    { id: 3, title: '知识问答', subtitle: '随机3题·语音/文本作答 (5分钟)' },
    { id: 4, title: '口译测试', subtitle: '英汉双向口译测试 (5分钟)' },
    { id: 5, title: '考生成绩单', subtitle: '全真模拟考核综合报告' }
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
            完全模拟全国导游资格考试现场口试流程。全流程分为 4 个考核部分，每个部分独立严格限时 <strong>5 分钟（300秒）</strong>，到时自动进入下一项，亦支持提前提交。
          </p>

          <div class="exam-stages-grid">
            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>01. 专题讲解</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">模拟随机抽取专题（历史/民族/风物/山水/长寿），考核专题阐述与应变能力。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>02. 景区讲解</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">抽取代表性景区并选择游览线路。支持两级求助提示（考纲速记与全文对照）。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>03. 知识问答</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">考官随机现场提问 3 题。支持普通话/英语实时语音识别与智能要点打分。</div>
            </div>

            <div class="stage-preview-card">
              <div class="stage-preview-title">
                <span>04. 口译测试</span>
                <span class="stage-preview-time">5:00</span>
              </div>
              <div class="stage-preview-desc">英汉双向口译测试，支持原声音频朗读试听与译文精准度要点比对。</div>
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
    // 重置所有数据
    examState.stage = 1;
    examState.part1 = { topic: null, hintLevel: 0, timeSpent: 0 };
    examState.part2 = { scenic: null, selectedRoute: '', hintLevel: 0, timeSpent: 0 };
    examState.part3 = { questions: [], answers: {}, scores: {}, timeSpent: 0 };
    examState.part4 = { translations: [], answers: {}, scores: {}, timeSpent: 0 };

    // 抽签初始化
    drawPart1Topic();
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

      // 更新计时时钟
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

      // 时间到，自动切到下一个阶段
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
      alert(`⏰ 本阶段5分钟时间已到，系统自动进入下一阶段！`);
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
  function drawPart1Topic() {
    if (!window.data || !window.data.speeches) return;
    const topics = window.data.speeches.filter(s => s.category !== '景区讲解');
    if (topics.length > 0) {
      const idx = Math.floor(Math.random() * topics.length);
      examState.part1.topic = topics[idx];
    }
  }

  function drawPart2Scenic() {
    if (!window.data || !window.data.speeches) return;
    const scenics = window.data.speeches.filter(s => s.category === '景区讲解');
    if (scenics.length > 0) {
      const idx = Math.floor(Math.random() * scenics.length);
      const scenic = scenics[idx];
      examState.part2.scenic = scenic;
      // 默认选中第一条线路
      if (scenic.outline && scenic.outline.route && scenic.outline.route.length > 0) {
        examState.part2.selectedRoute = `标准游览动线 (${scenic.outline.route.join(' ➔ ')})`;
      } else {
        examState.part2.selectedRoute = '全景核心精讲路线';
      }
    }
  }

  function drawPart3Questions() {
    if (!window.data || !window.data.questions) return;
    const all = [...window.data.questions];
    // 随机洗牌取 3 题
    all.sort(() => 0.5 - Math.random());
    examState.part3.questions = all.slice(0, 3);
  }

  function drawPart4Translations() {
    if (!window.data || !window.data.translations) return;
    const c2eList = window.data.translations.filter(t => t.type === 'C2E' || t.tag === '汉译英');
    const e2cList = window.data.translations.filter(t => t.type === 'E2C' || t.tag === '英译中');

    c2eList.sort(() => 0.5 - Math.random());
    e2cList.sort(() => 0.5 - Math.random());

    // 抽 1 道汉译英 + 1 道英译汉 (共2题)
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

  // 阶段 1: 专题讲解
  function renderPart1Content() {
    const topic = examState.part1.topic;
    if (!topic) return '<div>正在抽取专题...</div>';

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第一部分 · 占分 20%</span>
          <div class="exam-section-title">🎙️ 专题讲解 (Topic Presentation)</div>
          <div class="exam-section-subtitle">抽签确定专题，请在5分钟内组织语言并完成现场脱稿英文专题讲解。</div>
        </div>
      </div>

      <div class="lottery-box">
        <div class="lottery-title">🎲 考生现场抽签结果</div>
        <div class="lottery-result-text">
          <span>🏷️</span>
          <span>${escapeHtml(topic.name || topic.id)}</span>
          <span style="font-size: 14px; background: #e0e7ff; color: #3730a3; padding: 2px 10px; border-radius: 20px;">${escapeHtml(topic.category || '专题')}</span>
        </div>
        <button class="lottery-spin-btn" id="btn-redraw-part1">🔄 重新抽签换题</button>
      </div>

      <!-- 两级提示控制区 -->
      <div class="hint-control-bar">
        <div class="hint-status-badge">
          ${examState.part1.hintLevel === 0 ? '🔒 当前状态：模拟闭卷现场演讲' :
            examState.part1.hintLevel === 1 ? '💡 已开启：考纲速记与考点提示' : '📖 已展开：中英双语完整原文'}
        </div>
        <button class="btn-get-hint ${examState.part1.hintLevel === 1 ? 'level-2' : ''}" id="btn-hint-part1">
          ${examState.part1.hintLevel === 0 ? '💡 获取提示 (考纲速记)' :
            examState.part1.hintLevel === 1 ? '📖 再次获取提示 (中英原文)' : '✔️ 已展示全部提示内容'}
        </button>
      </div>

      <!-- 提示展示容器 -->
      <div class="hint-display-area" id="part1-hint-area">
        ${renderPart1Hints(topic)}
      </div>
    `;
  }

  function renderPart1Hints(topic) {
    if (examState.part1.hintLevel === 0) return '';

    let html = '';
    // 提示 Level 1: 考纲速记
    if (examState.part1.hintLevel >= 1 && topic.outline) {
      html += `
        <div class="hint-tier-card hint-tier-outline">
          <div class="hint-tier-header" style="color: #92400e;">
            <span>📋 考纲速记与考点关键词 (${escapeHtml(topic.outline.theme || '核心逻辑')})</span>
            <span style="font-size: 11px; font-weight: normal; background: #fef3c7; padding: 2px 8px; border-radius: 10px;">速记模式</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 8px;">
            ${(topic.outline.nodes || []).map(node => `
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

    // 提示 Level 2: 完整原文
    if (examState.part1.hintLevel >= 2) {
      html += `
        <div class="hint-tier-card hint-tier-fulltext">
          <div class="hint-tier-header" style="color: #166534;">
            <span>📖 专题完整导游词中英对照</span>
            <span style="font-size: 11px; font-weight: normal; background: #dcfce7; padding: 2px 8px; border-radius: 10px;">原文模式</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            ${(topic.sections || []).map(sec => `
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

  // 阶段 2: 景区讲解
  function renderPart2Content() {
    const scenic = examState.part2.scenic;
    if (!scenic) return '<div>正在抽取景区...</div>';

    const routeList = (scenic.outline && scenic.outline.route && scenic.outline.route.length > 0)
      ? [
          { id: 'route-1', title: '标准全景游览线路 (推荐)', path: scenic.outline.route.join(' ➔ ') },
          { id: 'route-2', title: '核心精华精讲路线', path: scenic.outline.route.slice(1, 3).join(' ➔ ') || scenic.outline.route.join(' ➔ ') }
        ]
      : [
          { id: 'route-1', title: '经典全景游览路线', path: '景区大门/游客中心 ➔ 核心观景点 ➔ 历史文化展示区 ➔ 欢送返程' }
        ];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第二部分 · 占分 30%</span>
          <div class="exam-section-title">🏞️ 景区讲解 (Scenic Presentation)</div>
          <div class="exam-section-subtitle">抽取景区与讲解路线，模拟现场带领游客游览并进行中英文景点讲解。</div>
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

      <!-- 线路选择 -->
      <div>
        <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">🚩 请选择本次模拟讲解的游览线路：</div>
        <div class="route-selector-group" id="scenic-route-selector">
          ${routeList.map((r, idx) => `
            <label class="route-option-card ${idx === 0 ? 'selected' : ''}" data-route="${escapeHtml(r.title + ': ' + r.path)}">
              <input type="radio" name="exam_scenic_route" class="route-option-radio" ${idx === 0 ? 'checked' : ''} value="${escapeHtml(r.title)}">
              <div class="route-option-info">
                <div class="route-option-title">${escapeHtml(r.title)}</div>
                <div class="route-option-path">${escapeHtml(r.path)}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- 两级提示控制区 -->
      <div class="hint-control-bar">
        <div class="hint-status-badge">
          ${examState.part2.hintLevel === 0 ? '🔒 当前状态：模拟闭卷现场演讲' :
            examState.part2.hintLevel === 1 ? '💡 已开启：考纲速记与动线考点' : '📖 已展开：中英双语完整原文'}
        </div>
        <button class="btn-get-hint ${examState.part2.hintLevel === 1 ? 'level-2' : ''}" id="btn-hint-part2">
          ${examState.part2.hintLevel === 0 ? '💡 获取提示 (考纲速记)' :
            examState.part2.hintLevel === 1 ? '📖 再次获取提示 (中英原文)' : '✔️ 已展示全部提示内容'}
        </button>
      </div>

      <!-- 提示展示容器 -->
      <div class="hint-display-area" id="part2-hint-area">
        ${renderPart2Hints(scenic)}
      </div>
    `;
  }

  function renderPart2Hints(scenic) {
    if (examState.part2.hintLevel === 0) return '';

    let html = '';
    // 提示 Level 1: 考纲速记
    if (examState.part2.hintLevel >= 1 && scenic.outline) {
      html += `
        <div class="hint-tier-card hint-tier-outline">
          <div class="hint-tier-header" style="color: #92400e;">
            <span>📋 景区动线流程与考点关键词 (${escapeHtml(scenic.outline.theme || '核心看点')})</span>
            <span style="font-size: 11px; font-weight: normal; background: #fef3c7; padding: 2px 8px; border-radius: 10px;">速记大纲</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 8px;">
            ${(scenic.outline.nodes || []).map(node => `
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

    // 提示 Level 2: 完整原文
    if (examState.part2.hintLevel >= 2) {
      html += `
        <div class="hint-tier-card hint-tier-fulltext">
          <div class="hint-tier-header" style="color: #166534;">
            <span>📖 景区完整中英双语对照原文</span>
            <span style="font-size: 11px; font-weight: normal; background: #dcfce7; padding: 2px 8px; border-radius: 10px;">原文模式</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            ${(scenic.sections || []).map(sec => `
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

  // 阶段 3: 知识问答
  function renderPart3Content() {
    const questions = examState.part3.questions || [];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第三部分 · 占分 25%</span>
          <div class="exam-section-title">📝 知识问答考核 (Q&A Interview)</div>
          <div class="exam-section-subtitle">考官现场随机提问 3 题。请点击麦克风录音作答或打字输入，系统将实时进行要点打分。</div>
        </div>
      </div>

      <div class="qa-exam-list">
        ${questions.map((q, idx) => {
          const userAns = examState.part3.answers[q.id] || '';
          const scoreInfo = examState.part3.scores[q.id];
          return `
            <div class="qa-exam-card" data-qid="${q.id}">
              <div class="qa-exam-q-header">
                <span class="qa-exam-q-num">QUESTION 0${idx + 1}</span>
                <span style="font-size: 12px; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 6px;">${escapeHtml(q.officialCategory || q.category || '知识问答')}</span>
              </div>
              <div class="qa-exam-q-text-en">${escapeHtml(q.enQuestion || q.question || '')}</div>
              <div class="qa-exam-q-text-cn">${escapeHtml(q.cnQuestion || '')}</div>

              <div class="qa-exam-input-area">
                <textarea class="qa-exam-textarea" id="qa-input-${q.id}" placeholder="请点击下方麦克风录音作答或直接打字输入您的答案...">${escapeHtml(userAns)}</textarea>
                <div class="qa-exam-ctrls">
                  <button class="qa-voice-btn" id="qa-voice-${q.id}" data-qid="${q.id}">
                    <span>🎙️</span> <span>语音输入</span>
                  </button>
                  <button class="action-btn active" style="padding: 6px 16px; font-size: 12.5px;" id="qa-eval-btn-${q.id}" data-qid="${q.id}">
                    🎯 实时打分评测
                  </button>
                </div>
              </div>

              <div class="qa-eval-box" id="qa-eval-box-${q.id}" style="${scoreInfo ? 'display:block;' : 'display:none;'}">
                ${scoreInfo ? renderEvalResult(scoreInfo) : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 阶段 4: 口译测试
  function renderPart4Content() {
    const translations = examState.part4.translations || [];

    return `
      <div class="exam-section-header">
        <div>
          <span class="exam-section-tag">第四部分 · 占分 25%</span>
          <div class="exam-section-title">🗣️ 口译测试 (Interpretation)</div>
          <div class="exam-section-subtitle">双向现场口译测试。请点击喇叭听题，录入翻译并打分。</div>
        </div>
      </div>

      <div class="qa-exam-list">
        ${translations.map((t, idx) => {
          const userAns = examState.part4.answers[t.id] || '';
          const scoreInfo = examState.part4.scores[t.id];
          const isC2E = (t.type === 'C2E' || t.tag === '汉译英');
          return `
            <div class="qa-exam-card" data-tid="${t.id}">
              <div class="qa-exam-q-header">
                <span class="qa-exam-q-num">TASK 0${idx + 1}</span>
                <span style="font-size: 12px; color: ${isC2E ? '#b45309' : '#047857'}; background: ${isC2E ? '#fef3c7' : '#ecfdf5'}; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                  ${isC2E ? '🇨🇳 汉译英' : '🇬🇧 英译中'}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(t.src || '')}</div>
                <button class="action-btn" style="padding: 4px 10px; font-size: 12px;" onclick="window.MockExam.playTts('${escapeHtml(t.src || '')}', '${isC2E ? 'zh-CN' : 'en-US'}')">
                  🔊 朗读原句
                </button>
              </div>

              <div class="qa-exam-input-area">
                <textarea class="qa-exam-textarea" id="trans-input-${t.id}" placeholder="请说出或键入您的译文...">${escapeHtml(userAns)}</textarea>
                <div class="qa-exam-ctrls">
                  <button class="qa-voice-btn" id="trans-voice-${t.id}" data-tid="${t.id}" data-lang="${isC2E ? 'en-US' : 'zh-CN'}">
                    <span>🎙️</span> <span>语音输入</span>
                  </button>
                  <button class="action-btn active" style="padding: 6px 16px; font-size: 12.5px;" id="trans-eval-btn-${t.id}" data-tid="${t.id}">
                    🎯 实时打分评测
                  </button>
                </div>
              </div>

              <div class="qa-eval-box" id="trans-eval-box-${t.id}" style="${scoreInfo ? 'display:block;' : 'display:none;'}">
                ${scoreInfo ? renderEvalResult(scoreInfo) : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 阶段 5: 考生成绩单报告
  function renderReportView() {
    // 计算统计分数
    const p3Scores = Object.values(examState.part3.scores || {});
    const avgP3 = p3Scores.length ? Math.round(p3Scores.reduce((a, b) => a + (b.score || 0), 0) / p3Scores.length) : 0;

    const p4Scores = Object.values(examState.part4.scores || {});
    const avgP4 = p4Scores.length ? Math.round(p4Scores.reduce((a, b) => a + (b.score || 0), 0) / p4Scores.length) : 0;

    // 综合预估得分 (满分100)
    // Part1 (20) + Part2 (30) + Part3 (25) + Part4 (25)
    // 提示扣分：Part1 每级扣 3分，Part2 每级扣 3分
    const p1Base = 20 - (examState.part1.hintLevel * 3);
    const p2Base = 30 - (examState.part2.hintLevel * 4);
    const p3Base = Math.round((avgP3 / 100) * 25);
    const p4Base = Math.round((avgP4 / 100) * 25);
    const totalScore = Math.max(0, Math.min(100, p1Base + p2Base + p3Base + p4Base));

    const totalSeconds = (examState.part1.timeSpent || 0) + (examState.part2.timeSpent || 0) +
                         (examState.part3.timeSpent || 0) + (examState.part4.timeSpent || 0);

    let rankTag = '良好 (Passed)';
    let rankColor = '#2563eb';
    if (totalScore >= 85) { rankTag = '优秀 (Excellent)'; rankColor = '#16a34a'; }
    else if (totalScore < 60) { rankTag = '待加强 (Need Practice)'; rankColor = '#dc2626'; }

    return `
      <div class="mock-exam-container">
        <div class="exam-report-card">
          <div class="report-header">
            <span class="exam-welcome-badge">EXAM RESULT TRANSCRIPT</span>
            <h1 class="report-title">🎉 全真模拟考试 · 成绩综合评估报告</h1>
            <div class="report-score-badge" style="color: ${rankColor};">
              ${totalScore} <span style="font-size: 16px; font-weight: normal; color: #64748b;">/ 100分</span>
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
              <div class="report-item-val" style="font-size: 15px;">
                ${escapeHtml(examState.part1.topic?.name || '无')}
                <span style="font-size: 12px; color: #64748b; font-weight: normal;">(求助提示: ${examState.part1.hintLevel}次)</span>
              </div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">🏞️ Part 2 景区讲解</div>
              <div class="report-item-val" style="font-size: 15px;">
                ${escapeHtml(examState.part2.scenic?.name || '无')}
                <span style="font-size: 12px; color: #64748b; font-weight: normal;">(求助提示: ${examState.part2.hintLevel}次)</span>
              </div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">📝 Part 3 知识问答得分</div>
              <div class="report-item-val">${avgP3}分 <span style="font-size: 12px; color: #64748b; font-weight: normal;">(折合 ${p3Base}/25分)</span></div>
            </div>

            <div class="report-item-box">
              <div class="report-item-title">🗣️ Part 4 口译测试得分</div>
              <div class="report-item-val">${avgP4}分 <span style="font-size: 12px; color: #64748b; font-weight: normal;">(折合 ${p4Base}/25分)</span></div>
            </div>
          </div>

          <div style="background: #f8fafc; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
            <div style="font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px;">💡 考官备考点评与提升建议：</div>
            <ul style="font-size: 13px; color: #475569; line-height: 1.7; padding-left: 20px; margin: 0;">
              <li><strong>专题与景区：</strong>尽量减少对速记提示和原文的依赖，牢记“起承转合”骨架节点与专有名词。</li>
              <li><strong>知识问答：</strong>注意条理性（First, Second, Finally），关键法规与应急流程词汇需精准命中。</li>
              <li><strong>口译测试：</strong>重在核心信息传达与流畅度，遇生词时可采取同义解释策略。</li>
            </ul>
          </div>

          <div style="text-align: center; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
            <button class="exam-start-btn" id="btn-restart-exam">🔄 再来一套真题模拟</button>
            <button class="btn-stage-action prev" id="btn-back-to-home" style="padding: 14px 28px; font-size: 15px;">返回首页</button>
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

    // Part 1: 重新抽题
    const redrawP1 = document.getElementById('btn-redraw-part1');
    if (redrawP1) {
      redrawP1.addEventListener('click', () => {
        drawPart1Topic();
        examState.part1.hintLevel = 0;
        renderExamLayout();
      });
    }

    // Part 1: 获取提示
    const hintP1 = document.getElementById('btn-hint-part1');
    if (hintP1) {
      hintP1.addEventListener('click', () => {
        if (examState.part1.hintLevel < 2) {
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

    // Part 2: 线路选择单选
    const routeCards = document.querySelectorAll('.route-option-card');
    routeCards.forEach(card => {
      card.addEventListener('click', () => {
        routeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        examState.part2.selectedRoute = card.getAttribute('data-route') || '';
      });
    });

    // Part 2: 获取提示
    const hintP2 = document.getElementById('btn-hint-part2');
    if (hintP2) {
      hintP2.addEventListener('click', () => {
        if (examState.part2.hintLevel < 2) {
          examState.part2.hintLevel++;
          renderExamLayout();
        }
      });
    }

    // Part 3: 问答语音输入 & 实时打分
    (examState.part3.questions || []).forEach(q => {
      const textarea = document.getElementById(`qa-input-${q.id}`);
      if (textarea) {
        textarea.addEventListener('input', () => {
          examState.part3.answers[q.id] = textarea.value;
        });
      }

      const evalBtn = document.getElementById(`qa-eval-btn-${q.id}`);
      if (evalBtn) {
        evalBtn.addEventListener('click', () => {
          const text = (textarea ? textarea.value : '') || '';
          const target = q.answer || q.enAnswer || q.cnAnswer || '';
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

      const voiceBtn = document.getElementById(`qa-voice-${q.id}`);
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          toggleSpeechRecognition(`qa-input-${q.id}`, voiceBtn, 'en-US');
        });
      }
    });

    // Part 4: 口译语音输入 & 实时打分
    (examState.part4.translations || []).forEach(t => {
      const textarea = document.getElementById(`trans-input-${t.id}`);
      if (textarea) {
        textarea.addEventListener('input', () => {
          examState.part4.answers[t.id] = textarea.value;
        });
      }

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

      const voiceBtn = document.getElementById(`trans-voice-${t.id}`);
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          const lang = voiceBtn.getAttribute('data-lang') || 'en-US';
          toggleSpeechRecognition(`trans-input-${t.id}`, voiceBtn, lang);
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
        missKeywords: ['(尚未输入有效作答内容)']
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
    let color = '#16a34a';
    if (result.score < 50) color = '#dc2626';
    else if (result.score < 80) color = '#d97706';

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-weight: 700; color: #1e293b;">🎯 智能匹配得分</span>
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
        // 触发 input 事件更新状态
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
