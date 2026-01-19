const express = require('express');
const router = express.Router();
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  updateStock
} = require('../controllers/itemController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getItems)
  .post(createItem);

router.route('/:id')
  .get(getItem)
  .put(updateItem)
  .delete(deleteItem);

router.patch('/:id/stock', updateStock);

module.exports = router;
