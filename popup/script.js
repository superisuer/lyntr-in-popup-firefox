browser.tabs
.executeScript({ file: "/content_scripts/popup.js" })
.then(listenForClicks)
.catch(reportExecuteScriptError);
