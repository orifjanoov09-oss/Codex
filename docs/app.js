import { rpc } from "./api.js";

const $ = (selector) => document.querySelector(selector);
const storageKey = "qidiruv-test-attempt";
const state = { attempt: null, index: 0, answers: {} };
const views = [$("#welcome"), $("#quiz"), $("#result")];

function show(view) {
  views.forEach((item) => item.classList.add("hidden"));
  view.classList.remove("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3200);
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify({
    attempt_id: state.attempt.attempt_id,
    token: state.attempt.token,
    index: state.index,
    answers: state.answers
  }));
}

function getSaved() {
  try { return JSON.parse(localStorage.getItem(storageKey)); }
  catch { localStorage.removeItem(storageKey); return null; }
}

async function startTest(event) {
  event.preventDefault();
  const button = event.submitter;
  const error = $("#start-error");
  error.textContent = "";
  button.disabled = true;
  button.querySelector("span").textContent = "Tayyorlanmoqda…";
  try {
    const attempt = await rpc("quiz_start_attempt", {
      p_full_name: $("#full-name").value.trim(),
      p_group_name: $("#group-name").value.trim()
    });
    state.attempt = attempt;
    state.index = 0;
    state.answers = {};
    save();
    openQuiz();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Testni boshlash";
  }
}

async function resumeTest() {
  const saved = getSaved();
  if (!saved) return;
  const button = $("#resume-button");
  button.disabled = true;
  try {
    const attempt = await rpc("quiz_get_attempt", {p_attempt_id: saved.attempt_id, p_token: saved.token});
    if (attempt.status === "submitted") throw new Error("Bu urinish yakunlangan.");
    state.attempt = {...attempt, token: saved.token};
    state.index = Math.min(saved.index || 0, attempt.questions.length - 1);
    state.answers = saved.answers || {};
    openQuiz();
  } catch (err) {
    localStorage.removeItem(storageKey);
    button.classList.add("hidden");
    toast(err.message);
  } finally { button.disabled = false; }
}

function openQuiz() {
  $("#participant-line").textContent = `${state.attempt.full_name} · ${state.attempt.group_name}`;
  show($("#quiz"));
  renderQuestion(false);
}

function renderQuestion(animate = true) {
  const question = state.attempt.questions[state.index];
  const card = $("#question-card");
  const update = () => {
    $("#section-name").textContent = question.section;
    $("#question-position").textContent = `${state.index + 1} / ${state.attempt.questions.length}`;
    $("#question-text").textContent = question.prompt;
    const percent = ((state.index + 1) / state.attempt.questions.length) * 100;
    $("#progress-fill").style.width = `${percent}%`;
    $("#progress-node").style.left = `${percent}%`;
    const options = $("#options");
    options.innerHTML = "";
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "option-button";
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(state.answers[question.id] === option.id));
      if (state.answers[question.id] === option.id) button.classList.add("selected");
      button.innerHTML = `<span class="letter">${String.fromCharCode(65 + index)}</span><span></span>`;
      button.lastElementChild.textContent = option.label;
      button.addEventListener("click", () => selectAnswer(question.id, option.id));
      options.appendChild(button);
    });
    updateNextButton();
  };
  if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
  const out = card.animate([{opacity:1,transform:"translateX(0)",filter:"blur(0)"},{opacity:0,transform:"translateX(-26px)",filter:"blur(5px)"}],{duration:180,easing:"ease-in",fill:"forwards"});
  out.finished.then(() => {
    update();
    card.animate([{opacity:0,transform:"translateX(34px)",filter:"blur(5px)"},{opacity:1,transform:"translateX(0)",filter:"blur(0)"}],{duration:360,easing:"cubic-bezier(.16,1,.3,1)",fill:"forwards"});
  });
}

function selectAnswer(questionId, optionId) {
  state.answers[questionId] = optionId;
  [...$("#options").children].forEach((button, index) => {
    const selected = state.attempt.questions[state.index].options[index].id === optionId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  $("#answer-hint").textContent = "Javob saqlandi";
  updateNextButton();
  save();
}

function updateNextButton() {
  const question = state.attempt.questions[state.index];
  const button = $("#next-button");
  button.disabled = !state.answers[question.id];
  button.querySelector("span").textContent = state.index === state.attempt.questions.length - 1 ? "Natijani yuborish" : "Keyingi savol";
}

async function nextQuestion() {
  if (state.index < state.attempt.questions.length - 1) {
    state.index += 1;
    save();
    renderQuestion();
    return;
  }
  const button = $("#next-button");
  button.disabled = true;
  button.querySelector("span").textContent = "Yuborilmoqda…";
  try {
    const result = await rpc("quiz_submit_attempt", {
      p_attempt_id: state.attempt.attempt_id,
      p_token: state.attempt.token,
      p_answers: state.answers
    });
    localStorage.removeItem(storageKey);
    showResult(result);
  } catch (err) {
    toast(err.message);
    button.disabled = false;
    button.querySelector("span").textContent = "Natijani yuborish";
  }
}

function showResult(result) {
  show($("#result"));
  $("#result-person").textContent = `${state.attempt.full_name} · ${state.attempt.group_name}`;
  $("#result-percent").textContent = `${result.percent}%`;
  $("#result-fraction").textContent = `${result.score} / ${result.total}`;
  const high = result.percent >= 80;
  const medium = result.percent >= 60;
  $("#result-title").textContent = high ? "A’lo natija" : medium ? "Yaxshi natija" : "Mashqni davom ettiring";
  $("#result-message").textContent = high ? "Qidiruv sintaksisi va tizimlar farqini puxta o‘zlashtirgansiz." : medium ? "Asosiy tushunchalar aniq. Operatorlarni yana bir bor takrorlash foydali bo‘ladi." : "Taqdimot materiallarini qayta ko‘rib, yangi urinishda natijani yaxshilang.";
  requestAnimationFrame(() => $("#score-fill").style.width = `${result.percent}%`);
  if (high && !matchMedia("(prefers-reduced-motion: reduce)").matches) celebrate();
}

function celebrate() {
  const colors = ["#8b7cff", "#73e6dc", "#b4a9ff"];
  for (let i = 0; i < 28; i++) {
    const particle = document.createElement("i");
    Object.assign(particle.style, {position:"fixed",left:`${45 + Math.random()*10}%`,top:"42%",width:"5px",height:"10px",background:colors[i%colors.length],zIndex:30,pointerEvents:"none"});
    document.body.appendChild(particle);
    const angle = (Math.PI * 2 * i) / 28;
    particle.animate([{transform:"translate(0,0) rotate(0)",opacity:1},{transform:`translate(${Math.cos(angle)*(90+Math.random()*160)}px,${Math.sin(angle)*(70+Math.random()*130)+140}px) rotate(240deg)`,opacity:0}],{duration:900+Math.random()*500,easing:"cubic-bezier(.16,1,.3,1)"}).finished.then(()=>particle.remove());
  }
}

$("#start-form").addEventListener("submit", startTest);
$("#resume-button").addEventListener("click", resumeTest);
$("#next-button").addEventListener("click", nextQuestion);
$("#new-attempt").addEventListener("click", () => location.reload());
document.addEventListener("keydown", (event) => {
  if ($("#quiz").classList.contains("hidden")) return;
  if (["1","2","3","4"].includes(event.key)) $("#options").children[Number(event.key)-1]?.click();
  if (event.key === "Enter" && !$("#next-button").disabled) nextQuestion();
});

if (getSaved()) $("#resume-button").classList.remove("hidden");
