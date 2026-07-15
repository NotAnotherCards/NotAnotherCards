import { execFileSync } from 'node:child_process';

describe('@repo/schemas wiring', () => {
  it('imports and validates auth schemas', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { loginSchema, registerSchema } from '@repo/schemas';

          const result = {
            login: loginSchema.safeParse({
              email: 'test@example.com',
              password: 'secret',
            }).success,
            register: registerSchema.safeParse({
              name: 'Test User',
              email: 'test@example.com',
              password: 'Password123*',
              confirmPassword: 'Password123*',
            }).success,
          };

          console.log(JSON.stringify(result));
        `,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(JSON.parse(output)).toEqual({
      login: true,
      register: true,
    });
  });
});
