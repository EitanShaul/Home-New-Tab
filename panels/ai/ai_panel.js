const MAX_MESSAGES = 10;

const COPY_ICON = `
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect x="6" y="6" width="8" height="8" rx="2" stroke="currentColor" fill="none"/>
    <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" fill="none"/>
  </svg>
`;

const AI_API_URL = 'https://ai.homenewtab.com';

class MessageView {
  constructor(role, content, id) {
    this.el = document.createElement('div');
    this.el.className = `chat__message chat__message--${role}`;
    this.el.dataset.messageId = id;
    
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'chat__message-content';
    
    if (role === 'user') {
      const actions = document.createElement('div');
      actions.className = 'chat__message-edit';
      actions.appendChild(this.createMessageAction(
        `<svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M2 11V14H5L12 7L9 4L2 11Z" stroke="currentColor" fill="none"/>
        </svg>`,
        'Edit',
        () => this.onEdit?.(id, content)
      ));
      this.el.appendChild(actions);
    }
    
    this.el.appendChild(this.contentEl);
    this.setContent(content);
  }

  createMessageAction(icon, label, onClick) {
    const button = document.createElement('button');
    button.className = 'chat__message-action';
    button.innerHTML = icon;
    button.setAttribute('data-label', label);
    button.onclick = onClick;
    return button;
  }

  setOnEdit(callback) {
    this.onEdit = callback;
  }

  addActions(actions) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'chat__message-actions';
    
    actions.forEach(({ icon, label, onClick }) => {
      actionsContainer.appendChild(this.createMessageAction(icon, label, onClick));
    });
    
    this.contentEl.appendChild(actionsContainer);
  }

  startEditing(content, onSave, onCancel) {
    this.contentEl.classList.add('chat__message-content--editing');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'chat__edit-wrapper';
    
    const editor = document.createElement('textarea');
    editor.className = 'chat__edit-input scrollbar-thin';
    editor.value = content;
    
    const autoResize = () => {
      editor.style.height = '0';
      const maxHeight = 400;
      const scrollHeight = editor.scrollHeight;
      editor.style.height = Math.min(scrollHeight, maxHeight) + 'px';
      
      editor.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    };
    
    editor.addEventListener('input', autoResize);
    requestAnimationFrame(autoResize);
    
    const actions = document.createElement('div');
    actions.className = 'chat__edit-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'chat__edit-action';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      this.contentEl.classList.remove('chat__message-content--editing');
      this.contentEl.textContent = content;
      onCancel?.();
    };
    
    const sendBtn = document.createElement('button');
    sendBtn.className = 'chat__edit-action chat__edit-action--primary';
    sendBtn.textContent = 'Send';
    sendBtn.onclick = () => onSave?.(editor.value);
    
    actions.appendChild(cancelBtn);
    actions.appendChild(sendBtn);
    
    wrapper.appendChild(editor);
    wrapper.appendChild(actions);
    
    this.contentEl.textContent = '';
    this.contentEl.appendChild(wrapper);
    editor.focus();
  }

  setContent(content) {
    this.contentEl.innerHTML = marked.parse(content || '');
  }
}


