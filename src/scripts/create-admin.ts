import bcrypt from 'bcryptjs';
import { input, password } from '@inquirer/prompts';
import { emailSchema, minecraftUsernameSchema, passwordSchema } from '../domain/validation.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/pool.js';
import { UserRepository } from '../repositories/users.js';

try {
  await runMigrations(pool);

  const email = emailSchema.parse(await input({ message: 'E-mail do administrador:' }));
  const minecraftUsername = minecraftUsernameSchema.parse(await input({ message: 'Nome administrativo (3 a 16 caracteres):' }));
  const adminPassword = passwordSchema.parse(await password({ message: 'Senha do portal:', mask: '*' }));
  const confirmation = await password({ message: 'Confirme a senha:', mask: '*' });

  if (adminPassword !== confirmation) throw new Error('As senhas não conferem.');

  const users = new UserRepository(pool);
  await users.createAdmin(email, minecraftUsername, await bcrypt.hash(adminPassword, 12));
  console.log('Administrador criado com sucesso.');
} finally {
  await pool.end();
}
