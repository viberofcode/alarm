const ALARM_NAME = "countdown";
const REPEATING_ALARM_NAME = "countdown-repeating";
let repeatStartTime = null;

function getState() {
  return Promise.all([
    browser.alarms.get(ALARM_NAME),
    browser.alarms.get(REPEATING_ALARM_NAME)
  ]).then(([alarm, repeatingAlarm]) => {
    const activeAlarm = alarm || repeatingAlarm;
    const durationMs = repeatingAlarm ? repeatingAlarm.periodInMinutes * 60000 : null;
    return {
      endTime: activeAlarm ? activeAlarm.scheduledTime : null,
      durationMs,
      repeating: Boolean(repeatingAlarm),
      startTime: repeatingAlarm
        ? (repeatStartTime || repeatingAlarm.scheduledTime - durationMs)
        : null
    };
  });
}

function playGentleChime() {
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
    });
  }

  window.setTimeout(() => context.close(), 5000);
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== ALARM_NAME && alarm.name !== REPEATING_ALARM_NAME) {
    return;
  }

  try {
    playGentleChime();
  } catch (error) {
    console.error("Could not play the alarm sound.", error);
  }
});

browser.runtime.onMessage.addListener(message => {
  if (message.type === "start") {
    const startTime = Date.now();
    const endTime = startTime + message.durationMs;
    const alarmName = message.repeating ? REPEATING_ALARM_NAME : ALARM_NAME;
    const alarmOptions = { when: endTime };
    if (message.repeating) {
      alarmOptions.periodInMinutes = message.durationMs / 60000;
    }

    return Promise.all([
      browser.alarms.clear(ALARM_NAME),
      browser.alarms.clear(REPEATING_ALARM_NAME)
    ]).then(() => browser.alarms.create(alarmName, alarmOptions)).then(() => {
      repeatStartTime = message.repeating ? startTime : null;
      return {
        endTime,
        durationMs: message.durationMs,
        repeating: message.repeating,
        startTime: repeatStartTime
      };
    });
  }

  if (message.type === "cancel") {
    return Promise.all([
      browser.alarms.clear(ALARM_NAME),
      browser.alarms.clear(REPEATING_ALARM_NAME)
    ]).then(() => {
      repeatStartTime = null;
    });
  }

  if (message.type === "getState") {
    return getState();
  }
});
