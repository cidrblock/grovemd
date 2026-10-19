import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Grove Notes', version: '1.0.0' });
const title = document.getElementById('title');
const context = document.getElementById('context');
const back = document.getElementById('back');
const resultsElement = document.getElementById('results');
const noteElement = document.getElementById('note');
let state = { query: '', results: [] };
let busy = false;

function isCogsworthHost() {
  return app.getHostVersion()?.name?.toLowerCase() === 'cogsworth';
}

function showError(message) {
  const error = document.createElement('p');
  error.className = 'empty error';
  error.textContent = message;
  resultsElement.hidden = false;
  resultsElement.style.display = '';
  noteElement.hidden = true;
  noteElement.style.display = 'none';
  resultsElement.replaceChildren(error);
}

async function callTool(name, arguments_) {
  const result = await app.callServerTool({ name, arguments: arguments_ });
  if (result.isError) {
    const text = result.content?.find((item) => item.type === 'text')?.text;
    throw new Error(text || 'The Grove request failed.');
  }
  return result.structuredContent ?? {};
}

async function selectDocument(result, index) {
  if (busy) return;
  busy = true;
  for (const button of resultsElement.querySelectorAll('button')) button.disabled = true;
  try {
    if (isCogsworthHost()) {
      await app.sendMessage({ role: 'user', content: [{ type: 'text', text: String(index) }] });
      return;
    }
    render(await callTool('grove_read', { path: result.path, query: state.query }));
  } catch (error) {
    showError(error.message || 'The note could not be opened.');
  } finally {
    busy = false;
  }
}

async function returnToResults() {
  if (busy || !state.query) return;
  busy = true;
  back.disabled = true;
  try {
    if (isCogsworthHost()) {
      await app.sendMessage({ role: 'user', content: [{ type: 'text', text: `grove ${state.query}` }] });
      return;
    }
    render(await callTool('grove_search', { query: state.query, limit: 10 }));
  } catch (error) {
    showError(error.message || 'The search could not be restored.');
  } finally {
    busy = false;
    back.disabled = false;
  }
}

function renderResults(data) {
  state = {
    query: String(data.query || ''),
    results: Array.isArray(data.results) ? data.results : Array.isArray(data.notes) ? data.notes : [],
  };
  title.textContent = state.query ? `Grove · ${state.query}` : 'Grove notes';
  context.textContent = state.results.length
    ? `${state.results.length} ${state.results.length === 1 ? 'document' : 'documents'}`
    : (data.prefix || 'Grove');
  back.hidden = true;
  noteElement.hidden = true;
  noteElement.style.display = 'none';
  resultsElement.hidden = false;
  resultsElement.style.display = '';
  resultsElement.replaceChildren();

  if (!data.ok || !state.results.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = data.canned_text || 'No Grove notes matched this search.';
    resultsElement.append(empty);
    return;
  }

  if (state.query && state.results.length === 1) {
    void selectDocument(state.results[0], 1);
    return;
  }

  for (const [index, result] of state.results.entries()) {
    const button = document.createElement('button');
    const name = document.createElement('span');
    const path = document.createElement('span');
    button.type = 'button';
    button.className = 'result';
    name.className = 'result-title';
    path.className = 'path';
    name.textContent = result.title || result.name || result.path || 'Grove note';
    path.textContent = `${result.path || ''}${result.line ? ` · line ${result.line}` : ''}`;
    button.append(name, path);
    if (result.preview) {
      const preview = document.createElement('span');
      preview.className = 'preview';
      preview.textContent = result.preview;
      button.append(preview);
    }
    button.addEventListener('click', () => void selectDocument(result, index + 1));
    resultsElement.append(button);
  }
}

function renderNote(data) {
  const note = data.note || data;
  state.query = String(data.query || '');
  title.textContent = note.title || 'Grove note';
  context.textContent = note.path || '';
  back.hidden = !state.query;
  resultsElement.hidden = true;
  resultsElement.style.display = 'none';
  noteElement.hidden = false;
  noteElement.style.display = '';
  noteElement.innerHTML = String(note.content_html || '');
  if (note.truncated) {
    const notice = document.createElement('p');
    notice.className = 'truncated';
    notice.textContent = 'This note was shortened for display.';
    noteElement.append(notice);
  }
}

function render(data) {
  if (!data || typeof data !== 'object') return;
  if (data.error && !data.note && data.content === undefined) {
    showError(data.canned_text || data.message || 'The Grove request failed.');
  } else if (data.note || data.content !== undefined) {
    renderNote(data);
  } else {
    renderResults(data);
  }
}

back.addEventListener('click', () => void returnToResults());
app.ontoolresult = (result) => render(result?.structuredContent ?? {});
app.onhostcontextchanged = (hostContext) => {
  if (hostContext.theme) applyDocumentTheme(hostContext.theme);
  if (hostContext.styles?.variables) applyHostStyleVariables(hostContext.styles.variables);
};
app.connect().catch(() => showError('The Grove view could not connect to its MCP host.'));