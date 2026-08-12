import React from 'react'
import { act, render, fireEvent, waitFor } from '@testing-library/react-native'
import Login from '@/app/login'

const mockReplace = jest.fn()

// expo-router isn't available in the test env; stub the pieces the screen uses.
jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    useRouter: () => ({ replace: mockReplace }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  }
})

// The real auth client pulls in native modules; mock it like web does in setup.ts.
const mockSignIn = jest.fn(
  async (): Promise<{ error: { message?: string } | null }> => ({
    error: null,
  }),
)

// What useSession returns; tests mutate this to simulate the session arriving.
let mockSession: { data: { user: { name: string } } | null; isPending: boolean }

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: { email: () => mockSignIn() },
    useSession: () => mockSession,
  },
}))

beforeEach(() => {
  mockSession = { data: null, isPending: false }
  mockReplace.mockClear()
})

describe('Login screen', () => {
  it('navigates to the dashboard only once the session exists', async () => {
    const { getByText, getByPlaceholderText, rerender } = render(<Login />)
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Your password'), 'Password123*')
    fireEvent.press(getByText('Log in'))
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
    await act(async () => {})

    // Login succeeded but the session store hasn't caught up yet - jumping
    // now is the race that bounces users back to /login.
    expect(mockReplace).not.toHaveBeenCalled()

    mockSession = { data: { user: { name: 'Jane Doe' } }, isPending: false }
    rerender(<Login />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'))
  })

  it('renders the card and both fields', () => {
    const { getByText, getByPlaceholderText } = render(<Login />)
    expect(getByText('Welcome back')).toBeTruthy()
    expect(getByPlaceholderText('you@example.com')).toBeTruthy()
    expect(getByPlaceholderText('Your password')).toBeTruthy()
  })

  it('shows a validation error for an invalid email on submit', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<Login />)
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'not-an-email',
    )
    fireEvent.press(getByText('Log in'))
    expect(await findByText('Please enter a valid email address')).toBeTruthy()
  })

  it('shows a friendly message when the server is unreachable', async () => {
    mockSignIn.mockRejectedValueOnce(
      new Error(
        'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
      ),
    )
    const { getByText, getByPlaceholderText, findByText } = render(<Login />)
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Your password'), 'Password123*')
    fireEvent.press(getByText('Log in'))
    expect(await findByText(/Can't reach the server/)).toBeTruthy()
  })

  it('shows the server message on an API error', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Invalid email or password' },
    })
    const { getByText, getByPlaceholderText, findByText } = render(<Login />)
    fireEvent.changeText(
      getByPlaceholderText('you@example.com'),
      'jane@example.com',
    )
    fireEvent.changeText(getByPlaceholderText('Your password'), 'Password123*')
    fireEvent.press(getByText('Log in'))
    expect(await findByText('Invalid email or password')).toBeTruthy()
  })
})
