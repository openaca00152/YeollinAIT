const byId = (id) => document.getElementById(id);
const el = {
  install: byId('installAppBtn'), upload: byId('uploadButtonsGroup'), camera: byId('cameraInput'), gallery: byId('galleryInput'),
  cropPanel: byId('cropperContainer'), image: byId('imageToCrop'), crop: byId('doCropBtn'), cancel: byId('cancelCropBtn'),
  loading: byId('loadingMessage'), result: byId('resultArea'), code: byId('accessCode'), rememberCode: byId('rememberAccessCode'),
  clearCode: byId('clearAccessCodeBtn'), codeStatus: byId('codeStatus'), consent: byId('privacyConsent'), next: byId('newQuestionBtn'),
  grade: byId('studentGrade'), learning: byId('learningContent'), learningTabs: [...document.querySelectorAll('.learning-tab')],
  calmPlayer: byId('calmPlayer'), calmStarts: [...document.querySelectorAll('.calm-start')], stopCalm: byId('stopCalmBtn'),
  breathingCircle: byId('breathingCircle'), breathingGuide: byId('breathingGuide'), calmTimer: byId('calmTimer'), calmVolume: byId('calmVolume'),
};
let cropper = null;
let imageUrl = null;
let installPrompt = null;
const ACCESS_CODE_STORAGE_KEY = 'yeollinAIT.accessCode';
const GRADE_STORAGE_KEY = 'yeollinAIT.grade';
const DEVICE_STORAGE_KEY = 'yeollinAIT.deviceId';
const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function removeSavedAccessCode(message = '') {
  try { localStorage.removeItem(ACCESS_CODE_STORAGE_KEY); } catch (_) { /* Storage may be blocked. */ }
  el.rememberCode.checked = false;
  el.clearCode.hidden = true;
  el.codeStatus.textContent = message;
}
function loadSavedAccessCode() {
  try {
    const savedCode = localStorage.getItem(ACCESS_CODE_STORAGE_KEY);
    if (!savedCode) return;
    el.code.value = savedCode;
    el.rememberCode.checked = true;
    el.clearCode.hidden = false;
    el.codeStatus.textContent = '이 기기에 저장된 이용 코드를 불러왔습니다.';
  } catch (_) { /* Continue without persistence when storage is unavailable. */ }
}
function saveAccessCode(accessCode) {
  if (!el.rememberCode.checked) return removeSavedAccessCode();
  try {
    localStorage.setItem(ACCESS_CODE_STORAGE_KEY, accessCode);
    el.clearCode.hidden = false;
    el.codeStatus.textContent = '이용 코드를 이 기기에 저장했습니다.';
  } catch (_) {
    removeSavedAccessCode('브라우저 설정 때문에 코드를 저장하지 못했습니다.');
  }
}

loadSavedAccessCode();
try { el.grade.value = localStorage.getItem(GRADE_STORAGE_KEY) || ''; } catch (_) { /* Continue without persistence. */ }
el.grade.addEventListener('change', () => {
  try {
    if (el.grade.value) localStorage.setItem(GRADE_STORAGE_KEY, el.grade.value);
    else localStorage.removeItem(GRADE_STORAGE_KEY);
  } catch (_) { /* Continue without persistence. */ }
  if (el.grade.value) trackUsage('visit');
});
el.rememberCode.addEventListener('change', () => {
  if (!el.rememberCode.checked) removeSavedAccessCode('저장된 이용 코드를 삭제했습니다.');
  else el.codeStatus.textContent = '정상 코드로 풀이가 완료되면 이 기기에 저장됩니다.';
});
el.clearCode.addEventListener('click', () => {
  removeSavedAccessCode('저장된 이용 코드를 삭제했습니다.');
  el.code.value = '';
  el.code.focus();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); installPrompt = event;
  if (!standalone) el.install.hidden = false;
});
if (isIOS && !standalone) el.install.hidden = false;
el.install.addEventListener('click', async () => {
  if (installPrompt) {
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') el.install.hidden = true;
    installPrompt = null;
  } else if (isIOS) alert('아이폰 설치 방법\n\n1. 화면 아래의 공유 버튼을 누르세요.\n2. “홈 화면에 추가”를 선택하세요.');
});

