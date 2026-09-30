'use strict';
// Standalone, synthetic design prototype. All writes use this single local key.
const STORAGE_KEY = 'small-words:interactive-paper:20260930:v1';
const MAX_LOCAL_MESSAGES = 80;
const MAX_TEXT = 4000;
const icons = { bookmark: 'i-bookmark', link: 'i-link', image: 'i-image', check: 'i-check' };
const chats = [
  { id: 'friday', name: 'Friday dinner', initials: 'FD', subtitle: '6 members', group: true, members: ['You', 'Ana', 'Tomás', 'Rui', 'Inês', 'Sofia'], preview: "Me: 8 works. I’ll bring wine.", time: '9:43', messages: [
    { id: 'f1', sender: 'Tomás', text: 'Who’s in for Friday?', time: '9:20' },
    { id: 'f2', sender: 'You', text: 'Me! Near the river?', time: '9:24', mine: true },
    { id: 'f3', sender: 'Rui', text: 'I can get there by eight.', time: '9:31' },
    { id: 'f4', sender: 'Ana', text: 'Taberna da Rua has space.', time: '9:41' },
    { id: 'f5', sender: 'Ana', text: 'Table for six at 8?', time: '9:41' },
    { id: 'f6', sender: 'You', text: '8 works. I’ll bring wine.', time: '9:43', mine: true, delivered: true }
  ], links: [{ title: 'A table near the river', domain: 'Dinner notes', description: 'Friday · 8 pm · a table for six', message: 'f5' }], media: { title: 'Friday’s little plan', kicker: 'A night together', main: 'Dinner,\nby the river.', detail: 'Friday · eight o’clock', sender: 'Ana', time: '9:39' } },
  { id: 'ana', name: 'Ana', initials: 'A', subtitle: 'Ana', group: false, members: ['You', 'Ana'], preview: 'Table for six at 8?', time: '9:41', messages: [
    { id: 'a1', sender: 'Ana', text: 'Found a lovely little place for Friday.', time: '9:32' },
    { id: 'a2', sender: 'You', text: 'The one you told me about?', time: '9:34', mine: true },
    { id: 'a3', sender: 'Ana', text: 'Yes! Blue door, very good bread.', time: '9:35' },
    { id: 'a4', sender: 'Ana', text: 'I’ll ask for the table by the window.', time: '9:36' },
    { id: 'a5', sender: 'You', text: 'That sounds perfect.', time: '9:38', mine: true, delivered: true },
    { id: 'a6', sender: 'Ana', text: 'Table for six at 8?', time: '9:41' }
  ], links: [], media: null },
  { id: 'weekend', name: 'Weekend plans', initials: 'WP', subtitle: '4 members', group: true, members: ['You', 'Rui', 'Inês', 'Sofia'], preview: 'Rui: Sounds good!', time: 'Thu', unread: true, messages: [
    { id: 'w1', sender: 'Inês', text: 'A long walk on Saturday?', time: '18:10' },
    { id: 'w2', sender: 'Sofia', text: 'Coast path, then coffee.', time: '18:12' },
    { id: 'w3', sender: 'You', text: 'Yes please. Shall we meet at ten?', time: '18:14', mine: true },
    { id: 'w4', sender: 'Inês', text: 'Ten at the little station. Bring a layer!', time: '18:16' },
    { id: 'w5', sender: 'You', text: 'I’ll pack something for a picnic.', time: '18:18', mine: true, delivered: true },
    { id: 'w6', sender: 'Rui', text: 'Sounds good!', time: '18:21' }
  ], links: [{ title: 'Saturday’s meeting point', domain: 'Walk notes', description: 'The little station · 10 am', message: 'w4' }], media: { title: 'A Saturday outside', kicker: 'Take the slow way', main: 'Sea air.\nGood company.', detail: 'Saturday · ten o’clock', sender: 'Sofia', time: '18:09' } },
  { id: 'rui', name: 'Rui', initials: 'R', subtitle: 'Rui', group: false, members: ['You', 'Rui'], preview: 'I can get there by eight.', time: 'Thu', messages: [
    { id: 'r1', sender: 'Rui', text: 'Still up for dinner tomorrow?', time: '17:42' },
    { id: 'r2', sender: 'You', text: 'Absolutely. Ana’s finding us a table.', time: '17:45', mine: true },
    { id: 'r3', sender: 'Rui', text: 'Lovely. I’m finishing a little later.', time: '17:46' },
    { id: 'r4', sender: 'You', text: 'No rush. We’ll save you a seat.', time: '17:48', mine: true, delivered: true },
    { id: 'r5', sender: 'Rui', text: 'I can get there by eight.', time: '17:50' }
  ], links: [], media: null }
];
const $ = (id) => document.getElementById(id);
const app = $('app');
const dialog = $('dialog');
const input = $('message-input');
const smallScreen = window.matchMedia('(max-width: 980px)');
const mobileScreen = window.matchMedia('(max-width: 640px)');
let storageAvailable = true;
let statusTimer;
let dialogTrigger;
let memoryTab = 'saved';
let currentId = 'friday';
let selectedMessageId = null;
let focusedMessageId = null;
let state = loadState();

