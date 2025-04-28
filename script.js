const wordDisplay = document.getElementById('wordDisplay');
const typingInput = document.getElementById('typingInput');
const timerElement = document.getElementById('timer');
const scoreElement = document.getElementById('score');
const wordCountElement = document.getElementById('wordCount');
const accuracyElement = document.getElementById('accuracy');
const meaningElement = document.querySelector('.meaning');
const pronunciationElement = document.querySelector('.pronunciation');
const koreanPronunciationElement = document.querySelector('.korean-pronunciation'); // 한글 발음 엘리먼트
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const difficultySelect = document.getElementById('difficultySelect'); // 난이도 선택 select 엘리먼트

// TODO: 단어 횟수 및 초기화 횟수를 표시할 엘리먼트 추가 필요 (HTML 및 여기)
const appearanceCountElement = document.getElementById('appearanceCount'); // HTML에 추가해야 함
const resetCountElement = document.getElementById('resetCount'); // HTML에 추가해야 함


let words = []; // 현재 불러온 단어들 (JSON 데이터)
let currentWord = null; // 현재 타이핑할 단어 객체
let currentWordCharacters = []; // 현재 단어를 글자 단위로 분리한 배열
let typedCharactersCount = 0; // 현재 단어에서 입력된 글자 수 (UI 표시용)
let totalCharactersTyped = 0; // 전체 게임에서 사용자가 실제로 키보드로 누른 총 글자 수 (오타 포함, 백스페이스 제외)
let totalErrors = 0; // 전체 게임에서 발생한 오타 수

let timer = 60; // 게임 시간 (초)
let typingTimer = null; // 타이머 setInterval ID
let gameStarted = false;
let score = 0; // 점수
let wordCount = 0; // 맞춘 단어 수

// --- 단어 완료 처리 플래그: 단어 완료 처리가 진행 중인지 확인 ---
let isWordCompletionPending = false; // 다음 단어로 넘어가는 과정이 시작되었는지 여부

// --- 음성 합성 객체 준비 ---
const synth = window.speechSynthesis; // Web Speech API의 음성 합성 객체

// --- 단어별 통계 데이터 ---
// 각 난이도 파일의 단어별 { 출현 횟수, 초기화 횟수 }를 저장할 객체
// 키는 단어 자체 (currentWord.word) 사용
let wordStatistics = {}; // { "word1": { appearanceCount: 5, resetCount: 1 }, "word2": { appearanceCount: 2, resetCount: 0 }, ... }

// --- localStorage 키 생성 함수 ---
// 난이도 파일 경로에 따라 고유한 localStorage 키를 생성합니다.
function getStatsStorageKey(filePath) {
    return `wordStats_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`; // 파일 경로의 특수문자 제거
}


// --- localStorage에 단어 통계 저장 함수 ---
function saveWordStatistics() {
    const filePath = difficultySelect.value; // 현재 선택된 파일 경로
    const storageKey = getStatsStorageKey(filePath);
    try {
        localStorage.setItem(storageKey, JSON.stringify(wordStatistics));
        // console.log(`localStorage에 통계 저장 완료 (${storageKey})`);
    } catch (e) {
        console.error("localStorage 통계 저장 오류:", e);
    }
}


