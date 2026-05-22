// 状态管理
const state = {
  currentCourse: null,
  practiceMode: 'sentences', // 'sentences' | 'words'
  currentIndex: 0,
  combo: 0,
  maxCombo: 0,
  correct: 0,
  total: 0,
  startTime: null,
  isProcessing: false,
  wordPhase: 'show', // 'show' | 'type' — 词汇练习：先显示，再输入
  currentWord: null,
  answerRevealed: false, // 答案是否已显示
};

// 本地存储
const storage = {
  get(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

// 获取历史数据
function getHistory() {
  return storage.get('julebu_history', { sessions: [], totalPracticed: 0, totalCorrect: 0, maxCombo: 0 });
}

function saveHistory(result) {
  const history = getHistory();
  history.sessions.unshift(result);
  if (history.sessions.length > 50) history.sessions = history.sessions.slice(0, 50);
  history.totalPracticed += result.total;
  history.totalCorrect += result.correct;
  if (result.maxCombo > history.maxCombo) history.maxCombo = result.maxCombo;
  storage.set('julebu_history', history);
}

// 页面切换
function showLanding() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('landing').classList.add('active');
}

function showPractice() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('practice').classList.add('active');
  document.getElementById('course-select').classList.remove('hidden');
  document.getElementById('practice-area').classList.add('hidden');
  document.getElementById('practice-result').classList.add('hidden');
  renderCourses();
}

function showProgress() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('progress').classList.add('active');
  renderProgress();
}

// 渲染课程列表
function renderCourses() {
  const grid = document.getElementById('course-grid');

  const groups = {};
  COURSES.forEach(course => {
    if (!groups[course.level]) groups[course.level] = [];
    groups[course.level].push(course);
  });

  const groupOrder = ['每周过关', '过渡单元', '正式单元', '下册'];
  let html = '';

  groupOrder.forEach(level => {
    if (!groups[level]) return;
    const titleClass = level === '每周过关' ? 'course-group-title weekly-title' : 'course-group-title';
    html += `<div class="course-group"><div class="${titleClass}">${level}</div><div class="course-group-grid">`;
    groups[level].forEach(course => {
      html += `
        <div class="course-card">
          <div class="course-card-header">
            <h3>${course.name}</h3>
            ${course.level === '每周过关' ? '<span class="course-badge weekly-badge">本周</span>' : ''}
          </div>
          <div class="course-desc">${course.desc}</div>
          <div class="course-actions">
            <button class="btn-mode btn-sentence" onclick="startCourse('${course.id}', 'sentences')">
              句子练习 (${course.sentences.length}句)
            </button>
            <button class="btn-mode btn-word" onclick="startCourse('${course.id}', 'words')">
              词汇练习 (${course.words.length}词)
            </button>
          </div>
        </div>
      `;
    });
    html += '</div></div>';
  });

  grid.innerHTML = html;
}

// 每周过关快捷入口
function startWeeklyChallenge(courseId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('practice').classList.add('active');
  startCourse(courseId, 'words');
}

// 开始课程
function startCourse(courseId, mode) {
  const course = COURSES.find(c => c.id === courseId);
  if (!course) return;

  state.currentCourse = course;
  state.practiceMode = mode;
  state.currentIndex = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.correct = 0;
  state.total = 0;
  state.startTime = Date.now();
  state.isProcessing = false;

  document.getElementById('course-select').classList.add('hidden');
  document.getElementById('practice-area').classList.remove('hidden');
  document.getElementById('practice-result').classList.add('hidden');

  if (mode === 'sentences') {
    loadSentence();
  } else {
    loadWord();
  }
}

// ========== 句子练习 ==========

function loadSentence() {
  const course = state.currentCourse;
  if (!course || state.currentIndex >= course.sentences.length) {
    finishPractice();
    return;
  }

  const sentence = course.sentences[state.currentIndex];
  const hintEl = document.getElementById('sentence-hint');
  const targetEl = document.getElementById('sentence-target');
  const inputEl = document.getElementById('typing-input');
  const feedbackEl = document.getElementById('feedback');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  hintEl.textContent = sentence.hint;
  document.getElementById('word-info').classList.add('hidden');

  // 显示读音按钮
  document.getElementById('btn-speak').classList.remove('hidden');

  // 隐藏英文，只显示占位下划线
  state.answerRevealed = false;
  targetEl.innerHTML = `<span class="word-blank">${'_ '.repeat(sentence.target.length).trim()}</span>`;

  inputEl.value = '';
  inputEl.className = '';
  inputEl.placeholder = '在这里输入英文句子... (Ctrl+; 显示答案)';
  inputEl.focus();
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  progressFill.style.width = `${(state.currentIndex / course.sentences.length) * 100}%`;
  progressText.textContent = `${state.currentIndex + 1}/${course.sentences.length}`;

  state.isProcessing = false;
}

// ========== 词汇练习 ==========

