import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Login from '../app/login'

// expo-router isn't available in the test env; stub the pieces the screen uses.
jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    useRouter: () => ({ replace: jest.fn() }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  }
})

// The real auth client pulls in native modules; mock it like web does in setup.ts.
jest.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: { email: jest.fn(async () => ({ error: null })) },
  },
}))

describe('Login screen', () => {
  it('renders the card and both fields', () => {
    const { getByText, getByPlaceholderText } = render(<Login />)
    expect(getByText('Welcome back')).toBeTruthy()
    expect(getByPlaceholderText('you@example.com')).toBeTruthy()
    expect(getByPlaceholderText('Your password')).toBeTruthy()
  })

  it('shows a validation error for an invalid email on submit', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<Login />)
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'not-an-email')
    fireEvent.press(getByText('Log in'))
    expect(
      await findByText('Please enter a valid email address'),
    ).toBeTruthy()
  })
})
