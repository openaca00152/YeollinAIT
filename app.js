const byId = (id) => document.getElementById(id);
const el = {
  install: byId('installAppBtn'), upload: byId('uploadButtonsGroup'), openCamera: byId('openCameraBtn'), camera: byId('cameraInput'), gallery: byId('galleryInput'),
  cameraPanel: byId('cameraPanel'), cameraViewport: byId('cameraViewport'), cameraPreview: byId('cameraPreview'), cameraGuide: byId('cameraGuide'),
  closeCamera: byId('closeCameraBtn'), captureProblem: byId('captureProblemBtn'),
  cropPanel: byId('cropperContainer'), image: byId('imageToCrop'), crop: byId('doCropBtn'), cancel: byId('cancelCropBtn'),
  loading: byId('loadingMessage'), result: byId('resultArea'), code: byId('accessCode'), rememberCode: byId('rememberAccessCode'),
  clearCode: byId('clearAccessCodeBtn'), codeStatus: byId('codeStatus'), consent: byId('privacyConsent'), next: byId('newQuestionBtn'),
  grade: byId('studentGrade'), learning: byId('learningContent'), learningTabs: [...document.querySelectorAll('.learning-tab')],
  calmPlayer: byId('calmPlayer'), calmStarts: [...document.querySelectorAll('.calm-start')], stopCalm: byId('stopCalmBtn'),
  breathingCircle: byId('breathingCircle'), breathingGuide: byId('breathingGuide'), calmTimer: byId('calmTimer'), calmVolume: byId('calmVolume'),
};
let cropper = null;
let imageUrl = null;
let cameraStream = null;
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
function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  el.cameraPreview.srcObject = null;
  el.cameraPanel.hidden = true;
}
function setBusy(value) { el.loading.hidden = !value; el.crop.disabled = value; el.cancel.disabled = value; }
function reset() {
  destroyCropper(); stopCamera(); setBusy(false); el.cropPanel.hidden = true; el.upload.hidden = false; el.next.hidden = true;
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

async function openLiveCamera() {
  if (!el.consent.checked) return showError('사진 전송 안내를 확인하고 동의해 주세요.');
  if (!navigator.mediaDevices?.getUserMedia) { el.camera.click(); return; }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false,
    });
    el.result.replaceChildren(); el.next.hidden = true; el.upload.hidden = true; el.install.hidden = true; el.cameraPanel.hidden = false;
    el.cameraPreview.srcObject = cameraStream;
    await el.cameraPreview.play();
  } catch (_) {
    stopCamera(); el.upload.hidden = false; el.camera.click();
  }
}
el.openCamera.addEventListener('click', openLiveCamera);
el.closeCamera.addEventListener('click', reset);
window.addEventListener('pagehide', stopCamera);

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
  const subjectNames = { math: '수학', english: '영어', korean: '국어', social: '사회', history: '역사', science: '과학' };
  box.append(node('p', `${subjectNames[answer.subject] || '교과'} 문제`, 'answer-label'), node('h2', answer.title || '풀이 결과'));
  if (Array.isArray(answer.recognizedConditions) && answer.recognizedConditions.length) {
    const recognized = node('section', '', 'recognized-box');
    recognized.append(node('strong', 'AI가 사진에서 읽은 조건'));
    const recognizedList = node('ul');
    answer.recognizedConditions.forEach((condition) => recognizedList.append(node('li', condition)));
    recognized.append(recognizedList); box.append(recognized);
  }
  if (answer.needsRetake) {
    const retake = node('section', '', 'retake-box');
    retake.append(node('strong', '사진을 한 번 더 찍어 주세요'), node('p', answer.summary || '꼭짓점 글자나 선·각도 표시가 흐리거나 잘렸습니다. 문제 전체가 안내선 안에 오도록 다시 촬영해 주세요.'));
    box.append(retake); el.result.append(box); el.next.hidden = false; return;
  }
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

