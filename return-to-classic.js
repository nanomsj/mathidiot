chrome.action.onClicked.addListener(({ id }) => {
  if (id !== undefined) chrome.tabs.update(id, {
    url: 'https://mathsmart.pku.edu.cn/schedule#four-panels',
  });
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'sms-read-archive' || sender.origin !== 'https://mathsmart.pku.edu.cn') return;
  const { id } = message;
  if (typeof id !== 'string' || (id && !/^\d{1,10}$/.test(id))) return;
  const path = id ? '/htdocs/showarticle.php?id=' + id : '/htdocs/main.php';
  fetch('http://portal.math.pku.edu.cn' + path, {
    credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(7000),
  }).then(response => {
    if (!response.ok) throw new Error('Archive unavailable');
    return response.text();
  }).then(html => respond({ html }), () => respond({}));
  return true;
});
