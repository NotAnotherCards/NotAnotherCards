import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { InfoPanel } from '@/components/info-panel';

type Element = ReturnType<ReturnType<typeof render>['getByText']>;

// A host view with accessible={true} is read as one element: everything
// inside it is merged into its label, and the text cannot be reached.
function mergedByAncestor(node: Element): boolean {
  for (let at = node.parent; at; at = at.parent) {
    if (typeof at.type === 'string' && at.props.accessible === true) {
      return true;
    }
  }
  return false;
}

describe('InfoPanel', () => {
  const panel = (onClose = jest.fn()) =>
    render(
      <InfoPanel title="How daily goals count" onClose={onClose}>
        <Text>Daily challenges reset at 00:00 UTC.</Text>
      </InfoPanel>,
    );

  it('lets a screen reader reach the title and the text', () => {
    const { getByText } = panel();
    expect(mergedByAncestor(getByText('How daily goals count'))).toBe(false);
    expect(
      mergedByAncestor(getByText('Daily challenges reset at 00:00 UTC.')),
    ).toBe(false);
  });

  it('offers a Close button to a screen reader', () => {
    const onClose = jest.fn();
    const { getByRole } = panel(onClose);
    fireEvent.press(getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap on the panel itself too', () => {
    const onClose = jest.fn();
    const { getByText } = panel(onClose);
    fireEvent.press(getByText('Daily challenges reset at 00:00 UTC.'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
