import React from 'react';
import { render } from '@testing-library/react-native';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('gives multiline fields room without changing single-line fields', () => {
    const { getByTestId } = render(
      <>
        <Input testID="multiline" multiline value={'Question\nMore detail'} />
        <Input testID="single" value="Title" />
      </>,
    );
    const multiline = getByTestId('multiline');
    expect(multiline.props.className).toContain('min-h-24');
    expect(multiline.props.className).not.toMatch(/\bh-10\b|sm:h-9/);
    expect(multiline.props.textAlignVertical).toBe('top');
    expect(multiline.props.value).toBe('Question\nMore detail');
    const single = getByTestId('single');
    expect(single.props.className).toContain('h-10');
    expect(single.props.className).toContain('sm:h-9');
    expect(single.props.textAlignVertical).toBeUndefined();
  });
});
