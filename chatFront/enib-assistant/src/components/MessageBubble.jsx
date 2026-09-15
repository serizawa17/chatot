export default function MessageBubble({ role, text, sources, pending }) {
  if (role === 'user') {
    return <div className="msg user">{text}</div>;
  }

  return (
    <div className={`msg bot${pending ? ' pending' : ''}`}>
      <div className="body">{pending ? 'Recherche dans les documents…' : text}</div>
      {!pending && sources && sources.length > 0 && (
        <div className="sources">
          {sources.map((s) => (
            <span className="source-chip" key={s.source}>
              [{s.source}] {s.document_name}
              {s.page_number != null ? ` · p.${s.page_number}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
