import { z } from 'zod';

export const minecraftUsernameSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres.')
  .max(16, 'O nome deve ter no máximo 16 caracteres.')
  .regex(/^[A-Za-z0-9_]+$/, 'Use apenas letras, números e sublinhado.');

export const emailSchema = z.string().trim().toLowerCase().email('Informe um e-mail válido.');

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')
  .regex(/[a-z]/, 'Inclua pelo menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua pelo menos uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua pelo menos um número.');

export const registrationSchema = z
  .object({
    email: emailSchema,
    minecraftUsername: minecraftUsernameSchema,
    password: passwordSchema,
    passwordConfirmation: z.string()
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não conferem.'
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.').max(128)
});

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message);
}

