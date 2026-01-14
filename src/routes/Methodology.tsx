import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import methodologyMd from "../content/methodology.md?raw";

function safeUri(uri: string): string {
  const u = (uri ?? "").trim();
  // Block javascript: and data: by default. Allow relative and http(s).
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

export function Methodology() {
  return (
    <div>
      <div className="h1">Methodology</div>
      <p className="muted" style={{ marginTop: 0 }}>
        Plain-English summary of assumptions and limitations. All calculations are client-side and visible in code.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => downloadText("housing-reform-model-methodology.md", methodologyMd)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "white",
            cursor: "pointer",
            fontWeight: 650
          }}
        >
          Download methodology summary
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ node, href, ...props }) => {
              const safe = safeUri(href ?? "");
              return <a {...props} href={safe} target="_blank" rel="noopener noreferrer" />;
            },
            img: ({ node, src, ...props }) => {
              const safe = safeUri(src ?? "");
              return <img {...props} src={safe} />;
            },
          }}
        >
          {methodologyMd}
        </ReactMarkdown>
      </div>
    </div>
  );
}


