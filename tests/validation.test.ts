import { describe, expect, it } from 'vitest';
import { emailSchema, minecraftUsernameSchema, passwordSchema, registrationSchema } from '../src/domain/validation.js';

describe('validação de cadastro', () => {
  it('aceita um cadastro válido', () => {
    const result = registrationSchema.safeParse({
      email: 'Jogador@Example.com',
      minecraftUsername: 'gnomoteste',
      password: 'SenhaSegura123',
      passwordConfirmation: 'SenhaSegura123'
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('jogador@example.com');
  });

  it('bloqueia comandos no nome do Minecraft', () => {
    expect(minecraftUsernameSchema.safeParse('jogador whitelist op').success).toBe(false);
    expect(minecraftUsernameSchema.safeParse('jogador;stop').success).toBe(false);
  });

  it('limita o nome do Minecraft a 16 caracteres', () => {
    expect(minecraftUsernameSchema.safeParse('a'.repeat(17)).success).toBe(false);
  });

  it('exige uma senha adequada', () => {
    expect(passwordSchema.safeParse('fraca').success).toBe(false);
    expect(passwordSchema.safeParse('SenhaSegura123').success).toBe(true);
  });

  it('normaliza e valida o e-mail', () => {
    expect(emailSchema.parse(' JOGADOR@EXAMPLE.COM ')).toBe('jogador@example.com');
  });
});

