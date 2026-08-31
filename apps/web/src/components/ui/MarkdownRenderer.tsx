import { useMemo } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
  'data-testid'?: string;
}

const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|m4a|aac|flac)(?:\?.*)?$/i;
const AUDIO_SCHEME_REGEX = /^audio:/i;

function isAudioUrl(url: string, linkText?: string): boolean {
  if (!url) return false;
  if (AUDIO_SCHEME_REGEX.test(url)) return true;
  if (AUDIO_EXT_REGEX.test(url)) return true;
  if (url.startsWith('data:audio/')) return true;
  if (linkText && /^audio:/i.test(linkText.trim())) return true;
  return false;
}

function cleanAudioUrl(url: string): string {
  if (AUDIO_SCHEME_REGEX.test(url)) {
    return url.replace(/^audio:/i, '');
  }
  return url;
}

// Initialize configured Marked instance
const markedInstance = new Marked();

// Custom renderer override for links and images
markedInstance.use({
  renderer: {
    link({ href, title, text }) {
      const targetUrl = href || '#';
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

      if (isAudioUrl(targetUrl, text)) {
        const audioSrc = cleanAudioUrl(targetUrl);
        const label = text && !/^audio:/i.test(text) ? text : 'Audio sample';
        return `<span className="inline-flex items-center my-1"><audio controls preload="none" aria-label="${escapeHtml(label)}"${titleAttr}><source src="${escapeHtml(audioSrc)}" /></audio></span>`;
      }

      return `<a href="${escapeHtml(targetUrl)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    image({ href, title, text }) {
      const src = href || '';
      const alt = text || 'Card image';
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} className="max-w-full h-auto rounded-lg inline-block my-1" />`;
    },
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function MarkdownRenderer({
  content,
  className = '',
  inline = false,
  'data-testid': testId,
}: MarkdownRendererProps) {
  const sanitizedHtml = useMemo(() => {
    if (!content) return '';

    try {
      // 1. Parse Markdown into raw HTML
      let rawHtml = markedInstance.parse(content, { async: false }) as string;

      // If inline mode requested, strip outer <p>...</p> tags if present
      if (inline) {
        rawHtml = rawHtml.replace(/^<p>(.*?)<\/p>\n?$/s, '$1');
      }

      // 2. Sanitize HTML via DOMPurify to eliminate XSS, scripts, and unsafe attributes
      const purified = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p',
          'span',
          'div',
          'em',
          'strong',
          'del',
          'code',
          'pre',
          'a',
          'img',
          'audio',
          'source',
          'ul',
          'ol',
          'li',
          'br',
          'blockquote',
          'sub',
          'sup',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
        ],
        ALLOWED_ATTR: [
          'href',
          'src',
          'alt',
          'title',
          'rel',
          'target',
          'controls',
          'preload',
          'aria-label',
          'class',
          'type',
        ],
        ALLOWED_URI_REGEXP:
          /^(?:(?:https?|mailto|blob):|data:(?:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)|audio\/(?:mp3|wav|ogg|mpeg|aac|m4a));)/i,
        ADD_ATTR: ['target', 'rel'],
      });

      return purified;
    } catch {
      return escapeHtml(content);
    }
  }, [content, inline]);

  const Component = inline ? 'span' : 'div';

  return (
    <Component
      className={`markdown-content ${className}`.trim()}
      data-testid={testId}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
