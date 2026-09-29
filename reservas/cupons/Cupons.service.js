const supabase = require("../../supabaseClient");
const crypto = require("crypto");

// Tabela "cupons": codigo (único), hash (único), percentual_desconto,
// descricao, categoria, valor_minimo_compra, data_validade, ativo.
// Tabela "cupons_resgates": id_cupom, id_cliente, data_resgate — cada
// cliente só resgata um cupom uma vez (constraint única no banco).

function gerarHash() {
  // Hash único interno do cupom — 32 caracteres hexadecimais.
  return crypto.randomBytes(16).toString("hex");
}

class CuponsService {
  async create(createCupomDto) {
    const {
      codigo,
      percentual_desconto,
      descricao,
      categoria,
      valor_minimo_compra,
      data_validade,
    } = createCupomDto;

    if (!codigo) {
      const err = new Error("codigo é obrigatório.");
      err.status = 400;
      throw err;
    }
    if (percentual_desconto === undefined || percentual_desconto === null) {
      const err = new Error("percentual_desconto é obrigatório.");
      err.status = 400;
      throw err;
    }

    const codigoNormalizado = String(codigo).trim().toUpperCase();

    // Confere se já existe cupom com esse código
    const { data: existente, error: existenteError } = await supabase
      .from("cupons")
      .select("id")
      .eq("codigo", codigoNormalizado)
      .maybeSingle();

    if (existenteError) throw existenteError;
    if (existente) {
      const err = new Error("Já existe um cupom com esse código.");
      err.status = 409;
      throw err;
    }

    const { data: cupom, error } = await supabase
      .from("cupons")
      .insert({
        codigo: codigoNormalizado,
        hash: gerarHash(),
        percentual_desconto,
        descricao: descricao || null,
        categoria: categoria || "Geral",
        valor_minimo_compra: valor_minimo_compra || 0,
        data_validade: data_validade || null,
        ativo: true,
      })
      .select()
      .single();

    if (error) throw error;
    return cupom;
  }

  // Lista cupons ativos e dentro da validade (ou sem validade definida) —
  // é isso que a tela de Cupons no app consome.
  async findAll() {
    const hoje = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("cupons")
      .select("*")
      .eq("ativo", true)
      .or(`data_validade.is.null,data_validade.gte.${hoje}`)
      .order("data_criacao", { ascending: false });

    if (error) throw error;
    return data;
  }

  async findByCodigo(codigo) {
    const { data, error } = await supabase
      .from("cupons")
      .select("*")
      .eq("codigo", String(codigo).trim().toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const err = new Error("Cupom não encontrado.");
      err.status = 404;
      throw err;
    }
    return data;
  }

  // Resgata um cupom pra um cliente específico. Se o cliente já tiver
  // resgatado esse cupom antes, a constraint única em (id_cupom,
  // id_cliente) impede duplicidade e aqui devolvemos um erro 409 claro
  // antes mesmo de tentar inserir.
  async resgatar(idCupom, idCliente) {
    const { data: cupom, error: cupomError } = await supabase
      .from("cupons")
      .select("*")
      .eq("id", idCupom)
      .maybeSingle();

    if (cupomError) throw cupomError;
    if (!cupom || !cupom.ativo) {
      const err = new Error("Cupom não encontrado ou inativo.");
      err.status = 404;
      throw err;
    }

    const { data: jaResgatado, error: jaResgatadoError } = await supabase
      .from("cupons_resgates")
      .select("id")
      .eq("id_cupom", idCupom)
      .eq("id_cliente", idCliente)
      .maybeSingle();

    if (jaResgatadoError) throw jaResgatadoError;
    if (jaResgatado) {
      const err = new Error("Você já resgatou esse cupom antes.");
      err.status = 409;
      throw err;
    }

    const { data: resgate, error: resgateError } = await supabase
      .from("cupons_resgates")
      .insert({ id_cupom: idCupom, id_cliente: idCliente })
      .select()
      .single();

    if (resgateError) throw resgateError;
    return resgate;
  }

  // Valida se um cliente pode USAR um cupom numa compra (chamado tanto
  // pelo carrinho, pra mostrar o desconto, quanto pelo backend de
  // reservas, que nunca confia no que o app calculou). Exige que:
  // - o cupom exista, esteja ativo e dentro da validade
  // - a compra atinja o valor mínimo do cupom
  // - o cliente já tenha resgatado esse cupom (linha em cupons_resgates)
  // - esse resgate ainda não tenha sido usado numa compra anterior
  async validarParaUso(codigo, idCliente, valorCompra) {
    const cupom = await this.findByCodigo(codigo); // já lança 404 se não existir

    if (!cupom.ativo) {
      const err = new Error("Esse cupom não está mais ativo.");
      err.status = 409;
      throw err;
    }

    if (cupom.data_validade) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (cupom.data_validade < hoje) {
        const err = new Error("Esse cupom expirou.");
        err.status = 409;
        throw err;
      }
    }

    if (Number(valorCompra) < Number(cupom.valor_minimo_compra || 0)) {
      const err = new Error(
        `Esse cupom exige compra mínima de R$ ${Number(
          cupom.valor_minimo_compra,
        ).toFixed(2)}.`,
      );
      err.status = 409;
      throw err;
    }

    const { data: resgate, error: resgateError } = await supabase
      .from("cupons_resgates")
      .select("id, usado")
      .eq("id_cupom", cupom.id)
      .eq("id_cliente", idCliente)
      .maybeSingle();

    if (resgateError) throw resgateError;
    if (!resgate) {
      const err = new Error(
        "Resgate esse cupom na tela de Cupons antes de usá-lo.",
      );
      err.status = 409;
      throw err;
    }
    if (resgate.usado) {
      const err = new Error("Você já usou esse cupom antes.");
      err.status = 409;
      throw err;
    }

    return cupom;
  }

  // Marca o resgate de um cupom como usado, vinculado à reserva criada.
  // Chamado só DEPOIS que a reserva é criada com sucesso.
  async marcarComoUsado(idCupom, idCliente, idReserva) {
    const { error } = await supabase
      .from("cupons_resgates")
      .update({ usado: true, id_reserva: idReserva })
      .eq("id_cupom", idCupom)
      .eq("id_cliente", idCliente);

    if (error) throw error;
  }

  // Ids dos cupons que um cliente já resgatou — a tela usa isso pra
  // pintar "usado" sem precisar de uma chamada por cupom.
  async findResgatadosPorCliente(idCliente) {
    const { data, error } = await supabase
      .from("cupons_resgates")
      .select("id_cupom")
      .eq("id_cliente", idCliente);

    if (error) throw error;
    return (data || []).map((r) => r.id_cupom);
  }
}

module.exports = new CuponsService();
