// Minimal SAFE Markdown → HTML renderer for AI-generated reports.
//
// The model is instructed to return Markdown only, but we never trust it:
// all raw HTML is escaped FIRST, then a small subset of Markdown is
// converted (headings, bold, italic, lists, tables, rules, code spans).
// No raw HTML passthrough, no script/style, no inline event handlers.
"use strict";

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  let out = escHtml(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return out;
}

function isTableSep(line) {
  return /^\s*\|?[\s:|-]+\|?[\s:|-]*$/.test(line) && line.includes("|") && /-/.test(line);
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function render(md) {
  const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let i = 0;
  let listOpen = null; // "ul" | "ol"

  function closeList() {
    if (listOpen) { html.push(listOpen === "ul" ? "</ul>" : "</ol>"); listOpen = null; }
  }

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { closeList(); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { closeList(); html.push("<hr>"); i++; continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      closeList();
      const lvl = Math.min(h[1].length + 1, 4); // ## → h3 inside report body
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++; continue;
    }

    // table: header row + separator row
    if (t.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const heads = splitRow(t);
      html.push('<div class="tablewrap"><table><thead><tr>' +
        heads.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        html.push("<tr>" + splitRow(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
        i++;
      }
      html.push("</tbody></table></div>");
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(t);
    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const text = (ul || ol)[1];
      if (listOpen !== kind) { closeList(); html.push(`<${kind}>`); listOpen = kind; }
      html.push(`<li>${inline(text)}</li>`);
      i++; continue;
    }

    closeList();
    // paragraph: gather consecutive non-blank, non-special lines
    const buf = [t];
    i++;
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,4}\s|[-*]\s|\d+[.)]\s)/.test(lines[i].trim()) &&
           !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      buf.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${buf.map(inline).join("<br>")}</p>`);
  }
  closeList();
  return html.join("\n");
}

module.exports = { render, escHtml };
