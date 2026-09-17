const STORAGE_KEYS = {
  tasks: "daymark.tasks.v1",
  energy: "daymark.energy.v1",
  timer: "daymark.timer.v1",
};

const seedTasks = [
  { id: "t1", name: "Собрать структуру кейса для портфолио", category: "work", time: "09:30", project: "Портфолио", dateOffset: 0, complete: false },
  { id: "t2", name: "Ответить на письма по новому проекту", category: "work", time: "11:00", project: "Коммуникации", dateOffset: 0, complete: true },
  { id: "t3", name: "Прогулка без телефона", category: "personal", time: "13:30", project: "Перерыв", dateOffset: 0, complete: false },
  { id: "t4", name: "Проверить адаптивы главной страницы", category: "work", time: "15:00", project: "Редизайн", dateOffset: 0, complete: false },
  { id: "t5", name: "Заказать продукты на выходные", category: "personal", time: "18:30", project: "Дом", dateOffset: 1, complete: false },
  { id: "t6", name: "Подготовить заметки к созвону", category: "work", time: "10:00", project: "Новый проект", dateOffset: 1, complete: false },
  { id: "t7", name: "Разобрать папку с референсами", category: "personal", time: "12:00", project: "Архив", dateOffset: -1, complete: true },
];

const energyNotes = {
  1: "Снизьте планку: оставьте только одно обязательное дело и паузы.",
  2: "Выберите короткие задачи и не планируйте плотный вечер.",
  3: "Обычный ритм: чередуйте сложные и простые задачи.",
  4: "Хороший темп: оставьте один спокойный слот после обеда.",
  5: "Энергии много — направьте её на одну сложную задачу, а не на пять сразу.",
};

let tasks = loadJSON(STORAGE_KEYS.tasks, seedTasks);
let activeFilter = "all";
let activeView = "today";
let activeDateOffset = 0;
let searchQuery = "";
let timerInterval = null;
let timerState = loadJSON(STORAGE_KEYS.timer, { remaining: 1500, running: false, taskId: "" });
let toastTimeout = null;

const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const focusDialog = document.querySelector("#focus-dialog");

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  updateWeeklyProgress();
}

