import { Fragment, useMemo, type ReactNode } from 'react';
import {
  Image,
  Linking,
  Pressable,
  Text as NativeText,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  MarkedHooks,
  Renderer,
  useMarkdown,
  type MarkedStyles,
} from 'react-native-marked';
import { isSafeUrl } from '@repo/schemas';

interface MarkdownProps {
  content: string;
  inline?: boolean;
}

const themes = {
  light: {
    colors: {
      text: '#0a0a0a',
      link: '#171717',
      code: '#f5f5f5',
      border: '#e5e5e5',
    },
  },
  dark: {
    colors: {
      text: '#fafafa',
      link: '#e5e5e5',
      code: '#262626',
      border: '#232323',
    },
  },
} as const;

const styles: MarkedStyles = {
  paragraph: { paddingVertical: 0 },
  codespan: {
    borderRadius: 4,
    fontFamily: 'monospace',
    fontStyle: 'normal',
    paddingHorizontal: 4,
  },
  codeText: { fontFamily: 'monospace' },
  link: { fontStyle: 'normal', textDecorationLine: 'underline' },
};

const blockedUrl = 'unsafe-markdown:';
const safeUrlHooks = new MarkedHooks();
const explicitSchemePattern = /^[a-z][a-z0-9+.-]*:/i;
const dataSchemePattern = /^data:/i;

function canOpenUrl(url: string): boolean {
  if (dataSchemePattern.test(url)) return false;
  return isSafeUrl(url) && explicitSchemePattern.test(url);
}

function openSafeUrl(url: string): void {
  if (!canOpenUrl(url)) return;
  void Linking.openURL(url).catch(() => undefined);
}

function blockUnsafeTokenUrls(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => blockUnsafeTokenUrls(item, seen));
    return;
  }

  if (
    'type' in value &&
    'href' in value &&
    (value.type === 'link' || value.type === 'image') &&
    typeof value.href === 'string' &&
    (value.type === 'image' ? !isSafeUrl(value.href) : !canOpenUrl(value.href))
  ) {
    value.href = blockedUrl;
  }
  Object.values(value).forEach((item) => blockUnsafeTokenUrls(item, seen));
}

// react-native-marked resolves relative links before they reach its renderer.
// Check the original token so URL-parser whitespace cannot be hidden by that
// resolution step. Unsafe or relative links lose only their interactivity, so
// nested formatting and images still render. Unsafe images are still refused.
safeUrlHooks.processAllTokens = (tokens) => {
  blockUnsafeTokenUrls(tokens);
  return tokens;
};

function inheritTextStyle(
  style?: TextStyle,
  keepColor = false,
): TextStyle | undefined {
  if (!style) return undefined;

  const inherited = { ...style };
  if (!keepColor) delete inherited.color;
  delete inherited.fontSize;
  delete inherited.lineHeight;
  return inherited;
}

class SafeRenderer extends Renderer {
  constructor(private readonly inline: boolean) {
    super();
  }

  paragraph(children: ReactNode[], style?: ViewStyle): ReactNode {
    if (this.inline) {
      return <Fragment key={this.getKey()}>{children}</Fragment>;
    }
    return super.paragraph(children, style);
  }

  blockquote(children: ReactNode[], style?: ViewStyle): ReactNode {
    if (this.inline) {
      return <Fragment key={this.getKey()}>{children}</Fragment>;
    }
    return super.blockquote(children, style);
  }

  code(
    text: string,
    language?: string,
    containerStyle?: ViewStyle,
    textStyle?: TextStyle,
  ): ReactNode {
    if (this.inline) return this.codespan(text, textStyle);
    return super.code(text, language, containerStyle, textStyle);
  }

  hr(style?: ViewStyle): ReactNode {
    if (this.inline) {
      return <NativeText key={this.getKey()}> — </NativeText>;
    }
    return super.hr(style);
  }

  listItem(children: ReactNode[], style?: ViewStyle): ReactNode {
    if (this.inline) {
      return <Fragment key={this.getKey()}>{children}</Fragment>;
    }
    return super.listItem(children, style);
  }