function defaultState() {
  return { theme: 'light', texture: 'richer', drafts: {}, replies: {}, messages: {}, saved: ['f4', 'f5', 'w4'], read: [] };
}
function loadState() {
  const fallback = defaultState();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    fallback.theme = raw.theme === 'dark' ? 'dark' : 'light';
    fallback.texture = raw.texture === 'original' ? 'original' : 'richer';
    for (const chat of chats) {
      const reply = cleanQuote(raw.replies?.[chat.id]);
      if (reply) fallback.replies[chat.id] = reply;
      if (typeof raw.drafts?.[chat.id] === 'string') fallback.drafts[chat.id] = raw.drafts[chat.id].slice(0, MAX_TEXT);
      if (Array.isArray(raw.messages?.[chat.id])) {
        fallback.messages[chat.id] = raw.messages[chat.id].filter(m => m && typeof m.id === 'string' && m.id.startsWith('local-') && typeof m.text === 'string' && m.text.trim() && typeof m.time === 'string').slice(-MAX_LOCAL_MESSAGES).map(m => ({ id: m.id.slice(0,100), sender: 'You', text: m.text.slice(0,MAX_TEXT), time: m.time.slice(0,10), mine: true, local: true, attachment: m.attachment === true, quote: cleanQuote(m.quote) }));
      }
    }
    const knownIds = new Set(chats.flatMap(c => [...c.messages, ...(fallback.messages[c.id] || [])].map(m => m.id)));
    if (Array.isArray(raw.saved)) fallback.saved = [...new Set(raw.saved.filter(id => knownIds.has(id)))];
    if (Array.isArray(raw.read)) fallback.read = raw.read.filter(id => chats.some(c => c.id === id));
  } catch (_) { storageAvailable = false; }
  return fallback;
}
function cleanQuote(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.sender !== 'string' || typeof value.text !== 'string' || !value.text.trim()) return null;
  return { id: value.id.slice(0,100), sender: value.sender.slice(0,80), text: value.text.slice(0,MAX_TEXT) };
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (_) {
    if (storageAvailable) announce('Storage is unavailable. Your changes will last for this visit.');
    storageAvailable = false;
  }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + (icons[name] || name));
  svg.append(use);
  return svg;
}
function currentChat() { return chats.find(c => c.id === currentId); }
function allMessages(chat = currentChat()) { return [...chat.messages, ...(state.messages[chat.id] || [])]; }
function announce(text) {
  clearTimeout(statusTimer);
  $('status').textContent = text;
  $('status').classList.add('visible');
  statusTimer = setTimeout(() => $('status').classList.remove('visible'), 3800);
}
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
}
function applyTexture(texture) {
  state.texture = texture === 'original' ? 'original' : 'richer';
  document.documentElement.dataset.texture = state.texture;
  document.querySelectorAll('[data-texture-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.textureChoice === state.texture)));
}
function renderChatList() {
  const query = $('chat-search').value.trim().toLocaleLowerCase();
  const list = $('chat-list');
  list.replaceChildren();
  for (const chat of chats) {
    const messages = allMessages(chat);
    if (query && ![chat.name, ...messages.map(m => m.text)].join(' ').toLocaleLowerCase().includes(query)) continue;
    const local = state.messages[chat.id]?.at(-1);
    const button = el('button', 'chat-row');
    button.type = 'button';
    button.setAttribute('aria-current', String(currentId === chat.id));
    button.dataset.chat = chat.id;
    const avatar = el('span', 'avatar ' + chat.id, chat.initials);
    avatar.setAttribute('aria-hidden', 'true');
    const details = el('span', 'chat-details');
    const line = el('span', 'chat-line');
    line.append(el('span', 'chat-name', chat.name), el('span', 'chat-time', local?.time || chat.time));
    const preview = el('span', 'chat-preview');
    const draft = state.drafts[chat.id];
    preview.append(el('span', 'preview-text', draft?.trim() ? 'Draft: ' + draft.trim() : local ? 'Me: ' + local.text : chat.preview));
    if (chat.unread && !state.read.includes(chat.id)) {
      const dot = el('span', 'unread-dot');
      dot.setAttribute('aria-label', 'Unread');
      preview.append(dot);
    }
    details.append(line,preview);
    button.append(avatar,details);
    button.addEventListener('click', () => selectChat(chat.id));
    list.append(button);
  }
  $('search-empty').hidden = list.childElementCount > 0;
}
function selectChat(id) {
  clearMessageSelection();
  focusedMessageId = null;
  currentId = id;
  if (!state.read.includes(id)) { state.read.push(id); persist(); }
  app.classList.add('chat-open');
  renderChatList();
  renderConversation();
  renderMemory();
  if (mobileScreen.matches) $('back-button').focus();
}
function renderConversation() {
  const chat = currentChat();
  $('conversation-title').textContent = chat.name;
  $('conversation-subtitle').textContent = chat.subtitle;
  $('header-avatar').className = 'avatar header-avatar ' + chat.id;
  $('header-avatar').textContent = chat.initials;
  $('call-button').setAttribute('aria-label', 'Call ' + chat.name);
  input.value = state.drafts[chat.id] || '';
  updateComposer();
  renderReplyDraft();
  renderMessages(true);
}
function renderMessages(scrollToEnd = false) {
  const container = $('messages');
  const oldTop = container.scrollTop;
  container.replaceChildren(el('div','day-label', ['friday','ana'].includes(currentId) ? 'Today' : 'Thursday'));
  const messages = allMessages();
  if (!messages.some(message => message.id === focusedMessageId)) focusedMessageId = messages[0]?.id || null;
  let previous;
  for (const message of messages) {
    const continuation = previous && previous.sender === message.sender;
    const row = el('article','message-row' + (message.mine ? ' mine' : '') + (continuation ? ' continuation' : ''));
    row.id = 'message-' + message.id;
    row.dataset.message = message.id;
    row.tabIndex = message.id === focusedMessageId ? 0 : -1;
    row.setAttribute('aria-label','Message from ' + message.sender + ' at ' + message.time);
    row.addEventListener('focus', () => setRovingMessage(message.id));
    row.addEventListener('keydown',event => {
      if (event.target !== row) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const index = messages.findIndex(item => item.id === message.id);
        const next = Math.max(0,Math.min(messages.length - 1,index + (event.key === 'ArrowDown' ? 1 : -1)));
        setRovingMessage(messages[next].id,true);
      } else if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        selectMessage(message.id);
      }
    });
    if (currentChat().group && !message.mine && !continuation) row.append(el('div','message-sender',message.sender));
    const wrap = el('div','bubble-wrap');
    const bubble = el('div','bubble');
    bubble.addEventListener('click',event => {
      if (event.detail > 1) return;
      setRovingMessage(message.id);
      selectMessage(message.id);
    });
    if (message.quote) {
      const quote = el('span','quoted-message');
      quote.append(el('span','quote-author',message.quote.sender),el('span','quote-text',message.quote.text));
      bubble.append(quote);
    }
    if (message.attachment) bubble.append(icon('image'));
    bubble.append(el('span','message-text',message.text),el('time','message-time',message.time));
    const action = el('button','message-action');
    const saved = state.saved.includes(message.id);
    action.type = 'button';
    action.setAttribute('aria-label', (saved ? 'Unsave' : 'Save') + ' message: ' + message.text.slice(0,65));
    action.setAttribute('aria-pressed',String(saved));
    action.append(icon('bookmark'));
    action.addEventListener('click', () => toggleSaved(message.id, action));
    wrap.append(bubble,action);
    row.append(wrap);
    if (message.delivered) row.append(el('div','delivery','Delivered'));
    if (message.local) row.append(el('div','delivery','On this device'));
    container.append(row);
    previous = message;
  }
  renderMessageSelection();
  if (scrollToEnd) requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  else container.scrollTop = oldTop;
}
function toggleSaved(id, button) {
  const saved = state.saved.includes(id);
  state.saved = saved ? state.saved.filter(value => value !== id) : [...state.saved,id];
  persist();
  const message = allMessages().find(m => m.id === id);
  const action = button || $('message-' + id)?.querySelector('.message-action');
  action?.setAttribute('aria-pressed',String(!saved));
  action?.setAttribute('aria-label',(saved ? 'Save' : 'Unsave') + ' message: ' + message.text.slice(0,65));
  renderMessageSelection();
  renderMemory();
  announce(saved ? 'Removed from Saved' : 'Saved to Memory');
}
function setRovingMessage(id, focus = false) {
  focusedMessageId = id;
  $('messages').querySelectorAll('.message-row').forEach(row => { row.tabIndex = row.dataset.message === id ? 0 : -1; });
  if (focus) $('message-' + id)?.focus({ preventScroll: true });
  if (focus) $('message-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
function selectedMessage() { return allMessages().find(message => message.id === selectedMessageId); }
function selectMessage(id) {
  selectedMessageId = selectedMessageId === id ? null : id;
  renderMessageSelection();
  const message = selectedMessage();
  $('selection-status').textContent = message ? 'Selected message from ' + message.sender : 'Message selection cleared';
}
function renderMessageSelection() {
  const message = selectedMessage();
  if (!message) selectedMessageId = null;
  $('messages').querySelectorAll('.message-row').forEach(row => {
    const selected = row.dataset.message === selectedMessageId;
    row.classList.toggle('message-selected',selected);
    const content = allMessages().find(item => item.id === row.dataset.message);
    row.setAttribute('aria-label',(selected ? 'Selected message from ' : 'Message from ') + content.sender + ' at ' + content.time);
  });
  $('selection-actions').hidden = !message;
  if (message) $('selection-save').textContent = state.saved.includes(message.id) ? 'Unsave' : 'Save';
}
function clearMessageSelection(restoreFocus = false) {
  const previousId = selectedMessageId;
  selectedMessageId = null;
  renderMessageSelection();
  if (restoreFocus && previousId) setRovingMessage(previousId,true);
  if (previousId) $('selection-status').textContent = 'Message selection cleared';
}
function renderReplyDraft() {
  const quote = state.replies[currentId];
  $('reply-draft').hidden = !quote;
  $('reply-author').textContent = quote ? 'Replying to ' + quote.sender : '';
  $('reply-excerpt').textContent = quote?.text || '';
}
function replyToSelection() {
  const message = selectedMessage();
  if (!message) return;
  state.replies[currentId] = cleanQuote(message);
  persist();
  clearMessageSelection();
  renderReplyDraft();
  input.focus();
}
async function copySelection() {
  const message = selectedMessage();
  if (!message) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(message.text);
    announce('Message copied');
  } catch (_) {
    openDialog('Copy this message','Clipboard access is unavailable. Select and copy the text below.');
    const text = el('textarea','copy-fallback');
    text.readOnly = true;
    text.value = message.text;
    text.setAttribute('aria-label','Message to copy');
    $('dialog-body').append(text);
    text.focus();
    text.select();
  }
}
function updateComposer() {
  input.style.height = 'auto';
  input.style.height = Math.max(24, Math.min(input.scrollHeight,130)) + 'px';
  const hasText = !!input.value.trim();
  $('send-button').hidden = !hasText;
  $('mic-button').hidden = hasText;
}
function addLocalMessage(text, attachment = false, quote = null) {
  clearMessageSelection();
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  const random = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const message = { id: 'local-' + random, sender: 'You', text: text.slice(0,MAX_TEXT), time, mine: true, local: true, attachment, quote: cleanQuote(quote) };
  state.messages[currentId] = [...(state.messages[currentId] || []),message].slice(-MAX_LOCAL_MESSAGES);
  const known = new Set(chats.flatMap(c => allMessages(c).map(m => m.id)));
  state.saved = state.saved.filter(id => known.has(id));
  persist();
  renderMessages(true);
  renderChatList();
  renderMemory();
  announce(attachment ? 'Attachment added on this device' : 'Message added on this device');
}
function sendMessage(event) {
  event?.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const quote = state.replies[currentId] || null;
  delete state.replies[currentId];
  state.drafts[currentId] = '';
  input.value = '';
  updateComposer();
  renderReplyDraft();
  addLocalMessage(text,false,quote);
  input.focus();
}
function renderMemory() {
  const content = $('memory-content');
  content.replaceChildren();
  content.setAttribute('aria-labelledby','tab-' + memoryTab);
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button.dataset.tab === memoryTab;
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (memoryTab === 'saved') {
    const saved = allMessages().filter(m => state.saved.includes(m.id));
    if (!saved.length) return memoryEmpty('bookmark','Keep the good bits.','Save a message with its bookmark. You’ll find it here whenever you need it.');
    for (const message of saved) {
      const item = el('button','saved-item');
      item.type = 'button';
      item.append(el('span','saved-title',message.id === 'f5' ? 'Friday, 8 pm' : message.text),el('span','saved-meta',message.sender + '  ·  ' + (message.local ? 'On this device' : ['friday','ana'].includes(currentId) ? 'Today' : 'Thursday') + ', ' + message.time));
      item.addEventListener('click', () => jumpToMessage(message.id));
      content.append(item);
    }
  } else if (memoryTab === 'links') {
    if (!currentChat().links.length) return memoryEmpty('link','A place for shared links.','Links from this conversation will be gathered here.');
    for (const link of currentChat().links) {
      const item = el('button','link-item');
      item.type = 'button';
      const label = el('span','link-label');
      label.append(icon('link'),document.createTextNode(link.domain));
      item.append(label,el('span','saved-title',link.title),el('span','saved-meta',link.description));
      item.addEventListener('click', () => {
        openDialog(link.title, 'A sample shared note for this conversation.');
        $('dialog-body').append(el('p','',link.description));
        const jump = el('button','dialog-primary','View in conversation');
        jump.type = 'button';
        jump.addEventListener('click', () => { closeDialog(); jumpToMessage(link.message); });
        $('dialog-body').append(jump);
      });
      content.append(item);
    }
  } else {
    const media = currentChat().media;
    const attachments = allMessages().filter(m => m.attachment);
    if (!media && !attachments.length) return memoryEmpty('image','The moments you share.','Photos and attachments in this conversation will appear here.');
    if (media) {
      const card = el('button','media-card');
      card.type = 'button';
      card.append(makeMediaArt(media),el('span','media-caption',media.title),el('span','saved-meta',media.sender + '  ·  ' + media.time));
      card.addEventListener('click', () => {
        openDialog(media.title);
        $('dialog-body').append(makeMediaArt(media),el('p','',media.sender + ' · ' + media.time));
      });
      content.append(card);
    }
    for (const message of attachments) {
      const item = el('button','saved-item');
      item.type = 'button';
      item.append(icon('image'),el('span','saved-title',message.text),el('span','saved-meta','You · On this device'));
      item.addEventListener('click', () => jumpToMessage(message.id));
      content.append(item);
    }
  }
}
function makeMediaArt(media) {
  const art = el('div','media-art');
  const inside = el('div','media-art-inner');
  inside.append(el('small','',media.kicker),document.createTextNode(media.main),el('span','',media.detail));
  inside.style.whiteSpace = 'pre-line';
  art.append(inside);
  return art;
}
function memoryEmpty(iconName,title,text) {
  const empty = el('div','memory-empty');
  empty.append(icon(iconName),el('div','',undefined));
  empty.lastChild.append(el('strong','',title),el('p','',text));
  $('memory-content').append(empty);
}
function jumpToMessage(id) {
  if (smallScreen.matches) setMemory(false);
  const row = $('message-' + id);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'auto' });
  row.classList.add('jump-highlight');
  setRovingMessage(id,true);
  setTimeout(() => row.classList.remove('jump-highlight'),2200);
}
function memoryIsOpen() { return smallScreen.matches ? app.classList.contains('memory-open') : !app.classList.contains('memory-hidden'); }
function setMemory(open, returnFocus = false) {
  app.classList.toggle('memory-open',open && smallScreen.matches);
  app.classList.toggle('memory-hidden',!open && !smallScreen.matches);
  $('memory-scrim').hidden = !(open && smallScreen.matches);
  $('memory-toggle').setAttribute('aria-expanded',String(open));
  if (smallScreen.matches) {
    $('memory-panel').setAttribute('role',open ? 'dialog' : 'complementary');
    if (open) $('memory-panel').setAttribute('aria-modal','true');
    else $('memory-panel').removeAttribute('aria-modal');
    document.querySelector('.conversation').inert = open;
    document.querySelector('.sidebar').inert = open;
    document.querySelector('.prototype-bar').inert = open;
  } else {
    $('memory-panel').removeAttribute('aria-modal');
    $('memory-panel').removeAttribute('role');
    document.querySelector('.conversation').inert = false;
    document.querySelector('.sidebar').inert = false;
    document.querySelector('.prototype-bar').inert = false;
  }
  if (open && smallScreen.matches) $('memory-close').focus();
  if (!open && returnFocus) $('memory-toggle').focus();
}
function openDialog(title,text) {
  dialogTrigger = document.activeElement;
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren();
  if (text) $('dialog-body').append(el('p','',text));
  if (!dialog.open) dialog.showModal();
  $('dialog-close').focus();
}
function closeDialog() { dialog.close(); }
function showInfo() {
  const chat = currentChat();
  openDialog(chat.name,chat.group ? chat.subtitle + ' · a little space to make plans.' : 'A conversation with ' + chat.name + '.');
  const list = el('div','member-list');
  for (const name of chat.members) {
    const member = el('div','member');
    member.append(el('span','avatar',name.slice(0,1)),el('span','',name));
    list.append(member);
  }
  $('dialog-body').append(list);
  const memory = el('button','dialog-option');
  memory.type = 'button';
  memory.append(icon('bookmark'),document.createTextNode('Open Memory'));
  memory.addEventListener('click', () => { closeDialog(); setMemory(true); });
  $('dialog-body').append(memory);
}
function showAttachment() {
  openDialog('Add something','Try a sample attachment. It stays in this preview on your device.');
  const options = [
    { label: 'A little dinner note', text: 'Dinner note · Friday, eight o’clock' },
    { label: 'A weekend plan', text: 'Weekend plan · Saturday, ten o’clock' }
  ];
  for (const option of options) {
    const button = el('button','dialog-option');
    button.type = 'button';
    button.append(icon('image'),document.createTextNode(option.label));
    button.addEventListener('click', () => { closeDialog(); addLocalMessage(option.text,true); });
    $('dialog-body').append(button);
  }
}

