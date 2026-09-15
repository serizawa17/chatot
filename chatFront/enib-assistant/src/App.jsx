
import { useState, useRef, useEffect } from "react";

/*
  Assistant documentaire — interface de chat pour le pipeline RAG n8n.

  Le workflow n8n expose deux webhooks :
    POST {chatUrl}    body: { query: string }
                       réponse: { output, answer, sources: [...] }

    POST {uploadUrl}  multipart/form-data
                       champ binaire "data" (le PDF)

  Les URLs sont configurées directement dans le code
  et ne sont pas affichées dans l'interface.
*/

const STYLES = `
  :root {
    --bg: #131315;
    --surface: #1C1C1F;
    --surface-alt: #202024;
    --border: #313136;
    --border-strong: #43434A;
    --ink: #F1EFEA;
    --muted: #9B9AA0;
    --accent: #E0742C;
    --accent-dim: #C15F20;
    --accent-tint: rgba(224, 116, 44, 0.14);
    --danger: #D0553B;
    --danger-tint: rgba(208, 85, 59, 0.14);
    --ok: #4E9A6C;
    --focus: #E0742C;
  }

  * {
    box-sizing: border-box;
  }

  .ad-root {
    min-height: 100%;
    height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
  }

  .ad-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 28px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .ad-brand {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .ad-title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink);
    margin: 0;
  }

  .ad-subtitle {
    font-size: 12.5px;
    color: var(--muted);
  }

  .ad-body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .ad-side {
    width: 300px;
    border-right: 1px solid var(--border);
    padding: 22px;
    overflow-y: auto;
    background: var(--surface-alt);
  }

  .ad-side h2 {
    font-size: 11.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 14px 0;
    font-weight: 600;
  }

  .ad-dropzone {
    border: 1.5px dashed var(--border-strong);
    border-radius: 8px;
    padding: 26px 14px;
    text-align: center;
    cursor: pointer;
    background: var(--surface);
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .ad-dropzone:hover,
  .ad-dropzone.drag {
    border-color: var(--accent);
    background: var(--accent-tint);
  }

  .ad-dropzone p {
    margin: 0;
    font-size: 12.5px;
    color: var(--muted);
    line-height: 1.55;
  }

  .ad-upload-log {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ad-upload-item {
    font-size: 12px;
    padding: 9px 11px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border-strong);
    border-radius: 5px;
    line-height: 1.45;
  }

  .ad-upload-item.ok {
    border-left-color: var(--ok);
  }

  .ad-upload-item.err {
    border-left-color: var(--danger);
  }

  .ad-upload-item .fname {
    display: block;
    color: var(--ink);
    font-weight: 500;
    margin-bottom: 2px;
    word-break: break-all;
  }

  .ad-upload-item .status {
    color: var(--muted);
  }

  .ad-chat-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .ad-messages {
    flex: 1;
    overflow-y: auto;
    padding: 30px 24px 10px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .ad-empty {
    margin: auto;
    text-align: center;
    max-width: 440px;
    color: var(--muted);
  }

  .ad-empty h3 {
    color: var(--ink);
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 8px 0;
  }

  .ad-empty p {
    font-size: 13.5px;
    line-height: 1.6;
    margin: 0;
  }

  .ad-row {
    display: flex;
    max-width: 76%;
  }

  .ad-row.user {
    align-self: flex-end;
    justify-content: flex-end;
  }

  .ad-row.bot {
    align-self: flex-start;
  }

  .ad-bubble {
    padding: 13px 16px;
    border-radius: 10px;
    font-size: 14.5px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .ad-row.user .ad-bubble {
    background: var(--accent);
    color: #FFFFFF;
    border-bottom-right-radius: 3px;
  }

  .ad-row.bot .ad-bubble {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--border);
    border-bottom-left-radius: 3px;
  }

  .ad-row.bot .ad-bubble.pending {
    color: var(--muted);
    font-style: italic;
  }

  .ad-row.bot .ad-bubble.error {
    border-color: var(--danger);
    background: var(--danger-tint);
    color: var(--danger);
  }

  .ad-cite {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 600;
    background: var(--accent-tint);
    color: var(--accent-dim);
    padding: 1px 6px;
    border-radius: 8px;
    margin: 0 2px;
    vertical-align: middle;
  }

  .ad-sources {
    margin-top: 9px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ad-source-chip {
    font-size: 11px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    padding: 4px 9px;
    border-radius: 5px;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ad-source-chip b {
    color: var(--ink);
    font-weight: 600;
  }

  .ad-composer {
    border-top: 1px solid var(--border);
    padding: 16px 24px 22px;
    display: flex;
    gap: 10px;
    background: var(--surface);
  }

  .ad-composer textarea {
    flex: 1;
    resize: none;
    background: var(--surface-alt);
    border: 1px solid var(--border-strong);
    color: var(--ink);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.5;
    max-height: 140px;
  }

  .ad-composer textarea:focus {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 3px var(--accent-tint);
  }

  .ad-composer textarea::placeholder {
    color: var(--muted);
  }

  .ad-send {
    background: var(--accent);
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 0 22px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .ad-send:hover:not(:disabled) {
    background: var(--accent-dim);
  }

  .ad-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ad-status-bar {
    font-size: 11.5px;
    color: var(--muted);
    padding: 10px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .ad-status-bar .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ok);
    margin-right: 7px;
  }

  @media (max-width: 720px) {
    .ad-side {
      width: 240px;
    }

    .ad-row {
      max-width: 90%;
    }

    .ad-header {
      padding: 14px 18px;
    }

    .ad-subtitle {
      display: none;
    }

    .ad-side {
      padding: 16px;
    }

    .ad-messages {
      padding: 20px 14px 10px;
    }

    .ad-composer {
      padding: 12px 14px 16px;
    }
  }
`;