function destroyCropper() {
  cropper?.destroy(); cropper = null;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
}
function setBusy(value) { el.loading.hidden = !value; el.crop.disabled = value; el.cancel.disabled = value; }
function reset() {
  destroyCropper(); setBusy(false); el.cropPanel.hidden = true; el.upload.hidden = false; el.next.hidden = true;
  el.result.replaceChildren(); el.camera.value = ''; el.gallery.value = '';
}
function node(tag, text, className) {
  const item = document.createElement(tag); item.textContent = text;
  if (className) item.className = className;
  return item;
}
function showError(message) {
  el.result.replaceChildren();
  const box = node('section', '', 'answer-box error-box');
  box.append(node('h2', '분석하지 못했어요'), node('p', message));
  el.result.append(box); el.next.hidden = false;
}
function validate(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'JPG, PNG, WEBP 사진만 사용할 수 있어요.';
  if (file.size > 10 * 1024 * 1024) return '사진 크기는 10MB 이하로 선택해 주세요.';
  return '';
}
function selectImage(event) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  const error = validate(file);
  if (error) return showError(error);
  if (!el.consent.checked) return showError('사진 전송 안내를 확인하고 동의해 주세요.');
  destroyCropper(); imageUrl = URL.createObjectURL(file); el.image.src = imageUrl;
  el.upload.hidden = true; el.install.hidden = true; el.result.replaceChildren(); el.next.hidden = true; el.cropPanel.hidden = false;
  cropper = new Cropper(el.image, { viewMode: 1, autoCropArea: 0.85, background: false, responsive: true });
}
el.camera.addEventListener('change', selectImage);
el.gallery.addEventListener('change', selectImage);
el.cancel.addEventListener('click', reset);
el.next.addEventListener('click', reset);

function speak(text) {
  if (!window.speechSynthesis) return alert('현재 기기에서는 음성 듣기를 지원하지 않습니다.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_STORAGE_KEY, id); }
    return id;
  } catch (_) { return ''; }
}
async function trackUsage(eventType) {
  const apiUrl = String(window.YEOLLIN_API_URL || '').trim();
  const accessCode = el.code.value.trim();
  if (!apiUrl.startsWith('https://') || !accessCode || !el.grade.value) return;
  try {
    await fetch(apiUrl.replace(/\/analyze$/, '/track'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Academy-Code': accessCode },
      body: JSON.stringify({ eventType, grade: el.grade.value, deviceId: deviceId() }),
    });
  } catch (_) { /* Statistics must never interrupt studying. */ }
}
function render(answer) {
  el.result.replaceChildren();
  const box = node('article', '', 'answer-box');
  box.append(node('p', answer.subject === 'english' ? '영어 문제' : '수학 문제', 'answer-label'), node('h2', answer.title || '풀이 결과'));
  const hintBox = node('section', '', 'hint-box');
  hintBox.append(node('strong', '먼저 생각해 볼 힌트'), node('p', answer.hint || answer.checkTip || '문제에서 주어진 조건을 다시 확인해 보세요.'));
  const reveal = node('button', '전체 풀이와 정답 보기', 'button reveal-button'); reveal.type = 'button';
  const details = node('div', '', 'answer-details'); details.hidden = true;
  if (answer.originalText) {
    details.append(node('p', answer.originalText, 'english-original'));
    const listen = node('button', '🔊 미국식 발음 듣기', 'listen-btn'); listen.type = 'button';
    listen.addEventListener('click', () => speak(answer.originalText)); details.append(listen);
  }
  if (answer.summary) details.append(node('p', answer.summary, 'answer-summary'));
  if (Array.isArray(answer.steps) && answer.steps.length) {
    const list = node('ol', '', 'answer-steps');
    answer.steps.forEach((step) => list.append(node('li', step))); details.append(list);
  }
  if (answer.finalAnswer) {
    const finalBox = node('section', '', 'final-answer'); finalBox.append(node('strong', '정답'), node('p', answer.finalAnswer)); details.append(finalBox);
  }
  if (answer.checkTip) details.append(node('p', `확인하기: ${answer.checkTip}`, 'check-tip'));
  details.append(node('p', 'AI 설명은 틀릴 수 있어요. 중요한 답은 담당 선생님과 다시 확인하세요.', 'ai-warning'));
  reveal.addEventListener('click', () => {
    details.hidden = !details.hidden;
    reveal.textContent = details.hidden ? '전체 풀이와 정답 보기' : '전체 풀이 접기';
    if (!details.hidden) window.MathJax?.typesetPromise?.([details]).catch(() => {});
  });
  box.append(hintBox, reveal, details);
  el.result.append(box); el.next.hidden = false;
  window.MathJax?.typesetPromise?.([hintBox]).catch(() => {});
}

