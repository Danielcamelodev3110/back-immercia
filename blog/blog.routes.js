const { Router } = require("express");
const blogController = require("./blog.controller");

const router = Router();

router.post("/", blogController.create);
router.get("/", blogController.findAll);
router.get("/:id", blogController.findOne);

module.exports = router;
