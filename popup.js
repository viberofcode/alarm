const setupView = document.getElementById("setup-view");
const runningView = document.getElementById("running-view");
const minutesInput = document.getElementById("minutes");
const secondsInput = document.getElementById("seconds");
const hoursInput = document.getElementById("hours");
const repeatInput = document.getElementById("repeat");
const visualNotificationInput = document.getElementById("visual-notification");
const chimeInput = document.getElementById("chime");
const countdown = document.getElementById("countdown");
const elapsed = document.getElementById("elapsed");
const status = document.getElementById("status");
const error = document.getElementById("error");
let endTime = null;
let durationMs = null;
let startTime = null;
let repeating = false;
let intervalId = null;

try {
  visualNotificationInput.checked = window.localStorage.getItem("showVisualNotification") !== "false";
  visualNotificationInput.disabled = false;
} catch (loadError) {
  console.error("Could not load the visual alert setting.", loadError);
  error.textContent = "Could not load the visual alert setting.";
}

visualNotificationInput.addEventListener("change", () => {
  try {
    window.localStorage.setItem("showVisualNotification", String(visualNotificationInput.checked));
    error.textContent = "";
  } catch (saveError) {
    console.error("Could not save the visual alert setting.", saveError);
    visualNotificationInput.checked = !visualNotificationInput.checked;
    error.textContent = "Could not save the visual alert setting.";
  }
});

try {
  chimeInput.checked = window.localStorage.getItem("playChime") !== "false";
  chimeInput.disabled = false;
} catch (loadError) {
  console.error("Could not load the chime setting.", loadError);
  error.textContent = "Could not load the chime setting.";
}

chimeInput.addEventListener("change", () => {
  try {
    window.localStorage.setItem("playChime", String(chimeInput.checked));
    error.textContent = "";
  } catch (saveError) {
    console.error("Could not save the chime setting.", saveError);
    chimeInput.checked = !chimeInput.checked;
    error.textContent = "Could not save the chime setting.";
  }
});

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showSetup() {
  setupView.classList.remove("hidden");
  runningView.classList.add("hidden");
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function updateCountdown() {
  const remaining = endTime - Date.now();
  if (repeating) {
    elapsed.textContent = formatTime(Date.now() - startTime);
  }
  if (remaining <= 0) {
    if (repeating) {
      endTime += durationMs;
      countdown.textContent = formatTime(endTime - Date.now());
      return;
    }
    showSetup();
    return;
  }
  countdown.textContent = formatTime(remaining);
}

function showRunning(state) {
  endTime = state.endTime;
  durationMs = state.durationMs;
  repeating = state.repeating;
  startTime = state.startTime || (repeating ? endTime - durationMs : null);
  elapsed.classList.toggle("hidden", !repeating);
  status.classList.toggle("hidden", repeating);
  status.textContent = "Your timer is running.";
  setupView.classList.add("hidden");
  runningView.classList.remove("hidden");
  updateCountdown();
  intervalId = window.setInterval(updateCountdown, 250);
}

document.getElementById("start").addEventListener("click", () => {
  const hours = Number(hoursInput.value) || 0;
  const minutes = Number(minutesInput.value) || 0;
  const seconds = Number(secondsInput.value) || 0;
  const durationMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

  error.textContent = "";
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds) ||
      hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 ||
      durationMs <= 0) {
    error.textContent = "Enter a time greater than zero.";
    return;
  }

  browser.runtime.sendMessage({
    type: "start",
    durationMs,
    repeating: repeatInput.checked
  }).then(state => {
    showRunning(state);
  }).catch(() => {
    error.textContent = "Could not start the timer. Please try again.";
  });
});

document.getElementById("cancel").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "cancel" }).then(showSetup);
});

browser.runtime.sendMessage({ type: "getState" }).then(state => {
  if (state.endTime && state.endTime > Date.now()) {
    showRunning(state);
  }
}).catch(() => {
  error.textContent = "Could not load the timer.";
});
