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

// --- 단어 횟수 및 초기화 횟수를 표시할 엘리먼트 추가 ---
// 이 엘리먼트들은 index.html에 id="appearanceCount", id="resetCount", id="resetMessage"로 추가되어 있어야 합니다.
const appearanceCountElement = document.getElementById('appearanceCount'); // Corrected ID in HTML: appearanceCount
const resetCountElement = document.getElementById('resetCount');
const resetMessageElement = document.getElementById('resetMessage'); // 초기화 메시지 표시 엘리먼트

let words = []; // 현재 불러온 단어들 (선택된 난이도의 전체 JSON 데이터)
let playableWords = []; // 이번 게임 세션에서 실제로 연습할 단어 목록 (words 에서 뽑아서 셔플된 100개)

let currentWord = null; // 현재 타이핑할 단어 객체
let currentWordCharacters = []; // 현재 단어를 글자 단위로 분리한 배열
let typedCharactersCount = 0; // 현재 단어에서 입력된 글자 수 (UI 표시용)
let totalCharactersTyped = 0; // 전체 게임에서 사용자가 실제로 키보도로 누른 총 글자 수 (오타 포함, 백스페이스 제외)
let totalErrors = 0; // 전체 게임에서 발생한 오타 수

let timer = 300; // 게임 시간 (초)
let typingTimer = null; // 타이머 setInterval ID
let gameStarted = false;
let score = 0; // 점수
let wordCount = 0; // 맞춘 단어 수

// --- 단어 완료 처리 플래그: 단어 완료 처리가 진행 중인지 확인 ---
let isWordCompletionPending = false; // 다음 단어로 넘어가는 과정이 시작되었는지 여부

// --- 음성 합성 객체 준비 ---
const synth = window.speechSynthesis; // Web Speech API의 음성 합성 객체

// --- 단어별 통계 데이터 ---
// 각 난이도 파일의 단어별 { appearanceCount: 출현 횟수, resetCount: 초기화 횟수 }를 저장할 객체
// 키는 단어 자체 (currentWord.word) 사용
// 이 통계는 로드된 전체 난이도 단어에 대한 통계가 유지됩니다.
let wordStatistics = {}; // { "word1": { appearanceCount: 5, resetCount: 1 }, "word2": { appearanceCount: 2, resetCount: 0 }, ... }

// --- localStorage 키 생성 함수 ---
// 난이도 파일 경로에 따라 고유한 localStorage 키를 생성합니다.
function getStatsStorageKey(filePath) {
    return `wordStats_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`; // 파일 경로의 특수문자 제거
}