el.crop.addEventListener('click', async () => {
  if (!cropper) return;
  const accessCode = el.code.value.trim();
  if (!accessCode) return showError('학원 이용 코드를 입력해 주세요.');
  if (!el.grade.value) return showError('학년을 먼저 선택해 주세요.');
  setBusy(true); el.result.replaceChildren();
  try {
    const apiUrl = String(window.YEOLLIN_API_URL || '').trim();
    if (!apiUrl.startsWith('https://')) throw new Error('보안 서버 연결 설정이 아직 완료되지 않았습니다.');
    const canvas = cropper.getCroppedCanvas({ maxWidth: 1280, maxHeight: 1280, imageSmoothingQuality: 'high' });
    if (!canvas) throw new Error('사진을 처리하지 못했습니다.');
    const image = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    destroyCropper(); el.cropPanel.hidden = true;
    const response = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Academy-Code': accessCode },
      body: JSON.stringify({ image, mimeType: 'image/jpeg', grade: el.grade.value, deviceId: deviceId() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '잠시 후 다시 시도해 주세요.');
    saveAccessCode(accessCode);
    render(payload.answer);
  } catch (error) { showError(error.message || '잠시 후 다시 시도해 주세요.'); }
  finally { setBusy(false); }
});

const learningGuides = {
  study: {
    title: '학년별 공부 방법',
    elementary: ['국어 · 매일 10분 읽고 중심 내용을 한 문장으로 말하세요.', '수학 · 개념을 말로 설명한 뒤 계산 문제를 조금씩 매일 푸세요.', '영어 · 단어를 그림·소리와 연결하고 짧은 문장을 소리 내어 읽으세요.', '사회 · 인물·장소·사건을 이야기 순서로 연결하세요.', '과학 · 관찰한 것과 그 까닭을 나누어 적으세요.', '공통 · 매일 같은 시간에 20~30분 공부하고 완료 표시를 하세요.'],
    middle: ['국어 · 지문마다 중심문장과 근거를 표시하고 문제의 요구를 확인하세요.', '수학 · 개념→예제→유형→오답 재풀이 순서를 지키세요.', '영어 · 단어→본문 해석→핵심 문법→서술형 문장 순서로 공부하세요.', '사회 · 핵심용어를 원인→과정→결과로 연결하세요.', '과학 · 개념·실험 과정·그래프 해석을 함께 정리하세요.', '공통 · 학교 수업 당일 10분 복습하고 틀린 이유를 기록하세요.'],
    high: ['국어 · 시간 안에 지문을 읽고 답의 근거가 있는 문장을 확인하세요.', '수학 · 개념과 조건을 적은 뒤 막힌 지점부터 다시 분석하세요.', '영어 · 어휘·문장구조·주제·근거를 함께 확인하고 매일 지문을 읽으세요.', '사회탐구 · 개념 간 관계와 자료·도표의 변화 원인을 설명해 보세요.', '과학탐구 · 공식 암기보다 조건·단위·그래프의 의미를 먼저 이해하세요.', '공통 · 내신과 모의고사 목표를 나누고 기출을 시간 안에 푸세요.'],
  },
  exam: {
    title: '시험까지 남은 기간별 준비',
    common: ['4주 전 · 시험 범위표를 만들고 교과서 개념을 1회 정리하세요.', '3주 전 · 학교 프린트와 유형별 문제를 풀고 모르는 부분을 표시하세요.', '2주 전 · 틀린 문제를 답 없이 다시 풀고 서술형 답안을 직접 써 보세요.', '1주 전 · 과목별 요점 한 장과 오답만 반복하며 시간을 재어 푸세요.', '전날 · 새로운 문제는 줄이고 암기표·공식·자주 하는 실수를 확인하세요.', '시험 당일 · 쉬운 문제부터 풀고 마지막 5분은 단위·부호·답안 누락을 점검하세요.'],
  },
  summary: {
    title: '한 장 요점정리 방법',
    common: ['① 종이 위에 단원명과 “이 단원에서 꼭 알아야 할 것은?”을 적으세요.', '② 수학은 개념·공식·대표문제·실수, 영어는 단어·핵심문장·문법·해석으로 나누세요.', '③ 국어는 중심내용·근거·표현법, 사회·과학은 핵심용어와 원인→과정→결과로 정리하세요.', '④ 문장 전체를 베끼지 말고 화살표·표·짧은 핵심어를 사용하세요.', '⑤ 책을 덮고 빈 종이에 다시 써 본 뒤 빠진 내용만 다른 색으로 보충하세요.'],
  },
  rest: {
    title: '집중을 되찾는 3분 휴식',
    common: ['호흡 30초 · 코로 천천히 들이마시고 더 길게 내쉬기를 3회 반복하세요.', '목·어깨 60초 · 어깨를 뒤로 돌리고 목을 좌우로 천천히 기울이세요. 통증이 있으면 멈추세요.', '손목·허리 30초 · 손목을 가볍게 돌리고 자리에서 일어나 등을 펴세요.', '눈 휴식 30초 · 화면에서 눈을 떼고 먼 곳을 바라보세요.', '마음 정리 30초 · 잡생각을 없애려 하지 말고 호흡에만 잠깐 집중하세요.', '다시 시작 30초 · 물을 마시고 다음 25분 동안 할 일 한 가지만 정하세요.'],
  },
};
function gradeBand() {
  if (el.grade.value.startsWith('초등')) return 'elementary';
  if (el.grade.value.startsWith('고등')) return 'high';
  return 'middle';
}
function renderLearning(topic) {
  const guide = learningGuides[topic];
  const items = guide[gradeBand()] || guide.common;
  el.learning.replaceChildren(node('h3', guide.title));
  const list = node('ol', '', 'guide-list');
  items.forEach((item) => list.append(node('li', item)));
  el.learning.append(list);
  el.calmPlayer.hidden = topic !== 'rest';
}
el.learningTabs.forEach((tab) => tab.addEventListener('click', () => {
  el.learningTabs.forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
  renderLearning(tab.dataset.topic);
}));
el.grade.addEventListener('change', () => renderLearning('study'));
renderLearning('study');
setTimeout(() => trackUsage('visit'), 0);

let calmSession = null;
function stopCalm(completed = false) {
  if (!calmSession) return;
  const endingSession = calmSession;
  clearInterval(endingSession.timer);
  const now = endingSession.context.currentTime;
  endingSession.master.gain.cancelScheduledValues(now);
  endingSession.master.gain.setValueAtTime(endingSession.master.gain.value, now);
  endingSession.master.gain.linearRampToValueAtTime(0, now + 0.35);
  endingSession.oscillators.forEach((oscillator) => oscillator.stop(now + 0.4));
  setTimeout(() => endingSession.context.close().catch(() => {}), 500);
  calmSession = null; el.stopCalm.disabled = true;
  el.calmStarts.forEach((button) => { button.disabled = false; });
  el.breathingCircle.className = '';
  el.breathingGuide.textContent = completed ? '잘했습니다. 천천히 눈을 뜨고 첫 문제를 차분히 읽어보세요.' : '재생을 멈췄습니다.';
}
function startCalm(totalSeconds) {
  stopCalm();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return alert('현재 기기에서는 마음 안정 소리를 재생할 수 없습니다.');
  const context = new AudioContext();
  const master = context.createGain();
  const oscillators = [174, 261.63].map((frequency, index) => {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = index ? 0.28 : 0.45;
    oscillator.connect(gain).connect(master); oscillator.start(); return oscillator;
  });
  master.connect(context.destination); master.gain.value = 0;
  const targetVolume = Number(el.calmVolume.value) / 100 * 0.09;
  master.gain.linearRampToValueAtTime(targetVolume, context.currentTime + 1.5);
  const startedAt = Date.now();
  const update = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);
    el.calmTimer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    const cycle = elapsed % 10; const inhale = cycle < 4;
    el.breathingCircle.className = inhale ? 'inhale' : 'exhale';
    el.breathingGuide.textContent = inhale ? '코로 천천히 들이마셔요' : '입으로 더 길게 내쉬어요';
    if (!remaining) stopCalm(true);
  };
  calmSession = { context, master, oscillators, timer: setInterval(update, 250) };
  el.stopCalm.disabled = false; el.calmStarts.forEach((button) => { button.disabled = true; }); update();
}
el.calmStarts.forEach((button) => button.addEventListener('click', () => startCalm(Number(button.dataset.calmSeconds))));
el.stopCalm.addEventListener('click', () => stopCalm());
el.calmVolume.addEventListener('input', () => {
  if (!calmSession) return;
  calmSession.master.gain.setTargetAtTime(Number(el.calmVolume.value) / 100 * 0.09, calmSession.context.currentTime, 0.08);
});
window.addEventListener('pagehide', () => stopCalm());

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
