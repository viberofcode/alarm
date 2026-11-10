const ALARM_NAME = "countdown";
const REPEATING_ALARM_NAME = "countdown-repeating";
const REPEATING_ALARM_PREFIX = `${REPEATING_ALARM_NAME}-`;
let alarmWindowId = null;
let alarmWindowTask = Promise.resolve();
let activeChime = null;

function isRepeatingAlarm(alarm) {
  return alarm.name === REPEATING_ALARM_NAME ||
    alarm.name.startsWith(REPEATING_ALARM_PREFIX);
}

function getRepeatingAlarms() {
  return browser.alarms.getAll().then(alarms => alarms.filter(isRepeatingAlarm));
}

function clearRepeatingAlarms() {
  return getRepeatingAlarms().then(alarms =>
    Promise.all(alarms.map(alarm => browser.alarms.clear(alarm.name)))
  );
}

function stopGentleChime() {
  if (!activeChime) {
    return;
  }

  const { context, oscillators } = activeChime;
  oscillators.forEach(oscillator => {
    try {
      oscillator.stop();
    } catch (error) {
      // The oscillator may already have finished.
    }
  });

  if (context && context.state !== "closed") {
    context.close().catch(() => {
      // The context may already be closed.
    });
  }

  activeChime = null;
}

function getState() {
  return Promise.all([
    browser.alarms.get(ALARM_NAME),
    getRepeatingAlarms()
  ]).then(([alarm, repeatingAlarms]) => {
    const repeatingAlarm = repeatingAlarms[0];
    const activeAlarm = alarm || repeatingAlarm;
    const durationMs = repeatingAlarm ? repeatingAlarm.periodInMinutes * 60000 : null;
    const alarmStartTime = repeatingAlarm && repeatingAlarm.name.startsWith(REPEATING_ALARM_PREFIX)
      ? Number(repeatingAlarm.name.slice(REPEATING_ALARM_PREFIX.length))
      : null;
    const startTime = repeatingAlarm
      ? (Number.isFinite(alarmStartTime)
        ? alarmStartTime
        : repeatingAlarm.scheduledTime - durationMs)
      : null;
    return {
      endTime: activeAlarm ? activeAlarm.scheduledTime : null,
      durationMs,
      repeating: Boolean(repeatingAlarm),
      startTime
    };
  });
}

function playGentleChime() {
  stopGentleChime();

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const now = context.currentTime;
  const melody = [
    { frequency: 523.25, start: 0, duration: 1.2 },
    { frequency: 659.25, start: 0.18, duration: 1.35 }
  ];
  const oscillators = [];

  for (let repetition = 0; repetition < 3; repetition += 1) {
    const repetitionStart = repetition * 1.4;
    melody.forEach(({ frequency, start, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = repetitionStart + start;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + noteStart);
      gain.gain.exponentialRampToValueAtTime(0.12, now + noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + noteStart + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + noteStart);
      oscillator.stop(now + noteStart + duration);
      oscillators.push(oscillator);
    });
  }

  activeChime = { context, oscillators };
  window.setTimeout(() => {
    if (activeChime && activeChime.context === context) {
      stopGentleChime();
    }
  }, 5000);
}

function createAlarmWindow() {
  return browser.windows.create({
    url: browser.runtime.getURL("alert.html"),
    type: "popup",
    width: 360,
    height: 260,
    focused: true
  });
}

browser.windows.onRemoved.addListener(windowId => {
  if (windowId === alarmWindowId) {
    alarmWindowId = null;
    stopGentleChime();
  }
});

function showAlarmWindow() {
  alarmWindowTask = alarmWindowTask.then(() => {
    if (alarmWindowId !== null) {
      return browser.windows.update(alarmWindowId, { focused: true }).catch(error => {
        console.error("Could not focus the existing alarm window.", error);
        alarmWindowId = null;
        return createAlarmWindow().then(alarmWindow => {
          alarmWindowId = alarmWindow.id;
        });
      });
    }

    return createAlarmWindow().then(alarmWindow => {
      alarmWindowId = alarmWindow.id;
    });
  }).catch(error => {
    console.error("Could not open the alarm window.", error);
  });
  return alarmWindowTask;
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== ALARM_NAME && !isRepeatingAlarm(alarm)) {
    return;
  }

  try {
    if (window.localStorage.getItem("showVisualNotification") !== "false") {
      showAlarmWindow();
    }
  } catch (error) {
    console.error("Could not load the visual alert setting.", error);
  }

  try {
    if (window.localStorage.getItem("playChime") !== "false") {
      playGentleChime();
    }
  } catch (error) {
    console.error("Could not load the chime setting or play the alarm sound.", error);
  }
});

browser.runtime.onMessage.addListener(message => {
  if (message.type === "start") {
    const startTime = Date.now();
    const endTime = startTime + message.durationMs;
    const alarmName = message.repeating
      ? `${REPEATING_ALARM_PREFIX}${startTime}`
      : ALARM_NAME;
    const alarmOptions = { when: endTime };
    if (message.repeating) {
      alarmOptions.periodInMinutes = message.durationMs / 60000;
    }

    return Promise.all([
      browser.alarms.clear(ALARM_NAME),
      clearRepeatingAlarms()
    ]).then(() => browser.alarms.create(alarmName, alarmOptions)).then(() => {
      return {
        endTime,
        durationMs: message.durationMs,
        repeating: message.repeating,
        startTime: message.repeating ? startTime : null
      };
    });
  }

  if (message.type === "cancel") {
    return Promise.all([
      browser.alarms.clear(ALARM_NAME),
      clearRepeatingAlarms()
    ]);
  }

  if (message.type === "stopChime") {
    stopGentleChime();
    return Promise.resolve();
  }

  if (message.type === "getState") {
    return getState();
  }
});
