import React from 'react';
import { Linking, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Markdown } from '@/components/ui/markdown';

describe('Markdown', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openUrl.mockRestore();
  });

  it('renders markdown emphasis with native text styles', () => {
    const result = render(<Markdown content="**gato** (m.)" inline />);

    expect(result.getByText('gato')).toHaveStyle({ fontWeight: 'bold' });
    expect(result.getByText('(m.)')).toBeTruthy();
  });

  it('opens safe links', async () => {
    const result = render(
      <Markdown content="[Example](https://example.com)" inline />,
    );

    fireEvent.press(result.getByRole('link'));

    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://example.com'),
    );
  });

  it('renders relative links as noninteractive text', () => {
    const result = render(<Markdown content="[Next](page2.html)" inline />);

    expect(result.getByText('Next')).toBeTruthy();
    expect(result.queryByRole('link')).toBeNull();
    fireEvent.press(result.getByText('Next'));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', ' javaScript:alert(1)'])(
    'renders unsafe link %j as plain text without opening it',
    (url) => {
      const result = render(
        <Markdown content={`[do not open](${url})`} inline />,
      );

      expect(result.queryByRole('link')).toBeNull();
      fireEvent.press(result.getByText('do not open'));
      expect(openUrl).not.toHaveBeenCalled();
    },
  );

  it('does not make an obfuscated malformed URL interactive', () => {
    const content = '[do not open](java\tscript:alert(1))';
    const result = render(<Markdown content={content} inline />);

    expect(result.queryByRole('link')).toBeNull();
    expect(result.getByText(content)).toBeTruthy();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('renders only images whose sources pass the shared URL policy', () => {
    const safe = render(
      <Markdown content="![safe](https://example.com/card.png)" />,
    );
    const unsafe = render(
      <Markdown content="![unsafe](data:text/html,not-an-image)" />,
    );

    expect(safe.getByTestId('markdown-image')).toBeTruthy();
    expect(unsafe.queryByTestId('markdown-image')).toBeNull();
  });

  it.each([
    ['fenced code', '```ts\nconst value = 1;\n```'],
    ['list', '- one\n- two'],
    ['blockquote', '> quoted'],
    ['horizontal rule', '---'],
    ['table', '| a | b |\n| - | - |\n| c | d |'],
  ])('does not emit block views for %s in inline mode', (_name, content) => {
    const result = render(<Markdown content={content} inline />);

    expect(result.UNSAFE_queryAllByType(View)).toHaveLength(0);
    expect(result.UNSAFE_queryAllByType(Text)).not.toHaveLength(0);
  });
});
