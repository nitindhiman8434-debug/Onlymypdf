import DOMPurify from "isomorphic-dompurify";

const BLOCKED_TAGS =
  /<\s*(script|iframe|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\/\s*\1\s*>|<\s*(script|iframe|object|embed|link|meta|base|form)\b[^>]*\/?>/gi;

const EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF = /\b(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "a",
    "abbr",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "col",
    "colgroup",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  ALLOWED_ATTR: [
    "alt",
    "class",
    "colspan",
    "height",
    "href",
    "rowspan",
    "src",
    "title",
    "width",
  ],
  ALLOW_DATA_ATTR: false,
};

/** Strip active content before rendering untrusted HTML in a sandboxed preview. */
export function sanitizeHtmlPreview(html: string): string {
  let out = html.replace(BLOCKED_TAGS, "");
  out = out.replace(EVENT_HANDLER_ATTR, "");
  out = out.replace(JS_HREF, '$1="#"');
  return DOMPurify.sanitize(out, DOMPURIFY_CONFIG);
}

export const HTML_PREVIEW_WARNING =
  "Preview is for layout only. It may not match the final PDF and can show deceptive content.";
