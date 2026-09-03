const bcrypt = require("bcrypt");
const supabase = require("../supabaseClient");

// ⚠️ Ajuste o nome da tabela ('registro_cliente') caso seja diferente
// no seu banco Supabase.

// -----------------------------------------------------------------
// Helper: envolve qualquer Promise com um timeout.
// Se a operação não resolver dentro do tempo definido, rejeita
// com um erro específico (status 504) em vez de ficar pendurada.
// -----------------------------------------------------------------
function withTimeout(promise, ms = 8000, label = "operação") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Tempo limite excedido ao executar: ${label}`);
      err.status = 504; // Gateway Timeout
      err.code = "TIMEOUT";
      reject(err);
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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
    const { data: emailExists, error: emailError } = await withTimeout(
      supabase
        .from("registro_cliente")
        .select("id")
        .eq("email", email)
        .maybeSingle(),
      8000,
      "verificar e-mail existente",
    );

    if (emailError) throw emailError;
    if (emailExists) {
      const err = new Error("E-mail já cadastrado.");
      err.status = 409; // Conflict
      throw err;
    }

    // 2. Validação de CPF existente
    if (cpf) {
      const { data: cpfExists, error: cpfError } = await withTimeout(
        supabase
          .from("registro_cliente")
          .select("id")
          .eq("cpf", cpf)
          .maybeSingle(),
        8000,
        "verificar CPF existente",
      );

      if (cpfError) throw cpfError;
      if (cpfExists) {
        const err = new Error("CPF já cadastrado.");
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

    const { data: user, error } = await withTimeout(
      supabase
        .from("registro_cliente")
        .insert({
          ...rest,
          email,
          cpf,
          senha_hash,
          data_nascimento: data_nascimento_formatada,
        })
        .select()
        .single(),
      10000,
      "criar usuário",
    );

    if (error) throw error;

    return sanitizeUser(user);
  }

  async findAll() {
    const { data: users, error } = await withTimeout(
      supabase.from("registro_cliente").select("*"),
      8000,
      "listar usuários",
    );

    if (error) throw error;

    return users.map(sanitizeUser);
  }

  async findOne(id) {
    const { data: user, error } = await withTimeout(
      supabase.from("registro_cliente").select("*").eq("id", id).maybeSingle(),
      8000,
      "buscar usuário por id",
    );

    if (error) throw error;

    if (!user) {
      const err = new Error("Usuário não encontrado.");
      err.status = 404;
      throw err;
    }

    return sanitizeUser(user);
  }

  async findByEmailWithPassword(email) {
    const { data: user, error } = await withTimeout(
      supabase
        .from("registro_cliente")
        .select("*")
        .eq("email", email)
        .maybeSingle(),
      8000,
      "buscar usuário para login",
    );

    if (error) throw error;

    return user; // aqui mantém a senha_hash de propósito, pro login comparar
  }

  async update(id, updateUserDto) {
    const { data: user, error } = await withTimeout(
      supabase
        .from("registro_cliente")
        .update({
          nome_completo: updateUserDto.nome_completo,
          email: updateUserDto.email,
          telefone: updateUserDto.telefone,
        })
        .eq("id", id)
        .select()
        .maybeSingle(),
      8000,
      "atualizar usuário",
    );

    if (error) throw error;

    if (!user) {
      const err = new Error("Usuário não encontrado.");
      err.status = 404;
      throw err;
    }

    return sanitizeUser(user);
  }

  async remove(id) {
    // Garante que existe antes de deletar (equivalente ao findOne do Nest)
    await this.findOne(id);

    const { data: user, error } = await withTimeout(
      supabase
        .from("registro_cliente")
        .delete()
        .eq("id", id)
        .select()
        .maybeSingle(),
      8000,
      "remover usuário",
    );

    if (error) throw error;

    return sanitizeUser(user);
  }
}

module.exports = new UsersService();