class ChatInput {
  constructor() {
    this.container = document.createElement('form');
    this.container.className = 'chat__input-container';
    
    this.input = document.createElement('textarea');
    this.input.className = 'chat__input scrollbar-thin';
    this.input.placeholder = 'Ask me anything...';
    this.input.rows = 1;
    
    this.sendButton = document.createElement('button');
    this.sendButton.className = 'chat__send-button';
    this.sendButton.type = 'submit';
    this.sendButton.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22L12 6M12 6L7 11M12 6L17 11" 
              stroke="white" 
              stroke-width="3" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"/>
      </svg>
    `;
    
    this.container.appendChild(this.input);
    this.container.appendChild(this.sendButton);
    
    // Initial button state
    this.sendButton.disabled = true;
    
    // Bind events
    this.input.addEventListener('input', this.handleInput.bind(this));
    this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleInput() {
    this.autoResize();
    this.sendButton.disabled = !this.input.value.trim();
  }

  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (this.input.value.trim()) {
        this.container.dispatchEvent(new Event('submit'));
      }
    }
  }

  autoResize() {
    this.input.style.height = 'auto';
    this.input.style.height = this.input.scrollHeight + 'px';
    this.input.classList.toggle('chat__input--expanded', 
      this.input.scrollHeight >= parseInt(getComputedStyle(this.input).maxHeight));
  }

  clear() {
    this.input.value = '';
    this.input.style.height = 'auto';
    this.sendButton.disabled = true;
  }

  get value() {
    return this.input.value;
  }

  set value(text) {
    this.input.value = text;
    this.sendButton.disabled = !text.trim();
  }
}


// Storage helper
class TokenStorage {
  static async get(service) {
    const data = await chrome.storage.local.get(`auth:${service}`);
    return data[`auth:${service}`];
  }

  static set(service, data) {
    return chrome.storage.local.set({
      [`auth:${service}`]: data
    });
  }

  static async remove(service) {
    return chrome.storage.local.remove(`auth:${service}`);
  }
}


class Chat {
  constructor(rootElement, token) {
    this.messages = [];
    this.messageId = 0;
    
    this.container = document.createElement('div');
    this.container.className = 'chat';
    
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat__messages';
    
    this.input = new ChatInput();
    
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(this.input.container);
    rootElement.appendChild(this.container);

    this.input.container.addEventListener('submit', this.handleSubmit.bind(this));
  }

  async ensureValidToken() {
    const stored = await TokenStorage.get('ai');
    const now = Date.now() / 1000;

    if (stored?.token && stored.expiry > now + 60) {
      return stored.token;
    }

    const response = await fetch(`${AI_API_URL}/auth/token`, {
      method: 'POST'
    });
    const data = await response.json();
    
    // not awaiting on purpose
    TokenStorage.set('ai', {
      token: data.token,
      expiry: now + data.expires_in
    });

    return data.token;
  }


  async handleSubmit(e) {
    e.preventDefault();
    const message = this.input.value.trim();
    if (!message) return;

    this.addMessage('user', message);
    this.input.clear();
    
    await this.streamAssistantResponseUI();
  }

  addMessage(role, content) {
    const id = this.messageId++;
    const view = new MessageView(role, content, id);
    
    this.messagesContainer.appendChild(view.el);

    if (role === 'user') {
      view.setOnEdit((id, content) => this.startEditing(id, content));
    }
    
    const message = { id, role, content, view };
    this.messages.push(message);
    return message;
  }

  createCopyAction(content) {
    return {
      icon: COPY_ICON,
      label: 'Copy',
      onClick: () => navigator.clipboard.writeText(content)
    };
  }

  // {role, content} only, for user and completed assistant messages
  getMessagesToSend() {
    return this.messages
      .filter(m => Boolean(m.content))
      .map(m => ({ role: m.role, content: m.content }));
  }

  async streamAssistantResponseUI() {
    try {
      const token = await this.ensureValidToken();

      // we add new message to thread (because of UI)
      const message = this.addMessage('assistant', '');
  
      const start = Date.now();
      let timeToFirstChunk; // TODO: publish events instead (start, chunk, end)

      await this.streamChatWithAuthRetry(
        token,
        this.getMessagesToSend(),
        chunk => {
          message.content += chunk;
          message.view.setContent(message.content);
          timeToFirstChunk ||= Date.now() - start;
        }
      );

      console.log(`Time to first chunk:`, timeToFirstChunk);
      console.log(`Time to completion:`, Date.now() - start);

      message.view.addActions([this.createCopyAction(message.content)]);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

    } catch (error) {
      console.error('Error:', error);
      message.view.setContent('Sorry, there was an error generating the response.');
    }
  }

  startEditing(messageId, content) {
    const message = this.messages.find(m => m.id === messageId);
    message.view.startEditing(
      content,
      (newContent) => this.handleEdit(messageId, newContent),
      () => message.view.setContent(content)
    );
  }

  handleEdit(messageId, newContent) {
    const messageIndex = this.messages.findIndex(m => m.id === messageId);
    
    // Remove subsequent messages from UI and array
    this.messages.slice(messageIndex).forEach(m => m.view.el.remove());
    this.messages = this.messages.slice(0, messageIndex);
    
    this.addMessage('user', newContent);
    this.streamAssistantResponseUI();
  }

  // throws on error
  async streamChatWithAuthRetry(token, messages, onChunk) {
    const url = `${AI_API_URL}/proxy`;
    try {
      await streamFetch(url, token, messages, onChunk);
    } catch (error) {
      if (error.status === 401) {
        // Clear invalid token (server might've been cleared)
        await TokenStorage.set('ai', null);
        
        // Get fresh token and retry once
        const newToken = await this.ensureValidToken();
        await streamFetch(url, newToken, messages, onChunk);
      } else {
        throw error;
      }
    }
  }
}


// Create chat immediately
const chat = new Chat(document.getElementById('chat-root'));

// Handle incoming messages to start chat with term
window.addEventListener('message', (event) => {
  if (event.data.type === 'start-chat') {
    chat.input.value = event.data.term;
    chat.handleSubmit(new Event('submit'));
  }
});

// Configure marked renderer once available
(function configureMarked() {
  if (typeof marked === 'undefined') {
    setTimeout(configureMarked, 100);
    return;
  }
  marked.use({
    renderer: {
      code(code) {
        const language = code.lang || '';
        return `
          <div class="code-block">
            <pre><code class="${language}">${code.text}</code></pre>
            <button class="chat__message-action" data-label="Copy code">
              ${COPY_ICON}
            </button>
          </div>
        `;
      }
    }
  });
})();

// Add click handler for code copy buttons
document.addEventListener('click', (e) => {
  if (e.target.closest('.code-block .chat__message-action')) {
    const code = e.target.closest('.code-block').querySelector('code').textContent;
    navigator.clipboard.writeText(code);
  }
});



// throws on error
async function streamFetch(url, token, messages, onChunk) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ messages, stream: true })
  });

  if (!response.ok) {
    const error = new Error('Request failed');
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices[0]?.delta?.content || '';
          onChunk(chunk);
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }
  }
}
