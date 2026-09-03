const bcrypt = require('bcrypt');
const usersService = require('./users.service');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  const user = await usersService.create(req.body);
  res.status(201).json(user);
});

// POST /users/login
exports.login = asyncHandler(async (req, res) => {
  const { email, senha } = req.body;

  const user = await usersService.findByEmailWithPassword(email);
  if (!user) {
    const err = new Error('E-mail ou senha incorretos.');
    err.status = 401; // Unauthorized
    throw err;
  }

  const passwordMatch = await bcrypt.compare(senha, user.senha_hash);
  if (!passwordMatch) {
    const err = new Error('E-mail ou senha incorretos.');
    err.status = 401;
    throw err;
  }

  // Desestruturação estável: separa senha_hash e mantém só o resto
  const { senha_hash, ...sanitizedUser } = user;

  res.json({
    message: 'Login realizado com sucesso!',
    user: sanitizedUser,
  });
});

exports.findAll = asyncHandler(async (req, res) => {
  const users = await usersService.findAll();
  res.json(users);
});

exports.findOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await usersService.findOne(id);
  res.json(user);
});

exports.update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await usersService.update(id, req.body);
  res.json(user);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await usersService.remove(id);
  res.json(user);
});