// --- localStorage에 단어 통계 저장 함수 ---
function saveWordStatistics() {
    // 게임 중이 아닐 때나 단어 목록이 비어있으면 저장하지 않음 (불필요한 저장 방지)
    // playableWords가 아닌, 로드된 전체 단어(words)에 대한 통계를 저장합니다.
    if (!gameStarted && words.length === 0) return;

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
// 이 함수는 선택된 난이도의 '전체' 단어를 로드합니다.
async function loadWords(filePath) {
    console.log("loadWords called with filePath:", filePath); // 함수 호출 로그 시작

    words = []; // 기존 단어 목록 초기화 (선택된 난이도의 전체 단어)
    playableWords = []; // 연습할 단어 목록 초기화

    // wordStatistics는 난이도 파일 기준으로 로드/저장되므로 초기화하지 않습니다.
    // 다른 난이도 파일 선택 시 wordStatistics는 새로 로드됩니다.

    wordDisplay.innerHTML = "단어 로딩 중...";
    meaningElement.textContent = "뜻: 로딩 중...";
    pronunciationElement.textContent = "발음: 로딩 중...";
    koreanPronunciationElement.textContent = "한글 발음: 로딩 중...";

     // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
     if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
     if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
     if (resetMessageElement) resetMessageElement.textContent = ''; // 초기화 메시지 초기화


    typingInput.disabled = true; // 로딩 중 입력 비활성화
    startButton.disabled = true; // 로딩 중 시작 버튼 비활성화
    difficultySelect.disabled = true; // 로딩 중 난이도 선택 비활성화

    console.log("loadWords: 파일 fetch 시도..."); // fetch 시작 전 로그

    try {
        const response = await fetch(filePath);
        console.log("loadWords: fetch 응답 받음.", response); // fetch 응답 로그

        if (!response.ok) {
            console.error(`loadWords: HTTP 오류! 상태: ${response.status} from ${filePath}`); // HTTP 오류 로그
            throw new Error(`HTTP error! status: ${response.status} from ${filePath}`);
        }

        console.log("loadWords: 응답 OK, JSON 파싱 시도..."); // JSON 파싱 시작 전 로그
        words = await response.json(); // 선택된 난이도의 전체 단어 로드
        console.log(`loadWords: 단어 로드 완료 (${filePath}):`, words.length, "단어 목록 (일부 표시):", Array.isArray(words) ? words.slice(0, 5) : words); // 로드된 단어 목록 일부 로그


        // --- localStorage에서 단어 통계 로드 ---
        // 선택된 난이도 파일에 대한 통계 로드
        const storageKey = getStatsStorageKey(filePath);
        const savedStats = localStorage.getItem(storageKey);

        console.log(`loadWords: localStorage에서 통계 로드 시도 (${storageKey}).`); // localStorage 로드 시도 로그

        if (savedStats) {
            try {
                wordStatistics = JSON.parse(savedStats);
                console.log(`loadWords: localStorage에서 통계 로드 완료 (${storageKey})`);
                // 로드된 통계 데이터에 없는 새로운 단어는 초기화 (현재 로드된 words 목록 기준)
                words.forEach(word => {
                    if (word && typeof word.word === 'string' && !wordStatistics[word.word]) {
                         wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
                    } else if (word && word !== null && typeof word.word !== 'string') { // word가 null이 아닐 때만 word.word 체크
                         console.warn("loadWords: 로드된 단어 객체에 'word' 속성이 없거나 문자열이 아닙니다:", word);
                    }
                });
                 console.log("loadWords: 로드된 통계와 words 배열 병합 완료."); // 병합 완료 로그

            } catch (e) {
                console.error("loadWords: localStorage 통계 파싱 오류:", e); // localStorage 파싱 오류 로그
                wordStatistics = {}; // 오류 발생 시 통계 초기화
                // 로드된 통계 데이터에 없는 새로운 단어 초기화
                 words.forEach(word => {
                    if (word && typeof word.word === 'string') { // word.word 속성이 있고 문자열인지 확인
                         wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
                     } else if (word && word !== null) { // word가 null이 아닐 때만 경고
                         console.warn("loadWords: 파싱 오류 후 단어 초기화 중, 'word' 속성 없음:", word);
                     }
                });
                 console.log("loadWords: 통계 파싱 오류 발생 후 wordStatistics 재초기화 완료."); // 재초기화 완료 로그
            }
        } else {
             // localStorage에 통계가 없으면 현재 로드된 words 목록 기준으로 모든 단어 통계 초기화
             console.log(`loadWords: localStorage에 통계 없음 (${storageKey}). 초기화합니다.`);
             wordStatistics = {}; // 전체 통계 초기화
             words.forEach(word => {
                 if (word && typeof word.word === 'string') { // word.word 속성이 있고 문자열인지 확인
                     wordStatistics[word.word] = { appearanceCount: 0, resetCount: 0 };
                 } else if (word && word !== null) { // word가 null이 아닐 때만 경고
                      console.warn("loadWords: localStorage 없음, 단어 초기화 중, 'word' 속성 없음:", word);
                 }
            });
            console.log("loadWords: localStorage 통계 초기화 완료."); // 초기화 완료 로그
        }

         console.log("loadWords: 최종 wordStatistics 상태 (로드 후):", wordStatistics); // 최종 통계 데이터 상태 로그


        if (words.length > 0) {
             console.log("loadWords: 단어 로드 성공, UI 업데이트 시작."); // 성공 UI 업데이트 시작 로그
             wordDisplay.innerHTML = `총 ${words.length}개의 단어 로드 완료.<br>시작 버튼을 누르세요.`;
             meaningElement.textContent = "뜻: -";
             pronunciationElement.textContent = "발음: -";
             koreanPronunciationElement.textContent = "한글 발음: -";
             // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
             if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
             if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
             if (resetMessageElement) resetMessageElement.textContent = ''; // 메시지 초기화


             typingInput.disabled = true; // 게임 시작 전 입력 비활성화
             startButton.disabled = false; // 단어를 성공적으로 로드했으니 시작 버튼 활성화
             difficultySelect.disabled = false; // 단어 로드 성공 후 난이도 선택 활성화
             console.log("loadWords: UI 업데이트 완료. 시작 가능."); // 성공 UI 업데이트 완료 로그


        } else {
             console.warn(`loadWords: 파일(${filePath})에 단어가 없습니다. words.length: ${words.length}`); // 단어 없음 경고 로그
            wordDisplay.innerHTML = `선택한 파일(${filePath})에 단어가 없습니다.`;
             meaningElement.textContent = "뜻: -";
             pronunciationElement.textContent = "발음: -";
             koreanPronunciationElement.textContent = "한글 발음: -";
              // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
              if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
              if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
              if (resetMessageElement) resetMessageElement.textContent = ''; // 메시지 초기화

             typingInput.disabled = true;
             startButton.disabled = true; // 단어가 없으니 시작 버튼 비활성화
             difficultySelect.disabled = false; // 단어 없어도 난이도 선택은 가능
             console.log("loadWords: 단어 없음 UI 업데이트 완료."); // 단어 없음 UI 업데이트 완료 로그
        }


    } catch (error) {
        console.error("loadWords: 단어 로드 실패 (Catch 블록):", error); // 로드 실패 (catch 블록) 로그
        wordDisplay.innerHTML = `단어 로드 실패: ${error.message}`;
        meaningElement.textContent = "뜻: 에러";
        pronunciationElement.textContent = "발음: 에러";
        koreanPronunciationElement.textContent = "한글 발음: 에러";
         // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
         if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
         if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
         if (resetMessageElement) resetMessageElement.textContent = ''; // 초기화 메시지 초기화
        typingInput.disabled = true;
        startButton.disabled = true;
        difficultySelect.disabled = false;
        console.log("loadWords: 로드 실패 UI 업데이트 완료."); // 로드 실패 UI 업데이트 완료 로그
    }
     console.log("loadWords 함수 실행 종료."); // 함수 실행 종료 로그
}

// ... 나머지 코드는 그대로 ...

// --- Fisher-Yates 셔플 알고리즘 ---
// 배열을 무작위로 섞는 함수
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // 요소 교환
    }
    return array;
}


