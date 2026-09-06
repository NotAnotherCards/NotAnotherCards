import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  describe('Positive Rendering Cases & URI Scheme Preservations', () => {
    it('renders external links with target="_blank" and rel="noopener noreferrer"', () => {
      render(
        <MarkdownRenderer
          content="[Example Link](https://example.com)"
          data-testid="md-link"
        />,
      );

      const link = screen.getByRole('link', { name: 'Example Link' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('preserves relative image sources', () => {
      const { container } = render(
        <MarkdownRenderer content="![Logo](/vite.svg)" />,
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/vite.svg');
      expect(img).toHaveAttribute('alt', 'Logo');
    });

    it('preserves scheme-less image and link paths starting with letters', () => {
      const { container } = render(
        <MarkdownRenderer content="![Logo](images/logo.png) [Page](page2.html)" />,
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'images/logo.png');

      const a = container.querySelector('a');
      expect(a).toHaveAttribute('href', 'page2.html');
    });

    it('preserves fragment anchor links', () => {
      render(
        <MarkdownRenderer
          content="[Go to section](#section)"
          data-testid="md-anchor"
        />,
      );

      const link = screen.getByRole('link', { name: 'Go to section' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '#section');
    });

    it('preserves safe data URIs for images', () => {
      const dataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const { container } = render(
        <MarkdownRenderer content={`![Data Image](${dataUri})`} />,
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', dataUri);
    });

    it('renders custom audio scheme link as audio player', () => {
      const { container } = render(
        <MarkdownRenderer content="[Track](audio:https://example.com/song.mp3)" />,
      );

      const audio = container.querySelector('audio');
      expect(audio).toBeInTheDocument();
      const source = container.querySelector('audio source');
      expect(source).toHaveAttribute('src', 'https://example.com/song.mp3');
    });

    it('renders direct audio extension link as audio player', () => {
      const { container } = render(
        <MarkdownRenderer content="[Audio Link](https://example.com/podcast.mp3)" />,
      );

      const audio = container.querySelector('audio');
      expect(audio).toBeInTheDocument();
      const source = container.querySelector('audio source');
      expect(source).toHaveAttribute('src', 'https://example.com/podcast.mp3');
    });
  });

  describe('Inline Mode Behavior', () => {
    it('renders a <span> element when inline is true and does not wrap in <p>', () => {
      const { container } = render(
        <MarkdownRenderer
          content="Hello World"
          inline
          data-testid="inline-md"
        />,
      );

      const wrapper = screen.getByTestId('inline-md');
      expect(wrapper.tagName.toLowerCase()).toBe('span');
      expect(container.querySelector('p')).toBeNull();
      expect(wrapper).toHaveTextContent('Hello World');
    });

    it('renders a <div> element when inline is false and wraps blocks in <p>', () => {
      const { container } = render(
        <MarkdownRenderer content="Hello World" data-testid="block-md" />,
      );

      const wrapper = screen.getByTestId('block-md');
      expect(wrapper.tagName.toLowerCase()).toBe('div');
      expect(container.querySelector('p')).toBeInTheDocument();
    });

    it('parses multi-line inline content without block elements using parseInline', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'one\n\ntwo'}
          inline
          data-testid="multi-inline"
        />,
      );

      const wrapper = screen.getByTestId('multi-inline');
      expect(wrapper.tagName.toLowerCase()).toBe('span');
      expect(container.querySelector('p')).toBeNull();
      expect(wrapper.textContent).toContain('one');
      expect(wrapper.textContent).toContain('two');
    });
  });

  describe('DOMPurify Sanitization & Security Protection', () => {
    it('strips javascript: URIs from href attributes', () => {
      const { container } = render(
        <MarkdownRenderer content='[Malicious Link](javascript:alert("xss"))' />,
      );

      expect(screen.getByText('Malicious Link')).toBeInTheDocument();
      const a = container.querySelector('a');
      const href = a?.getAttribute('href');
      expect(href ?? '').not.toMatch(/^javascript:/i);
    });

    it('strips data:text/html URIs from href attributes', () => {
      const { container } = render(
        <MarkdownRenderer content="[HTML Data](data:text/html,<script>alert(1)</script>)" />,
      );

      expect(screen.getByText('HTML Data')).toBeInTheDocument();
      const a = container.querySelector('a');
      const href = a?.getAttribute('href');
      expect(href ?? '').not.toMatch(/^data:text\/html/i);
    });

    it('strips vbscript: URIs from href attributes', () => {
      const { container } = render(
        <MarkdownRenderer content="[VBScript Link](vbscript:msgbox(1))" />,
      );

      expect(screen.getByText('VBScript Link')).toBeInTheDocument();
      const a = container.querySelector('a');
      const href = a?.getAttribute('href');
      expect(href ?? '').not.toMatch(/^vbscript:/i);
    });

    it('strips inline <script> tags and execution code', () => {
      const { container } = render(
        <MarkdownRenderer content='<script>console.log("hacked")</script>Safe Content' />,
      );

      expect(container.querySelector('script')).toBeNull();
      expect(container.textContent).toBe('Safe Content');
    });

    it('strips onload event attributes from image tags', () => {
      const { container } = render(
        <MarkdownRenderer content='<img src="/valid.png" onload="alert(1)" />' />,
      );

      const img = container.querySelector('img');
      if (img) {
        expect(img).not.toHaveAttribute('onload');
      }
    });

    it('strips disallowed iframe elements', () => {
      const { container } = render(
        <MarkdownRenderer content='<iframe src="https://evil.com"></iframe>' />,
      );

      expect(container.querySelector('iframe')).toBeNull();
    });

    it('handles empty content gracefully', () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container.firstChild?.textContent).toBe('');
    });
  });
});
