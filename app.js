const byId = (id) => document.getElementById(id);
const el = {
  install: byId('installAppBtn'), upload: byId('uploadButtonsGroup'), camera: byId('cameraInput'), gallery: byId('galleryInput'),
  cropPanel: byId('cropperContainer'), image: byId('imageToCrop'), crop: byId('doCropBtn'), cancel: byId('cancelCropBtn'),
  loading: byId('loadingMessage'), result: byId('resultArea'), code: byId('accessCode'), rememberCode: byId('rememberAccessCode'),
  clearCode: byId('clearAccessCodeBtn'), codeStatus: byId('codeStatus'), consent: byId('privacyConsent'), next: byId('newQuestionBtn'),
  grade: byId('studentGrade'), learning: byId('learningContent'), learningTabs: [...document.querySelectorAll('.learning-tab')],
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
    elementary: ['매일 같은 시간에 20~30분씩 시작하세요.', '수학은 풀이를 말로 설명하고, 영어는 소리 내어 읽으세요.', '맞힌 문제도 왜 맞았는지 한 문장으로 정리하세요.'],
    middle: ['학교 수업 당일에 교과서와 노트를 10분 복습하세요.', '수학은 개념→예제→유형 순서로, 영어는 단어→본문→문법 순서로 공부하세요.', '틀린 문제는 정답보다 틀린 이유를 기록하세요.'],
    high: ['내신과 모의고사의 목표를 나누고 주간 계획을 세우세요.', '수학은 풀이가 막힌 지점을 표시하고, 영어는 문장 구조를 분석하세요.', '기출문제를 시간 안에 풀고 근거 없는 답을 점검하세요.'],
  },
  exam: {
    title: '시험까지 남은 기간별 준비',
    common: ['4주 전 · 시험 범위와 교과서 개념 정리', '3주 전 · 유형별 문제와 학교 프린트 학습', '2주 전 · 틀린 문제 재풀이와 서술형 연습', '1주 전 · 암기 반복과 실전 시간 점검', '전날 · 새로운 문제보다 요점과 오답 확인'],
  },
  summary: {
    title: '한 장 요점정리 방법',
    common: ['종이 위에 단원명과 핵심 질문을 먼저 적으세요.', '수학은 개념·공식·대표문제·실수, 영어는 단어·핵심문장·문법·해석으로 나누세요.', '사회·과학은 핵심용어와 원인→과정→결과를 화살표로 연결하세요.', '책을 덮고 빈 종이에 다시 써 본 뒤 빠진 내용만 보충하세요.'],
  },
  rest: {
    title: '집중을 되찾는 3분 휴식',
    common: ['30초 · 코로 천천히 들이마시고 길게 내쉬기를 3회 반복하세요.', '60초 · 어깨를 뒤로 돌리고 목을 좌우로 천천히 기울이세요.', '30초 · 먼 곳을 바라보며 눈을 쉬게 하세요.', '60초 · 물을 마시고 다음 공부 목표 한 가지만 정하세요.'],
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
}
el.learningTabs.forEach((tab) => tab.addEventListener('click', () => {
  el.learningTabs.forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
  renderLearning(tab.dataset.topic);
}));
el.grade.addEventListener('change', () => renderLearning('study'));
renderLearning('study');
setTimeout(() => trackUsage('visit'), 0);

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