// --- startGame 함수 ---
function startGame() {
    console.log("startGame called"); // 함수 호출 로그

    // 단어 로드 확인 및 게임 중복 실행 방지
    // words 배열은 선택된 난이도의 '전체' 단어 목록입니다.
    if (words.length === 0 || gameStarted) {
        if(words.length === 0) {
             alert("먼저 단어를 로드해주세요. 난이도를 선택하거나 파일 경로를 확인하세요.");
             console.warn("단어가 로드되지 않았거나 비어있습니다.");
        } else if (gameStarted) {
            console.warn("게임이 이미 시작되었습니다.");
        }
        // --- 여기에서 함수가 종료되는지 확인 ---
        console.log("startGame 함수 초기 체크에서 종료됨. words.length:", words.length, "gameStarted:", gameStarted); // 추가 로그
        return; // <-- 여기서 return 되는 경우 단어 선택 로직까지 가지 않습니다.
    }

    console.log("startGame 초기 체크 통과."); // 추가 로그
    console.log("게임 시작 전 words 배열 상태:", words); // 추가 로그 (로드된 전체 단어)


    gameStarted = true;
    score = 0; // 점수 초기화
    wordCount = 0; // 단어 수 초기화
    typedCharactersCount = 0; // 현재 단어 입력 상태 초기화 (UI용)
    totalCharactersTyped = 0; // 전체 게임 통계 초기화
    totalErrors = 0; // 전체 게임 통계 초기화
    timer = 300; // 게임 시간 (초) (원하는 시간으로 변경)
    scoreElement.textContent = `점수: ${score}`;
    wordCountElement.textContent = `단어 수: ${wordCount}`;
    accuracyElement.textContent = `정확도: 100%`; // 초기 정확도 100%
    timerElement.textContent = `시간: ${timer}초`;
    typingInput.value = ""; // 입력 필드 비우기
    typingInput.disabled = false; // 입력 활성화
    typingInput.focus(); // 입력 필드에 포커스

    // 단어 완료 처리 플래그 초기화
    isWordCompletionPending = false;

    // 초기화 메시지 숨기기
    if (resetMessageElement) resetMessageElement.textContent = '';

    // --- 게임에 사용할 100개 단어 목록 준비 (셔플 및 추출) ---
    const batchSize = 100; // <-- 한 게임에 연습할 단어 개수 (여기서 조절)

    console.log(`게임에 사용할 단어 ${batchSize}개 준비 시작. 로드된 전체 단어 수: ${words.length}`); // 추가 로그


    // 1. 현재 로드된 난이도의 전체 단어 목록 (words 배열)을 셔플합니다.
    //    words 배열이 비어있으면 여기서 오류 발생 가능성? (shuffleArray 함수 확인 필요)
    let shuffledWords = [];
    if (Array.isArray(words) && words.length > 0) {
        shuffledWords = shuffleArray([...words]); // 원본 words 배열을 복사하여 셔플
         console.log(`words 배열 셔플 완료. 셔플된 배열 길이: ${shuffledWords.length}`); // 추가 로그
    } else {
         console.warn("words 배열이 비어있거나 배열이 아닙니다. 셔플 건너뜀."); // 추가 로그
         // words 배열이 비어있으면 playableWords 도 비게 됩니다.
    }


    // 2. 셔플된 목록에서 원하는 개수만큼 잘라내어 이번 게임의 연습 목록을 만듭니다.
    //    shuffledWords 가 비어있다면 playableWords 도 비게 됩니다.
    playableWords = shuffledWords.slice(0, Math.min(batchSize, shuffledWords.length));

    console.log(`이번 게임에 사용할 단어 ${playableWords.length}개 준비 완료 (셔플됨).`); // 추가 로그
    console.log("PlayableWords (연습 목록):", playableWords.slice(0, Math.min(5, playableWords.length))); // 연습 목록 일부/전체 로그


    // --- 첫 단어 설정 ---
    // playableWords 가 비어있다면 setNewWord 함수 안에서 처리됩니다.
    setNewWord(); // 이제 playableWords 에서 단어를 선택합니다.

    startTimer(); // 타이머 시작
    startButton.disabled = true; // 게임 시작 후 시작 버튼 비활성화
    resetButton.disabled = false; // 재시작 버튼 활성화
    difficultySelect.disabled = true; // 게임 시작 후 난이도 선택 비활성화

    // 입력 필드의 이전 길이를 저장하는 변수 초기화 (input 이벤트에서 사용)
    typingInput._prevLength = 0;
}

