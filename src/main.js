import './styles.css';

const state = {
  models: [],
  selectedModel: null,
  messages: [],
  chats: [],
  currentChatId: null,
  modelMenuOpen: false,
  modelQuery: '',
  reasoning: 'medium',
  maximumMode: false,
  attachments: [],
  busy: false,
};

const preferred = [
  { match: /gpt[- ]?6[- ]?astra/i, preferred: 'openai/gpt-6-astra' },
  { match: /fable[- ]?5\.1|claude.*fable.*5\.1/i },
  { match: /claude.*opus 5/i },
  { match: /gemini.*3\.8/i },
  { match: /gpt[- ]?5\.6/i },
  { match: /deepseek.*v4/i },
];

function esc(s='') {
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function id(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function modelLabel(m) { return m?.name || m?.id || 'Unknown model'; }
function modelMatches(m, q) {
  if (!q) return true;
  return `${m.name||''} ${m.id||''} ${m.provider||''}`.toLowerCase().includes(q.toLowerCase());
}
function pickPreferred(models) {
  for (const p of preferred) {
    const found = models.find(m => p.preferred ? m.id === p.preferred : p.match.test(modelLabel(m)));
    if (found) return found;
  }
  return models.find(m => /gpt-5\.6|claude|gemini|deepseek/i.test(modelLabel(m))) || models[0];
}

async function loadModels() {
  try {
    const models = await puter.ai.listModels();
    state.models = (models || []).filter(m => m && m.id);
    state.selectedModel = pickPreferred(state.models);
  } catch (e) {
    console.error(e);
    toast('Could not load Puter model catalog.');
  }
}

function saveLocal() {
  localStorage.setItem('modelforge_state', JSON.stringify({ chats: state.chats, currentChatId: state.currentChatId }));
}
function loadLocal() {
  try {
    const v = JSON.parse(localStorage.getItem('modelforge_state') || 'null');
    if (v?.chats) state.chats = v.chats;
    if (v?.currentChatId) state.currentChatId = v.currentChatId;
  } catch {}
}
function currentChat() { return state.chats.find(c => c.id === state.currentChatId); }
function ensureChat() {
  if (currentChat()) return currentChat();
  const chat = { id:id('chat'), title:'New chat', messages:[] };
  state.chats.unshift(chat); state.currentChatId = chat.id; state.messages = chat.messages;
  saveLocal(); return chat;
}
function newChat() { state.messages=[]; state.currentChatId=null; state.attachments=[]; render(); }
function useChat(chat) { state.currentChatId=chat.id; state.messages=chat.messages; render(); }

function render() {
  document.querySelector('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="logo">M</div><div>ModelForge</div></div>
        <button class="new-chat" id="newChat">＋ New chat</button>
        <div class="nav">
          <button class="active">Chat</button>
          <button id="compareBtn">Compare models</button>
          <button>Projects <span style="float:right;color:#5e6879">Soon</span></button>
          <button>Files <span style="float:right;color:#5e6879">Soon</span></button>
        </div>
        <div class="chat-list">
          ${state.chats.slice(0,24).map(c=>`<div class="chat-item ${c.id===state.currentChatId?'active':''}" data-chat="${c.id}">${esc(c.title)}</div>`).join('')}
        </div>
        <div class="account"><button id="accountBtn">Checking Puter account…</button></div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="model-picker">
            <button class="model-button" id="modelBtn">
              <div><b>${esc(modelLabel(state.selectedModel))}</b><small>${esc(state.selectedModel?.provider || 'Puter')} ${state.maximumMode?'• MAX':''}</small></div>
              <span>▾</span>
            </button>
            ${state.modelMenuOpen ? renderModelMenu() : ''}
          </div>
          <div class="status">${state.busy ? 'Generating…' : state.models.length ? `${state.models.length} models available` : 'Loading models…'}</div>
        </header>

        <div class="content">
          <section class="messages">
            ${state.messages.length ? state.messages.map(renderMessage).join('') : `
              <div class="empty"><div>
                <h1>Use the model. Not the limits of the interface.</h1>
                <p>ModelForge is a Puter-native multi-model workspace. Pick a model, turn on MAX mode, attach files, stream responses, and compare models from one chat.</p>
              </div></div>`}
          </section>
        </div>

        <div class="composer-wrap">
          <div class="composer">
            ${state.attachments.length ? `<div class="attachment-list">${state.attachments.map((a,i)=>`<span class="chip">${esc(a.name)} <button data-remove="${i}" style="border:0;background:none;cursor:pointer">×</button></span>`).join('')}</div>`:''}
            <textarea id="prompt" placeholder="Message ${esc(modelLabel(state.selectedModel))}…"></textarea>
            <div class="controls">
              <div class="left-controls">
                <label class="icon-btn" title="Attach a file">📎 <input id="fileInput" type="file" multiple hidden></label>
                <button class="select-btn ${state.maximumMode?'active':''}" id="maxBtn">⚡ MAX</button>
                <button class="select-btn" id="reasonBtn">Reasoning: ${state.reasoning}</button>
              </div>
              <div class="right-controls"><button class="send" id="sendBtn" ${state.busy?'disabled':''}>Send ⌘↵</button></div>
            </div>
          </div>
        </div>
      </main>
    </div>
    <div id="toast" class="toast"></div>
  `;
  wire();
}

function renderModelMenu() {
  const filtered = state.models.filter(m=>modelMatches(m,state.modelQuery)).slice(0,80);
  return `<div class="dropdown">
    <input id="modelSearch" class="search" placeholder="Search models…" value="${esc(state.modelQuery)}" />
    <div class="model-grid">${filtered.map(m=>`
      <div class="model-row ${m.id===state.selectedModel?.id?'selected':''}" data-model="${esc(m.id)}">
        <div style="flex:1"><b>${esc(modelLabel(m))}</b><span>${esc(m.provider||'')} · ${m.context?Math.round(m.context/1000)+'K ctx':''}${m.cost?.input!=null?` · $${m.cost.input}/MTok in`:''}</span></div>
      </div>`).join('')}</div>
  </div>`;
}

function renderMessage(m) {
  const who = m.role === 'user' ? 'You' : modelLabel(state.selectedModel);
  const html = m.content ? `<div>${formatContent(m.content)}</div>` : '<div class="status">Working…</div>';
  return `<article class="message ${m.role}"><div class="avatar">${m.role==='user'?'U':'AI'}</div><div class="message-body"><div class="message-meta"><span class="role">${esc(who)}</span><span class="muted">${m.model ? esc(m.model):''}</span></div>${html}</div></article>`;
}
function formatContent(text) {
  const blocks=[]; let safe=esc(text);
  safe=safe.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_,lang,code)=>{const i=blocks.push(`<pre><code>${code}</code></pre>`)-1;return `\u0000B${i}\u0000`;});
  safe=safe.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
  return safe.replace(/\u0000B(\d+)\u0000/g,(_,i)=>blocks[i]);
}

function wire() {
  document.querySelector('#newChat')?.addEventListener('click', newChat);
  document.querySelector('#modelBtn')?.addEventListener('click', ()=>{state.modelMenuOpen=!state.modelMenuOpen; render();});
  document.querySelector('#modelSearch')?.addEventListener('input', e=>{state.modelQuery=e.target.value; render(); document.querySelector('#modelSearch')?.focus();});
  document.querySelectorAll('[data-model]').forEach(el=>el.addEventListener('click', ()=>{
    state.selectedModel=state.models.find(m=>m.id===el.dataset.model) || state.selectedModel; state.modelMenuOpen=false; state.modelQuery=''; render();
  }));
  document.querySelectorAll('[data-chat]').forEach(el=>el.addEventListener('click', ()=>useChat(state.chats.find(c=>c.id===el.dataset.chat))));
  document.querySelector('#sendBtn')?.addEventListener('click', send);
  document.querySelector('#prompt')?.addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); send(); }});
  document.querySelector('#maxBtn')?.addEventListener('click', ()=>{state.maximumMode=!state.maximumMode; if(state.maximumMode) state.reasoning='xhigh'; render();});
  document.querySelector('#reasonBtn')?.addEventListener('click', cycleReasoning);
  document.querySelector('#fileInput')?.addEventListener('change', e=>{
    state.attachments = [...state.attachments, ...[...e.target.files].map(f=>({name:f.name,type:f.type,size:f.size,file:f}))].slice(0,6); render();
  });
  document.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{state.attachments.splice(Number(el.dataset.remove),1);render();}));
  document.querySelector('#compareBtn')?.addEventListener('click', compareLastPrompt);
  document.querySelector('#accountBtn')?.addEventListener('click', async () => {
  try {
    if (puter.auth.isSignedIn()) {
      puter.auth.signOut();
      await refreshAccount();
      render();
      return;
    }

    // Pre-open Puter's named authentication window during the
    // user's click so Edge treats it as user-initiated.
    const authPopup = window.open(
      'about:blank',
      'Puter',
      'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=600,height=700'
    );

    if (!authPopup) {
      throw {
        error: 'popup_blocked',
        msg: 'Edge blocked the authentication window. Allow pop-ups for this site and try again.'
      };
    }

    await puter.auth.signIn({ request_auth: true });

    await refreshAccount();
    render();
    toast('Signed in successfully');
  } catch (e) {
    console.error('Puter authentication failed:', e);

    const code = e?.error || e?.code || 'authentication_failed';
    const message = e?.msg || e?.message || String(e);

    toast(`${code}: ${message}`);
  }
});
  
  refreshAccount();
}
function cycleReasoning(){ const vals=['none','low','medium','high','xhigh']; const i=vals.indexOf(state.reasoning); state.reasoning=vals[(i+1)%vals.length]; state.maximumMode=false; render(); }
async function refreshAccount(){ const btn=document.querySelector('#accountBtn'); if(!btn)return; try{ if(puter.auth.isSignedIn()){const u=puter.auth.getUser(); btn.textContent=u?.username ? `@${u.username}` : 'Puter account';} else btn.textContent='Sign in to Puter'; }catch{btn.textContent='Puter account';} }
function toast(msg){ const el=document.querySelector('#toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }

async function send() {
  if (state.busy) return;
  const input=document.querySelector('#prompt'); const text=input?.value.trim(); if(!text) return;
  const chat=ensureChat();
  if(chat.title==='New chat') chat.title=text.slice(0,56);
  const userMessage={id:id('msg'), role:'user', content:text};
  state.messages.push(userMessage); chat.messages=state.messages; saveLocal();
  state.busy=true; render();

  const assistant={id:id('msg'), role:'assistant', content:'', model:state.selectedModel?.id};
  state.messages.push(assistant); render();

  try {
    const options={
      model:state.selectedModel?.id,
      stream:true,
      reasoning_effort:state.reasoning,
    };
    if(state.attachments.length) {
      const urls=[];
      for(const a of state.attachments){
        try { const uploaded=await puter.fs.upload(a.file); if(uploaded?.path) urls.push(uploaded.path); } catch(e) { console.warn('Upload failed',a.name,e); }
      }
      if(urls.length) options.media=urls;
    }
    const history=state.messages.filter(m=>m.content).map(m=>({role:m.role,content:m.content}));
    history.pop(); history.push({role:'user',content:text});
    const resp=await puter.ai.chat(history, options);
    if(resp && typeof resp[Symbol.asyncIterator]==='function') {
      for await(const part of resp){
        const delta=part?.text ?? part?.delta ?? part?.message?.content ?? '';
        if(typeof delta==='string' && delta){assistant.content += delta; state.messages=[...state.messages]; render();}
      }
    } else {
      const content=resp?.message?.content ?? resp?.text ?? String(resp ?? '');
      assistant.content=typeof content==='string'?content:JSON.stringify(content,null,2);
    }
  } catch(e) {
    assistant.content=`Error: ${e?.message || String(e)}`;
    toast('Model request failed.');
  } finally {
    state.busy=false; chat.messages=state.messages.filter(m=>m.content!=='' || m.id!==assistant.id); saveLocal(); render();
  }
}

async function compareLastPrompt(){
  const last=[...state.messages].reverse().find(m=>m.role==='user');
  if(!last){ toast('Send a message first.'); return; }
  const candidates=state.models.filter(m=>/gpt-6-astra|fable 5\.1|opus 5|gemini 3\.8|gpt-5\.6/i.test(modelLabel(m))).slice(0,4);
  if(candidates.length<2){ toast('Not enough matched models in the live catalog.'); return; }
  state.busy=true;
  const results=[];
  render();
  for(const model of candidates){
    try {
      const r=await puter.ai.chat(last.content,{model:model.id,stream:false,reasoning_effort:'high'});
      results.push({model, text:r?.message?.content ?? r?.text ?? String(r)});
    } catch(e){ results.push({model,text:`Error: ${e.message||e}`}); }
  }
  state.busy=false;
  state.messages.push({id:id('cmp'),role:'assistant',model:'Compare',content:results.map(x=>`**${modelLabel(x.model)}**\n\n${x.text}`).join('\n\n---\n\n')});
  const chat=ensureChat(); chat.messages=state.messages; saveLocal(); render();
}

async function boot(){
  loadLocal();
  render();
  await loadModels();
  render();
}
boot();