function encodedImage(canvas) {
  let dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > 6_000_000) dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const [header, image] = dataUrl.split(',');
  return { image, mimeType: header.includes('image/png') ? 'image/png' : 'image/jpeg' };
}
async function analyzeCanvas(canvas) {
  const accessCode = el.code.value.trim();
  if (!accessCode) return showError('학원 이용 코드를 입력해 주세요.');
  if (!el.grade.value) return showError('학년을 먼저 선택해 주세요.');
  setBusy(true); el.result.replaceChildren();
  try {
    const apiUrl = String(window.YEOLLIN_API_URL || '').trim();
    if (!apiUrl.startsWith('https://')) throw new Error('보안 서버 연결 설정이 아직 완료되지 않았습니다.');
    if (!canvas) throw new Error('사진을 처리하지 못했습니다.');
    const { image, mimeType } = encodedImage(canvas);
    destroyCropper(); el.cropPanel.hidden = true;
    const response = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Academy-Code': accessCode },
      body: JSON.stringify({ image, mimeType, grade: el.grade.value, deviceId: deviceId() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '잠시 후 다시 시도해 주세요.');
    saveAccessCode(accessCode);
    render(payload.answer);
  } catch (error) { showError(error.message || '잠시 후 다시 시도해 주세요.'); }
  finally { setBusy(false); }
}
el.crop.addEventListener('click', async () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ maxWidth: 2048, maxHeight: 2048, imageSmoothingQuality: 'high' });
  await analyzeCanvas(canvas);
});

