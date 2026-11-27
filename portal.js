(() => {
  const groups = ['学院通知', '教务信息', '学院制度及规定', '学生园地'];
  const archiveLimit = 50;
  const localSectionParam = 'mathidiot-section';
  const homePath = '/schedule';
  const listingPath = '/schedule/academic-notice';
  const roomsPath = '/activity-room/activity-room';
  const bookingPath = '/activity-room/quick-book';
  const recordsPath = '/activity-room/my-reservations';
  const overviewPath = '/reservation-overview/index';
  const roomChoiceKey = 'sms-classic-room-choice';
  const roomNamesKey = 'sms-classic-room-names';
  const classicHash = '#four-panels';
  const originalKey = 'sms-classic-portal-original';
  const logoutKey = 'sms-classic-logout-pending';
  const archive = 'http://portal.math.pku.edu.cn/htdocs/main.php';
  const archiveArticle = 'http://portal.math.pku.edu.cn/htdocs/showarticle.php';
  const services = [
    ['讨论室预约', '/activity-room/activity-room'],
    ['我的预约', recordsPath],
    ['预约总览', overviewPath],
    ['教师查询', 'https://math.pku.edu.cn/jsdw/js/index.htm'],
  ];

  function element(tag, label) {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    return node;
  }

  function link(label, href) {
    const node = element('a', label);
    node.href = href;
    return node;
  }

  function button(label, action) {
    const node = element('button', label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  const root = document.documentElement;
  if (root.hasAttribute('data-sms-portal-loaded')) return;
  root.setAttribute('data-sms-portal-loaded', '');
  const container = element('section');
  container.id = 'sms-classic-portal';
  const returnBookmark = link('回到四栏版', homePath + classicHash);
  returnBookmark.id = 'sms-classic-bookmark';
  const main = element('main');
  const header = element('header');
  const brand = element('h1');
  const logo = element('img');
  logo.src = typeof smsPortalLogoUrl === 'string' ? smsPortalLogoUrl : chrome.runtime.getURL('college-logo.png');
  logo.alt = '北京大学数学科学学院';
  logo.width = 496;
  logo.height = 72;
  const brandLink = link('', homePath);
  brandLink.append(logo);
  brand.append(brandLink);
  const headerLinks = element('div');
  headerLinks.className = 'sms-header-links';
  headerLinks.append(link('学院官网', 'https://math.pku.edu.cn/'), button('MathSmart 原版', () => {
    sessionStorage.setItem(originalKey, '1');
    if (location.pathname !== homePath) location.assign(homePath);
    else refresh();
  }), button('退出登录', requestLogout));
  const feedback = link('反馈 Bug', 'https://github.com/nanomsj/mathidiot/issues');
  feedback.className = 'sms-header-feedback';
  feedback.target = '_blank';
  feedback.rel = 'noopener noreferrer';
  headerLinks.append(feedback);
  header.append(brand, headerLinks);
  const nav = element('nav');
  const menu = element('details');
  const links = element('ul');
  for (const [label, href] of services) {
    const item = element('li');
    item.append(link(label, href));
    links.append(item);
  }
  menu.append(element('summary', '常用服务'), links);
  nav.append(link('通知首页', homePath), menu);
  container.append(header, nav, main);

  let frame = 0;
  let signature = '';
  let panels = new Map();
  let listing = null;
  let listedTitles = new Set();
  let article = null;
  let pending = null;
  let listingTitle = '';
  let lastUrl = '';
  let queuedNotice = null;
  let reservationView;
  let overviewView;
  let archiveSections = new Map();
  let archiveStatus = '';
  let bookingRoomIds = new Map();
  let bookingRoomRequest;
  const homeSize = new ResizeObserver(([entry]) => fitHome(entry.target));

  async function readArchive(id = '') {
    const url = id ? `${archiveArticle}?id=${id}` : archive;
    const html = typeof smsPortalReadArchive === 'function'
      ? await smsPortalReadArchive(url)
      : (await chrome.runtime.sendMessage({ type: 'sms-read-archive', id }))?.html;
    if (!html) throw new Error('Archive unavailable');
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function loadArchive() {
    if (archiveStatus) return;
    archiveStatus = 'loading';
    readArchive().then(archivePage => {
      for (const section of archivePage.querySelectorAll('.module')) {
        const title = text(section, '.module_title');
        if (!groups.includes(title)) continue;
        const rows = [];
        for (const row of section.querySelectorAll('.module_content > a[href]')) {
          const raw = safeUrl(row.getAttribute('href'), false, archive);
          if (!raw) continue;
          const href = new URL(raw);
          const id = href.searchParams.get('id');
          const notice = text(row, '.module_item');
          if (href.origin !== new URL(archive).origin || href.pathname !== '/htdocs/showarticle.php' || !/^\d{1,10}$/.test(id ?? '') || !notice) continue;
          rows.push({ title: notice, date: text(row, '.module_date'), archiveId: id, href: href.href });
          if (rows.length === archiveLimit) break;
        }
        archiveSections.set(title, rows);
      }
      archiveStatus = archiveSections.size ? 'ready' : 'unavailable';
    }).catch(() => { archiveStatus = 'unavailable'; }).finally(scheduleRefresh);
  }

  function combineNotices(current, label, seenTitles) {
    const currentTitles = new Set(current.map(({ title }) => noticeTitleKey(title)));
    const older = (archiveSections.get(label) ?? []).filter(({ title }) => {
      const key = noticeTitleKey(title);
      return !currentTitles.has(key) && !seenTitles?.has(key);
    });
    return [...current, ...older];
  }

  function text(node, selector) {
    return node.querySelector(selector)?.textContent.trim() ?? '';
  }

  function originalLogout(app) {
    return [...(app?.querySelectorAll('a, button, [role="button"]') ?? [])]
      .find((control) => control.textContent.trim() === '退出登录' && !control.disabled);
  }

  function requestLogout() {
    const action = originalLogout(document.getElementById('app'));
    if (action) {
      action.click();
      return;
    }
    sessionStorage.setItem(logoutKey, String(Date.now()));
    location.assign(homePath);
  }

  function shortDate(date) {
    const parts = date.match(/(?:\d{4}[-/.年]\s*)?(\d{1,2})[-/.月]\s*(\d{1,2})(?!\d)/);
    return parts ? parts.slice(1).map((part) => part.padStart(2, '0')).join('-') : '';
  }

  function readRows(node, selector) {
    return [...node.querySelectorAll(selector)].flatMap((row) => {
      const title = text(row, '.notice-title-text, .notice-title, strong');
      if (!title || title.startsWith('暂无')) return [];
      return [{ title, date: text(row, '.notice-date, time'), row }];
    });
  }

  function sourcePanels(app) {
    const result = new Map();
    for (const panel of app.querySelectorAll('.notice-section, .lg-panel')) {
      const label = text(panel, '.card-header-title, .lg-panel-title h2');
      if (!label) continue;
      result.set(label, {
        more: panel.querySelector('.el-card__header .el-link, .lg-panel-link'),
        rows: readRows(panel, '.notice-item-student, .notice-item-teacher, .list-row'),
      });
    }
    return result;
  }

  function sourceListing(app) {
    const page = app.querySelector('.academic-notice-container');
    if (!page) return null;
    return {
      label: text(page, '.page-title'),
      rows: readRows(page, '.notice-list .notice-item'),
      empty: Boolean(page.querySelector('.notice-list .empty-state')),
      total: text(page, '.el-pagination__total'),
      current: text(page, '.el-pager .is-active'),
      previous: page.querySelector('.el-pagination .btn-prev:not(:disabled)'),
      next: page.querySelector('.el-pagination .btn-next:not(:disabled)'),
      search: page.querySelector('.filter-bar input'),
    };
  }

  function safeUrl(value, image = false, base = location.href) {
    if (!value) return null;
    if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,/i.test(value)) return value;
    try {
      const url = new URL(value, base);
      if (url.protocol === 'https:' || (!image && ['http:', 'mailto:'].includes(url.protocol))) return url.href;
    } catch {
      return null;
    }
    return null;
  }

  const preservedTags = new Set('p br div span strong b em i u s sub sup blockquote pre code dl dt dd ul ol li h1 h2 h3 h4 h5 h6 table caption thead tbody tfoot tr td th hr a img'.split(' '));
  const removedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'template']);
  const textStyles = [
    'text-align', 'text-indent', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-decoration', 'line-height', 'white-space', 'color', 'vertical-align',
  ];

  function copyContent(source, target, base = location.href) {
    for (const child of source.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        target.append(document.createTextNode(child.data));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.localName;
      if (removedTags.has(tag)) continue;
      if (!preservedTags.has(tag)) {
        copyContent(child, target, base);
        continue;
      }
      const node = element(tag);
      if (child.id) node.id = 'sms-notice-' + child.id;
      if (tag === 'a') {
        const sourceHref = child.getAttribute('href');
        const href = sourceHref?.startsWith('#') ? '#sms-notice-' + sourceHref.slice(1) : safeUrl(sourceHref, false, base);
        if (href) {
          node.href = href;
          if (child.hasAttribute('download')) node.download = child.download;
          if (child.target === '_blank') {
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
          }
        }
      }
      if (tag === 'img') {
        const rawSource = child.getAttribute('src');
        const src = safeUrl(rawSource, true, base);
        if (!src) {
          const imageLink = base !== location.href ? safeUrl(rawSource, false, base) : null;
          if (imageLink?.startsWith('http://')) target.append(link(child.alt || '查看正文图片', imageLink));
          continue;
        }
        node.src = src;
        node.alt = child.alt || '正文图片';
        node.loading = 'lazy';
        for (const attribute of ['width', 'height']) {
          if (/^\d+$/.test(child.getAttribute(attribute) ?? '')) node.setAttribute(attribute, child.getAttribute(attribute));
        }
      }
      for (const attr of ['colspan', 'rowspan']) {
        if (/^\d+$/.test(child.getAttribute(attr) ?? '')) node.setAttribute(attr, child.getAttribute(attr));
      }
      for (const property of textStyles) {
        const value = child.style?.getPropertyValue(property);
        if (value) node.style.setProperty(property, value);
      }
      if (['left', 'center', 'right', 'justify'].includes(child.getAttribute('align'))) {
        node.style.textAlign = child.getAttribute('align');
      }
      copyContent(child, node, base);
      target.append(node);
    }
  }

  function noticeContent(record, dialog) {
    const body = element('div');
    body.className = 'sms-body';
    let files;
    let originalPublication;
    if (dialog) {
      const content = dialog.querySelector('.detail-content, .notice-content, .modal-body > div:nth-child(2)');
      if (content) copyContent(content, body);
      const title = noticeTitleKey(record.title);
      const prefix = document.createRange();
      prefix.setStart(body, 0);
      const atStart = (node) => {
        if (node.querySelector('img, table, a[href]')) return false;
        prefix.setEndBefore(node);
        return !prefix.toString().trim() && !prefix.cloneContents().querySelector('img, table, a[href]');
      };
      const duplicate = [...body.querySelectorAll('h1, h2, h3, p, div')].find((node) =>
        title && noticeTitleKey(node.textContent) === title && atStart(node));
      duplicate?.remove();
      for (const node of body.querySelectorAll('p, div')) {
        const metadata = node.textContent.trim()
          .match(/^发布日期\s*[:：]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)(?:\s*[\[［]([^\]］]+)[\]］])?$/);
        if (!metadata || !atStart(node)) continue;
        originalPublication = { date: metadata[1], author: metadata[2] };
        node.remove();
        break;
      }
    }
    if (dialog) {
      const attachmentRows = [...dialog.querySelectorAll('.attachment-row, .detail-attachments li')];
      if (attachmentRows.length) {
        files = element('section');
        files.className = 'sms-panel sms-files';
        files.append(element('h3', '附件下载'));
        attachmentRows.forEach((row, index) => {
          const label = text(row, '.attachment-name, span') || '下载附件';
          const rawHref = row.querySelector('a[href]')?.getAttribute('href');
          const href = rawHref && rawHref !== '#' ? safeUrl(rawHref) : null;
          const control = href ? link(label, href) : button(label, () => readDialog(record, (reopened) => {
            reopened?.querySelectorAll('.attachment-row, .detail-attachments li')[index]?.querySelector('button, a')?.click();
          }));
          files.append(control);
        });
      }
    }
    const hasContent = Boolean((body.textContent.trim() && !/^暂无(?:详细)?(?:正文|内容)$/.test(body.textContent.trim()))
      || body.querySelector('img') || files);
    if (!body.textContent.trim() && !body.querySelector('img') && !files) {
      body.append(element('p', dialog ? '暂无正文' : '正文加载失败，请返回列表后重试。'));
    }
    return { body, files, hasContent, originalPublication };
  }

  function showNotice(record, fromHome = false, fallback) {
    if (!record.row.isConnected || pending) return;
    article = { ...record, fromHome, loading: true };
    signature = '';
    scheduleRefresh();
    readDialog(record, (dialog) => {
      if (article?.row !== record.row) return;
      const content = noticeContent(record, dialog);
      Object.assign(article, content.hasContent || !fallback?.hasContent ? content : fallback, { loading: false });
      signature = '';
      scheduleRefresh();
    });
    window.scrollTo(0, 0);
  }

  function readDialog(record, read) {
    if (pending || !record.row.isConnected) return;
    record.row.click();
    const start = Date.now();
    pending = setInterval(() => {
      const dialog = [...document.querySelectorAll('.el-dialog')].find((candidate) =>
        candidate.querySelector('.detail-content, .notice-detail, .notice-detail-footer')
          && candidate.textContent.includes(record.title),
      );
      if (!dialog && Date.now() - start < 3000) return;
      clearInterval(pending);
      pending = null;
      read(dialog);
      dialog?.querySelector('.el-dialog__headerbtn')?.click();
    }, 50);
  }

  function findFullNotice(record, label) {
    const more = panels.get(label)?.more;
    if (!more) {
      showNotice(record);
      return;
    }
    if (pending) return;
    article = { ...record, loading: true };
    signature = '';
    scheduleRefresh();
    readDialog(record, (dialog) => {
      const fallback = noticeContent(record, dialog);
      if (location.pathname !== homePath || article?.row !== record.row) return;
      if (fallback.files) {
        Object.assign(article, fallback, { loading: false });
        signature = '';
        scheduleRefresh();
        return;
      }
      const request = { title: record.title, started: Date.now(), searched: false, fallback };
      queuedNotice = request;
      listingTitle = label;
      queueMicrotask(() => {
        if (queuedNotice === request && more.isConnected) more.click();
      });
      setTimeout(() => {
        if (queuedNotice !== request) return;
        queuedNotice = null;
        if (location.pathname === listingPath || location.pathname === homePath) {
          article = { ...record, ...fallback, fromHome: location.pathname === listingPath, loading: false };
          signature = '';
          scheduleRefresh();
        }
      }, 3500);
    });
  }

  function noticeTitleKey(title) {
    return title.normalize('NFKC').replace(/\s+/g, '');
  }

  function findQueuedNotice() {
    if (!queuedNotice || !listing) return;
    const found = listing.rows.find(({ title }) => noticeTitleKey(title) === noticeTitleKey(queuedNotice.title));
    if (found) {
      const fallback = queuedNotice.fallback;
      queuedNotice = null;
      showNotice(found, true, fallback);
    } else if (listing.search && !queuedNotice.searched) {
      queuedNotice.searched = true;
      listing.search.value = queuedNotice.title.split(/[：:（(，,]/)[0].slice(0, 30).trim() || queuedNotice.title;
      listing.search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function showArchivedNotice(record) {
    const opened = { ...record, loading: true };
    article = opened;
    signature = '';
    scheduleRefresh();
    window.scrollTo(0, 0);

    readArchive(record.archiveId).then(source => {
      const content = source.querySelector('.module_center .module_content');
      const heading = source.querySelector('.article_header');
      if (!content || !heading) throw new Error('Archive article unavailable');
      const body = element('div');
      body.className = 'sms-body';
      copyContent(content, body, record.href);
      // 浏览器修正旧门户的段落嵌套时，可能为同一附件生成一个额外的空链接。
      const attachments = new Map();
      for (const anchor of source.querySelectorAll('#news-attach a[href]')) {
        const href = safeUrl(anchor.getAttribute('href'), false, record.href);
        if (!href || attachments.get(href)) continue;
        attachments.set(href, anchor.textContent.trim().replace(/^附件\s*[:：]\s*/, ''));
      }
      if (attachments.size) {
        const files = element('section');
        files.className = 'sms-panel sms-files';
        files.append(element('h3', '附件下载'), ...Array.from(attachments, ([href, name]) => link(name || '下载附件', href)));
        opened.files = files;
      }
      const date = text(heading, '.article_date').match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
      if (date) opened.date = date[0];
      if (!body.textContent.trim() && !body.querySelector('img') && !attachments.size) {
        body.append(link('在旧门户查看原文', record.href));
      }
      opened.body = body;
    }).catch(() => {
      const body = element('div');
      body.className = 'sms-body';
      body.append(element('p', '旧站正文暂时无法加载。'), link('在旧门户查看原文', record.href));
      opened.body = body;
    }).finally(() => {
      opened.loading = false;
      if (article === opened) scheduleRefresh();
    });
  }

  function rowList(records, label) {
    const list = element('ul');
    list.className = 'sms-notice-list';
    for (const record of records) {
      const row = element('li');
      const title = button(record.title, () => {
        if (record.archiveId) showArchivedNotice(record);
        else if (label) findFullNotice(record, label);
        else showNotice(record);
      });
      title.title = record.title;
      row.append(title, element('time', shortDate(record.date)));
      list.append(row);
    }
    return list;
  }

  function renderHome() {
    const grid = element('div');
    grid.className = 'sms-grid sms-home-grid';
    for (const label of groups) {
      const panel = element('section');
      panel.className = 'sms-panel';
      const heading = element('div');
      heading.className = 'sms-panel-heading';
      heading.append(element('h2', label));
      const source = panels.get(label);
      const records = combineNotices(source?.rows ?? [], label);
      if (source?.more) {
        heading.append(button('查看全部', () => {
          listingTitle = label;
          panels.get(label)?.more?.click();
        }));
      } else if (records.length) {
        heading.append(link('查看全部', `${listingPath}?${new URLSearchParams({ [localSectionParam]: label })}`));
      }
      panel.append(heading);
      if (records.length) {
        panel.append(rowList(records, label));
      } else {
        const message = archiveStatus === 'loading' ? '正在加载旧站通知…'
          : archiveStatus === 'unavailable' ? '旧站通知暂时无法加载' : '暂无通知';
        panel.append(element('p', message));
      }
      grid.append(panel);
    }
    return grid;
  }

  function fitHome(grid) {
    if (!grid.isConnected) return;
    const desktop = matchMedia('(min-width: 651px) and (min-height: 450px)').matches;
    const rowHeight = parseFloat(getComputedStyle(grid).getPropertyValue('--sms-home-row-height'));
    for (const panel of grid.children) {
      const list = panel.querySelector('.sms-notice-list');
      if (!list) continue;
      const bottom = panel.getBoundingClientRect().top + panel.clientTop + panel.clientHeight;
      const padding = parseFloat(getComputedStyle(panel).paddingBottom);
      const remaining = bottom - padding - list.getBoundingClientRect().top;
      const count = desktop ? Math.max(0, Math.floor((remaining + 0.05) / rowHeight)) : 8;
      for (const [index, row] of [...list.children].entries()) row.hidden = index >= count;
    }
  }

  function listingGroup() {
    const category = new URLSearchParams(location.search).get('category') ?? '';
    if (category.includes('student-garden')) return '学生园地';
    if (category.includes('college')) return '学院通知';
    if (category.includes('academic') || category.includes('teaching')) return '教务信息';
    return groups.find(label => listing?.label?.includes(label)) ?? listingTitle;
  }

  function renderListing() {
    const panel = element('section');
    panel.className = 'sms-panel sms-listing';
    const heading = element('div');
    heading.className = 'sms-panel-heading';
    const localGroup = new URLSearchParams(location.search).get(localSectionParam);
    const label = listingGroup();
    heading.append(element('h2', localGroup || label || listing?.label || '通知列表'));
    panel.append(heading);
    if (groups.includes(localGroup)) {
      const records = combineNotices(panels.get(localGroup)?.rows ?? [], localGroup);
      if (records.length) panel.append(rowList(records));
      else if (archiveStatus === 'loading') panel.append(element('p', '正在加载旧站通知…'));
      else panel.append(element('p', archiveStatus === 'unavailable' ? '旧站通知暂时无法加载' : '暂无通知'));
      return panel;
    }
    if (queuedNotice) {
      panel.append(element('p', Date.now() - queuedNotice.started > 5000
        ? '未在栏目中找到这条通知。' : '正在查找通知正文…'));
      panel.append(link('返回通知首页', homePath));
      return panel;
    }
    if (!listing || (!listing.rows.length && !listing.empty)) {
      panel.append(element('p', '正在加载通知…'));
      return panel;
    }
    const records = listing.next ? listing.rows : combineNotices(listing.rows, label, listedTitles);
    panel.append(records.length ? rowList(records) : element('p', archiveStatus === 'loading' ? '正在加载旧站通知…' : '暂无通知'));
    if (!listing.next && groups.includes(label) && archiveStatus === 'unavailable') {
      panel.append(element('p', '旧站通知暂时无法加载'));
    }
    const pagination = element('div');
    pagination.className = 'sms-pagination';
    const previous = button('上一页', () => listing?.previous?.click());
    const next = button('下一页', () => listing?.next?.click());
    previous.disabled = !listing.previous;
    next.disabled = !listing.next;
    if (listing.current) pagination.append(previous, element('span', '第 ' + listing.current + ' 页'), next);
    if (listing.total) pagination.append(element('span', listing.total));
    if (pagination.childElementCount) panel.append(pagination);
    return panel;
  }

  function renderArticle() {
    const page = element('div');
    page.className = 'sms-article-page';
    const panel = element('article');
    panel.className = 'sms-panel sms-article';
    const record = article;
    page.append(button(!record.fromHome && location.pathname === listingPath ? '返回栏目列表' : '返回通知首页', () => {
      if (record.fromHome) {
        location.assign(homePath);
        return;
      }
      article = null;
      signature = '';
      scheduleRefresh();
    }));
    const heading = element('div');
    heading.className = 'sms-article-heading';
    const publication = record.originalPublication;
    const date = element('p', publication ? '原文发布日期：' : '发布日期：');
    const time = element('time', publication?.date || record.date);
    if (publication && record.date && publication.date !== record.date) {
      time.title = 'MathSmart 发布记录：' + record.date;
    }
    date.append(time);
    if (publication?.author) date.append(' [' + publication.author + ']');
    heading.append(element('h2', record.title), date);
    panel.append(heading, record.loading ? element('p', '正在加载正文…') : record.body);
    page.append(panel);
    if (record.files) page.append(record.files);
    return page;
  }

  function today() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
  }

  function storedRoomChoice() {
    return JSON.parse(sessionStorage.getItem(roomChoiceKey) || 'null');
  }

  function roomLabel(number, name) {
    return [number, name].filter(Boolean).join(' · ');
  }

  function roomControls(app) {
    const rooms = new Map();
    for (const name of app.querySelectorAll('.room-name-text')) {
      const card = name.closest('.room-card');
      const action = [...(card?.querySelectorAll('.room-actions button') ?? [])]
        .find((control) => control.textContent.includes('立即预约') && !control.disabled);
      if (!action) continue;
      const number = text(card, '.room-no-tag');
      const label = roomLabel(number, name.textContent.trim());
      rooms.set(label, action);
    }
    return rooms;
  }

  function loadBookingRoomIds() {
    if (bookingRoomRequest) return;
    const token = localStorage.getItem('token');
    bookingRoomRequest = fetch('/api/activity-rooms/list?page=0&size=10000', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    }).then(response => {
      if (!response.ok) throw new Error('Room directory unavailable');
      return response.json();
    }).then(({ data }) => {
      const entries = data?.content ?? data?.data ?? data;
      if (!Array.isArray(entries)) return;
      const rooms = new Map();
      for (const entry of entries) {
        const activity = entry.activityRoom ?? entry.meetingRoom ?? entry;
        const { roomName, roomNo } = entry.publicRoom ?? {};
        const id = entry.id || activity.id;
        if (!id || !roomName || activity.roomStatus === 'maintenance') continue;
        if (!['all', 'card-only'].includes(activity.displayMode || 'all')) continue;
        rooms.set(roomLabel(roomNo || activity.roomNo, roomName), String(id));
      }
      bookingRoomIds = rooms;
    }).catch(() => {}).finally(scheduleRefresh);
  }

  function field(caption, control) {
    const label = element('label', caption);
    label.append(control);
    return label;
  }

  function roomPicker(names, choice, onSelect) {
    const form = element('form');
    form.className = 'sms-room-picker';
    const select = element('select');
    select.required = true;
    const blank = element('option', '请选择房间');
    blank.value = '';
    select.append(blank);
    for (const name of names) select.append(element('option', name));
    select.value = choice?.room || '';
    const date = element('input');
    date.type = 'date';
    date.min = today();
    date.required = true;
    date.value = choice?.date || today();
    const submit = element('button', '查看时段');
    submit.type = 'submit';
    submit.disabled = names.length === 0;
    form.append(field('房间', select), field('日期', date), submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      onSelect({ room: select.value, date: date.value });
    });
    return form;
  }

  function setRoomChoice(choice, next) {
    sessionStorage.setItem(roomChoiceKey, JSON.stringify({ ...choice, next }));
  }

  function reservationSidebar() {
    const sidebar = element('aside');
    sidebar.className = 'sms-reservation-sidebar';
    const navigation = element('div');
    navigation.className = 'sms-reservation-links';
    navigation.setAttribute('role', 'navigation');
    navigation.setAttribute('aria-label', '预约功能');
    for (const [label, path] of [
      ['讨论室预约', roomsPath],
      ['我的预约', recordsPath],
      ['预约总览', overviewPath],
    ]) {
      const item = link(label, path);
      const current = location.pathname === path || (path === roomsPath && location.pathname === bookingPath);
      if (current) item.setAttribute('aria-current', 'page');
      navigation.append(item);
    }
    sidebar.append(navigation);
    return sidebar;
  }

  function reservationLayout(content, sidebar = reservationSidebar()) {
    const layout = element('div');
    layout.className = 'sms-booking-layout';
    layout.append(sidebar, content);
    return layout;
  }

  function renderRoomPicker(rooms) {
    const panel = element('section');
    panel.className = 'sms-room-entry';
    panel.append(roomPicker([...rooms.keys()], storedRoomChoice(), (choice) => {
      setRoomChoice(choice, 'booking');
      rooms.get(choice.room)?.click();
    }));
    if (!rooms.size) panel.append(element('p', '房间尚未加载，或当前没有可预约的房间。'));
    return reservationLayout(panel);
  }

  function bookingUrl(date, roomId) {
    const url = roomId ? new URL(bookingPath, location.origin) : new URL(location.href);
    if (roomId) url.searchParams.set('roomId', roomId);
    url.searchParams.set('clickedDate', date);
    return url.href;
  }

  function readBooking(app, date) {
    const page = app.querySelector('.quick-book-page');
    if (!page) return { room: '', slots: [], ready: false };
    const headings = [...page.querySelectorAll('.normal-schedule-container .el-table__header th')];
    const column = headings.findIndex((heading) => {
      const label = text(heading, '.date-header-title');
      return label === date || shortDate(label) === date.slice(5);
    });
    const room = text(page, '.room-name-text');
    const roomNumber = text(page, '.room-info-header .room-no-tag');
    const booker = [...page.querySelectorAll('.quick-book-form .el-form-item')].find((item) =>
      text(item, 'label').includes('预定人'),
    )?.querySelector('input')?.value.trim();
    const slots = [];
    if (column !== -1) {
      const rows = page.querySelectorAll('.normal-schedule-container .el-table__body-wrapper tbody tr');
      for (const row of rows) {
        const time = text(row, '.time-slot-cell');
        const cell = row.cells[column];
        if (!time || !cell) continue;
        const input = cell.querySelector('input[type="checkbox"]');
        const reservation = cell.querySelector('div[style*="word-break"]');
        const details = [...(reservation?.firstElementChild?.children ?? [])];
        const themeLine = details.find((line) => line.style.fontSize === '11px');
        const occupant = details.find((line) => line !== themeLine)?.textContent.trim() || '';
        const theme = themeLine?.textContent.trim() || '';
        const own = Boolean(reservation && booker && occupant === booker);
        slots.push({ time, input, state: cell.textContent.trim(), reserved: Boolean(reservation), own, occupant, theme });
      }
    }
    return { room, roomNumber, slots, ready: headings.length > 0, form: page.querySelector('.booking-form-column') };
  }

  function exposeBookingForm(app, form) {
    if (!form) return null;
    form.classList.add('sms-native-booking-form');
    const official = form.querySelector('.quick-book-form');
    let purpose;
    let people;
    let submit;
    for (const section of official?.children ?? []) {
      const title = text(section, '.el-form-item__label, label');
      if (title.includes('活动名称')) purpose = section.querySelector('input');
      if (title.includes('共同预定人') || title.includes('共同预约人') || title.includes('参与人员')) {
        people = section;
      }
      submit ??= [...section.querySelectorAll('button')]
        .find((control) => /^\s*(提交预约|提交申请|确认预约)\s*$/.test(control.textContent));
    }
    for (let branch = form; branch; branch = branch.parentElement) {
      branch.classList.add('sms-native-booking-path');
      if (branch === app) break;
    }
    const choosePerson = [...(people?.querySelectorAll('button') ?? [])]
      .find((control) => /选择(?:共同预定人|共同预约人|参与人员)/.test(control.textContent));
    if (!purpose || !choosePerson || !submit) return null;
    const names = [...people.querySelectorAll('.attendee-tags .el-tag__content')]
      .map((tag) => tag.textContent.trim()).filter(Boolean);
    return { purpose, choosePerson, submit, names };
  }

  function bookingFooter(official) {
    const form = element('form');
    form.className = 'sms-booking-footer';
    const purpose = element('input');
    purpose.placeholder = '请在此处填写用途';
    purpose.required = true;
    purpose.value = official.purpose.value;
    purpose.addEventListener('input', () => {
      official.purpose.value = purpose.value;
      official.purpose.dispatchEvent(new Event('input', { bubbles: true }));
    });
    form.append(field('用途', purpose));
    for (let index = 0; index < 2; index += 1) {
      const caption = '参与者 ' + (index + 1);
      const choose = button(official.names[index] || '选择共同预约人', () => official.choosePerson.click());
      choose.className = 'sms-booking-person';
      choose.setAttribute('aria-label', caption + '：' + choose.textContent);
      form.append(field(caption, choose));
    }
    const submit = element('button', '提交');
    submit.type = 'submit';
    submit.disabled = official.submit.disabled;
    form.append(submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!official.submit.disabled) official.submit.click();
    });
    return form;
  }

  function readReservationTable(source) {
    const table = source.querySelector('.el-table');
    const headings = [...(table?.querySelectorAll('.el-table__header-wrapper th') ?? [])]
      .map((cell, index) => ({ label: cell.textContent.trim(), index }))
      .filter(({ label }) => label);
    const timeIndex = headings.findIndex(({ label }) => /时间|日期|时段/.test(label));
    if (timeIndex > 0) headings.unshift(...headings.splice(timeIndex, 1));
    const rows = [...(table?.querySelectorAll('.el-table__body-wrapper tbody > tr') ?? [])]
      .filter((row) => row.cells.length >= headings.length && row.cells.length > 0)
      .map((row) => headings.map(({ index }) => {
        const cell = row.cells[index];
        const actions = [...(cell?.querySelectorAll('button, a[href]') ?? [])]
          .filter((control) => control.textContent.trim());
        const lines = /时间|时段/.test(headings.find((heading) => heading.index === index)?.label ?? '')
          ? [...(cell?.querySelectorAll('.cell > div') ?? [])].map((line) => line.textContent.trim()).filter(Boolean)
          : [];
        return { text: lines.length ? lines.join('\n') : cell?.textContent.trim() ?? '', actions };
      }));
    return { headings, rows };
  }

  function exposeReservationSource(app, source) {
    if (!source) return;
    source.classList.add('sms-records-source');
    for (let branch = source.parentElement; branch && branch !== app; branch = branch.parentElement) {
      branch.classList.add('sms-records-branch');
    }
    app.classList.add('sms-records-active');
  }

  function refreshReservations(app, path, config) {
    if (!container.isConnected) app.before(container);
    root.dataset.smsClassicView = 'records';
    const source = app.querySelector(config.selector);
    exposeReservationSource(app, source);
    if (!reservationView || reservationView.path !== path || !reservationView.panel.isConnected) {
      const panel = element('section');
      panel.className = 'sms-records-panel';
      const heading = element('div');
      heading.className = 'sms-records-heading';
      heading.append(element('h2', config.title));
      const controls = element('div');
      controls.className = 'sms-records-controls';
      const search = element('input');
      search.type = 'search';
      search.placeholder = '搜索活动名称、房间号、活动室';
      search.setAttribute('aria-label', '搜索预约');
      search.addEventListener('input', () => {
        const original = app.querySelector(config.selector + ' .search-box input');
        if (!original) return;
        original.value = search.value;
        original.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const area = element('div');
      area.className = 'sms-records-table';
      const filters = element('div');
      filters.className = 'sms-records-filters';
      controls.append(filters, search);
      panel.append(heading, controls, area);
      main.replaceChildren(reservationLayout(panel));
      reservationView = { path, panel, search, filters, area, signature: '' };
    }
    const view = reservationView;
    if (!source) {
      if (view.signature !== 'loading') {
        view.area.replaceChildren(element('p', '正在加载预约记录…'));
        view.signature = 'loading';
      }
      return;
    }
    if (view.source !== source) {
      view.source = source;
      view.signature = '';
    }
    const sourceSearch = source.querySelector('.search-box input');
    view.search.hidden = !sourceSearch;
    if (sourceSearch && document.activeElement !== view.search) view.search.value = sourceSearch.value;
    const tabs = [...source.querySelectorAll('.el-tabs__item[role="tab"]')];
    const tabState = tabs.map((tab) => [tab.textContent.trim(), tab.getAttribute('aria-selected') === 'true']);
    const { headings, rows } = readReservationTable(source);
    const pagination = source.querySelector('.el-pagination');
    const previous = pagination?.querySelector('.btn-prev');
    const next = pagination?.querySelector('.btn-next');
    const page = pagination ? text(pagination, '.el-pager .is-active') : '';
    const total = pagination ? text(pagination, '.el-pagination__total') : '';
    const state = JSON.stringify([tabState, headings, rows.map((row) => row.map((cell) =>
      [cell.text, cell.actions.map((action) => action.disabled)])), page, total, previous?.disabled, next?.disabled]);
    if (state === view.signature) return;
    view.signature = state;
    view.filters.replaceChildren(...tabState.map(([label, selected], index) => {
      const control = button(label, () => source.querySelectorAll('.el-tabs__item[role="tab"]')[index]?.click());
      control.setAttribute('aria-pressed', selected);
      return control;
    }));
    const table = element('table');
    const header = element('thead');
    const headerRow = element('tr');
    headerRow.append(...headings.map(({ label }) => element('th', label)));
    header.append(headerRow);
    const body = element('tbody');
    if (!rows.length) {
      const row = element('tr');
      const empty = element('td', '暂无预约记录');
      empty.colSpan = Math.max(1, headings.length);
      row.append(empty);
      body.append(row);
    } else {
      rows.forEach((row, rowIndex) => {
        const tr = element('tr');
        row.forEach((cell, colIndex) => {
          const label = headings[colIndex].label;
          const td = element(colIndex === 0 ? 'th' : 'td');
          if (colIndex === 0) td.scope = 'row';
          if (/状态/.test(label)) td.dataset.status = /取消|拒绝|未通过/.test(cell.text) ? 'inactive' : 'current';
          if (cell.actions.length) {
            cell.actions.forEach((action, actionIndex) => {
              const control = button(action.textContent.trim(), () => {
                readReservationTable(source).rows[rowIndex]?.[colIndex]?.actions[actionIndex]?.click();
              });
              control.disabled = Boolean(action.disabled);
              td.append(control);
            });
          } else {
            td.textContent = cell.text;
          }
          tr.append(td);
        });
        body.append(tr);
      });
    }
    table.append(header, body);
    view.area.replaceChildren(table);
    if (pagination) {
      const pager = element('div');
      pager.className = 'sms-pagination';
      const prevButton = button('上一页', () => source.querySelector('.el-pagination .btn-prev')?.click());
      const nextButton = button('下一页', () => source.querySelector('.el-pagination .btn-next')?.click());
      prevButton.disabled = !previous || previous.disabled;
      nextButton.disabled = !next || next.disabled;
      pager.append(prevButton);
      if (page) pager.append(element('span', '第 ' + page + ' 页'));
      pager.append(nextButton);
      if (total) pager.append(element('span', total));
      view.area.append(pager);
    }
  }

  function refreshOverview(app) {
    if (!container.isConnected) app.before(container);
    root.dataset.smsClassicView = 'records';
    const source = app.querySelector('.reservation-overview');
    exposeReservationSource(app, source);
    if (!overviewView || !overviewView.panel.isConnected) {
      const panel = element('section');
      panel.className = 'sms-records-panel';
      const heading = element('div');
      heading.className = 'sms-records-heading';
      heading.append(element('h2', '预约总览'));
      const controls = element('div');
      controls.className = 'sms-records-controls';
      const week = element('div');
      week.className = 'sms-records-filters';
      const room = element('input');
      room.type = 'search';
      room.placeholder = '搜索房间或楼宇';
      room.setAttribute('aria-label', '搜索房间或楼宇');
      const date = element('input');
      date.type = 'date';
      date.value = today();
      date.setAttribute('aria-label', '日期');
      const area = element('div');
      area.className = 'sms-records-table';
      controls.append(week, field('日期', date), room);
      panel.append(heading, controls, area);
      main.replaceChildren(reservationLayout(panel));
      overviewView = { panel, week, room, date, area, signature: '' };
      room.addEventListener('input', scheduleRefresh);
      date.addEventListener('change', scheduleRefresh);
    }
    const view = overviewView;
    if (!source) {
      if (view.signature !== 'loading') {
        view.area.replaceChildren(element('p', '正在加载预约总览…'));
        view.signature = 'loading';
      }
      return;
    }
    const rooms = new Map([...source.querySelectorAll('.room-cell')].flatMap((cell) => {
      const name = text(cell, '.room-name');
      const metadata = [...cell.querySelectorAll('.room-meta')].map((item) => item.textContent.trim());
      const number = metadata.length > 1 ? metadata[0] : '';
      const building = metadata.at(-1)?.split(' · ').at(-1) ?? '';
      const label = number && !name.includes(number) ? number + ' ' + name : name;
      return name ? [[cell.style.gridRowStart || name, { name: label, building, dates: new Map() }]] : [];
    }));
    const records = [...source.querySelectorAll('.booking-cell button[aria-label]')].flatMap((node, index) => {
      const label = node.getAttribute('aria-label');
      const match = label?.match(/^(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(.+?)，([^，]+)，(\d+条预约)$/);
      if (!match) return [];
      const [, name, date, time, , count] = match;
      const key = node.closest('.booking-cell')?.style.gridRowStart || name;
      if (!rooms.has(key)) rooms.set(key, { name, building: '', dates: new Map() });
      const room = rooms.get(key);
      if (!room.dates.has(date)) room.dates.set(date, []);
      const slot = { time, count, node, id: label + ':' + index };
      room.dates.get(date).push(slot);
      return [{ date, slot }];
    });
    const weekLabel = text(source, '.range-label');
    const pickedDate = view.date.value;
    const validDates = [];
    const [start, end] = weekLabel.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    if (start && end) {
      const date = new Date(start + 'T00:00:00Z');
      for (let index = 0; index < 7 && date.toISOString().slice(0, 10) <= end; index += 1) {
        validDates.push(date.toISOString().slice(0, 10));
        date.setUTCDate(date.getUTCDate() + 1);
      }
    } else {
      validDates.push(...[...new Set(records.map(({ date }) => date))].sort());
    }
    const selectedDate = validDates.includes(pickedDate) ? pickedDate : validDates[0] || pickedDate || today();
    if (validDates.length) {
      view.date.min = validDates[0];
      view.date.max = validDates.at(-1);
      view.date.value = selectedDate;
    }
    const keyword = view.room.value.trim().toLowerCase();
    const groups = records.filter(({ date }) => date === selectedDate).map(({ slot }) => slot);
    const detailKey = JSON.stringify([selectedDate, groups.map(({ id }) => id)]);
    if (view.detailKey !== detailKey) {
      view.detailKey = detailKey;
      view.details = new Map();
      view.detailsLoaded = groups.length === 0;
      if (groups.length) readOverviewDetails(view, detailKey, groups);
    }
    const state = JSON.stringify([weekLabel, detailKey, keyword, view.detailsLoaded, [...rooms.values()]
      .map(({ name, building }) => [name, building])]);
    if (state === view.signature) return;
    view.signature = state;
    const nativeWeekButton = (label) => [...source.querySelectorAll('.date-nav button')]
      .find((control) => control.textContent.trim() === label);
    const weekButton = (label) => {
      const control = button(label, () => nativeWeekButton(label)?.click());
      control.disabled = !nativeWeekButton(label);
      return control;
    };
    view.week.replaceChildren(weekButton('上一周'), weekButton('今天'), weekButton('下一周'));
    const minute = (hour, minutes) => Number(hour) * 60 + Number(minutes);
    const ranges = (value) => [...value.matchAll(/(\d{1,2}):(\d{2})\s*[-–—~至]\s*(\d{1,2}):(\d{2})/g)]
      .map((match) => [minute(match[1], match[2]), minute(match[3], match[4])]);
    const bounds = groups.flatMap(({ time }) => ranges(time));
    const firstHour = Math.min(8, ...bounds.map(([start]) => Math.floor(start / 60)));
    const lastHour = Math.max(22, ...bounds.map(([, end]) => Math.ceil(end / 60)));
    const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
    const table = element('table');
    table.className = 'sms-overview-grid';
    table.style.minWidth = (126 + hours.length * 66) + 'px';
    const header = element('thead');
    const headerRow = element('tr');
    const roomHeading = element('th', '房间');
    roomHeading.rowSpan = 2;
    headerRow.append(roomHeading);
    const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' });
    const dateHeading = element('th', selectedDate + ' ' + weekday.format(new Date(selectedDate + 'T00:00:00Z')));
    dateHeading.colSpan = hours.length;
    headerRow.append(dateHeading);
    const times = element('tr');
    for (const hour of hours) {
      const th = element('th', String(hour).padStart(2, '0') + ':00');
      th.scope = 'col';
      times.append(th);
    }
    header.append(headerRow, times);
    const body = element('tbody');
    const visible = [...rooms.values()].filter(({ name, building }) => (name + ' ' + building).toLowerCase().includes(keyword));
    for (const room of visible) {
      const row = element('tr');
      const roomCell = element('th', room.name);
      roomCell.scope = 'row';
      if (room.building) roomCell.title = room.building;
      row.append(roomCell);
      const bookings = (room.dates.get(selectedDate) ?? []).flatMap((slot) => {
        const details = view.details.get(slot.id);
        const entries = details?.length ? details : [{ time: slot.time, reason: slot.count }];
        return entries.flatMap((detail) => {
          const times = ranges(detail.time);
          return (times.length ? times : ranges(slot.time)).map(([start, end]) => ({ ...detail, start, end }));
        });
      }).sort((a, b) => a.start - b.start);
      const displayed = [];
      for (const booking of bookings) {
        const previous = displayed.at(-1);
        if (!previous || booking.start >= previous.end) displayed.push(booking);
      }
      for (const hour of hours) {
        const cell = element('td');
        const start = hour * 60;
        const end = start + 60;
        const occupied = bookings.filter((booking) => booking.start < end && booking.end > start);
        if (occupied.length) {
          cell.className = 'sms-overview-occupied';
          for (const detail of displayed.filter((booking) => booking.start >= start && booking.start < end)) {
            const line = element('div');
            line.title = [detail.time, detail.status].filter(Boolean).join(' · ');
            if (detail.person) line.append(element('span', detail.person));
            if (detail.reason) {
              const reason = element('span', detail.person ? '（' + detail.reason + '）' : detail.reason);
              reason.className = 'sms-overview-reason';
              line.append(reason);
            }
            cell.append(line);
          }
          if (!cell.childElementCount) cell.setAttribute('aria-label', '预约时段继续');
        } else cell.setAttribute('aria-label', '无预约记录');
        row.append(cell);
      }
      body.append(row);
    }
    if (!visible.length) {
      const row = element('tr');
      const cell = element('td', weekLabel ? '没有符合条件的房间' : '正在加载排期…');
      cell.colSpan = hours.length + 1;
      row.append(cell);
      body.append(row);
    }
    table.append(header, body);
    view.area.replaceChildren(table);
  }

  async function readOverviewDetails(view, key, groups) {
    for (const { node, id } of groups) {
      if (view.detailKey !== key || location.pathname !== overviewPath) return;
      if (!node.isConnected) continue;
      node.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (view.detailKey !== key || location.pathname !== overviewPath) return;
      const details = [...document.querySelectorAll('.booking-popover button > span')].flatMap((line) => {
        const [time, ...parts] = line.textContent.trim().split(' · ');
        if (parts.length < 4) return [];
        parts.shift();
        const status = parts.pop();
        const person = parts.pop();
        const reason = parts.join(' · ');
        return [{
          time, status,
          person: person === '申请人未填写' ? '' : person,
          reason: reason === '预约' ? '' : reason,
        }];
      }).filter(({ person, reason }) => person || reason);
      if (details.length) view.details.set(id, details);
    }
    if (view.detailKey !== key || location.pathname !== overviewPath) return;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    view.detailsLoaded = true;
    scheduleRefresh();
  }

  function renderBooking(data, choice, names, official, draft) {
    const sidebar = reservationSidebar();
    sidebar.append(element('h2', '选择房间和日期'));
    const selection = {
      room: names.includes(draft?.room) ? draft.room : choice.room,
      date: draft?.date || choice.date,
    };
    const picker = roomPicker(names, selection, (next) => {
      const roomId = bookingRoomIds.get(next.room);
      if (next.room === choice.room || roomId) {
        setRoomChoice(next, '');
        location.assign(bookingUrl(next.date, next.room === choice.room ? undefined : roomId));
      } else {
        setRoomChoice(next, 'room');
        location.assign(roomsPath);
      }
    });
    sidebar.append(picker);
    const shortcuts = element('div');
    shortcuts.className = 'sms-room-shortcuts';
    if (names.length < 2) shortcuts.append(link('房间列表', roomsPath));
    if (shortcuts.childElementCount) sidebar.append(shortcuts);
    const schedule = element('section');
    schedule.className = 'sms-booking-schedule';
    const roomTitle = data.roomNumber || data.room || choice.room;
    schedule.append(element('h2', '预订讨论室' + (roomTitle ? ' - ' + roomTitle : '')));
    const switchRoom = button('选择其他时间或教室', () => picker.querySelector('select').focus());
    switchRoom.className = 'sms-switch-room';
    schedule.append(switchRoom);
    if (!data.slots.length) {
      schedule.append(element('p', data.ready ? '所选日期没有可预约的时段。' : '正在加载时段…'));
    } else {
      const table = element('table');
      const heading = element('thead');
      const columns = element('tr');
      const [, month, day] = choice.date.split('-');
      const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(new Date(choice.date + 'T12:00:00'));
      const dayLabel = month + '月' + day + '日 ' + weekday;
      const timeHeading = element('th', '时段');
      timeHeading.className = 'sms-time-heading';
      columns.append(timeHeading, element('th', dayLabel));
      heading.append(columns);
      const body = element('tbody');
      for (const slot of data.slots) {
        const row = element('tr');
        const time = element('th', slot.time);
        time.scope = 'row';
        const status = element('td');
        if (slot.input && !slot.input.disabled) {
          const control = element('input');
          control.type = 'checkbox';
          control.checked = slot.input.checked;
          control.setAttribute('aria-label', slot.time + ' 预订');
          control.addEventListener('change', () => {
            if (slot.input.isConnected) slot.input.click();
            control.checked = slot.input.checked;
            scheduleRefresh();
          });
          status.append(field('预订', control));
        } else if (slot.reserved) {
          status.className = slot.own ? 'sms-booked-own' : 'sms-booked-other';
          const label = slot.own ? '我的预约' : '已预约';
          status.setAttribute('aria-label', label);
          const occupant = element('div', slot.occupant || label);
          if (slot.own) {
            const marker = element('input');
            marker.type = 'checkbox';
            marker.checked = true;
            marker.disabled = true;
            marker.setAttribute('aria-hidden', 'true');
            occupant.prepend(marker);
          }
          status.append(occupant);
          if (slot.theme && slot.theme !== slot.occupant) {
            const theme = element('div', '（' + slot.theme.replace(/^[（(]|[）)]$/g, '') + '）');
            theme.className = 'sms-reservation-theme';
            status.append(theme);
          }
        } else {
          status.textContent = slot.state || '暂不可选';
        }
        row.append(time, status);
        body.append(row);
      }
      table.append(heading, body);
      schedule.append(table);
    }
    if (official) schedule.append(bookingFooter(official));
    return reservationLayout(schedule, sidebar);
  }

  function refreshBooking(app, path) {
    if (path === roomsPath) {
      const rooms = roomControls(app);
      if (rooms.size) sessionStorage.setItem(roomNamesKey, JSON.stringify([...rooms.keys()]));
      const choice = storedRoomChoice();
      if (choice?.next === 'room' && rooms.has(choice.room)) {
        setRoomChoice(choice, 'booking');
        rooms.get(choice.room).click();
      }
      const next = JSON.stringify([...rooms.keys()]);
      root.dataset.smsClassicView = 'classic';
      if (next !== signature) {
        signature = next;
        main.replaceChildren(renderRoomPicker(rooms));
      }
      return;
    }
    const url = new URL(location.href);
    const stored = storedRoomChoice();
    if (stored?.next === 'booking') {
      setRoomChoice(stored, '');
      if (url.searchParams.get('clickedDate') !== stored.date) {
        location.replace(bookingUrl(stored.date));
        return;
      }
    }
    const requested = url.searchParams.get('clickedDate');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? '') ? requested : today();
    const data = readBooking(app, date);
    if (data.room) loadBookingRoomIds();
    const currentId = url.searchParams.get('roomId');
    const currentRoom = [...bookingRoomIds].find(([, id]) => id === currentId)?.[0];
    const choice = { room: currentRoom || roomLabel(data.roomNumber, data.room) || stored?.room || '', date };
    const names = bookingRoomIds.size ? [...bookingRoomIds.keys()] : JSON.parse(sessionStorage.getItem(roomNamesKey) || '[]');
    if (choice.room && !names.includes(choice.room)) names.unshift(choice.room);
    const canBook = data.slots.some(({ input }) => input && !input.disabled);
    if (!canBook || !data.form) app.classList.remove('sms-native-booking-path');
    const official = canBook ? exposeBookingForm(app, data.form) : null;
    data.form?.classList.toggle('sms-has-booking-footer', Boolean(official));
    root.dataset.smsClassicView = 'booking';
    const next = JSON.stringify([
      choice, names, data.room, data.roomNumber, data.ready,
      official && [official.names, official.submit.disabled],
      data.slots.map((slot) => [slot.time, slot.input?.checked, slot.input?.disabled, slot.state, slot.own]),
    ]);
    if (next !== signature) {
      const previous = signature && main.querySelector('.sms-reservation-sidebar .sms-room-picker');
      const draft = previous ? {
        room: previous.querySelector('select').value,
        date: previous.querySelector('input[type="date"]').value,
      } : null;
      signature = next;
      main.replaceChildren(renderBooking(data, choice, names, official, draft));
    }
  }

  function refresh() {
    frame = 0;
    const path = location.pathname;
    if (location.hash === classicHash) {
      sessionStorage.removeItem(originalKey);
      history.replaceState(history.state, '', location.pathname + location.search);
    }
    const viewUrl = path + location.search;
    if (viewUrl !== lastUrl) {
      lastUrl = viewUrl;
      article = null;
      listedTitles = new Set();
      signature = '';
      window.scrollTo(0, 0);
    }
    const app = document.getElementById('app');
    const pendingLogout = Number(sessionStorage.getItem(logoutKey));
    if (pendingLogout) {
      if (Date.now() - pendingLogout > 15000 || path !== homePath) sessionStorage.removeItem(logoutKey);
      else {
        const action = originalLogout(app);
        if (action) {
          sessionStorage.removeItem(logoutKey);
          action.click();
          return;
        }
      }
    }
    const original = Boolean(sessionStorage.getItem(originalKey));
    if (original) {
      if (!returnBookmark.isConnected) document.body.append(returnBookmark);
    } else returnBookmark.remove();
    if (!app || original || ![homePath, listingPath, roomsPath, bookingPath, recordsPath, overviewPath].includes(path)) {
      container.remove();
      delete root.dataset.smsClassicView;
      signature = '';
      return;
    }
    if (path === recordsPath) {
      refreshReservations(app, path, { title: '我的预约', selector: '.my-booking' });
      return;
    }
    if (path === overviewPath) {
      refreshOverview(app);
      return;
    }
    if ([roomsPath, bookingPath].includes(path)) {
      if (!container.isConnected) app.before(container);
      refreshBooking(app, path);
      return;
    }
    loadArchive();
    if (path === homePath) {
      panels = sourcePanels(app);
      if (!panels.has('学院通知') || !panels.has('教务信息') || !panels.has('学生园地')) {
        if (!container.isConnected) app.before(container);
        root.dataset.smsClassicView = 'classic';
        if (signature !== 'loading-dashboard') {
          signature = 'loading-dashboard';
          main.replaceChildren(element('p', '正在加载通知…'));
        }
        return;
      }
    } else {
      listing = sourceListing(app);
      for (const { title } of [...(panels.get(listingGroup())?.rows ?? []), ...(listing?.rows ?? [])]) {
        listedTitles.add(noticeTitleKey(title));
      }
      findQueuedNotice();
    }
    if (!container.isConnected) app.before(container);
    root.dataset.smsClassicView = 'classic';
    const data = path === homePath
      ? [...panels].map(([label, { more, rows }]) => [label, !!more, rows.map(({ title, date }) => [title, date])])
      : listing && [listing.label, listing.total, listing.current, listing.empty,
        listing.rows.map(({ title, date }) => [title, date])];
    const next = article ? JSON.stringify([article.title, article.loading]) : JSON.stringify([path, data, archiveStatus]);
    if (signature === next) return;
    signature = next;
    homeSize.disconnect();
    main.replaceChildren(article ? renderArticle() : path === homePath ? renderHome() : renderListing());
    const grid = main.querySelector('.sms-home-grid');
    if (grid) {
      fitHome(grid);
      homeSize.observe(grid);
    }
  }

  function scheduleRefresh() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }

  new MutationObserver(scheduleRefresh).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ['disabled'],
  });
  window.addEventListener('popstate', scheduleRefresh);
  window.addEventListener('hashchange', scheduleRefresh);
  refresh();
})();
