// dsh-elf — Host half
// Uses: llm (streaming model calls), agentDefaultModel (default model route)
// JSON API used by the ordinary Web Client half:
//   elf.sessionModel   -> { available, provider, model, reasoningEffort? }
//   elf.chat.start     -> { ok, chatId } | { ok:false, error }
//   elf.chat.poll      -> { ok, done, text, error? }
//   elf.chat.close     -> { ok }
const API_PREFIX = '/dsh-elf/api';
const MAX_BODY_BYTES = 1 << 20;

const MSG = {
  zh: {
    tooLarge: '请求内容过大',
    badJson: '请求不是有效 JSON',
    postOnly: '只支持 POST',
    unknown: '未知的小精灵 API',
    llmUnavailable: 'LLM 服务不可用',
    noMessages: '没有消息内容',
    noModel: '未配置模型',
    noChat: '对话不存在或已结束',
  },
  en: {
    tooLarge: 'Request body too large',
    badJson: 'Request body is not valid JSON',
    postOnly: 'Only POST is supported',
    unknown: 'Unknown elf API',
    llmUnavailable: 'LLM service unavailable',
    noMessages: 'No message content',
    noModel: 'No model configured',
    noChat: 'Chat not found or already ended',
  },
};

function langOf(args) {
  return args && (args.lang === 'en' || args.lang === 'zh') ? args.lang : 'zh';
}

function systemPrompt(lang) {
  const body = lang === 'en'
    ? 'You are the DeepSeek elf living in DSH. Be concise, friendly and direct, like a light-hearted assistant; this is a temporary chat, so do not assume you have tools or file access.'
    : '你是一只住在 DSH 里的 DeepSeek 小精灵。回答要简洁、友好、直接，像一位轻快的小助手；这是临时对话，不要假设你有工具或文件访问能力。';
  return body + ' 请使用用户当前界面语言回复（中文或英文）。 Reply in the user\'s current UI language (Chinese or English).';
}

class ElfHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new ElfHttpError(413, MSG.zh.tooLarge);
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ElfHttpError(400, MSG.zh.badJson);
  }
}

function writeJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function createApiRoute(handlers) {
  return async (req, res) => {
    let args = {};
    let lang = 'zh';
    try {
      args = await readJsonBody(req);
      lang = langOf(args);
    } catch (error) {
      // 400/413 are thrown before the body could be parsed — the language is
      // unknowable there, and the real client never hits these paths.
      const status = error instanceof ElfHttpError ? error.status : 500;
      writeJson(res, status, { ok: false, error: String((error && error.message) || error) });
      return;
    }
    const M = MSG[lang];
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, error: M.postOnly });
      return;
    }
    const pathname = new URL(req.url || '/', 'http://dsh.internal').pathname;
    const method = pathname.startsWith(API_PREFIX + '/')
      ? decodeURIComponent(pathname.slice(API_PREFIX.length + 1))
      : '';
    if (!method || method.includes('/')) {
      writeJson(res, 404, { ok: false, error: M.unknown });
      return;
    }
    const handler = handlers.get(method);
    if (!handler) {
      writeJson(res, 404, { ok: false, error: M.unknown + ': ' + method });
      return;
    }
    try {
      const value = await handler(args);
      writeJson(res, 200, { ok: true, value });
    } catch (error) {
      const status = error instanceof ElfHttpError ? error.status : 500;
      writeJson(res, status, { ok: false, error: String((error && error.message) || error) });
    }
  };
}

const plugin = {
  apply(ctx) {
    const chats = new Map();
    const handlers = new Map();
    let seq = 0;

    function buildMessage(m, i) {
      const text = String(m && m.text != null ? m.text : '');
      return {
        id: 'elf-msg-' + seq + '-' + i,
        role: m && m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text }],
        source: m && m.role === 'assistant'
          ? { kind: 'model', provider: m.provider || '', model: m.model || '' }
          : { kind: 'user' },
      };
    }

    handlers.set('elf.sessionModel', () => {
      const agentDefaultModel = ctx.get('agentDefaultModel');
      if (!agentDefaultModel) return { available: false };
      const sel = agentDefaultModel.currentSelection();
      return {
        available: true,
        provider: sel.provider,
        model: sel.model,
        reasoningEffort: sel.reasoningEffort || undefined,
      };
    });

    handlers.set('elf.chat.start', async (args) => {
      const llm = ctx.get('llm');
      const agentDefaultModel = ctx.get('agentDefaultModel');
      const lang = langOf(args);
      const M = MSG[lang];
      if (!llm) return { ok: false, error: M.llmUnavailable };
      const messages = Array.isArray(args && args.messages) ? args.messages : [];
      if (!messages.length) return { ok: false, error: M.noMessages };

      let provider = args && args.provider;
      let model = args && args.model;
      let reasoningEffort = args && args.reasoningEffort;
      if (!provider || !model) {
        if (!agentDefaultModel) return { ok: false, error: M.noModel };
        const sel = agentDefaultModel.currentSelection();
        provider = provider || sel.provider;
        model = model || sel.model;
        if (reasoningEffort === undefined) reasoningEffort = sel.reasoningEffort;
      }
      if (!provider || !model) return { ok: false, error: M.noModel };

      const chatId = 'elf-chat-' + Date.now() + '-' + (seq++);
      const entry = { text: '', done: false, error: null };
      chats.set(chatId, entry);

      const wire = messages.map(buildMessage);
      const options = { provider, model, messages: wire, system: systemPrompt(lang) };
      if (reasoningEffort) options.reasoningEffort = reasoningEffort;

      (async () => {
        try {
          for await (const chunk of llm.stream(options)) {
            if (chunk.type === 'text-delta') {
              entry.text += chunk.text;
            } else if (chunk.type === 'finish') {
              if (chunk.reason && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                entry.error = (chunk.reason.failure && chunk.reason.failure.message) || chunk.reason.kind;
              }
              entry.done = true;
            }
          }
          if (!entry.done) entry.done = true;
        } catch (err) {
          entry.error = String((err && err.message) || err);
          entry.done = true;
        }
      })();

      return { ok: true, chatId };
    });

    handlers.set('elf.chat.poll', (args) => {
      const entry = args && chats.get(args.chatId);
      if (!entry) return { ok: false, done: true, error: MSG[langOf(args)].noChat };
      return { ok: true, done: entry.done, text: entry.text, error: entry.error };
    });

    handlers.set('elf.chat.close', (args) => {
      if (args && args.chatId) chats.delete(args.chatId);
      return { ok: true };
    });

    ctx.inject(['webServer'], (scope) => {
      scope.effect(() => scope.webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: createApiRoute(handlers),
      }), 'dsh-elf: JSON API route');
    });

    // Dispose: drop any in-flight chat state with the plugin.
    ctx.effect(() => () => chats.clear());
  },
};

export const name = 'dsh-elf';
export const apply = plugin.apply;
