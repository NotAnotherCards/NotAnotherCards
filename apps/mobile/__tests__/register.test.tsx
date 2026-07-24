import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Register from '../app/register'

jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    useRouter: () => ({ replace: jest.fn() }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  }
})

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signUp: { email: jest.fn(async () => ({ error: null })) },
  },
}))

describe('Register screen', () => {
  it('shows an error when the passwords do not match', async () => {
    const { getByRole, getByPlaceholderText, findByText } = render(<Register />)
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane Doe')
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'jane@example.com')
    fireEvent.changeText(getByPlaceholderText('Create a password'), 'Abcdef1!')
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), 'Abcdef2!')
    fireEvent.press(getByRole('button', { name: 'Create account' }))
    expect(await findByText('Passwords do not match')).toBeTruthy()
  })
})
