document.getElementById("dismiss").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "stopChime" }).catch(() => {
    // Ignore failures when the background page is unavailable.
  }).finally(() => {
    window.close();
  });
});