el.captureProblem.addEventListener('click', async () => {
  const video = el.cameraPreview;
  if (!cameraStream || !video.videoWidth || !video.videoHeight) return showError('카메라 화면을 준비하지 못했습니다. 다시 시도해 주세요.');
  el.captureProblem.disabled = true;
  const viewport = el.cameraViewport.getBoundingClientRect();
  const guide = el.cameraGuide.getBoundingClientRect();
  const coverScale = Math.max(viewport.width / video.videoWidth, viewport.height / video.videoHeight);
  const displayedWidth = video.videoWidth * coverScale;
  const displayedHeight = video.videoHeight * coverScale;
  const hiddenX = (displayedWidth - viewport.width) / 2;
  const hiddenY = (displayedHeight - viewport.height) / 2;
  const sourceX = Math.max(0, Math.round((guide.left - viewport.left + hiddenX) / coverScale));
  const sourceY = Math.max(0, Math.round((guide.top - viewport.top + hiddenY) / coverScale));
  const sourceWidth = Math.min(video.videoWidth - sourceX, Math.round(guide.width / coverScale));
  const sourceHeight = Math.min(video.videoHeight - sourceY, Math.round(guide.height / coverScale));
  const scale = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  stopCamera();
  try { await analyzeCanvas(canvas); } finally { el.captureProblem.disabled = false; }
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
const learningIntros = {
  study: '과목마다 공부하는 방법이 다릅니다. 선택한 학교급에 맞는 방법을 하나씩 실천해 보세요.',
  exam: '시험 범위를 한꺼번에 외우지 말고, 남은 기간에 맞춰 학습 단계를 바꾸는 것이 중요합니다.',
  summary: '요점정리는 예쁘게 베끼는 작업이 아니라, 중요한 내용을 골라 다시 떠올리는 공부입니다.',
  rest: '짧은 휴식은 공부를 멈추는 시간이 아니라 집중력을 회복하는 과정입니다.',
};
const learningActions = {
  study: '오늘 배운 내용 중 하나를 책을 덮고 1분 동안 설명해 보세요.',
  exam: '지금 시험까지 남은 기간을 확인하고 오늘 할 일 세 가지만 적어보세요.',
  summary: '공책 한 장을 꺼내 핵심 질문 세 개부터 적어보세요.',
  rest: '어깨 힘을 빼고 세 번 천천히 내쉰 뒤 다음 공부 한 가지만 정하세요.',
};
function gradeBand() {
  if (el.grade.value.startsWith('초등')) return 'elementary';
  if (el.grade.value.startsWith('고등')) return 'high';
  return 'middle';
}
function renderLearning(topic) {
  const guide = learningGuides[topic];
  const items = guide[gradeBand()] || guide.common;
  el.learning.replaceChildren(node('h3', guide.title), node('p', learningIntros[topic], 'guide-intro'));
  const grid = node('div', '', 'guide-grid');
  items.forEach((item, index) => {
    const card = node('article', '', 'guide-card');
    const parts = item.split(' · ');
    if (parts.length > 1) card.append(node('h4', parts.shift()), node('p', parts.join(' · ')));
    else card.append(node('strong', `${index + 1}단계`), node('p', item.replace(/^[①②③④⑤⑥]\s*/, '')));
    grid.append(card);
  });
  const action = node('aside', '', 'practice-now');
  action.append(node('strong', '바로 실천하기'), node('p', learningActions[topic]));
  el.learning.append(grid, action);
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
  clearInterval(endingSession.chordTimer);
  clearInterval(endingSession.chimeTimer);
  const now = endingSession.context.currentTime;
  endingSession.master.gain.cancelScheduledValues(now);
  endingSession.master.gain.setValueAtTime(endingSession.master.gain.value, now);
  endingSession.master.gain.linearRampToValueAtTime(0, now + 0.35);
  endingSession.oscillators.forEach((oscillator) => { try { oscillator.stop(now + 0.4); } catch (_) { /* Already stopped. */ } });
  setTimeout(() => endingSession.context.close().catch(() => {}), 500);
  calmSession = null; el.stopCalm.disabled = true;
  el.calmStarts.forEach((button) => { button.disabled = false; });
  el.breathingCircle.className = '';
  el.breathingGuide.textContent = completed ? '잘했습니다. 천천히 눈을 뜨고 첫 문제를 차분히 읽어보세요.' : '재생을 멈췄습니다.';
}
async function startCalm(totalSeconds) {
  stopCalm();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return alert('현재 기기에서는 마음 안정 소리를 재생할 수 없습니다.');
  const context = new AudioContext();
  try { await context.resume(); } catch (_) { context.close().catch(() => {}); return alert('휴대폰의 미디어 음량을 확인한 뒤 다시 눌러주세요.'); }
  const master = context.createGain();
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1100; filter.Q.value = 0.45;
  const delay = context.createDelay(1); delay.delayTime.value = 0.38;
  const feedback = context.createGain(); feedback.gain.value = 0.2;
  filter.connect(master); filter.connect(delay); delay.connect(feedback).connect(delay); delay.connect(master);
  master.connect(context.destination); master.gain.value = 0;
  const targetVolume = Number(el.calmVolume.value) / 100 * 0.28;
  master.gain.linearRampToValueAtTime(targetVolume, context.currentTime + 2.5);
  const chords = [
    [130.81, 164.81, 196, 246.94],
    [110, 130.81, 164.81, 196],
    [87.31, 110, 130.81, 164.81],
    [98, 146.83, 196, 220],
  ];
  const oscillators = chords[0].map((frequency, index) => {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = index % 2 ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 ? 3 : -3; gain.gain.value = index === 0 ? 0.19 : 0.11;
    oscillator.connect(gain).connect(filter); oscillator.start(); return oscillator;
  });
  let chordIndex = 0;
  const changeChord = () => {
    chordIndex = (chordIndex + 1) % chords.length;
    oscillators.forEach((oscillator, index) => oscillator.frequency.linearRampToValueAtTime(chords[chordIndex][index], context.currentTime + 4));
  };
  const playChime = () => {
    const notes = [523.25, 587.33, 659.25, 783.99];
    const chime = context.createOscillator(); const chimeGain = context.createGain();
    chime.type = 'sine'; chime.frequency.value = notes[chordIndex];
    chimeGain.gain.setValueAtTime(0.045, context.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 2.8);
    chime.connect(chimeGain).connect(delay); chime.start(); chime.stop(context.currentTime + 2.9);
  };
  playChime();
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
  calmSession = {
    context, master, oscillators,
    timer: setInterval(update, 250), chordTimer: setInterval(changeChord, 12000), chimeTimer: setInterval(playChime, 16000),
  };
  el.stopCalm.disabled = false; el.calmStarts.forEach((button) => { button.disabled = true; }); update();
}
el.calmStarts.forEach((button) => button.addEventListener('click', () => startCalm(Number(button.dataset.calmSeconds))));
el.stopCalm.addEventListener('click', () => stopCalm());
el.calmVolume.addEventListener('input', () => {
  if (!calmSession) return;
  calmSession.master.gain.setTargetAtTime(Number(el.calmVolume.value) / 100 * 0.28, calmSession.context.currentTime, 0.12);
});
window.addEventListener('pagehide', () => stopCalm());

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
