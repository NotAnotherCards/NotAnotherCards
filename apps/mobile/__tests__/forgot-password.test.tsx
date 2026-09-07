import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ForgotPassword from '@/app/forgot-password';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: jest.fn() }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

const mockRequestReset = jest.fn(
  async (_input: unknown): Promise<{ error: { message?: string } | null }> => ({
    error: null,
  }),
);

jest.mock('../lib/auth-client', () => ({
  authClient: {
    requestPasswordReset: (input: unknown) => mockRequestReset(input),
  },
}));

beforeEach(() => mockRequestReset.mockClear());

describe('Forgot password screen', () => {
  it('asks the API for a reset email and confirms', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(
      <ForgotPassword />,
    );
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.press(getByText('Send reset email'));

    expect(await findByText('Check your email')).toBeTruthy();
    // the reset page is the web's; the API builds the link itself
    expect(mockRequestReset).toHaveBeenCalledWith({
      email: 'jane@example.com',
    });
  });

  it('shows the message when the request fails', async () => {
    mockRequestReset.mockResolvedValueOnce({
      error: { message: 'Too many requests' },
    });
    const { getByPlaceholderText, getByText, findByText, queryByText } = render(
      <ForgotPassword />,
    );
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.press(getByText('Send reset email'));

    expect(await findByText('Too many requests')).toBeTruthy();
    expect(queryByText('Check your email')).toBeNull();
  });

  it('rejects an invalid email before calling the API', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(
      <ForgotPassword />,
    );
    fireEvent.changeText(getByPlaceholderText('name@example.com'), 'nope');
    fireEvent.press(getByText('Send reset email'));

    expect(await findByText('Please enter a valid email address')).toBeTruthy();
    await waitFor(() => expect(mockRequestReset).not.toHaveBeenCalled());
  });
});
