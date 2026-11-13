# Gentle Alarm

Gentle Alarm is a simple Firefox extension for setting a countdown timer. When
the timer finishes, it can open a visual alert and play a gentle chime. The alarm
can also repeat, and track elapsed time.

## Building and Packaging

This project is a plain Firefox extension, so there is no build step required.
To test it locally:

1. Open Firefox.
2. Go to `about:debugging`.
3. Click "This Firefox".
4. Choose "Load Temporary Add-on" or "Load unpacked" and select the project folder.

To package the extension into a ZIP archive from the repository root:

```bash
zip gentle-alarm.zip manifest.json background.js popup.html popup.css popup.js alert.html alert.css alert.js alarm_bell_icon.png README.md
```

## Contributing

Keep contributions focused and consistent with the existing code:

- Write clean, readable code that is easy to maintain.
- Reuse existing code and browser APIs rather than duplicating behavior.
- Prefer the smallest change that fully solves the problem; avoid unnecessary
  abstractions, dependencies, and code.