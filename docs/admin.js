import { rpc, formatDate, duration } from "./api.js";

const $ = (selector) => document.querySelector(selector);
const sessionKey = "qidiruv-admin-session";
let dashboard = null;
let filteredAttempts = [];

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3200);
}

function token() {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey));
    if (!session || new Date(session.expires_at) <= new Date()) return null;
    return session.token;
  } catch { return null; }
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter;
  const error = $("#login-error");
  button.disabled = true;
  error.textContent = "";
  try {
    const session = await rpc("quiz_admin_login", {p_password: $("#admin-password").value});
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
    await openDashboard();
  } catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; }
}

async function openDashboard() {
  $("#admin-login").classList.add("hidden");
  $("#admin-app").classList.remove("hidden");
  await loadDashboard();
}

async function loadDashboard() {
  $("#refresh-button").disabled = true;
  try {
    dashboard = await rpc("quiz_admin_dashboard", {p_token: token()});
    renderMetrics();
    buildFilters();
    applyFilters();
    renderQuestionStats();
    $("#updated-time").textContent = `Обновлено ${new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(new Date())}`;
  } catch (err) {
    if (err.code === "ADMIN_UNAUTHORIZED") logout();
    else toast(err.message);
  } finally { $("#refresh-button").disabled = false; }
}

function renderMetrics() {
  const s = dashboard.stats;
  $("#metric-grid").className = "metric-grid";
  $("#metric-grid").innerHTML = [
    ["Всего попыток",s.total,"За всё время"],
    ["Средний балл",`${s.average} / 20`,"Завершённые попытки"],
    ["Лучший результат",`${s.best} / 20`,"Максимальный балл"],
    ["Завершено",`${s.completion_rate}%`,`${s.completed} участников`]
  ].map(([label,value,note])=>`<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");
}

function buildFilters() {
  const select = $("#group-filter");
  const current = select.value;
  const groups = [...new Set(dashboard.attempts.map((a)=>a.group_name))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML = `<option value="">Все группы</option>${groups.map((g)=>`<option></option>`).join("")}`;
  groups.forEach((group,index)=>{select.options[index+1].value=group;select.options[index+1].textContent=group});
  select.value = groups.includes(current) ? current : "";
}

function applyFilters() {
  const query = $("#search-input").value.trim().toLocaleLowerCase("ru");
  const group = $("#group-filter").value;
  const status = $("#status-filter").value;
  filteredAttempts = dashboard.attempts.filter((a) => {
    const matchesQuery = !query || `${a.full_name} ${a.group_name}`.toLocaleLowerCase("ru").includes(query);
    return matchesQuery && (!group || a.group_name === group) && (!status || a.status === status);
  });
  renderRows();
}

function renderRows() {
  const body = $("#results-body");
  body.innerHTML = "";
  $("#empty-results").classList.toggle("hidden", filteredAttempts.length > 0);
  filteredAttempts.forEach((a) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong></strong></td><td></td><td></td><td></td><td class="score-cell"></td><td><span class="status ${a.status==='submitted'?'done':'open'}"></span></td><td><button class="row-button" type="button">Подробнее</button></td>`;
    row.children[0].firstElementChild.textContent = a.full_name;
    row.children[1].textContent = a.group_name;
    row.children[2].textContent = formatDate(a.started_at);
    row.children[3].textContent = duration(a.started_at,a.submitted_at);
    row.children[4].textContent = a.status === "submitted" ? `${a.score} / ${a.total}` : "—";
    row.querySelector(".status").textContent = a.status === "submitted" ? "Завершён" : "В процессе";
    row.querySelector("button").addEventListener("click",()=>openAttempt(a.id));
    body.appendChild(row);
  });
}

function renderQuestionStats() {
  $("#question-stats").innerHTML = dashboard.questions.slice(0,8).map((q)=>`<div class="question-stat"><p></p><div class="mini-track"><i style="width:${q.correct_rate}%"></i></div><strong>${q.correct_rate}%</strong></div>`).join("");
  dashboard.questions.slice(0,8).forEach((q,index)=>$("#question-stats").children[index].querySelector("p").textContent=q.prompt);
}

async function openAttempt(id) {
  const dialog = $("#attempt-dialog");
  $("#attempt-detail").innerHTML = `<div class="skeleton-grid"><div></div></div>`;
  dialog.showModal();
  try {
    const a = await rpc("quiz_admin_attempt", {p_token:token(),p_attempt_id:id});
    const detail = $("#attempt-detail");
    detail.innerHTML = `<div class="detail-head"><h2></h2><p></p></div><div class="detail-summary"><div><span>Результат</span><strong>${a.score ?? '—'} / ${a.total}</strong></div><div><span>Начало</span><strong>${formatDate(a.started_at)}</strong></div><div><span>Время</span><strong>${duration(a.started_at,a.submitted_at)}</strong></div></div><div class="answer-list"></div>`;
    detail.querySelector("h2").textContent = a.full_name;
    detail.querySelector(".detail-head p").textContent = a.group_name;
    const list = detail.querySelector(".answer-list");
    (a.answers || []).forEach((answer,index)=>{
      const item=document.createElement("div");item.className="answer-detail";
      item.innerHTML=`<h3></h3><p class="${answer.is_correct?'correct':'wrong'}"></p><p></p>`;
      item.querySelector("h3").textContent=`${index+1}. ${answer.question}`;
      item.children[1].textContent=`Ответ участника: ${answer.selected || 'Нет ответа'}`;
      item.children[2].textContent=`Правильный ответ: ${answer.correct}`;
      list.appendChild(item);
    });
  } catch (err) { dialog.close(); toast(err.message); }
}

function exportCsv() {
  const rows = [["Ф.И.О.","Группа","Начало","Завершение","Балл","Всего","Статус"],...filteredAttempts.map((a)=>[a.full_name,a.group_name,formatDate(a.started_at),formatDate(a.submitted_at),a.score??"",a.total,a.status])];
  const csv = "\uFEFF" + rows.map((row)=>row.map((value)=>`"${String(value).replaceAll('"','""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download = `qidiruv-test-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function logout() {
  sessionStorage.removeItem(sessionKey);
  location.reload();
}

$("#login-form").addEventListener("submit", login);
$("#toggle-password").addEventListener("click",()=>{const input=$("#admin-password");input.type=input.type==="password"?"text":"password"});
$("#refresh-button").addEventListener("click",loadDashboard);
$("#search-input").addEventListener("input",applyFilters);
$("#group-filter").addEventListener("change",applyFilters);
$("#status-filter").addEventListener("change",applyFilters);
$("#export-button").addEventListener("click",exportCsv);
$("#logout-button").addEventListener("click",logout);
$("#dialog-close").addEventListener("click",()=>$("#attempt-dialog").close());
$("#attempt-dialog").addEventListener("click",(event)=>{if(event.target===$("#attempt-dialog"))$("#attempt-dialog").close()});

if (token()) openDashboard();