// --- loadWords 함수: 파일 경로를 인자로 받아 해당 JSON 파일을 로드 ---
async function loadWords(filePath) {
    words = []; // 기존 단어 목록 초기화
    wordStatistics = {}; // 기존 통계 데이터 초기화

    wordDisplay.innerHTML = "단어 로딩 중...";
    meaningElement.textContent = "뜻: 로딩 중...";
    pronunciationElement.textContent = "발음: 로딩 중...";
    koreanPronunciationElement.textContent = "한글 발음: 로딩 중...";
     // 단어 통계 표시 엘리먼트 초기화
     if (appearanceCountElement) appearanceCountElement.textContent = '0';
     if (resetCountElement) resetCountElement.textContent = '0';


    typingInput.disabled = true; // 로딩 중 입력 비활성화
    startButton.disabled = true; // 로딩 중 시작 버튼 비활성화
    difficultySelect.disabled = true; // 로딩 중 난이도 선택 비활성화


    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${filePath}`);
        }
        words = await response.json();
        console.log(`단어 로드 완료 (${filePath}):`, words.length);

        // --- localStorage에서 단어 통계 로드 ---
        const storageKey = getStatsStorageKey(filePath);
        const savedStats = localStorage.getItem(storageKey);

        if (savedStats) {
            try {
                wordStatistics = JSON.parse(savedStats);
                console.log(`localStorage에서 통계 로드 완료 (${storageKey})`);
                // 로드된 통계 데이터에 없는 새로운 단어는 초기화
                words.forEach(word => {
                    if (!wordStatistics[word.word]) {
                         wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
                    }
                });

            } catch (e) {
                console.error("localStorage 통계 파싱 오류:", e);
                wordStatistics = {}; // 오류 발생 시 통계 초기화
                // 로드된 통계 데이터에 없는 새로운 단어 초기화
                 words.forEach(word => {
                    wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
                });
            }
        } else {
             // localStorage에 통계가 없으면 모든 단어 통계 초기화
             console.log(`localStorage에 통계 없음 (${storageKey}). 초기화합니다.`);
             words.forEach(word => {
                wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
            });
        }


        if (words.length > 0) {
             wordDisplay.innerHTML = `총 ${words.length}개의 단어 로드 완료.<br>시작 버튼을 누르세요.`;
             meaningElement.textContent = "뜻: -";
             pronunciationElement.textContent = "发音: -"; // 일본어 발음 -> 한국어 발음으로 수정
             pronunciationElement.textContent = "발음: -";
             koreanPronunciationElement.textContent = "한글 발음: -";
             if (appearanceCountElement) appearanceCountElement.textContent = '0';
             if (resetCountElement) resetCountElement.textContent = '0';

             typingInput.disabled = true; // 게임 시작 전 입력 비활성화
             startButton.disabled = false; // 단어를 성공적으로 로드했으니 시작 버튼 활성화
             difficultySelect.disabled = false; // 단어 로드 성공 후 난이도 선택 활성화

        } else {
            wordDisplay.innerHTML = `선택한 파일(${filePath})에 단어가 없습니다.`;
             meaningElement.textContent = "뜻: -";
             pronunciationElement.textContent = "발음: -";
             koreanPronunciationElement.textContent = "한글 발음: -";
              if (appearanceCountElement) appearanceCountElement.textContent = '0';
              if (resetCountElement) resetCountElement.textContent = '0';

             typingInput.disabled = true;
             startButton.disabled = true; // 단어가 없으니 시작 버튼 비활성화
             difficultySelect.disabled = false; // 단어 없어도 난이도 선택은 가능
        }


    } catch (error) {
        console.error("단어 로드 실패:", error);
        wordDisplay.innerHTML = `단어 로드 실패: ${error.message}`;
        meaningElement.textContent = "뜻: 에러";
        pronunciationElement.textContent = "발음: 에러";
        koreanPronunciationElement.textContent = "한글 발음: 에러";
         if (appearanceCountElement) appearanceCountElement.textContent = '0';
         if (resetCountElement) resetCountElement.textContent = '0';
        typingInput.disabled = true;
        startButton.disabled = true;
        difficultySelect.disabled = false;
    }
}


// --- localStorage에 단어 통계 저장 (빈도 조정 기능 구현 시 호출) ---
// 현재는 beforeunload 이벤트와 processWordCompletion에서 호출 예정
// function saveWordStatistics() { ... }


// --- startGame 함수 ---
function startGame() {
    // 단어 로드 확인 및 게임 중복 실행 방지
    if (words.length === 0 || gameStarted) {
        if(words.length === 0) {
             alert("먼저 단어를 로드해주세요. 난이도를 선택하거나 파일 경로를 확인하세요.");
             console.warn("단어가 로드되지 않았거나 비어있습니다.");
        } else if (gameStarted) {
            console.warn("게임이 이미 시작되었습니다.");
        }
        return;
    }

    gameStarted = true;
    score = 0; // 점수 초기화
    wordCount = 0; // 단어 수 초기화
    typedCharactersCount = 0; // 현재 단어 입력 상태 초기화 (UI용)
    totalCharactersTyped = 0; // 전체 게임 통계 초기화
    totalErrors = 0; // 전체 게임 통계 초기화
    timer = 60; // 게임 시간 (초) (원하는 시간으로 변경)
    scoreElement.textContent = `점수: ${score}`;
    wordCountElement.textContent = `단어 수: ${wordCount}`;
    accuracyElement.textContent = `정확도: 100%`; // 초기 정확도 100%
    timerElement.textContent = `시간: ${timer}초`;
    typingInput.value = ""; // 입력 필드 비우기
    typingInput.disabled = false; // 입력 활성화
    typingInput.focus(); // 입력 필드에 포커스

    // 단어 완료 처리 플래그 초기화
    isWordCompletionPending = false;

    setNewWord(); // 첫 단어 설정
    startTimer(); // 타이머 시작
    startButton.disabled = true; // 게임 시작 후 시작 버튼 비활성화
    resetButton.disabled = false; // 재시작 버튼 활성화
    difficultySelect.disabled = true; // 게임 시작 후 난이도 선택 비활성화

    // 입력 필드의 이전 길이를 저장하는 변수 초기화 (input 이벤트에서 사용)
    typingInput._prevLength = 0;
}

 // --- resetGame 함수 ---
function resetGame() {
    clearInterval(typingTimer); // 기존 타이머 중지
    gameStarted = false;
    currentWord = null;
    score = 0; // 점수 초기화
    wordCount = 0; // 단어 수 초기화
    typedCharactersCount = 0;
    totalCharactersTyped = 0;
    totalErrors = 0;
    timer = 0; // 타이머 표시 초기화 (게임 시작 전에는 0초 또는 '준비')
    timerElement.textContent = `시간: 0초`;
    scoreElement.textContent = `점수: 0`;
    wordCountElement.textContent = `단어 수: 0`;
    accuracyElement.textContent = `정확도: 100%`;
    typingInput.value = "";
    typingInput.disabled = true;
    startButton.disabled = false; // 시작 버튼 다시 활성화
    resetButton.disabled = false; // 재시작 버튼 활성화
    difficultySelect.disabled = false; // 재시작 후 난이도 선택 활성화
    wordDisplay.innerHTML = "난이도를 선택하고 시작하세요"; // 초기 메시지로 되돌림
    meaningElement.textContent = "뜻: -";
    pronunciationElement.textContent = "발음: -";
    koreanPronunciationElement.textContent = "한글 발음: -";
     // 단어 통계 표시 엘리먼트 초기화
    if (appearanceCountElement) appearanceCountElement.textContent = '0';
    if (resetCountElement) resetCountElement.textContent = '0';


     // 단어 완료 처리 플래그 초기화
    isWordCompletionPending = false;
    typingInput._prevLength = 0; // 입력 필드 이전 길이 초기화

    // 재시작 시 현재 선택된 난이도의 단어를 다시 로드
    loadWords(difficultySelect.value); // 현재 선택된 파일 다시 로드

}


// --- setNewWord 함수: 새로운 단어 설정 ---
function setNewWord() {
  // 현재 단어 수가 전체 단어 목록 길이를 초과했거나 단어 목록이 비었으면 게임 종료 처리
  if (words.length === 0) {
      // 단어 없음 상태 처리
      wordDisplay.innerHTML = "단어 목록이 비어있습니다.";
      meaningElement.textContent = "뜻: -";
      pronunciationElement.textContent = "발음: -";
      koreanPronunciationElement.textContent = "한글 발음: -";
       if (appearanceCountElement) appearanceCountElement.textContent = '0';
       if (resetCountElement) resetCountElement.textContent = '0';

      typingInput.disabled = true;
      clearInterval(typingTimer);
      gameStarted = false;
      startButton.disabled = false;
      difficultySelect.disabled = false; // 단어 없을 시 난이도 선택 활성화
      isWordCompletionPending = false; // 플래그 초기화
      return;
  }

  // 단어 완료 처리 플래그 초기화 - 중요! 다음 단어가 시작됨.
  isWordCompletionPending = false;

  // --- TODO: 여기에 단어 출현 확률 조정 로직 추가 (weighted random selection) ---
  // 현재는 단순 무작위 선택
  // TODO: 통계 데이터를 활용하여 가중치 기반으로 단어 선택 로직 변경
  const randomIndex = Math.floor(Math.random() * words.length);
  currentWord = words[randomIndex];

  // --- TODO: 여기에 현재 단어의 출현 횟수 증가 및 초기화 로직 추가 ---
  // 예: wordStatistics[currentWord.word].appearanceCount++;
  // TODO: 출현 횟수가 10 이상이면 초기화 로직 실행 (resetCount++, appearanceCount = 0, 메시지 표시)
  // if (wordStatistics[currentWord.word].appearanceCount >= 10) { ... }

  // --- TODO: 단어 통계 표시 엘리먼트 업데이트 로직 추가 (HTML 추가 후) ---
  // if (appearanceCountElement && wordStatistics[currentWord.word]) appearanceCountElement.textContent = wordStatistics[currentWord.word].appearanceCount;
  // if (resetCountElement && wordStatistics[currentWord.word]) resetCountElement.textContent = wordStatistics[currentWord.word].resetCount;


  currentWordCharacters = currentWord.word.split(''); // 단어를 글자 배열로 분리
  typedCharactersCount = 0; // 현재 단어에서 맞게 입력된 글자 수 초기화 (UI 커서 위치용)
  typingInput.value = ""; // 입력 필드 비우기
  typingInput._prevLength = 0; // 입력 필드 이전 길이 초기화 (input 이벤트에서 사용)
  displayWord(); // 화면에 단어 표시 (초기 상태)

  // 뜻, 발음, 한글 발음 표시
  meaningElement.textContent = `뜻: ${currentWord.meaning}`;
  pronunciationElement.textContent = `발음: ${currentWord.pronunciation}`;
  // JSON에 korean_pronunciation 필드가 없을 경우 대비하여 || '-' 추가
  koreanPronunciationElement.textContent = `한글 발음: ${currentWord.korean_pronunciation || '-'}`;

  // --- 단어 읽어주기 ---
  // speakWord(currentWord.word); // 현재 단어를 음성으로 읽어줍니다. (주석 처리 - 필요시 활성화 및 Voice 설정)
  // Voice 설정 관련 주석 참고


  typingInput.focus(); // 새로운 단어 표시 후 입력 필드에 포커스
}

// --- 단어를 음성으로 읽어주는 함수 ---
// speakWord 함수는 이전 코드와 동일합니다.
function speakWord(wordToSpeak) {
    // 이미 다른 음성이 재생 중이면 중지합니다.
    if (synth.speaking) {
        synth.cancel();
    }
    // 읽을 텍스트를 Utterance 객체로 만듭니다.
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);
    // 기본 목소리 사용. 필요시 목소리 설정 추가.
    synth.speak(utterance);
}


// --- displayWord 함수: 화면에 단어 표시 (각 글자를 span으로 감싸서 초기 상태 표시) ---
function displayWord() {
    wordDisplay.innerHTML = currentWordCharacters.map((char, index) => {
        return `<span>${char}</span>`; // 초기에는 current 클래스 없이 span만 만듭니다.
    }).join('');
    // 초기 로딩 후 바로 색상 업데이트를 호출하여 첫 글자에 current 클래스 적용
    updateWordDisplayColors(typingInput.value, currentWord.word);
}


// --- startTimer 함수 ---
function startTimer() {
  typingTimer = setInterval(() => {
    if (timer > 0) {
      timer--;
      timerElement.textContent = `시간: ${timer}초`;
    } else {
      clearInterval(typingTimer);
      endGame(); // 시간 종료 시 게임 종료
    }
  }, 1000); // 1초마다 타이머 감소
}

 // --- updateAccuracy 함수: 정확도 계산 및 표시 ---
function updateAccuracy() {
    if (totalCharactersTyped === 0) {
        accuracyElement.textContent = `정확도: 100%`;
    } else {
        const accuracy = ((totalCharactersTyped - totalErrors) / totalCharactersTyped) * 100;
        accuracyElement.textContent = `정확도: ${accuracy.toFixed(1)}%`;
    }
}


// --- updateWordDisplayColors 함수: 현재까지 입력된 내용을 바탕으로 화면의 단어 색상 업데이트 ---
function updateWordDisplayColors(userInput, targetWord) {
     const wordSpans = wordDisplay.querySelectorAll('span');
     const inputLength = userInput.length; // 현재 입력 필드의 실제 길이
     const targetLength = targetWord.length; // 목표 단어의 길이

     wordSpans.forEach((span, index) => {
         // 기존 클래스 제거
         span.classList.remove('correct', 'incorrect', 'current');

         if (index < inputLength) {
             // 사용자가 입력한 글자 범위 내
             // 목표 단어 길이를 초과하여 입력된 글자는 'incorrect'로 표시
             if (index < targetLength && userInput[index] === targetWord[index]) {
                 span.classList.add('correct'); // 맞음 (목표 단어 범위 내)
             } else {
                 span.classList.add('incorrect'); // 틀림 또는 목표 단어 길이 초과
             }
         }

         // 다음에 입력해야 할 글자 하이라이트
         // 입력된 글자 수 위치에 있고, 목표 단어 길이보다 짧을 때
         if (index === inputLength && index < targetLength) {
              span.classList.add('current');
         }
     });

     // 입력 필드의 길이가 목표 단어 길이와 같아지면, 마지막 글자에 대한 current 클래스 제거
     if (inputLength >= targetLength && targetLength > 0) {
        const lastSpan = wordSpans[targetLength - 1];
        if (lastSpan) {
             lastSpan.classList.remove('current');
        }
     }
}


// --- endGame 함수: 게임 종료 처리 ---
function endGame() {
    gameStarted = false;
    typingInput.disabled = true;
    clearInterval(typingTimer);
    wordDisplay.innerHTML = `<div class="game-over">게임 종료!</div>`;
    meaningElement.textContent = "뜻: -";
    pronunciationElement.textContent = "발음: -";
    koreanPronunciationElement.textContent = "한글 발음: -";
     // 단어 통계 표시 엘리먼트 초기화
    if (appearanceCountElement) appearanceCountElement.textContent = '0';
    if (resetCountElement) resetCountElement.textContent = '0';

    startButton.disabled = false; // 시작 버튼 다시 활성화
    resetButton.disabled = false; // 재시작 버튼 활성화
    difficultySelect.disabled = false; // 게임 종료 후 난이도 선택 활성화

    // 최종 결과 표시
    const finalAccuracy = ((totalCharactersTyped - totalErrors) / (totalCharactersTyped || 1) * 100).toFixed(1);

    alert(
        `게임이 종료되었습니다!\n\n총 입력 시도 글자 수: ${totalCharactersTyped}\n오타 수: ${totalErrors}\n정확도: ${finalAccuracy}%\n완료 단어 수: ${wordCount}\n최종 점수: ${score}`
    );

    // 게임 종료 후 현재 단어 통계 저장
    saveWordStatistics();
}


// --- 단어 완료 처리 함수 ---
// 이 함수는 단어 입력이 완료되었을 때 (스페이스/엔터) 호출됩니다.
// 중복 호출을 방지하고 다음 단어 전환을 예약합니다.
function processWordCompletion(userInput, targetWord) {
    // 이미 다음 단어 전환이 진행 중이면 이 함수는 여기서 종료합니다.
    if (isWordCompletionPending) {
        return;
    }
    // 플래그 설정: 이제 단어 완료 처리가 시작됩니다.
    isWordCompletionPending = true;

    // 사용자가 현재 단어를 맞게 입력했는지 확인 (점수/통계용)
    // 이 시점의 userInput은 단어 길이와 같거나, 스페이스/엔터 직전의 값입니다.
    const isCorrect = (userInput === targetWord); // 단어 완료 시점의 최종 정확성

    if (isCorrect) {
        // 단어를 맞게 입력한 경우
        score += 10; // 점수 증가
        wordCount++; // 맞춘 단어 수 증가
        scoreElement.textContent = `점수: ${score}`;
        wordCountElement.textContent = `단어 수: ${wordCount}`;
        // totalErrors와 totalCharactersTyped는 input 이벤트에서 이미 글자 단위로 계산되었습니다.
    } else {
        // 단어를 틀리게 입력한 경우
        // 틀렸다는 피드백은 updateWordDisplayColors에서 이미 제공됩니다.
    }

    // --- TODO: 여기에 현재 단어의 출현 횟수 증가 및 초기화 로직 추가 ---
    // targetWord를 키로 사용하여 wordStatistics 객체 업데이트
     if (wordStatistics[targetWord]) {
        wordStatistics[targetWord].appearanceCount++;

        // 출현 횟수 10회 도달 시 초기화
        if (wordStatistics[targetWord].appearanceCount >= 10) { // 10회 기준
             wordStatistics[targetWord].appearanceCount = 0;
             wordStatistics[targetWord].resetCount++;
             console.log(`단어 '${targetWord}'가 10번 나왔습니다. 초기화 횟수: ${wordStatistics[targetWord].resetCount}`);
             // TODO: 화면에 초기화 메시지 표시 로직 추가
        }
     } else {
         // 예상치 못한 경우: 통계 데이터에 단어가 없음 (loadWords에서 초기화되어야 함)
         console.warn(`통계 데이터에 없는 단어 출현: ${targetWord}`);
         wordStatistics[targetWord] = { appearanceCount: 1, resetCount: 0 };
     }

     // TODO: 단어 통계 표시 엘리먼트 업데이트 로직 추가 (HTML 추가 후)
     if (appearanceCountElement && wordStatistics[targetWord]) appearanceCountElement.textContent = wordStatistics[targetWord].appearanceCount;
     if (resetCountElement && wordStatistics[targetWord]) resetCountElement.textContent = wordStatistics[targetWord].resetCount;

     // 통계 데이터 저장
     saveWordStatistics();


    // --- 다음 단어로 넘어가는 로직 ---
    // 맞았든 틀렸든, 단어 완료 시 다음 단어로 넘어갑니다.
    // 약간의 딜레이를 두어 사용자가 결과(맞았는지 틀렸는지 색상)를 잠깐 볼 시간을 줍니다.
    // Note: 여기의 딜레이 시간을 수정하면 됩니다. 기본 500ms
    setTimeout(() => {
         setNewWord(); // 다음 단어 설정 (이 함수 안에서 isWordCompletionPending = false로 초기화됩니다)
     }, 500); // <-- 이 숫자를 조절하여 딜레이 시간을 변경하세요 (밀리초 단위)

    // 정확도 업데이트 (optional)
    // updateAccuracy(); // 필요하다면 여기서 한 번 더 호출 가능
}


// --- Keydown 이벤트 리스너로 스페이스바 또는 엔터 처리 ---
// 스페이스바나 엔터를 눌렀을 때 단어 완료로 간주하고 processWordCompletion 호출
typingInput.addEventListener('keydown', function(event) {
    // 게임 중이 아니거나, 현재 단어가 없으면 무시
    if (!gameStarted || !currentWord || currentWordCharacters.length === 0) {
         // 게임 시작 전 스페이스바/엔터 입력 시 기본 동작 방지
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }

    const userInput = typingInput.value; // 현재까지 입력된 값
    const targetWord = currentWord.word; // 현재 목표 단어
    const targetLength = targetWord.length; // 목표 단어 길이

    // 스페이스바 또는 엔터 키를 눌렀을 때 처리
    if (event.key === ' ' || event.key === 'Enter') {

        // --- **수정 부분:** 단어 완성 후에만 (길이가 같거나 클 때) 스페이스/엔터로 완료 처리 ---
        // 입력 필드가 비어있거나 목표 단어 길이보다 짧으면...
        if (userInput.length === 0 || userInput.length < targetLength) {
             // 입력 필드가 비어있거나 단어 완성 전이면...
             // 스페이스바의 기본 동작을 허용하여 입력 필드에 스페이스가 들어가게 합니다.
             // (단, Enter는 기본 동작 방지하여 줄바꿈 막음)
             if (event.key === 'Enter') {
                  event.preventDefault(); // Enter의 줄바꿈만 막음
             }
             // Note: 스페이스바는 여기에서 preventDefault를 하지 않으므로 입력 필드에 추가됩니다.
             console.log("단어 완성 전 스페이스바/엔터 누름 또는 빈 입력 - 무시 (완료 처리만)");
             return; // 단어 완료 처리는 하지 않고 함수 실행 종료
        }
        // --- 수정 부분 끝 ---

        // --- **수정 부분:** 단어 완성 후에 스페이스/엔터가 눌렸을 때만 기본 동작 방지 ---
         event.preventDefault(); // 단어 완성 후에만 기본 동작(스페이스/엔터 추가) 막기

        // 단어 길이가 충족되었고 스페이스/엔터가 눌렸으니 단어 완료 처리 함수 호출
        // processWordCompletion 내부에서 isWordCompletionPending 체크 및 setTimeout 호출 관리
        processWordCompletion(userInput, targetWord);

    }

    // Enter/Space 외의 키 입력은 input 이벤트 리스너에서 처리
    // Note: input 이벤트 리스너에서는 입력 길이 완료 시 자동으로 다음 단어로 넘어가지 않습니다.
    // 오직 Space 또는 Enter 키를 눌렀을 때만 processWordCompletion이 호출되어 넘어갑니다.

});


// --- input 이벤트 리스너 (실시간 오타 표시 및 통계 누적) ---
// 사용자가 글자를 '입력'할 때마다 발생합니다.
// keydown에서 preventDefault로 막지 않은 키 입력 (일반 문자, 중간 스페이스)에 의해 발생
// 이 리스너는 단어 완료 시 다음 단어로 직접 넘어가지 않습니다.
typingInput.addEventListener("input", (e) => {
    // 게임 중이 아니거나, 현재 단어가 없으면 무시
    if (!gameStarted || !currentWord || currentWordCharacters.length === 0) {
        if (!gameStarted && typingInput.value !== "") {
             typingInput.value = ""; // 게임 시작 전 잘못된 입력 초기화
        }
        return;
    }

    const userInput = typingInput.value; // 사용자가 현재까지 입력한 전체 문자열
    const targetWord = currentWord.word; // 현재 목표 단어 문자열
    const targetLength = targetWord.length; // 목표 단어 길이

    // 사용자가 글자를 추가했을 때만 totalCharactersTyped와 totalErrors 업데이트
    // input 이벤트는 백스페이스/delete 시에도 발생하므로, 입력 길이를 비교하여 처리
    // keydown에서 preventDefault로 막지 않은 일반 문자나 중간 스페이스에 의해 발생
    if (userInput.length > (typingInput._prevLength || 0)) { // 입력 길이가 늘어났을 때
         totalCharactersTyped++; // 총 입력 글자 수 증가 (오타 포함)

         // 입력된 마지막 글자가 목표 글자와 다른 경우 오타 카운트
         // userInput.length - 1 인덱스가 targetWord.length를 넘지 않도록 방어 코드 추가
         const lastTypedCharIndex = userInput.length - 1;
         if (lastTypedCharIndex < targetLength && userInput[lastTypedCharIndex] !== targetWord[lastTypedCharIndex]) {
              totalErrors++; // 오타 수 증가
         }
         // Note: 목표 단어 길이를 초과하여 입력된 글자는 오타로 카운트하지 않습니다 (선택 사항).
         // if (lastTypedCharIndex >= targetLength) { /* 초과된 글자에 대한 특별 처리 필요 시 */ }
    }
    // else if (userInput.length < (typingInput._prevLength || 0)) { // 입력 길이가 줄어들었을 때 (백스페이스/삭제)
        // 백스페이스/삭제 시 로직 (필요 시 구현)
        // 오타 수 감소 로직 등은 더 복잡하며, 일반적으로 타자 연습 정확도 계산 시
        // 백스페이스로 인한 수정은 오타로 간주하고 지나간 오타 수를 되돌리지 않습니다.
        // 여기서는 단순화를 위해 백스페이스 시 오타 수 감소 로직은 생략합니다.
    // }


     // 현재 입력된 내용을 바탕으로 화면의 단어 색상 업데이트
     // 이 함수는 실시간 피드백 UI만 업데이트합니다.
     updateWordDisplayColors(userInput, targetWord);

     // 입력 필드의 이전 길이를 저장 (다음 input 이벤트에서 사용)
     typingInput._prevLength = userInput.length;


     // --- 단어 완료 체크 (입력 길이 기준 - 제거됨) ---
     // input 이벤트는 더 이상 입력 길이만으로 다음 단어로 직접 넘어가지 않습니다.
     // 단어 완성 후 Space/Enter keydown을 눌러야 넘어갑니다.
     // 이 부분이 의도적으로 제거되었습니다.


     // 정확도 업데이트 (입력할 때마다 실시간 업데이트)
     updateAccuracy();

});


// --- 이벤트 리스너 연결 ---
startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetGame);

// --- 난이도 선택 변경 이벤트 ---
difficultySelect.addEventListener('change', function() {
    const selectedFile = this.value; // 선택된 option의 value (파일 경로)
    // 게임 중이 아닐 때만 단어 로드
    if (!gameStarted) {
         resetGame(); // resetGame 내부에서 loadWords 호출

    } else {
        // 게임 중에는 난이도 변경 시도 시 알림
         alert("게임 중에는 난이도를 변경할 수 없습니다. 재시작 해주세요.");
         // 이전에 선택했던 값으로 되돌리는 로직은 추가 구현 필요
    }
});

// --- 페이지 언로드 시 localStorage에 통계 저장 ---
// 사용자가 페이지를 떠나거나 새로고침하기 전에 데이터를 저장합니다.
window.addEventListener('beforeunload', saveWordStatistics);

// --- 초기화 버튼 클릭 시 통계 초기화 (선택 사항) ---
// resetButton.addEventListener('click', function() {
//     // 재시작 시 통계를 유지하고 싶다면 이 부분은 주석 처리
//     // 만약 재시작 버튼으로 통계까지 완전히 초기화하고 싶다면 여기에 로직 추가
//     // 예: wordStatistics = {}; saveWordStatistics();
// });


// --- 페이지 로드 시 초기 단어 로드 (기본값 선택) ---
loadWords(difficultySelect.value);

// --- totalCharactersTyped 초기값 설정 ---
// input 이벤트 리스너 안에서 초기화하므로 여기서 별도로 할 필요는 없습니다.
// typingInput._prevLength = 0; // -> startGame, setNewWord, resetGame에 포함됨.