
/*
 VAYO Language — General Exams
 A1: 30 questions / 30 minutes / 70%
 A2: 50 questions / 45 minutes / 75%

 Requires globals from language.html:
 A1, A2, GRAMMAR, LANGUAGES,
 LEVEL_TOPICS, doneCount, totalLessons,
 state, save, updateStreak, render,
 esc, shuffle
*/

"use strict";

(function () {
  const EXAM_KEY = "vayo_language_exams_v1";

  const CONFIG = {
    A1: {
      count: 30,
      minutes: 30,
      pass: 70,
      reward: 150
    },
    A2: {
      count: 50,
      minutes: 45,
      pass: 75,
      reward: 300
    }
  };

  const DEFAULT_RESULTS = {
    passed: {},
    history: []
  };

  function readResults() {
    try {
      const value = JSON.parse(
        localStorage.getItem(EXAM_KEY) || "null"
      );

      if (!value || typeof value !== "object") {
        return {
          passed: {},
          history: []
        };
      }

      return {
        passed:
          value.passed &&
          typeof value.passed === "object"
            ? value.passed
            : {},
        history: Array.isArray(value.history)
          ? value.history
          : []
      };
    } catch (error) {
      return {
        passed: {},
        history: []
      };
    }
  }

  const results = readResults();

  let active = null;
  let timer = null;

  const $exam = id => document.getElementById(id);

  function saveResults() {
    try {
      localStorage.setItem(
        EXAM_KEY,
        JSON.stringify(results)
      );
    } catch (error) {
      console.warn("Exam storage unavailable", error);
    }
  }

  function examId(lang, level) {
    return lang + "_" + level;
  }

  function completedAll(lang, level) {
    const total = totalLessons(level);

    return (
      total > 0 &&
      doneCount(lang, level) === total
    );
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function createQuestion(
    question,
    correct,
    pool,
    category
  ) {
    const distractors = shuffle(
      unique(pool).filter(x => x !== correct)
    ).slice(0, 3);

    return {
      question,
      correct,
      options: shuffle([
        correct,
        ...distractors
      ]),
      category
    };
  }

  function makeA1Questions(lang) {
    const topics = A1[lang];

    const pool = topics
      .flat()
      .map(pair => pair[1]);

    const vocabulary = [];

    topics.forEach((words, topicIndex) => {
      words.forEach(pair => {
        vocabulary.push(
          createQuestion(
            "«" + pair[0] + "» чӣ маъно дорад?",
            pair[1],
            pool,
            "Луғат"
          )
        );
      });
    });

    const sentenceCandidates = topics
      .flat()
      .filter(pair =>
        /[.!?？。]/.test(pair[0]) ||
        pair[0].split(/\s+/).length >= 3
      );

    const sentencePool = sentenceCandidates
      .map(pair => pair[1]);

    const sentences = sentenceCandidates.map(pair =>
      createQuestion(
        "Ҷумларо тарҷума кун: " + pair[0],
        pair[1],
        sentencePool,
        "Ҷумла"
      )
    );

    /*
      A1 дар маълумоти мавҷуда қоидаҳои
      грамматикии алоҳида надорад.
      Барои қисми сеюм саволҳои
      фаҳмиши ибораҳо истифода мешаванд.
    */
    const comprehension = topics.flat().map(pair =>
      createQuestion(
        "Тарҷумаи дурустро интихоб кун: " +
          pair[0],
        pair[1],
        pool,
        "Фаҳмиши ибора"
      )
    );

    return shuffle([
      ...shuffle(vocabulary).slice(0, 10),
      ...shuffle(sentences).slice(0, 10),
      ...shuffle(comprehension).slice(0, 10)
    ]);
  }

  function makeA2Questions(lang) {
    const topics = A2[lang];

    const allWords = topics.flatMap(topic =>
      topic.words.map(pair => pair[1])
    );

    const allSentences = topics.flatMap(topic =>
      topic.sentences.map(pair => pair[1])
    );

    const grammarPool = GRAMMAR[lang]
      .map(rule => rule[3]);

    const words = topics.flatMap(topic =>
      topic.words.map(pair =>
        createQuestion(
          "«" + pair[0] + "» чӣ маъно дорад?",
          pair[1],
          allWords,
          "Луғат"
        )
      )
    );

    const sentences = topics.flatMap(topic =>
      topic.sentences.map(pair =>
        createQuestion(
          "Ҷумларо тарҷума кун: " + pair[0],
          pair[1],
          allSentences,
          "Ҷумла"
        )
      )
    );

    const grammar = topics.map(topic => {
      const rule = topic.grammar;

      return createQuestion(
        "Маънои мисоли грамматикӣ: " +
          rule[2],
        rule[3],
        grammarPool,
        "Грамматика"
      );
    });

    return shuffle([
      ...shuffle(words).slice(0, 15),
      ...shuffle(sentences).slice(0, 15),
      ...shuffle(grammar).slice(0, 20)
    ]);
  }

  function createExamQuestions(lang, level) {
    return level === "A1"
      ? makeA1Questions(lang)
      : makeA2Questions(lang);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return (
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0")
    );
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startTimer() {
    stopTimer();

    timer = setInterval(() => {
      if (!active) {
        stopTimer();
        return;
      }

      active.remaining = Math.max(
        0,
        Math.ceil(
          (active.deadline - Date.now()) / 1000
        )
      );

      const element = $exam("examTimer");

      if (element) {
        element.textContent = formatTime(
          active.remaining
        );
      }

      if (active.remaining <= 0) {
        finishExam(true);
      }
    }, 1000);
  }

  function renderExamSection() {
    const section = $exam("generalExams");

    if (!section) return;

    const lang = state.lang;
    const level = window.VAYO_SELECTED_LEVEL();

    if (!CONFIG[level]) {
      section.innerHTML = `
        <h2>🎓 Имтиҳони умумӣ</h2>
        <p class="muted">
          Имтиҳонҳои умумии A1 ва A2 фаъоланд.
          Аввал яке аз ин сатҳҳоро интихоб кун.
        </p>
      `;
      return;
    }

    const config = CONFIG[level];
    const unlocked = completedAll(lang, level);
    const id = examId(lang, level);
    const passed = results.passed[id];

    const completed = doneCount(lang, level);
    const total = totalLessons(level);

    section.innerHTML = `
      <h2>🎓 Имтиҳони умумии ${level}</h2>

      <p>
        📚 Пешрафт:
        <b>${completed} / ${total}</b>
      </p>

      <p>
        📝 ${config.count} савол ·
        ⏱️ ${config.minutes} дақиқа ·
        🎯 ${config.pass}% барои гузаштан
      </p>

      ${
        passed
          ? `<div class="notice">
               🏆 Имтиҳон гузашта шудааст.
               Натиҷаи беҳтарин:
               <b>${passed.percent}%</b>
             </div>`
          : ""
      }

      ${
        unlocked
          ? `<button
               class="btn primary"
               onclick="VAYOExam.start()">
               🏆 Оғози имтиҳони ${level}
             </button>`
          : `<div class="notice">
               🔒 Имтиҳон баста аст.
               Барои кушодан ҳамаи
               ${total} дарси ${level}-ро
               анҷом деҳ.
             </div>`
      }
    `;
  }

  function startExam() {
    const lang = state.lang;
    const level = window.VAYO_SELECTED_LEVEL();

    if (!CONFIG[level]) return;

    if (!completedAll(lang, level)) {
      alert(
        "🔒 Аввал ҳамаи дарсҳои " +
          level +
          "-ро анҷом деҳ."
      );
      return;
    }

    const config = CONFIG[level];
    const questions = createExamQuestions(
      lang,
      level
    );

    if (questions.length !== config.count) {
      alert(
        "Маълумоти имтиҳон нопурра аст."
      );
      return;
    }

    active = {
      lang,
      level,
      questions,
      answers: {},
      index: 0,
      remaining: config.minutes * 60,
      deadline:
        Date.now() + config.minutes * 60000,
      startedAt: new Date().toISOString()
    };

    $exam("home").classList.add("hidden");
    $exam("levelSection").classList.add("hidden");
    $exam("course").classList.add("hidden");
    $exam("lesson").classList.add("hidden");
    $exam("generalExams").classList.add("hidden");

    $exam("examScreen").classList.remove("hidden");

    startTimer();
    renderQuestion();

    $exam("examScreen").scrollIntoView({
      behavior: "smooth"
    });
  }

  function renderQuestion() {
    if (!active) return;

    const q = active.questions[active.index];
    const selected = active.answers[active.index];

    $exam("examTitle").textContent =
      "🎓 Имтиҳони умумии " + active.level;

    $exam("examCounter").textContent =
      "Саволи " +
      (active.index + 1) +
      " аз " +
      active.questions.length;

    $exam("examTimer").textContent =
      formatTime(active.remaining);

    $exam("examFill").style.width =
      (
        (active.index + 1) /
        active.questions.length *
        100
      ) + "%";

    $exam("examBody").innerHTML = `
      <div class="study">
        <small>${esc(q.category)}</small>
        <h3>${esc(q.question)}</h3>
      </div>

      <div id="examOptions"></div>
    `;

    const box = $exam("examOptions");

    q.options.forEach((value, index) => {
      const button = document.createElement(
        "button"
      );

      button.className = "option";

      if (selected === value) {
        button.classList.add("correct");
      }

      button.textContent = value;

      button.onclick = () => {
        active.answers[active.index] = value;
        renderQuestion();
      };

      box.appendChild(button);
    });

    $exam("examPrevious").disabled =
      active.index === 0;

    $exam("examNext").textContent =
      active.index ===
      active.questions.length - 1
        ? "Имтиҳонро анҷом додан ✓"
        : "Саволи навбатӣ →";
  }

  function previousQuestion() {
    if (!active || active.index <= 0) return;

    active.index--;
    renderQuestion();
  }

  function nextQuestion() {
    if (!active) return;

    if (
      active.index <
      active.questions.length - 1
    ) {
      active.index++;
      renderQuestion();
      return;
    }

    const answered = Object.keys(
      active.answers
    ).length;

    if (answered < active.questions.length) {
      const confirmFinish = confirm(
        "Шумо ба " +
          answered +
          " аз " +
          active.questions.length +
          " савол ҷавоб додед. Имтиҳонро анҷом медиҳед?"
      );

      if (!confirmFinish) return;
    }

    finishExam(false);
  }

  function finishExam(timedOut) {
    if (!active) return;

    stopTimer();

    const exam = active;
    active = null;

    let correct = 0;

    const errors = [];
    const categories = {};

    exam.questions.forEach((q, index) => {
      const answer = exam.answers[index];

      if (!categories[q.category]) {
        categories[q.category] = {
          correct: 0,
          total: 0
        };
      }

      categories[q.category].total++;

      if (answer === q.correct) {
        correct++;
        categories[q.category].correct++;
      } else {
        errors.push({
          question: q.question,
          answer: answer || "Ҷавоб дода нашуд",
          correct: q.correct
        });
      }
    });

    const config = CONFIG[exam.level];

    const percent = Math.round(
      correct / exam.questions.length * 100
    );

    const passed = percent >= config.pass;

    const id = examId(exam.lang, exam.level);

    let reward = 0;

    if (passed) {
      const old = results.passed[id];

      if (!old) {
        reward = config.reward;
        state.xp += reward;
      }

      if (!old || percent > old.percent) {
        results.passed[id] = {
          percent,
          correct,
          total: exam.questions.length,
          date: new Date().toISOString()
        };
      }

      updateStreak();
    }

    results.history.push({
      lang: exam.lang,
      level: exam.level,
      percent,
      correct,
      total: exam.questions.length,
      passed,
      timedOut,
      date: new Date().toISOString()
    });

    results.history = results.history.slice(-100);

    saveResults();
    save();

    const categoryHTML = Object.entries(
      categories
    ).map(([name, value]) => `
      <p>
        ${esc(name)}:
        <b>${value.correct}/${value.total}</b>
      </p>
    `).join("");

    const errorsHTML = errors.slice(0, 20)
      .map((error, i) => `
        <div class="study">
          <b>${i + 1}. ${esc(error.question)}</b>
          <p>
            Ҷавоби ту:
            ${esc(error.answer)}
          </p>
          <p>
            Ҷавоби дуруст:
            <b>${esc(error.correct)}</b>
          </p>
        </div>
      `).join("");

    $exam("examTitle").textContent =
      passed
        ? "🏆 Имтиҳон гузашта шуд!"
        : "📚 Боз омодагӣ бин";

    $exam("examCounter").textContent =
      "Натиҷа";

    $exam("examTimer").textContent =
      timedOut ? "Вақт тамом" : "Анҷом";

    $exam("examFill").style.width = "100%";

    $exam("examBody").innerHTML = `
      <div class="study" style="text-align:center">
        <div style="font-size:50px">
          ${passed ? "🏆" : "📖"}
        </div>

        <h2>${percent}%</h2>

        <p>
          Ҷавобҳои дуруст:
          <b>${correct}/${exam.questions.length}</b>
        </p>

        <p>
          ${
            passed
              ? "Табрик! Шумо имтиҳонро гузаштед."
              : "Барои гузаштан " +
                config.pass +
                "% лозим аст."
          }
        </p>

        <h3>+${reward} XP</h3>
      </div>

      <h3>📊 Натиҷа аз рӯйи қисмҳо</h3>
      ${categoryHTML}

      ${
        passed
          ? `<div class="notice">
               🎓 Шаҳодатномаи дохилии
               VAYO Language — ${exam.level}
             </div>`
          : ""
      }

      <h3>📝 Саволҳои хато</h3>
      ${
        errors.length
          ? errorsHTML
          : "<p>Ҳамаи ҷавобҳо дурустанд!</p>"
      }
    `;

    $exam("examPrevious").classList.add(
      "hidden"
    );

    $exam("examNext").textContent =
      "Ба дарсҳо баргаштан →";

    $exam("examNext").onclick = closeExam;
  }

  function closeExam() {
    stopTimer();
    active = null;

    $exam("examScreen").classList.add(
      "hidden"
    );

    $exam("home").classList.remove(
      "hidden"
    );

    $exam("levelSection").classList.remove(
      "hidden"
    );

    $exam("course").classList.remove(
      "hidden"
    );

    $exam("generalExams").classList.remove(
      "hidden"
    );

    $exam("examPrevious").classList.remove(
      "hidden"
    );

    $exam("examNext").onclick = nextQuestion;

    render();
    renderExamSection();
  }

  function cancelExam() {
    if (!active) {
      closeExam();
      return;
    }

    if (confirm(
      "Имтиҳонро қатъ мекунед? Натиҷаи ин кӯшиш нигоҳ дошта намешавад."
    )) {
      closeExam();
    }
  }

  window.VAYOExam = {
    render: renderExamSection,
    start: startExam,
    previous: previousQuestion,
    next: nextQuestion,
    cancel: cancelExam,
    close: closeExam,
    completedAll
  };

  document.addEventListener(
    "DOMContentLoaded",
    renderExamSection
  );
})();