document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => { applyTheme(button.dataset.themeChoice); persist(); }));
document.querySelectorAll('[data-texture-choice]').forEach(button => button.addEventListener('click', () => { applyTexture(button.dataset.textureChoice); persist(); }));
$('selection-reply').addEventListener('click',replyToSelection);
$('selection-copy').addEventListener('click',copySelection);
$('selection-save').addEventListener('click', () => { if (selectedMessageId) toggleSaved(selectedMessageId); });
$('selection-close').addEventListener('click', () => clearMessageSelection(true));
$('reply-cancel').addEventListener('click', () => {
  delete state.replies[currentId];
  persist();
  renderReplyDraft();
  input.focus();
});
document.addEventListener('click',event => {
  if (selectedMessageId && !event.target.closest('.bubble, .selection-actions, .message-action, .paper-dialog')) clearMessageSelection();
});
$('chat-search').addEventListener('input',renderChatList);
$('composer').addEventListener('submit',sendMessage);
input.addEventListener('input', () => { state.drafts[currentId] = input.value.slice(0,MAX_TEXT); persist(); updateComposer(); renderChatList(); });
let composing = false;
input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; });
input.addEventListener('keydown',event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) sendMessage(event);
});
$('back-button').addEventListener('click', () => { app.classList.remove('chat-open'); setMemory(false); document.querySelector('[data-chat="' + currentId + '"]')?.focus(); });
$('memory-toggle').addEventListener('click', () => setMemory(!memoryIsOpen()));
$('memory-close').addEventListener('click', () => setMemory(false,true));
$('memory-scrim').addEventListener('click', () => setMemory(false,true));
$('more-button').addEventListener('click',showInfo);
$('attach-button').addEventListener('click',showAttachment);
$('call-button').addEventListener('click', () => openDialog('A voice on the other end','Calls are preview-only here. No call will be placed.'));
$('mic-button').addEventListener('click', () => openDialog('Say it in your own voice','Voice messages are preview-only here. Your microphone won’t be accessed.'));
$('dialog-close').addEventListener('click',closeDialog);
dialog.addEventListener('click',event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
  }
});
dialog.addEventListener('close', () => { if (dialogTrigger?.isConnected && !dialogTrigger.closest('[inert]')) dialogTrigger.focus(); });
document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => { memoryTab = button.dataset.tab; renderMemory(); });
  button.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    memoryTab = tabs[next].dataset.tab;
    renderMemory();
    tabs[next].focus();
  });
});
document.addEventListener('keydown',event => {
  if (dialog.open) return;
  if (event.key === 'Escape' && memoryIsOpen() && smallScreen.matches) { event.preventDefault(); setMemory(false,true); return; }
  if (event.key === 'Escape' && selectedMessageId) { event.preventDefault(); clearMessageSelection(true); }
  if (event.key === 'Tab' && smallScreen.matches && memoryIsOpen()) {
    const focusable = [...$('memory-panel').querySelectorAll('button:not([tabindex="-1"]), [tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
smallScreen.addEventListener('change', () => setMemory(!smallScreen.matches));
applyTheme(state.theme);
applyTexture(state.texture);
renderChatList();
renderConversation();
renderMemory();
setMemory(!smallScreen.matches);
if (!storageAvailable) announce('Storage is unavailable. Your changes will last for this visit.');
