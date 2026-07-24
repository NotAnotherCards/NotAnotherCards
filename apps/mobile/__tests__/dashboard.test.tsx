import React from 'react'
import { render } from '@testing-library/react-native'
import Dashboard from '../app/dashboard'

const mockUseSession = jest.fn()

jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signOut: jest.fn(),
  },
}))

jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    useRouter: () => ({ replace: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
  }
})

describe('Dashboard screen', () => {
  it('redirects to login when there is no session', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })
    const { getByText } = render(<Dashboard />)
    expect(getByText('redirect:/login')).toBeTruthy()
  })

  it('shows the user when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', email: 'jane@example.com' } },
      isPending: false,
    })
    const { getByText } = render(<Dashboard />)
    expect(getByText('Jane Doe')).toBeTruthy()
    expect(getByText(/jane@example.com/)).toBeTruthy()
  })
})