// ... 나머지 코드는 그대로 ...

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
     // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
    if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
    if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
    if (resetMessageElement) resetMessageElement.textContent = ''; // 초기화 메시지 초기화


     // 단어 완료 처리 플래그 초기화
    isWordCompletionPending = false;
    typingInput._prevLength = 0; // 입력 필드 이전 길이 초기화

    // 재시작 시 현재 선택된 난이도의 단어를 다시 로드
    // loadWords(difficultySelect.value); // resetGame 에서 다시 로드하면 playableWords 가 초기화되므로 주석 처리
    // 대신 게임을 다시 시작하려면 Start 버튼을 누르도록 유도
     wordDisplay.innerHTML = "재시작하려면 Start 버튼을 누르세요."; // 메시지 변경
     playableWords = []; // 연습 단어 목록을 비워서 다시 시작 버튼 누르도록
}


// --- setNewWord 함수: 새로운 단어 설정 ---
function setNewWord() {
  console.log("setNewWord called"); // 함수 호출 로그

  // 연습할 단어 목록(playableWords)이 비었는지 확인
  // 게임 시작 시 playableWords 가 채워집니다.
  if (playableWords.length === 0) {
      console.warn("playableWords list is empty in setNewWord."); // 단어 목록 비어있음 경고
      // 게임 종료 또는 다음 라운드 종료 처리
      endGame(); // 연습할 단어가 없으면 게임 종료
      return;
  }

  // --- 단어 출현 확률 조정 로직 (weighted random selection) ---
  // playableWords (이번 게임의 100개 단어 목록) 내에서 통계 기반으로 단어 선택
  const weightedWords = [];
  let totalWeight = 0;

  // playableWords 배열 순회 (words 배열 대신)
  playableWords.forEach(word => {
      const wordText = word.word;
      // 통계 데이터가 없으면 초기화 (로드된 전체 단어 기준으로 초기화되어 있어야 함)
      if (!wordStatistics[wordText]) {
           // 이 경우는 loadWords 에서 초기화가 제대로 안된 드문 경우
           wordStatistics[wordText] = { appearanceCount: 0, resetCount: 0 };
           console.warn(`wordStatistics에 없던 단어 추가됨 (setNewWord 가중치 계산 중): ${wordText}`);
      }

      const stats = wordStatistics[wordText];
      // 간단한 가중치 계산: 출현 횟수가 적을수록, 초기화 횟수가 적을수록 가중치 높게
      // (appearanceCount + 1)은 출현 횟수 0일 때 나누기 0을 방지
      // (stats.resetCount * 5)는 초기화 횟수가 많을수록 가중치를 더 낮게 만들기 위함 (조절 가능)
      const weight = 1 / (stats.appearanceCount + 1 + stats.resetCount * 5);

      totalWeight += weight;
      // playableWords 에 있는 단어 객체를 weightedWords 에 추가
      weightedWords.push({ word: word, weight: weight, cumulativeWeight: totalWeight });
  });

  // 누적 가중치 목록에서 무작위 선택
  const randomNumber = Math.random() * totalWeight; // 총 가중치 범위 내에서 무작위 숫자 생성
  let selectedWord = null;

  for (let i = 0; i < weightedWords.length; i++) {
      if (randomNumber <= weightedWords[i].cumulativeWeight) {
          selectedWord = weightedWords[i].word; // 선택된 단어 객체 가져옴
          break; // 선택되면 반복 중단
      }
  }

  // 만약 어떤 이유로 선택되지 않았다면 (거의 발생하지 않음), playableWords 의 첫 번째 단어 선택 등 fallback 로직 추가
  if (!selectedWord && playableWords.length > 0) {
      console.warn("Weighted selection failed, falling back to first word in playableWords.");
      selectedWord = playableWords[0]; // fallback: 연습 목록의 첫 번째 단어
        if (!wordStatistics[selectedWord.word]) { // fallback 단어 통계 초기화 확인
           wordStatistics[selectedWord.word] = { appearanceCount: 0, resetCount: 0 };
       }
  }
   // 만약 playableWords.length > 0 인데도 selectedWord가 null이면 심각한 문제
   if (!selectedWord && playableWords.length > 0) {
        console.error("Weighted selection and fallback failed. playableWords array:", playableWords);
         wordDisplay.innerHTML = "단어 선택 오류 발생"; // 오류 메시지 표시
         typingInput.disabled = true;
         startButton.disabled = false;
         difficultySelect.disabled = false;
         clearInterval(typingTimer); // 타이머 중지
         gameStarted = false; // 게임 상태 종료
         return; // 함수 중단
   }


  currentWord = selectedWord; // 최종 선택된 단어 설정

  console.log("Selected word object:", currentWord); // 선택된 단어 객체 로그
  console.log("Selected word text:", currentWord.word); // 선택된 단어 텍스트 로그


  // --- 현재 단어의 출현 횟수 증가 및 초기화 로직 ---
   const currentWordText = currentWord.word; // 여기서 currentWord.word 사용

   // 통계 데이터에 해당 단어가 없으면 초기화 (loadWords에서 이미 하지만 혹시 모를 경우)
    if (!wordStatistics[currentWordText]) {
         wordStatistics[currentWordText] = { appearanceCount: 0, resetCount: 0 };
         console.warn(`wordStatistics에 없던 단어 추가됨 (setNewWord 통계 업데이트 중): ${currentWordText}`);
    }

   wordStatistics[currentWordText].appearanceCount++;

   // 출현 횟수 10회 도달 시 초기화 (기준 횟수 조절 가능)
   const resetThreshold = 10; // 10회 기준
   if (wordStatistics[currentWordText].appearanceCount >= resetThreshold) {
        wordStatistics[currentWordText].appearanceCount = 0;
        wordStatistics[currentWordText].resetCount++;
        console.log(`단어 '${currentWordText}'가 ${resetThreshold}번 나왔습니다. 초기화 횟수: ${wordStatistics[currentWordText].resetCount}`);
        // 화면에 초기화 메시지 표시
         if (resetMessageElement) {
             resetMessageElement.textContent = `단어 '${currentWordText}'가 ${resetThreshold}번 나왔습니다. 초기화 횟수: ${wordStatistics[currentWordText].resetCount}`;
              // 메시지를 잠시 보여준 후 사라지게 할 수 있습니다.
              // setTimeout(() => { if (resetMessageElement) resetMessageElement.textContent = ''; }, 5000); // 5초 후 메시지 삭제
         }
   }


  // --- 단어 통계 표시 엘리먼트 업데이트 (레이블 포함) ---
  // appearanceCountElement와 resetCountElement가 HTML에 존재할 경우에만 업데이트
    if (appearanceCountElement && wordStatistics[currentWordText]) {
        appearanceCountElement.textContent = `출현 횟수: ${wordStatistics[currentWordText].appearanceCount}`; // 레이블 추가
    } else if (appearanceCountElement) { // 엘리먼트는 있는데 통계 데이터가 없을 경우 (초기 상태)
        appearanceCountElement.textContent = '출현 횟수: 0'; // 레이블 포함 초기화
    }
    if (resetCountElement && wordStatistics[currentWordText]) {
        resetCountElement.textContent = `정답 횟수: ${wordStatistics[currentWordText].resetCount}`; // 레이블 추가
    } else if (resetCountElement) { // 엘리먼트는 있는데 통계 데이터가 없을 경우 (초기 상태)
         resetCountElement.textContent = '정답 횟수: 0'; // 레이블 포함 초기화
    }


   // 통계 데이터 저장 (단어가 새로 나올 때마다 저장)
   saveWordStatistics();


  // playableWords 에서 현재 단어 제거 (중복 출현 방지 - 한 게임 내에서)
  // 주의: 이렇게 하면 playableWords 의 길이가 줄어들고, 모든 단어를 한 번씩 보면 playableWords 가 비게 됩니다.
  // 게임 한 판에 100개의 단어를 '모두 다른 단어'로 연습하고 싶다면 이 코드를 활성화합니다.
  // 만약 100개 단어 묶음 내에서 '반복 출현'을 허용하고 싶다면 이 코드를 주석 처리합니다.
  // 현재 목표는 100개씩 반복하며 외우는 것이므로, 여기서는 제거하지 않고 반복 출현을 허용하겠습니다.
  /*
   const currentWordIndexInPlayable = playableWords.findIndex(word => word.word === currentWordText);
   if (currentWordIndexInPlayable > -1) {
       playableWords.splice(currentWordIndexInPlayable, 1);
       console.log(`단어 '${currentWordText}'를 연습 목록에서 제거함. 남은 단어: ${playableWords.length}개`);
   }
  */


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
  speakWord(currentWord.word); // 현재 단어를 음성으로 읽어줍니다.

  typingInput.focus(); // 새로운 단어 표시 후 입력 필드에 포커스
}

