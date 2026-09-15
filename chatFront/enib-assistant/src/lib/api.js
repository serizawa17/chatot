// Talks to the two n8n webhooks defined in the workflow:
//   - "Chat Trigger"  -> answers questions from the indexed documents
//   - "Upload PDF"    -> ingests a new PDF into the index
//
// Configure the real URLs in a .env file (see .env.example). n8n shows the
// exact production URL on each trigger node when you click it and copy the
// "Production URL" — paste that value here rather than guessing the path.

const CHAT_URL ='http://localhost:5678/webhook/upload';

const UPLOAD_URL = 'http://localhost:5678/webhook/chat';

function getSessionId() {
  let id = sessionStorage.getItem('enib-session-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('enib-session-id', id);
  }
  return id;
}

export async function sendChatMessage(message) {
  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatInput: message,
      query: message,
      sessionId: getSessionId()
    })
  });

  if (!response.ok) {
    throw new Error(`Le serveur a répondu ${response.status}`);
  }

  const data = await response.json();

  return {
    answer: data.output || data.answer || data.text || '',
    sources: Array.isArray(data.sources) ? data.sources : []
  };
}

export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  // Field name must match the form field label in the "Upload PDF" node.
  formData.append('data', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(true);
      } else {
        reject(new Error(`Le dépôt a échoué (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Connexion au serveur impossible'));
    xhr.send(formData);
  });
}
