chrome.action.onClicked.addListener(({ id }) => {
  if (id !== undefined) chrome.tabs.update(id, {
    url: 'https://mathsmart.pku.edu.cn/schedule#four-panels',
  });
});