function loadWord() {
  const course = state.currentCourse;
  if (!course || state.currentIndex >= course.words.length) {
    finishPractice();
    return;
  }

  const word = course.words[state.currentIndex];
  state.currentWord = word;
  state.wordPhase = 'type';

  const hintEl = document.getElementById('sentence-hint');
  const targetEl = document.getElementById('sentence-target');
  const inputEl = document.getElementById('typing-input');
  const feedbackEl = document.getElementById('feedback');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const wordInfo = document.getElementById('word-info');

  // 只显示中文释义
  hintEl.textContent = word.meaning;

  // 隐藏英文单词展示
  wordInfo.classList.add('hidden');

  // 显示读音按钮
  document.getElementById('btn-speak').classList.remove('hidden');

  // 隐藏英文，只显示占位下划线
  state.answerRevealed = false;
  targetEl.innerHTML = `<span class="word-blank">${'_ '.repeat(word.word.length).trim()}</span>`;

  inputEl.value = '';
  inputEl.className = '';
  inputEl.placeholder = '请输入英文单词... (Ctrl+; 显示答案)';
  inputEl.focus();
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  progressFill.style.width = `${(state.currentIndex / course.words.length) * 100}%`;
  progressText.textContent = `${state.currentIndex + 1}/${course.words.length}`;

  state.isProcessing = false;
}

// ========== 读音功能 ==========

function speakWord() {
  let text = '';
  if (state.practiceMode === 'sentences') {
    const sentence = state.currentCourse.sentences[state.currentIndex];
    if (!sentence) return;
    text = sentence.target;
  } else {
    if (!state.currentWord) return;
    text = state.currentWord.word;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// ========== 通用逻辑 ==========

// 实时字符检查
function checkInput() {
  const inputEl = document.getElementById('typing-input');
  const targetEl = document.getElementById('sentence-target');
  const input = inputEl.value;

  let target;
  if (state.practiceMode === 'sentences') {
    target = state.currentCourse.sentences[state.currentIndex].target;
  } else {
    target = state.currentWord.word;
  }

  let chars = targetEl.querySelectorAll('.word-blank-char');
  // 首次输入时，从下划线占位切换到字符格
  if (chars.length === 0) {
    targetEl.innerHTML = target.split('').map((char, i) => {
      return `<span class="word-blank-char pending" data-index="${i}">_</span>`;
    }).join('');
    chars = targetEl.querySelectorAll('.word-blank-char');
  }
  for (let i = 0; i < chars.length; i++) {
    if (i < input.length) {
      chars[i].textContent = input[i];
      chars[i].className = 'word-blank-char ' + (input[i].toLowerCase() === target[i].toLowerCase() ? 'correct' : 'incorrect');
    } else {
      chars[i].textContent = '_';
      chars[i].className = 'word-blank-char pending';
    }
  }
}

// 显示答案（Ctrl+;）
function revealAnswer() {
  state.answerRevealed = true;
  const targetEl = document.getElementById('sentence-target');
  const inputEl = document.getElementById('typing-input');

  if (state.practiceMode === 'sentences') {
    const sentence = state.currentCourse.sentences[state.currentIndex];
    targetEl.innerHTML = `<span class="word-revealed">${sentence.target}</span>`;
    inputEl.value = '';
    inputEl.focus();
    speakWord();
  } else if (state.practiceMode === 'words' && state.currentWord) {
    const word = state.currentWord;
    targetEl.innerHTML = `<span class="word-revealed">${word.word}</span>`;
    inputEl.value = '';
    inputEl.focus();
    speakWord();
  }
}

// 提交答案
function submitAnswer() {
  if (state.isProcessing) return;

  state.isProcessing = true;

  const inputEl = document.getElementById('typing-input');
  const feedbackEl = document.getElementById('feedback');
  const input = inputEl.value.trim();

  let target;
  if (state.practiceMode === 'sentences') {
    target = state.currentCourse.sentences[state.currentIndex].target;
  } else {
    target = state.currentWord.word;
  }

  // 词汇练习不区分大小写
  const isCorrect = state.practiceMode === 'words'
    ? input.toLowerCase() === target.toLowerCase()
    : input === target;

  state.total++;

  if (isCorrect) {
    state.correct++;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    inputEl.className = 'correct';
    feedbackEl.className = 'feedback perfect';

    if (state.combo >= 5) {
      feedbackEl.textContent = `Perfect! ${state.combo} 连击!`;
      showPerfectPopup();
      spawnComboParticles();
    } else {
      feedbackEl.textContent = 'Perfect!';
    }

    updateComboDisplay();
  } else {
    state.combo = 0;
    inputEl.className = 'incorrect';
    feedbackEl.className = 'feedback miss';

    if (state.practiceMode === 'words') {
      // 词汇练习：只提示再试一次，不显示答案，清空输入框
      feedbackEl.textContent = '再试一次';
      inputEl.value = '';
      // 重置下划线状态
      state.answerRevealed = false;
      const targetEl = document.getElementById('sentence-target');
      targetEl.innerHTML = `<span class="word-blank">${'_ '.repeat(target.length).trim()}</span>`;
    } else {
      // 句子练习：显示正确答案
      feedbackEl.textContent = `正确答案: ${target}`;
      // 显示答案字符并标记对错
      const targetEl = document.getElementById('sentence-target');
      targetEl.innerHTML = target.split('').map((char, i) => {
        const cls = i < input.length ? (input[i] === target[i] ? 'correct' : 'incorrect') : 'incorrect';
        return `<span class="word-blank-char ${cls}">${char === ' ' ? ' ' : char}</span>`;
      }).join('');
      state.answerRevealed = true;
    }

    updateComboDisplay();
    state.isProcessing = false;
    return;
  }

  setTimeout(() => {
    state.currentIndex++;
    if (state.practiceMode === 'sentences') {
      loadSentence();
    } else {
      loadWord();
    }
  }, 800);
}

// 跳过
function skipSentence() {
  state.total++;
  state.combo = 0;
  updateComboDisplay();
  state.currentIndex++;
  if (state.practiceMode === 'sentences') {
    loadSentence();
  } else {
    loadWord();
  }
}

// 返回课程列表
function backToCourses() {
  document.getElementById('course-select').classList.remove('hidden');
  document.getElementById('practice-area').classList.add('hidden');
  document.getElementById('practice-result').classList.add('hidden');
  document.getElementById('word-info').classList.add('hidden');
  renderCourses();
}

// 完成练习
function finishPractice() {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const accuracy = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
  const modeLabel = state.practiceMode === 'sentences' ? '句子' : '词汇';

  const result = {
    courseId: state.currentCourse.id,
    courseName: `${state.currentCourse.name} (${modeLabel})`,
    date: new Date().toLocaleString('zh-CN'),
    total: state.total,
    correct: state.correct,
    accuracy,
    maxCombo: state.maxCombo,
    elapsed,
  };
  saveHistory(result);

  document.getElementById('practice-area').classList.add('hidden');
  document.getElementById('practice-result').classList.remove('hidden');
  document.getElementById('word-info').classList.add('hidden');

  document.getElementById('result-total').textContent = state.total;
  document.getElementById('result-correct').textContent = state.correct;
  document.getElementById('result-accuracy').textContent = `${accuracy}%`;
  document.getElementById('result-max-combo').textContent = state.maxCombo;
}

// 重新练习
function restartPractice() {
  startCourse(state.currentCourse.id, state.practiceMode);
}

// 连击显示
function updateComboDisplay() {
  const display = document.getElementById('combo-display');
  const countEl = document.getElementById('combo-count');

  if (state.combo > 0) {
    display.classList.add('active');
    countEl.textContent = state.combo;
  } else {
    display.classList.remove('active');
  }
}

// Perfect 弹出特效
function showPerfectPopup() {
  const popup = document.createElement('div');
  popup.className = 'perfect-popup';
  popup.textContent = 'PERFECT!';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 600);
}

// 连击粒子特效
function spawnComboParticles() {
  const container = document.getElementById('combo-effects');
  const emojis = ['🔥', '⚡', '✨', '💫', '🌟'];
  const count = Math.min(state.combo, 10);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'combo-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.left = `${30 + Math.random() * 40}%`;
    particle.style.top = `${40 + Math.random() * 20}%`;
    particle.style.animationDelay = `${i * 0.05}s`;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 1000);
  }

  if (state.combo >= 10) {
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 300);
  }
}

