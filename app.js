// ⭐ 복사하신 진짜 키를 여기에 쏙 넣어주세요!
const API_KEY = 'AQ.Ab8RN6IUsLx140Z3JUo6-Cvs-jEkvOMbhbFV-DVW958KBYmI3g'; 

// 1. 영어 발음 듣기 기능
function speakEnglish(text) {
    if (!window.speechSynthesis) {
        alert("현재 기기에서는 음성 듣기를 지원하지 않습니다.");
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; 
    window.speechSynthesis.speak(utterance);
}

// 2. 사진 파일 변환 기능
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// 3. 메인 기능 (제미나이 3.1 PRO 통신)
document.getElementById('imageInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const resultArea = document.getElementById('resultArea');
    const loadingMessage = document.getElementById('loadingMessage');
    
    resultArea.innerHTML = '';
    loadingMessage.style.display = 'block';

    try {
        const base64Image = await fileToBase64(file);

        // ⭐ 학생들의 가독성을 위한 프롬프트 최적화
        const prompt = `
        너는 '군산열린학원'의 친절하고 똑똑한 수학/영어 선생님 '열린AIT'야.
        학생이 올린 사진을 분석해서 아래 규칙에 따라 HTML 태그로만 답변해. 절대 \`\`\`html 같은 코드블록 기호를 쓰지 마.
        
        [공통 규칙 - 가독성 매우 중요]
        1. 학생이 스마트폰으로 읽기 편하도록, 설명이 넘어갈 때 반드시 <br><br> 태그를 사용해서 줄바꿈을 넉넉하게 해줘. 빽빽하게 붙여 쓰지 마.
        2. 전체 답변은 <div class="box"> 태그로 감싸.

        [수학 문제인 경우]
        1. 정답과 함께 단계별 풀이 과정을 친절하게 설명해.
        2. 모든 수식과 숫자는 반드시 $$ 기호로 감싸서 작성해. (예: $$x^2 - 5x + 6 = 0$$)
        3. 핵심 원리나 정답은 <span class="highlight-red"> 또는 <span class="highlight-blue"> 로 감싸서 색상을 줘.

        [영어 문제인 경우]
        1. 사진 속 영어 문장을 파악해서 가장 상단에 <p id="eng-text" style="font-size:1.1em; font-weight:bold;">[영어 원문]</p> 형식으로 적어줘.
        2. 원문 바로 밑에 다음 버튼 코드를 그대로 넣어: <button class="listen-btn" onclick="speakEnglish(document.getElementById('eng-text').innerText)">🔊 미국식 발음 듣기</button>
        3. 한글 해석을 제공하고, 핵심 영문법이나 단어 뜻을 번호 매겨서 설명해. 중요 부분은 highlight-red나 highlight-blue 클래스를 쓴 span 태그로 강조해.
        `;

        // ⭐ 구글의 최신 3.1 PRO 모델 호출
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: file.type, data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error.message || '제미나이 답변 생성 오류');

        let aiText = data.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```html/g, '').replace(/```/g, '');

        loadingMessage.style.display = 'none';
        resultArea.innerHTML = aiText;

        if (window.MathJax) {
            MathJax.typesetPromise();
        }

    } catch (error) {
        console.error(error);
        loadingMessage.style.display = 'none';
        resultArea.innerHTML = `<p style="color:red; text-align:center;">오류 원인: ${error.message}</p>`;
    }
});