  list(
    ordered: boolean,
    items: ReactNode[],
    listStyle?: ViewStyle,
    textStyle?: TextStyle,
    startIndex = 1,
  ): ReactNode {
    if (!this.inline) {
      return super.list(ordered, items, listStyle, textStyle, startIndex);
    }
    return (
      <NativeText key={this.getKey()} style={this.textStyle(textStyle)}>
        {items.map((item, index) => (
          <Fragment key={this.getKey()}>
            {ordered ? `${startIndex + index}. ` : '• '}
            {item}
            {index < items.length - 1 ? '\n' : null}
          </Fragment>
        ))}
      </NativeText>
    );
  }

  escape(text: string, style?: TextStyle): ReactNode {
    return super.escape(text, this.textStyle(style));
  }

  link(
    children: string | ReactNode[],
    href: string,
    style?: TextStyle,
    title?: string,
  ): ReactNode {
    const safeStyle = this.textStyle(style, true);
    if (!canOpenUrl(href)) {
      return <Fragment key={this.getKey()}>{children}</Fragment>;
    }
    return (
      <NativeText
        key={this.getKey()}
        selectable
        accessibilityRole="link"
        accessibilityHint="Opens in a new window"
        accessibilityLabel={title}
        onPress={() => openSafeUrl(href)}
        style={safeStyle}
      >
        {children}
      </NativeText>
    );
  }

  image(
    uri: string,
    alt?: string,
    style?: ImageStyle,
    title?: string,
  ): ReactNode {
    if (!isSafeUrl(uri)) return null;
    return (
      <Image
        key={this.getKey()}
        source={{ uri }}
        accessibilityRole="image"
        accessibilityLabel={alt || title || 'Card image'}
        testID="markdown-image"
        style={[
          {
            width: '100%',
            height: 200,
            borderRadius: 8,
            resizeMode: 'contain',
          },
          style,
        ]}
      />
    );
  }

  linkImage(
    href: string,
    imageUrl: string,
    alt?: string,
    style?: ImageStyle,
    title?: string | null,
  ): ReactNode {
    if (!isSafeUrl(imageUrl)) return null;
    const image = this.image(imageUrl, alt, style, title ?? undefined);
    if (!canOpenUrl(href)) {
      return image;
    }
    return (
      <Fragment key={this.getKey()}>
        {this.inline ? (
          <NativeText
            accessibilityRole="link"
            accessibilityHint="Opens in a new window"
            accessibilityLabel={title ?? alt}
            onPress={() => openSafeUrl(href)}
          >
            {image}
          </NativeText>
        ) : (
          <Pressable
            accessibilityRole="link"
            accessibilityHint="Opens in a new window"
            accessibilityLabel={title ?? alt}
            onPress={() => openSafeUrl(href)}
          >
            {image}
          </Pressable>
        )}
      </Fragment>
    );
  }

  table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    tableStyle?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle,
  ): ReactNode {
    if (!this.inline) {
      return super.table(header, rows, tableStyle, rowStyle, cellStyle);
    }
    const tableRows = [header, ...rows];
    return (
      <NativeText key={this.getKey()}>
        {tableRows.map((row, rowIndex) => (
          <Fragment key={this.getKey()}>
            {row.map((cell, cellIndex) => (
              <Fragment key={this.getKey()}>
                {cellIndex > 0 ? ' | ' : null}
                {cell}
              </Fragment>
            ))}
            {rowIndex < tableRows.length - 1 ? '\n' : null}
          </Fragment>
        ))}
      </NativeText>
    );
  }

  strong(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.strong(children, this.textStyle(style));
  }

  em(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.em(children, this.textStyle(style));
  }

  codespan(text: string, style?: TextStyle): ReactNode {
    return super.codespan(text, this.textStyle(style));
  }

  del(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.del(children, this.textStyle(style));
  }

  text(text: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.text(text, this.textStyle(style));
  }

  html(text: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.html(text, this.textStyle(style));
  }

  private textStyle(
    style?: TextStyle,
    keepColor = false,
  ): TextStyle | undefined {
    return this.inline ? inheritTextStyle(style, keepColor) : style;
  }
}

export function Markdown({ content, inline = false }: MarkdownProps) {
  const { colorScheme } = useColorScheme();
  const renderer = useMemo(() => new SafeRenderer(inline), [inline]);
  const elements = useMarkdown(content, {
    colorScheme,
    renderer,
    hooks: safeUrlHooks,
    styles,
    theme: themes[colorScheme === 'dark' ? 'dark' : 'light'],
  });

  if (!content) return null;
  if (inline) return <>{elements}</>;
  return <View>{elements}</View>;
}
