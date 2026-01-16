import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import docsMd from "../content/docs.md?raw";

function safeUri(uri: string): string {
  const u = (uri ?? "").trim();
  if (/^javascript:/i.test(u)) return "";
  if (/^data:/i.test(u)) return "";
  return u;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Docs() {
  return (
    <div>
      <div className="h1">Docs</div>
      <p className="muted" style={{ marginTop: 0 }}>
        Full documentation of the model: terms, math, policies, assumptions, and validation.
        <span style={{ display: "block", marginTop: 6 }}>
          This model is a free tool developed by the not-for-profit consumer advocacy and research team at SOCii.
        </span>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => downloadText("housing-reform-model-docs.md", docsMd)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "white",
            cursor: "pointer",
            fontWeight: 650,
          }}
        >
          Download docs
        </button>
      </div>

      <div className="card docs-content" style={{ padding: 16 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ href, ...props }) => {
              const safe = safeUri(href ?? "");
              return <a {...props} href={safe} target="_blank" rel="noopener noreferrer" />;
            },
            img: ({ src, alt, ...props }) => {
              const safe = safeUri(src ?? "");
              return <img {...props} src={safe} alt={alt ?? ""} loading="lazy" decoding="async" />;
            },
          }}
        >
          {docsMd}
        </ReactMarkdown>
      </div>
    </div>
  );
}
