import z from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'auth.validation.password_min')
  .max(128, 'auth.validation.password_max')
  .regex(/[a-z]/, 'auth.validation.password_lowercase')
  .regex(/[A-Z]/, 'auth.validation.password_uppercase')
  .regex(/[0-9]/, 'auth.validation.password_number')
  .regex(/[^A-Za-z0-9]/, 'auth.validation.password_special');

export const loginSchema = z.object({
  email: z.string().email('auth.validation.invalid_email'),
  password: z.string().min(1, 'auth.validation.password_required'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'auth.validation.name_min'),
    email: z.string().email('auth.validation.invalid_email'),
    password: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'auth.validation.confirm_password_required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation.passwords_mismatch',
    path: ['confirmPassword'],
  });

export type SignupFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;

/** Response of GET /api/auth/check-username, parsed by the clients. */
export const usernameAvailabilitySchema = z.object({ available: z.boolean() });