// --- 단어를 음성으로 읽어주는 함수 ---
function speakWord(wordToSpeak) {
    // 이미 다른 음성이 재생 중이면 중지합니다.
    if (synth.speaking) {
        synth.cancel();
    }
    // 읽을 텍스트를 Utterance 객체로 만듭니다.
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);

    // --- 음성 목소리 설정 (선택 사항) ---
    // Console 에서 speechSynthesis.getVoices() 실행 결과 확인 후, 원하는 목소리의 name 을 여기에 넣어주세요.
     const voices = synth.getVoices();

     // !! 여기에 Console 에서 확인한 '원하는 목소리 이름'을 정확히 넣어주세요 !!
     const desiredVoiceName = 'Google US English'; // <-- 예시입니다. Console에서 확인한 이름으로 바꿔주세요.

     const preferredVoice = voices.find(voice => voice.name === desiredVoiceName); // 원하는 이름으로 찾기

     if (preferredVoice) {
         utterance.voice = preferredVoice;
         // console.log("음성 목소리 설정:", preferredVoice.name);
     } else {
         console.warn(`원하는 목소리(${desiredVoiceName})를 찾을 수 없습니다. 기본 목소리를 사용합니다.`);
         // 기본 목소리 사용 (아무것도 설정하지 않음)
     }


    // --- 속도나 음높이 조절 (선택 사항) ---
    // utterance.rate = 1.0; // 속도 (0.1 ~ 10, 기본값 1) - 1보다 작으면 느리게, 크면 빠르게
    // utterance.pitch = 1.0; // 음높이 (0 ~ 2, 기본값 1) - 1보다 작으면 낮게, 크면 높게

    // --- 주의: getVoices()는 비동기일 수 있습니다. 페이지 로드 직후 목소리 목록이 비어있을 수 있습니다. ---
    // voicesloaded 이벤트를 사용하거나, 목소리 목록을 불러온 후 목소리를 설정하는 것이 더 안전합니다.
    // 간단한 테스트를 위해 getVoices() 호출 결과를 콘솔에서 직접 확인하고,
    // 그 이름을 아래 코드에 직접 입력하는 방식으로 진행해 보겠습니다.
    // 동적으로 목소리 목록이 로드될 때까지 기다리는 코드는 좀 더 복잡합니다.


    // 음성 재생
    synth.speak(utterance);
}