function applyEnergy(energy, announce = true) {
  localStorage.setItem(STORAGE_KEYS.energy, String(energy));
  document.querySelectorAll("[data-energy]").forEach((item) => {
    const selected = Number(item.dataset.energy) === energy;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  document.querySelector("#energy-note").textContent = energyNotes[energy];
  if (announce) showToast("Уровень энергии сохранён");
}

function escapeHTML(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function visibleTasks() {
  return tasks
    .filter((task) => {
      if (activeView === "completed") return task.complete;
      if (activeView === "upcoming") return task.dateOffset > 0 && !task.complete;
      return task.dateOffset === activeDateOffset;
    })
    .filter((task) => activeFilter === "all" || task.category === activeFilter)
    .filter((task) => `${task.name} ${task.project}`.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function renderTasks() {
  const list = visibleTasks();
  taskList.innerHTML = list.map((task) => `
    <article class="task-card ${task.complete ? "is-complete" : ""}" data-task-id="${task.id}">
      <button class="complete-button" type="button" aria-label="${task.complete ? "Вернуть задачу в работу" : "Отметить задачу выполненной"}" aria-pressed="${task.complete}">${task.complete ? "✓" : ""}</button>
      <time class="task-time" datetime="${task.time}">${task.time}</time>
      <div class="task-copy">
        <h3>${escapeHTML(task.name)}</h3>
        <div class="task-meta"><span class="category-dot ${task.category}"></span><span>${task.category === "work" ? "Работа" : "Личное"}</span><span>•</span><span>${escapeHTML(task.project || "Без проекта")}</span></div>
      </div>
      <div class="task-menu">
        <button class="edit-task" type="button" aria-label="Редактировать задачу">✎</button>
        <button class="delete-task" type="button" aria-label="Удалить задачу">×</button>
      </div>
    </article>
  `).join("");
  emptyState.hidden = list.length > 0;
  populateFocusSelect();
}

function updateWeeklyProgress() {
  const weekTasks = tasks.filter((task) => task.dateOffset >= -3 && task.dateOffset <= 3);
  const complete = weekTasks.filter((task) => task.complete).length;
  document.querySelector("#weekly-count").textContent = String(complete);
  document.querySelector("#weekly-total").textContent = String(weekTasks.length);
  const progress = weekTasks.length ? Math.round((complete / weekTasks.length) * 100) : 0;
  document.querySelector(".progress-track span").style.width = `${progress}%`;
}

function openTaskDialog(task = null) {
  taskForm.reset();
  document.querySelector("#task-name-error").textContent = "";
  document.querySelector("#task-name").removeAttribute("aria-invalid");
  document.querySelector("#dialog-title").textContent = task ? "Редактировать задачу" : "Новая задача";
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-name").value = task?.name || "";
  document.querySelector("#task-category").value = task?.category || "work";
  document.querySelector("#task-time").value = task?.time || "10:00";
  document.querySelector("#task-project").value = task?.project || "";
  taskDialog.showModal();
  setTimeout(() => document.querySelector("#task-name").focus(), 20);
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setView(view) {
  activeView = view;
  const titles = { today: "Доброе утро, Анна", upcoming: "План на неделю", completed: "Завершённые задачи" };
  document.querySelector("#view-title").textContent = titles[view];
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  document.querySelector(".day-strip").hidden = view !== "today";
  renderTasks();
}

function setDate(offset) {
  activeDateOffset = Number(offset);
  activeView = "today";
  document.querySelectorAll(".day-strip button").forEach((button) => {
    const selected = Number(button.dataset.dateOffset) === activeDateOffset;
    button.classList.toggle("is-selected", selected);
    if (selected) button.setAttribute("aria-current", "date"); else button.removeAttribute("aria-current");
  });
  const label = activeDateOffset === 0 ? "План на день" : activeDateOffset > 0 ? "Планируем заранее" : "Архив дня";
  document.querySelector(".tasks-panel .eyebrow").textContent = label;
  renderTasks();
}

function populateFocusSelect() {
  const select = document.querySelector("#focus-task-select");
  const choices = tasks.filter((task) => !task.complete && task.dateOffset === 0);
  select.innerHTML = choices.length
    ? choices.map((task) => `<option value="${task.id}">${escapeHTML(task.name)}</option>`).join("")
    : '<option value="">Нет активных задач</option>';
  if (timerState.taskId && choices.some((task) => task.id === timerState.taskId)) select.value = timerState.taskId;
}

function renderTimer() {
  const minutes = Math.floor(timerState.remaining / 60).toString().padStart(2, "0");
  const seconds = (timerState.remaining % 60).toString().padStart(2, "0");
  document.querySelector("#timer").textContent = `${minutes}:${seconds}`;
  document.querySelector("#timer-toggle").textContent = timerState.running ? "Пауза" : timerState.remaining < 1500 ? "Продолжить" : "Запустить";
  const selected = tasks.find((task) => task.id === timerState.taskId);
  document.querySelector("#focus-task-title").textContent = selected?.name || "Время сосредоточиться";
  document.querySelector("#timer-status").textContent = timerState.running ? "Сессия идёт. Спокойно делайте только выбранное." : "25 минут без переключений и лишних вкладок.";
  localStorage.setItem(STORAGE_KEYS.timer, JSON.stringify(timerState));
}

function startTimerLoop() {
  clearInterval(timerInterval);
  if (!timerState.running) return;
  timerInterval = setInterval(() => {
    timerState.remaining -= 1;
    if (timerState.remaining <= 0) {
      timerState = { remaining: 1500, running: false, taskId: timerState.taskId };
      clearInterval(timerInterval);
      showToast("Фокус-сессия завершена. Сделайте короткий перерыв.");
    }
    renderTimer();
  }, 1000);
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) setView(viewButton.dataset.view);

  const dayButton = event.target.closest("[data-date-offset]");
  if (dayButton) setDate(dayButton.dataset.dateOffset);

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("is-active", button === filterButton));
    renderTasks();
  }

  const taskCard = event.target.closest(".task-card");
  if (taskCard && event.target.closest(".complete-button")) {
    const task = tasks.find((item) => item.id === taskCard.dataset.taskId);
    task.complete = !task.complete;
    saveTasks(); renderTasks(); showToast(task.complete ? "Задача завершена" : "Задача возвращена в план");
  }
  if (taskCard && event.target.closest(".edit-task")) openTaskDialog(tasks.find((item) => item.id === taskCard.dataset.taskId));
  if (taskCard && event.target.closest(".delete-task")) {
    const task = tasks.find((item) => item.id === taskCard.dataset.taskId);
    if (confirm(`Удалить задачу «${task.name}»?`)) {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveTasks(); renderTasks(); showToast("Задача удалена");
    }
  }
});

document.querySelectorAll("#add-task-button, #mobile-add, #empty-add").forEach((button) => button.addEventListener("click", () => openTaskDialog()));
document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => closeDialog(taskDialog)));
document.querySelector(".focus-close").addEventListener("click", () => closeDialog(focusDialog));

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nameInput = document.querySelector("#task-name");
  const name = nameInput.value.trim();
  if (name.length < 3) {
    nameInput.setAttribute("aria-invalid", "true");
    document.querySelector("#task-name-error").textContent = "Введите понятное название — не короче трёх символов.";
    nameInput.focus();
    return;
  }
  const id = document.querySelector("#task-id").value;
  const taskData = {
    name,
    category: document.querySelector("#task-category").value,
    time: document.querySelector("#task-time").value,
    project: document.querySelector("#task-project").value.trim(),
  };
  if (id) {
    tasks = tasks.map((task) => task.id === id ? { ...task, ...taskData } : task);
    showToast("Изменения сохранены");
  } else {
    tasks.push({ id: `t${Date.now()}`, ...taskData, dateOffset: activeView === "today" ? activeDateOffset : 0, complete: false });
    showToast("Задача добавлена в план");
  }
  saveTasks(); renderTasks(); closeDialog(taskDialog);
});