function extractSourceTags(text) {
  const parts = [];
  const regex = /\[SOURCE\s+(\d+)\]/gi;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "cite",
      value: match[1],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

export default function App() {
  /*
    URLs n8n.
    Elles sont utilisées par l'application mais
    ne sont pas affichées dans l'interface utilisateur.
  */
  const chatUrl =
    "http://localhost:5678/webhook/chat";

  const uploadUrl =
    "http://localhost:5678/webhook/upload-document";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  async function sendMessage(text) {
    const query = (text ?? input).trim();

    if (!query || isSending) {
      return;
    }

    setMessages((prev) => [
      ...prev,

      {
        role: "user",
        text: query,
        id: crypto.randomUUID(),
      },

      {
        role: "bot",
        text: "…",
        pending: true,
        id: crypto.randomUUID(),
      },
    ]);

    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(chatUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          query,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      const answer =
        data.output ||
        data.answer ||
        "Je ne trouve pas cette information dans les documents fournis.";

      const sources = Array.isArray(data.sources)
        ? data.sources
        : [];

      setMessages((prev) =>
        prev.map((m) =>
          m.pending
            ? {
                ...m,
                text: answer,
                pending: false,
                sources,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.pending
            ? {
                ...m,
                pending: false,
                error: true,
                text: `Impossible de joindre le serveur (${err.message}).`,
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  async function uploadFile(file) {
    if (!file) {
      return;
    }

    const entryId = crypto.randomUUID();

    setUploads((prev) => [
      {
        id: entryId,
        name: file.name,
        status: "Envoi en cours…",
        state: "pending",
      },
      ...prev,
    ]);

    try {
      const form = new FormData();

      form.append(
        "data",
        file,
        file.name
      );

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      setUploads((prev) =>
        prev.map((u) =>
          u.id === entryId
            ? {
                ...u,
                state: "ok",
                status:
                  data.message ||
                  "Reçu, indexation en cours en arrière-plan.",
              }
            : u
        )
      );
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === entryId
            ? {
                ...u,
                state: "err",
                status: `Échec : ${err.message}`,
              }
            : u
        )
      );
    }
  }

  function handleFiles(fileList) {
    Array.from(fileList)
      .filter(
        (f) =>
          f.type === "application/pdf" ||
          f.name
            .toLowerCase()
            .endsWith(".pdf")
      )
      .forEach(uploadFile);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="ad-root">

      <style>{STYLES}</style>

      {/* HEADER */}
      <header className="ad-header">

        <div className="ad-brand">

          <h1 className="ad-title">
            Assistant documentaire
          </h1>

          <span className="ad-subtitle">
            Questions & réponses sur vos documents
          </span>

        </div>

      </header>

      <div className="ad-body">

        {/* SIDEBAR */}
        <aside className="ad-side">

          <div style={{ marginBottom: 20 }}>

            <button
              className="ad-nav-btn active"
              style={{ width: "100%" }}
            >
              Documents
            </button>

          </div>

          <div>

            <h2>
              Alimenter la base
            </h2>

            <div
              className={`ad-dropzone ${
                isDragging ? "drag" : ""
              }`}

              onClick={() =>
                fileInputRef.current?.click()
              }

              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}

              onDragLeave={() =>
                setIsDragging(false)
              }

              onDrop={(e) => {
                e.preventDefault();

                setIsDragging(false);

                handleFiles(
                  e.dataTransfer.files
                );
              }}
            >

              <p>
                Déposez un PDF ici
                <br />
                ou cliquez pour parcourir
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                style={{
                  display: "none",
                }}
                onChange={(e) =>
                  handleFiles(
                    e.target.files
                  )
                }
              />

            </div>

            {/* UPLOAD LOG */}
            <div className="ad-upload-log">

              {uploads.length === 0 && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  Aucun document envoyé pour l'instant.
                </p>
              )}

              {uploads.map((u) => (
                <div
                  key={u.id}
                  className={`ad-upload-item ${u.state}`}
                >

                  <span className="fname">
                    {u.name}
                  </span>

                  <span className="status">
                    {u.status}
                  </span>

                </div>
              ))}

            </div>

          </div>

        </aside>

        {/* CHAT */}
        <div className="ad-chat-col">

          {/* STATUS */}
          <div className="ad-status-bar">

            <span className="dot" />

            Serveur connecté

          </div>

          {/* MESSAGES */}
          <div className="ad-messages">

            {messages.length === 0 && (
              <div className="ad-empty">

                <h3>
                  Posez une question sur vos documents
                </h3>

                <p>
                  Horaires, tarifs, règlement intérieur,
                  liens utiles — les réponses s'appuient
                  uniquement sur les PDF indexés.
                </p>

              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`ad-row ${m.role}`}
              >

                <div>

                  <div
                    className={`ad-bubble ${
                      m.pending
                        ? "pending"
                        : ""
                    } ${
                      m.error
                        ? "error"
                        : ""
                    }`}
                  >

                    {m.role === "bot" &&
                    !m.pending
                      ? extractSourceTags(
                          m.text
                        ).map(
                          (part, i) =>
                            part.type ===
                            "cite" ? (
                              <span
                                key={i}
                                className="ad-cite"
                              >
                                SOURCE{" "}
                                {part.value}
                              </span>
                            ) : (
                              <span key={i}>
                                {part.value}
                              </span>
                            )
                        )
                      : m.text}

                  </div>

                  {/* SOURCES */}
                  {m.role === "bot" &&
                    !m.pending &&
                    Array.isArray(
                      m.sources
                    ) &&
                    m.sources.length > 0 && (

                      <div className="ad-sources">

                        {m.sources.map(
                          (source, index) => (

                            <div
                              key={index}
                              className="ad-source-chip"
                            >

                              <b>
                                {source.title ||
                                  source.name ||
                                  `Source ${
                                    index + 1
                                  }`}
                              </b>

                            </div>

                          )
                        )}

                      </div>

                    )}

                </div>

              </div>
            ))}

            <div ref={messagesEndRef} />

          </div>

          {/* COMPOSER */}
          <div className="ad-composer">

            <textarea
              rows={1}
              placeholder="Écrivez votre question…"
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
            />

            <button
              className="ad-send"
              onClick={() =>
                sendMessage()
              }
              disabled={
                isSending ||
                !input.trim()
              }
            >
              Envoyer
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