// --- displayWord 함수: 화면에 단어 표시 (각 글자를 span으로 감싸서 초기 상태 표시) ---
function displayWord() {
    // wordDisplay 엘리먼트가 있는지 확인
    if (!wordDisplay) {
        console.error("wordDisplay element not found!");
        return;
    }
     // currentWordCharacters가 유효한 배열인지 확인
    if (!Array.isArray(currentWordCharacters)) {
         console.error("currentWordCharacters is not a valid array:", currentWordCharacters);
         wordDisplay.innerHTML = "단어 표시 오류"; // 오류 메시지 표시
         return;
    }

    wordDisplay.innerHTML = currentWordCharacters.map((char, index) => {
        return `<span>${char}</span>`; // 초기에는 current 클래스 없이 span만 만듭니다.
    }).join('');
    // 초기 로딩 후 바로 색상 업데이트를 호출하여 첫 글자에 current 클래스 적용
    // currentWord가 유효한 경우에만 호출
    if (currentWord && typeof currentWord.word === 'string') {
        updateWordDisplayColors(typingInput.value, currentWord.word);
    }
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
    // accuracyElement가 있는지 확인
    if (!accuracyElement) return;

    if (totalCharactersTyped === 0) {
        accuracyElement.textContent = `정확도: 100%`;
    } else {
        const accuracy = ((totalCharactersTyped - totalErrors) / totalCharactersTyped) * 100;
        accuracyElement.textContent = `정확도: ${accuracy.toFixed(1)}%`;
    }
}


// --- updateWordDisplayColors 함수: 현재까지 입력된 내용을 바탕으로 화면의 단어 색상 업데이트 ---
function updateWordDisplayColors(userInput, targetWord) {
     // wordDisplay 엘리먼트가 있는지 확인
     if (!wordDisplay) return;

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
     // 단어 통계 표시 엘리먼트 초기화 (레이블 포함)
    if (appearanceCountElement) appearanceCountElement.textContent = '출현 횟수: 0';
    if (resetCountElement) resetCountElement.textContent = '정답 횟수: 0';
    if (resetMessageElement) resetMessageElement.textContent = ''; // 메시지 초기화


    startButton.disabled = false; // 시작 버튼 다시 활성화
    resetButton.disabled = false; // 재시작 버튼 활성화
    difficultySelect.disabled = false; // 게임 종료 후 난이도 선택 활성화

    // 최종 결과 표시
    const finalAccuracy = ((totalCharactersTyped - totalErrors) / (totalCharactersTyped || 1) * 100).toFixed(1);

    alert(
        `게임이 종료되었습니다!\n\n총 입력 시도 글자 수: ${totalCharactersTyped}\n오타 수: ${totalErrors}\n정확도: ${finalAccuracy}%\n완료 단어 수: ${wordCount}\n최종 점수: ${score}`
    );

    // 게임 종료 후 현재 단어 통계 저장
    // playableWords 가 아닌, 로드된 전체 단어(words)에 대한 통계를 저장합니다.
    saveWordStatistics();
}