const searchToggle = document.querySelector("#search-toggle");
const searchPanel = document.querySelector("#search-panel");
searchToggle.addEventListener("click", () => {
  searchPanel.hidden = false;
  searchToggle.setAttribute("aria-expanded", "true");
  document.querySelector("#search-input").focus();
});
document.querySelector("#search-close").addEventListener("click", () => {
  searchPanel.hidden = true;
  searchToggle.setAttribute("aria-expanded", "false");
  searchQuery = "";
  document.querySelector("#search-input").value = "";
  renderTasks();
});
document.querySelector("#search-input").addEventListener("input", (event) => { searchQuery = event.target.value.trim(); renderTasks(); });

document.querySelectorAll("[data-energy]").forEach((button) => button.addEventListener("click", () => {
  applyEnergy(Number(button.dataset.energy));
}));

document.querySelector("#start-focus-button").addEventListener("click", () => { populateFocusSelect(); renderTimer(); focusDialog.showModal(); });
document.querySelector("#focus-task-select").addEventListener("change", (event) => { timerState.taskId = event.target.value; renderTimer(); });
document.querySelector("#timer-toggle").addEventListener("click", () => {
  if (!document.querySelector("#focus-task-select").value) { showToast("Сначала добавьте активную задачу"); return; }
  timerState.taskId = document.querySelector("#focus-task-select").value;
  timerState.running = !timerState.running;
  renderTimer(); startTimerLoop();
});
document.querySelector("#timer-reset").addEventListener("click", () => {
  timerState = { remaining: 1500, running: false, taskId: document.querySelector("#focus-task-select").value };
  clearInterval(timerInterval); renderTimer(); showToast("Таймер сброшен");
});

document.querySelector("#profile-button").addEventListener("click", () => showToast("Профиль работает локально — вход не требуется"));

document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) dialog.close();
}));

const savedEnergy = Number(localStorage.getItem(STORAGE_KEYS.energy) || 4);
applyEnergy(savedEnergy, false);

function updateCalendar() {
  const now = new Date();
  const label = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now);
  document.querySelector("#today-label").textContent = label.charAt(0).toUpperCase() + label.slice(1);
  const hour = now.getHours();
  document.querySelector("#view-title").textContent = `${hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер"}, Анна`;
  document.querySelectorAll("[data-date-offset]").forEach((button) => {
    const date = new Date(now);
    date.setDate(now.getDate() + Number(button.dataset.dateOffset));
    button.querySelector("span").textContent = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
    button.querySelector("strong").textContent = String(date.getDate());
  });
}

function registerWebMCPTools() {
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext?.registerTool) return;
  const registrations = [
    {
      name: "daymark_list_tasks",
      description: "Показать локальные задачи Daymark с их идентификаторами, временем, категорией и статусом.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => ({
        content: [{ type: "text", text: JSON.stringify(tasks.map(({ id, name, category, time, project, dateOffset, complete }) => ({ id, name, category, time, project, dateOffset, complete }))) }],
      }),
    },
    {
      name: "daymark_add_task",
      description: "Добавить локальную задачу в план на сегодня.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3, maxLength: 80, description: "Понятное название задачи" },
          category: { type: "string", enum: ["work", "personal"], description: "Рабочая или личная задача" },
          time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "Время в формате ЧЧ:ММ" },
          project: { type: "string", maxLength: 40, description: "Необязательный проект или контекст" },
        },
        required: ["name", "category", "time"],
        additionalProperties: false,
      },
      execute: async ({ name, category, time, project = "" }) => {
        const task = { id: `t${Date.now()}`, name: name.trim(), category, time, project: project.trim(), dateOffset: 0, complete: false };
        tasks.push(task); saveTasks(); renderTasks();
        return { content: [{ type: "text", text: `Задача «${task.name}» добавлена на ${task.time}. ID: ${task.id}` }] };
      },
    },
    {
      name: "daymark_complete_task",
      description: "Отметить локальную задачу Daymark выполненной по её идентификатору.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Идентификатор из daymark_list_tasks" } },
        required: ["id"],
        additionalProperties: false,
      },
      execute: async ({ id }) => {
        const task = tasks.find((item) => item.id === id);
        if (!task) return { content: [{ type: "text", text: `Задача с ID ${id} не найдена.` }], isError: true };
        task.complete = true; saveTasks(); renderTasks();
        return { content: [{ type: "text", text: `Задача «${task.name}» отмечена выполненной.` }] };
      },
    },
  ];
  Promise.all(registrations.map((tool) => modelContext.registerTool(tool))).catch(() => {});
}

updateCalendar();
renderTasks();
updateWeeklyProgress();
renderTimer();
if (timerState.running) startTimerLoop();
registerWebMCPTools();
