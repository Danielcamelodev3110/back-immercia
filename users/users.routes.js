const { Router } = require("express");
const usersController = require("./users.controller");

const router = Router();

router.post("/", usersController.create);

// ⚠️ Precisa vir antes de '/:id' pra não ser interpretada como um ID
router.post("/login", usersController.login);

router.get("/", usersController.findAll);
router.get("/:id", usersController.findOne);
router.patch("/:id", usersController.update);
router.delete("/:id", usersController.remove);

module.exports = router;