// --- 단어 완료 처리 함수 ---
// 이 함수는 단어 입력이 완료되었을 때 (스페이스/엔터) 호출됩니다.
// 중복 호출을 방지하고 다음 단어 전환을 예약합니다.
function processWordCompletion(userInput, targetWord) {
    // 이미 다음 단어 전환이 진행 중이면 이 함수는 여기서 종료합니다.
    if (isWordCompletionPending) {
        console.log("단어 완료 처리 이미 진행 중. 중복 호출 무시."); // 디버그 로그 추가
        return;
    }
    // 플래그 설정: 이제 단어 완료 처리가 시작됩니다.
    isWordCompletionPending = true;
    console.log("단어 완료 처리 시작. isWordCompletionPending =", isWordCompletionPending); // 디버그 로그 추가


    // 사용자가 현재 단어를 맞게 입력했는지 확인 (점수/통계용)
    // 이 시점의 userInput은 단어 길이와 같거나, 스페이스/엔터 직전의 값입니다.
    const isCorrect = (userInput === targetWord); // 단어 완료 시점의 최종 정확성

    if (isCorrect) {
        // 단어를 맞게 입력한 경우
        score += 10; // 점수 증가
        wordCount++; // 맞춘 단어 수 증가
        scoreElement.textContent = `점수: ${score}`;
        wordCountElement.textContent = `단어 수: ${wordCount}`;
        console.log("단어 정답 처리. 점수:", score, "단어 수:", wordCount); // 디버그 로그 추가
        // totalErrors와 totalCharactersTyped는 input 이벤트에서 이미 글자 단위로 계산되었습니다.
    } else {
        // 단어를 틀리게 입력한 경우
        console.log("단어 오답 처리."); // 디버그 로그 추가
        // 틀렸다는 피드백은 updateWordDisplayColors에서 이미 제공됩니다.
    }

    // --- 현재 단어의 출현 횟수 증가 및 초기화 로직 ---
    const currentWordText = currentWord.word; // currentWordText는 이미 유효하다고 가정 (setNewWord에서 체크)

    // 통계 데이터에 해당 단어가 없으면 초기화 (로드된 전체 단어 기준으로 초기화되어 있어야 함)
    if (!wordStatistics[currentWordText]) {
         wordStatistics[currentWordText] = { appearanceCount: 0, resetCount: 0 };
         console.warn(`wordStatistics에 없던 단어 추가됨 (processWordCompletion): ${currentWordText}`);
    }

    wordStatistics[currentWordText].appearanceCount++;
    console.log(`단어 '${currentWordText}' 출현 횟수 증가: ${wordStatistics[currentWordText].appearanceCount}`); // 디버그 로그 추가


    // 출현 횟수 10회 도달 시 초기화 (기준 횟수 조절 가능)
    const resetThreshold = 10; // 10회 기준
    if (wordStatistics[currentWordText].appearanceCount >= resetThreshold) {
         wordStatistics[currentWordText].appearanceCount = 0;
         wordStatistics[currentWordText].resetCount++;
         console.log(`단어 '${currentWordText}'가 ${resetThreshold}번 나왔습니다. 통계 초기화. 초기화 횟수: ${wordStatistics[currentWordText].resetCount}`); // 디버그 로그 추가
         // 화면에 초기화 메시지 표시
          if (resetMessageElement) {
              resetMessageElement.textContent = `단어 '${currentWordText}'가 ${resetThreshold}번 나왔습니다. 초기화 횟수: ${wordStatistics[currentWordText].resetCount}`;
               // 메시지를 잠시 보여준 후 사라지게 할 수 있습니다.
               // setTimeout(() => { if (resetMessageElement) resetMessageElement.textContent = ''; }, 5000); // 5초 후 메시지 삭제
          }
    }


    // --- 단어 통계 표시 엘리먼트 업데이트 (레이블 포함) ---
    // appearanceCountElement와 resetCountElement가 HTML에 존재할 경우에만 업데이트
     if (appearanceCountElement && wordStatistics[currentWordText]) {
         appearanceCountElement.textContent = `출현 횟수: ${wordStatistics[currentWordText].appearanceCount}`; // 레이블 추가
     } else if (appearanceCountElement) { // 엘리먼트는 있는데 통계 데이터가 없을 경우 (초기 상태)
         appearanceCountElement.textContent = '출현 횟수: 0'; // 레이블 포함 초기화
     }
     if (resetCountElement && wordStatistics[currentWordText]) {
         resetCountElement.textContent = `정답 횟수: ${wordStatistics[currentWordText].resetCount}`; // 레이블 추가
     } else if (resetCountElement) { // 엘리먼트는 있는데 통계 데이터가 없을 경우 (초기 상태)
          resetCountElement.textContent = '정답 횟수: 0'; // 레이블 포함 초기화
     }
     console.log("단어 통계 UI 업데이트 완료."); // 디버그 로그 추가


    // 통계 데이터 저장 (단어 완료 시마다 저장)
    // playableWords 가 아닌, 로드된 전체 단어(words)에 대한 통계를 저장합니다.
    saveWordStatistics();
    console.log("통계 데이터 저장 완료."); // 디버그 로그 추가


    // --- 다음 단어로 넘어가는 로직 ---
    // 맞았든 틀렸든, 단어 완료 시 다음 단어로 넘어갑니다.
    // 약간의 딜레이를 두어 사용자가 결과(맞았는지 틀렸는지 색상)를 잠깐 볼 시간을 줍니다.
    // Note: 여기의 딜레이 시간을 수정하면 됩니다. 기본 500ms
    console.log("다음 단어 설정 setTimeout 예약 (500ms 후)."); // 디버그 로그 추가

    setTimeout(() => {
         console.log("setTimeout 콜백 실행."); // 디버그 로그 추가
         // playableWords 가 비었는지 확인하고 게임 종료 처리
         if (playableWords.length === 0) {
              console.log("플레이할 단어가 모두 소진되었습니다. 게임 종료 처리.");
              endGame(); // 연습할 단어가 없으면 게임 종료
         } else {
              console.log("다음 단어 설정 (setNewWord 호출).");
              setNewWord(); // 다음 단어 설정 (playableWords 에서 단어 선택)
         }
         // !!! 여기에 플래그 초기화 코드 추가 !!!
         isWordCompletionPending = false;
         console.log("단어 완료 처리 종료. isWordCompletionPending =", isWordCompletionPending); // 디버그 로그 추가

      }, 500); // <-- 이 숫자를 조절하여 딜레이 시간을 변경하세요 (밀리초 단위)

    // 정확도 업데이트 (optional)
    // updateAccuracy(); // 필요하다면 여기서 한 번 더 호출 가능
}

