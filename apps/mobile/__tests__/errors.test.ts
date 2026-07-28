import { apiErrorMessage } from '../lib/errors'

describe('apiErrorMessage', () => {
  it('maps Android connection failures to a friendly message', () => {
    expect(
      apiErrorMessage(
        new Error(
          'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
        ),
      ),
    ).toMatch(/Can't reach the server at http/)
  })

  it('maps the generic RN network error too', () => {
    expect(apiErrorMessage(new Error('Network request failed'))).toMatch(
      /Can't reach the server/,
    )
  })

  it('passes real server messages through', () => {
    expect(apiErrorMessage({ message: 'Invalid email or password' })).toBe(
      'Invalid email or password',
    )
  })

  it('treats a caught connection failure (status 0, no message) as unreachable', () => {
    expect(apiErrorMessage({ status: 0, statusText: '' })).toMatch(
      /Can't reach the server/,
    )
  })

  it('names the status for a server error with an empty body', () => {
    expect(
      apiErrorMessage({ status: 500, statusText: '', message: null }),
    ).toBe('The server hit an error (HTTP 500) — check the API logs.')
  })

  it('prefers the server message over the status when both exist', () => {
    expect(
      apiErrorMessage({ status: 500, message: 'Internal database error' }),
    ).toBe('Internal database error')
  })

  it('falls back when there is no message', () => {
    expect(apiErrorMessage({ message: null })).toBe(
      'An unexpected error occurred',
    )
    expect(apiErrorMessage(undefined)).toBe('An unexpected error occurred')
  })
})