// 渲染进度页面
function renderProgress() {
  const history = getHistory();
  const accuracy = history.totalPracticed > 0
    ? Math.round((history.totalCorrect / history.totalPracticed) * 100)
    : 0;

  document.getElementById('total-practiced').textContent = history.totalPracticed;
  document.getElementById('total-accuracy').textContent = `${accuracy}%`;
  document.getElementById('total-combo').textContent = history.maxCombo;

  const listEl = document.getElementById('history-list');
  if (history.sessions.length === 0) {
    listEl.innerHTML = '<p style="color: #666; text-align: center;">还没有练习记录，快去练习吧！</p>';
    return;
  }

  listEl.innerHTML = history.sessions.slice(0, 20).map(s => `
    <div class="history-item">
      <div>
        <div class="history-course">${s.courseName}</div>
        <div class="history-date">${s.date}</div>
      </div>
      <div class="history-stats">
        <span>正确率 ${s.accuracy}%</span>
        <span>连击 ${s.maxCombo}</span>
      </div>
    </div>
  `).join('');
}

// 事件监听
document.getElementById('typing-input').addEventListener('input', checkInput);
document.getElementById('typing-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    submitAnswer();
  }
  // Ctrl+; 显示答案
  if (e.ctrlKey && e.key === ';') {
    e.preventDefault();
    revealAnswer();
  }
});

// 初始化
showLanding();
