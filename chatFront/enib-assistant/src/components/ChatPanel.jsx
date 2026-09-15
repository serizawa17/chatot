import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import { sendChatMessage } from '../lib/api.js';

export default function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setInput('');
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      { role: 'bot', pending: true }
    ]);

    try {
      const { answer, sources } = await sendChatMessage(question);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'bot', text: answer, sources };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'bot',
          text: `Je n'ai pas pu joindre le serveur : ${err.message}`
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="conversation">
      <div className="thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Posez une question sur les documents déposés</h3>
            <p>Tarifs, horaires, règlement, liens utiles — la réponse cite ses sources.</p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} {...m} />)
        )}
      </div>

      <div className="composer">
        <form onSubmit={handleSubmit}>
          <textarea
            rows={1}
            placeholder="Écrivez votre question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()}>
            {busy ? '…' : 'Envoyer'}
          </button>
        </form>
        <div className="hint">Entrée pour envoyer, Maj+Entrée pour un saut de ligne.</div>
      </div>
    </div>
  );
}
