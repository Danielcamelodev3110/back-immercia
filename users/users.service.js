const bcrypt = require('bcrypt');
const supabase = require('../supabaseClient');

// ⚠️ Ajuste o nome da tabela ('registro_cliente') caso seja diferente
// no seu banco Supabase.

function sanitizeUser(user) {
  if (!user) return user;
  const sanitized = { ...user };
  delete sanitized.senha_hash;
  return sanitized;
}

class UsersService {
  async create(createUserDto) {
    const { senha, email, cpf, data_nascimento, ...rest } = createUserDto;

    // 1. Validação de e-mail existente
    const { data: emailExists, error: emailError } = await supabase
      .from('registro_cliente')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailError) throw emailError;
    if (emailExists) {
      const err = new Error('E-mail já cadastrado.');
      err.status = 409; // Conflict
      throw err;
    }

    // 2. Validação de CPF existente
    if (cpf) {
      const { data: cpfExists, error: cpfError } = await supabase
        .from('registro_cliente')
        .select('id')
        .eq('cpf', cpf)
        .maybeSingle();

      if (cpfError) throw cpfError;
      if (cpfExists) {
        const err = new Error('CPF já cadastrado.');
        err.status = 409;
        throw err;
      }
    }

    // 3. Criptografia de senha
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    // 4. Data de nascimento: se vier só YYYY-MM-DD, o Postgres já aceita
    // como string diretamente numa coluna date/timestamp.
    const data_nascimento_formatada = data_nascimento
      ? new Date(data_nascimento).toISOString()
      : null;

    const { data: user, error } = await supabase
      .from('registro_cliente')
      .insert({
        ...rest,
        email,
        cpf,
        senha_hash,
        data_nascimento: data_nascimento_formatada,
      })
      .select()
      .single();

    if (error) throw error;

    return sanitizeUser(user);
  }

  async findAll() {
    const { data: users, error } = await supabase
      .from('registro_cliente')
      .select('*');

    if (error) throw error;

    return users.map(sanitizeUser);
  }

  async findOne(id) {
    const { data: user, error } = await supabase
      .from('registro_cliente')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      const err = new Error('Usuário não encontrado.');
      err.status = 404;
      throw err;
    }

    return sanitizeUser(user);
  }

  async findByEmailWithPassword(email) {
    const { data: user, error } = await supabase
      .from('registro_cliente')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    return user; // aqui mantém a senha_hash de propósito, pro login comparar
  }

  async update(id, updateUserDto) {
    const { data: user, error } = await supabase
      .from('registro_cliente')
      .update({
        nome_completo: updateUserDto.nome_completo,
        email: updateUserDto.email,
        telefone: updateUserDto.telefone,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      const err = new Error('Usuário não encontrado.');
      err.status = 404;
      throw err;
    }

    return sanitizeUser(user);
  }

  async remove(id) {
    // Garante que existe antes de deletar (equivalente ao findOne do Nest)
    await this.findOne(id);

    const { data: user, error } = await supabase
      .from('registro_cliente')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return sanitizeUser(user);
  }
}

module.exports = new UsersService();