// ... 나머지 코드는 그대로 ...

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

        // --- 단어 완성 후에만 (길이가 같거나 클 때) 스페이스/엔터로 완료 처리 ---
        // 입력 필드가 비어있거나 목표 단어 길이보다 짧으면...
        if (userInput.length === 0 || userInput.length < targetLength) {
             // 입력 필드가 비어있거나 단어 완성 전이면...
             // 스페이스바의 기본 동작을 허용하여 입력 필드에 스페이스가 들어가게 합니다.
             // (단, Enter는 기본 동작 방지하여 줄바꿈 막음)
             if (event.key === 'Enter') {
                  event.preventDefault(); // Enter의 줄바꿈만 막음
             }
             // Note: 스페이스바는 여기에서 preventDefault를 하지 않으므로 입력 필드에 추가됩니다.
             // console.log("단어 완성 전 스페이스바/엔터 누름 또는 빈 입력 - 무시 (완료 처리만)");
             return; // 단어 완료 처리는 하지 않고 함수 실행 종료
        }
        // --- 수정 부분 끝 ---

        // --- 단어 완성 후에 스페이스/엔터가 눌렸을 때만 기본 동작 방지 ---
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
     // currentWord가 유효하고 word 속성이 있는지 확인 후 호출
     if (currentWord && typeof currentWord.word === 'string') {
         updateWordDisplayColors(userInput, currentWord.word);
     }


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
         // 난이도 변경 시 기존 게임 상태 초기화 및 새 난이도 단어 로드
         resetGame(); // 기존 게임 상태 초기화 (타이머, 점수 등)
         loadWords(selectedFile); // 선택된 난이도 파일 로드 시작
    } else {
        // 게임 중에는 난이도 변경 시도 시 알림
         alert("게임 중에는 난이도를 변경할 수 없습니다. 재시작 해주세요.");
         // 이전에 선택했던 값으로 되돌리는 로직은 추가 구현 필요 (Optional)
         // this.value = 현재 게임 시작 시점의 difficultySelect.value 값;
    }
});

// --- 페이지 언로드 시 localStorage에 통계 저장 ---
// 사용자가 페이지를 떠나거나 새로고침하기 전에 데이터를 저장합니다.
// playableWords 가 아닌, 로드된 전체 단어(words)에 대한 통계를 저장합니다.
window.addEventListener('beforeunload', saveWordStatistics);

// --- 초기화 버튼 클릭 시 통계 초기화 (선택 사항) ---
// resetButton.addEventListener('click', function() {
//     // 재시작 시 통계를 유지하고 싶다면 이 부분은 주석 처리
//     // 만약 재시작 버튼으로 통계까지 완전히 초기화하고 싶다면 여기에 로직 추가
//     // 예: wordStatistics = {}; saveWordStatistics();
// });


// --- 페이지 로드 시 초기 단어 로드 (기본값 선택) ---
loadWords(difficultySelect.value);