import React from 'react'
import { act, render, fireEvent, waitFor } from '@testing-library/react-native'
import Register from '@/app/register'

const mockReplace = jest.fn()

jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    useRouter: () => ({ replace: mockReplace }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  }
})

const mockSignUp = jest.fn(
  async (): Promise<{ error: { message?: string } | null }> => ({
    error: null,
  }),
)

// What useSession returns; tests mutate this to simulate the session arriving.
let mockSession: { data: { user: { name: string } } | null; isPending: boolean }

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signUp: { email: () => mockSignUp() },
    useSession: () => mockSession,
  },
}))

beforeEach(() => {
  mockSession = { data: null, isPending: false }
  mockReplace.mockClear()
})

describe('Register screen', () => {
  it('navigates to the dashboard only once the session exists', async () => {
    const { getByRole, getByPlaceholderText, rerender } = render(<Register />)
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane Doe')
    fireEvent.changeText(getByPlaceholderText('jane_doe'), 'jane_doe')
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Create a password'), 'Abcdef1!')
    fireEvent.changeText(
      getByPlaceholderText('Repeat your password'),
      'Abcdef1!',
    )
    fireEvent.press(getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled())
    await act(async () => {})

    // Signup succeeded but the session store hasn't caught up yet - jumping
    // now is the race that bounces users back to /login.
    expect(mockReplace).not.toHaveBeenCalled()

    mockSession = { data: { user: { name: 'Jane Doe' } }, isPending: false }
    rerender(<Register />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows an error when the passwords do not match', async () => {
    const { getByRole, getByPlaceholderText, findByText } = render(<Register />)
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane Doe')
    fireEvent.changeText(getByPlaceholderText('jane_doe'), 'jane_doe')
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Create a password'), 'Abcdef1!')
    fireEvent.changeText(
      getByPlaceholderText('Repeat your password'),
      'Abcdef2!',
    )
    fireEvent.press(getByRole('button', { name: 'Create account' }))
    expect(await findByText('Passwords do not match')).toBeTruthy()
  })

  it('shows a friendly message when the server is unreachable', async () => {
    mockSignUp.mockRejectedValueOnce(
      new Error(
        'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
      ),
    )
    const { getByRole, getByPlaceholderText, findByText } = render(<Register />)
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane Doe')
    fireEvent.changeText(getByPlaceholderText('jane_doe'), 'jane_doe')
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Create a password'), 'Abcdef1!')
    fireEvent.changeText(
      getByPlaceholderText('Repeat your password'),
      'Abcdef1!',
    )
    fireEvent.press(getByRole('button', { name: 'Create account' }))
    expect(await findByText(/Can't reach the server/)).toBeTruthy()
  })
})
