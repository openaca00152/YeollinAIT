const byId = (id) => document.getElementById(id);
const el = {
  install: byId('installAppBtn'), upload: byId('uploadButtonsGroup'), camera: byId('cameraInput'), gallery: byId('galleryInput'),
  cropPanel: byId('cropperContainer'), image: byId('imageToCrop'), crop: byId('doCropBtn'), cancel: byId('cancelCropBtn'),
  loading: byId('loadingMessage'), result: byId('resultArea'), code: byId('accessCode'), consent: byId('privacyConsent'), next: byId('newQuestionBtn'),
};
let cropper = null;
let imageUrl = null;
let installPrompt = null;
const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
function render(answer) {
  el.result.replaceChildren();
  const box = node('article', '', 'answer-box');
  box.append(node('p', answer.subject === 'english' ? '영어 풀이' : '수학 풀이', 'answer-label'), node('h2', answer.title || '풀이 결과'));
  if (answer.originalText) {
    box.append(node('p', answer.originalText, 'english-original'));
    const listen = node('button', '🔊 미국식 발음 듣기', 'listen-btn'); listen.type = 'button';
    listen.addEventListener('click', () => speak(answer.originalText)); box.append(listen);
  }
  if (answer.summary) box.append(node('p', answer.summary, 'answer-summary'));
  if (Array.isArray(answer.steps) && answer.steps.length) {
    const list = node('ol', '', 'answer-steps');
    answer.steps.forEach((step) => list.append(node('li', step))); box.append(list);
  }
  if (answer.finalAnswer) {
    const finalBox = node('section', '', 'final-answer'); finalBox.append(node('strong', '정답'), node('p', answer.finalAnswer)); box.append(finalBox);
  }
  if (answer.checkTip) box.append(node('p', `확인하기: ${answer.checkTip}`, 'check-tip'));
  box.append(node('p', 'AI 설명은 틀릴 수 있어요. 중요한 답은 담당 선생님과 다시 확인하세요.', 'ai-warning'));
  el.result.append(box); el.next.hidden = false;
  window.MathJax?.typesetPromise?.([box]).catch(() => {});
}

el.crop.addEventListener('click', async () => {
  if (!cropper) return;
  const accessCode = el.code.value.trim();
  if (!accessCode) return showError('학원 이용 코드를 입력해 주세요.');
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
      body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '잠시 후 다시 시도해 주세요.');
    render(payload.answer);
  } catch (error) { showError(error.message || '잠시 후 다시 시도해 주세요.'); }
  finally { setBusy(false); }
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
