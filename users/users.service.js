const bcrypt = require("bcrypt");
const supabase = require("../supabaseClient");
const crypto = require("crypto");

// ⚠️ Ajuste o nome da tabela ('registro_cliente') caso seja diferente
// no seu banco Supabase.

// -----------------------------------------------------------------
// Helper: gera um ID curto para rastrear a operação nos logs
// -----------------------------------------------------------------
function generateOpId() {
  return crypto.randomBytes(4).toString("hex");
}

// -----------------------------------------------------------------
// Helper: envolve qualquer Promise com um timeout + logs detalhados
// -----------------------------------------------------------------
function withTimeout(promise, ms = 8000, label = "operação", opId = "") {
  const startedAt = Date.now();
  console.log(
    `[${opId}] ▶️  INICIANDO: "${label}" | timeout=${ms}ms | ${new Date(startedAt).toISOString()}`,
  );

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const elapsed = Date.now() - startedAt;
      const err = new Error(`Tempo limite excedido ao executar: ${label}`);
      err.status = 504; // Gateway Timeout
      err.code = "TIMEOUT";
      console.error(
        `[${opId}] ⏱️  TIMEOUT: "${label}" | excedeu ${ms}ms (decorrido: ${elapsed}ms) | ${new Date().toISOString()}`,
      );
      reject(err);
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        const elapsed = Date.now() - startedAt;
        const hasError = result && result.error;
        if (hasError) {
          console.error(
            `[${opId}] ❌ ERRO SUPABASE: "${label}" | duração=${elapsed}ms | código=${result.error.code || "N/A"} | mensagem=${result.error.message} | detalhes=${JSON.stringify(result.error.details || {})}`,
          );
        } else {
          const rowCount = Array.isArray(result?.data)
            ? result.data.length
            : result?.data
              ? 1
              : 0;
          console.log(
            `[${opId}] ✅ SUCESSO: "${label}" | duração=${elapsed}ms | registros=${rowCount}`,
          );
        }
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        const elapsed = Date.now() - startedAt;
        console.error(
          `[${opId}] 💥 EXCEÇÃO: "${label}" | duração=${elapsed}ms | mensagem=${error.message} | stack=${error.stack}`,
        );
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

// Mascara e-mail/cpf nos logs para não expor dados sensíveis por completo
function maskEmail(email) {
  if (!email) return email;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskCpf(cpf) {
  if (!cpf) return cpf;
  return cpf.replace(/^(\d{3})\d{5}(\d{2})$/, "$1.***.***-$2");
}

class UsersService {
  async create(createUserDto) {
    const opId = generateOpId();
    const { senha, email, cpf, data_nascimento, ...rest } = createUserDto;

    console.log(`[${opId}] ===== CREATE USER START =====`);
    console.log(
      `[${opId}] Payload recebido | email=${maskEmail(email)} | cpf=${maskCpf(cpf)} | data_nascimento=${data_nascimento || "N/A"} | campos_extra=${Object.keys(rest).join(", ")}`,
    );

    try {
      // 1. Validação de e-mail existente
      const { data: emailExists, error: emailError } = await withTimeout(
        supabase
          .from("registro_cliente")
          .select("id")
          .eq("email", email)
          .maybeSingle(),
        8000,
        "verificar e-mail existente",
        opId,
      );

      if (emailError) {
        console.error(`[${opId}] Falha na validação de e-mail:`, emailError);
        throw emailError;
      }
      if (emailExists) {
        console.warn(
          `[${opId}] ⚠️  E-mail já cadastrado | id_existente=${emailExists.id} | email=${maskEmail(email)}`,
        );
        const err = new Error("E-mail já cadastrado.");
        err.status = 409;
        throw err;
      }
      console.log(`[${opId}] E-mail disponível para cadastro`);

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
          opId,
        );

        if (cpfError) {
          console.error(`[${opId}] Falha na validação de CPF:`, cpfError);
          throw cpfError;
        }
        if (cpfExists) {
          console.warn(
            `[${opId}] ⚠️  CPF já cadastrado | id_existente=${cpfExists.id} | cpf=${maskCpf(cpf)}`,
          );
          const err = new Error("CPF já cadastrado.");
          err.status = 409;
          throw err;
        }
        console.log(`[${opId}] CPF disponível para cadastro`);
      } else {
        console.log(`[${opId}] CPF não informado, pulando validação`);
      }

      // 3. Criptografia de senha
      const hashStart = Date.now();
      const salt = await bcrypt.genSalt(10);
      const senha_hash = await bcrypt.hash(senha, salt);
      console.log(
        `[${opId}] Hash de senha gerado | duração=${Date.now() - hashStart}ms`,
      );

      // 4. Data de nascimento
      const data_nascimento_formatada = data_nascimento
        ? new Date(data_nascimento).toISOString()
        : null;
      console.log(
        `[${opId}] Data de nascimento formatada: ${data_nascimento_formatada}`,
      );

      // 5. Inserção
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
        "criar usuário (insert)",
        opId,
      );

      if (error) {
        console.error(
          `[${opId}] ❌ Falha ao inserir usuário | código=${error.code} | mensagem=${error.message} | detalhes=${JSON.stringify(error.details || {})} | hint=${error.hint || "N/A"}`,
        );
        throw error;
      }

      console.log(
        `[${opId}] ✅ Usuário criado com sucesso | id=${user.id} | email=${maskEmail(user.email)}`,
      );
      console.log(`[${opId}] ===== CREATE USER END =====`);

      return sanitizeUser(user);
    } catch (err) {
      console.error(
        `[${opId}] ===== CREATE USER FALHOU ===== | status=${err.status || 500} | mensagem=${err.message}`,
      );
      throw err;
    }
  }

  async findAll() {
    const opId = generateOpId();
    console.log(`[${opId}] ===== FIND ALL USERS START =====`);

    try {
      const { data: users, error } = await withTimeout(
        supabase.from("registro_cliente").select("*"),
        8000,
        "listar usuários",
        opId,
      );

      if (error) {
        console.error(`[${opId}] ❌ Falha ao listar usuários:`, error);
        throw error;
      }

      console.log(`[${opId}] ✅ ${users.length} usuário(s) encontrado(s)`);
      return users.map(sanitizeUser);
    } catch (err) {
      console.error(
        `[${opId}] ===== FIND ALL FALHOU ===== | mensagem=${err.message}`,
      );
      throw err;
    }
  }

  async findOne(id) {
    const opId = generateOpId();
    console.log(`[${opId}] ===== FIND ONE START ===== | id=${id}`);

    try {
      const { data: user, error } = await withTimeout(
        supabase
          .from("registro_cliente")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
        8000,
        `buscar usuário por id (${id})`,
        opId,
      );

      if (error) {
        console.error(`[${opId}] ❌ Erro ao buscar usuário id=${id}:`, error);
        throw error;
      }

      if (!user) {
        console.warn(`[${opId}] ⚠️  Usuário não encontrado | id=${id}`);
        const err = new Error("Usuário não encontrado.");
        err.status = 404;
        throw err;
      }

      console.log(
        `[${opId}] ✅ Usuário encontrado | id=${id} | email=${maskEmail(user.email)}`,
      );
      return sanitizeUser(user);
    } catch (err) {
      console.error(
        `[${opId}] ===== FIND ONE FALHOU ===== | id=${id} | mensagem=${err.message}`,
      );
      throw err;
    }
  }

  async findByEmailWithPassword(email) {
    const opId = generateOpId();
    console.log(
      `[${opId}] ===== LOGIN: BUSCAR POR EMAIL START ===== | email=${maskEmail(email)}`,
    );

    try {
      const { data: user, error } = await withTimeout(
        supabase
          .from("registro_cliente")
          .select("*")
          .eq("email", email)
          .maybeSingle(),
        8000,
        "buscar usuário para login",
        opId,
      );

      if (error) {
        console.error(
          `[${opId}] ❌ Erro ao buscar usuário para login | email=${maskEmail(email)}:`,
          error,
        );
        throw error;
      }

      if (!user) {
        console.warn(
          `[${opId}] ⚠️  Login falhou: e-mail não encontrado | email=${maskEmail(email)}`,
        );
      } else {
        console.log(
          `[${opId}] ✅ Usuário encontrado para login | id=${user.id} | email=${maskEmail(user.email)} | possui_hash=${!!user.senha_hash}`,
        );
      }

      // aqui mantém a senha_hash de propósito, pro login comparar
      return user;
    } catch (err) {
      console.error(
        `[${opId}] ===== LOGIN BUSCA FALHOU ===== | email=${maskEmail(email)} | mensagem=${err.message}`,
      );
      throw err;
    }
  }

  async update(id, updateUserDto) {
    const opId = generateOpId();
    console.log(
      `[${opId}] ===== UPDATE START ===== | id=${id} | campos=${Object.keys(updateUserDto).join(", ")}`,
    );

    try {
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
        `atualizar usuário (${id})`,
        opId,
      );

      if (error) {
        console.error(
          `[${opId}] ❌ Erro ao atualizar usuário id=${id}:`,
          error,
        );
        throw error;
      }

      if (!user) {
        console.warn(
          `[${opId}] ⚠️  Usuário não encontrado para atualização | id=${id}`,
        );
        const err = new Error("Usuário não encontrado.");
        err.status = 404;
        throw err;
      }

      console.log(`[${opId}] ✅ Usuário atualizado | id=${id}`);
      return sanitizeUser(user);
    } catch (err) {
      console.error(
        `[${opId}] ===== UPDATE FALHOU ===== | id=${id} | mensagem=${err.message}`,
      );
      throw err;
    }
  }

  async remove(id) {
    const opId = generateOpId();
    console.log(`[${opId}] ===== REMOVE START ===== | id=${id}`);

    try {
      await this.findOne(id);

      const { data: user, error } = await withTimeout(
        supabase
          .from("registro_cliente")
          .delete()
          .eq("id", id)
          .select()
          .maybeSingle(),
        8000,
        `remover usuário (${id})`,
        opId,
      );

      if (error) {
        console.error(`[${opId}] ❌ Erro ao remover usuário id=${id}:`, error);
        throw error;
      }

      console.log(`[${opId}] ✅ Usuário removido | id=${id}`);
      return sanitizeUser(user);
    } catch (err) {
      console.error(
        `[${opId}] ===== REMOVE FALHOU ===== | id=${id} | mensagem=${err.message}`,
      );
      throw err;
    }
  }
}

module.exports = new UsersService();
