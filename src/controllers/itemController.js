const Item = require('../models/Item');

// @desc    Get all items
// @route   GET /api/items
// @access  Private
exports.getItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;

    // Search functionality
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { hsnCode: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Item.countDocuments(query);

    res.json({
      items,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single item
// @route   GET /api/items/:id
// @access  Private
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, user: req.user._id });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create item
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
  try {
    req.body.user = req.user._id;
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update item stock
// @route   PATCH /api/items/:id/stock
// @access  Private
exports.updateStock = async (req, res) => {
  try {
    const { quantity, weight, bags, operation } = req.body;
    const item = await Item.findOne({ _id: req.params.id, user: req.user._id });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (operation === 'add') {
      item.stock.quantity += quantity || 0;
      item.stock.weight += weight || 0;
      item.stock.bags += bags || 0;
    } else if (operation === 'subtract') {
      item.stock.quantity -= quantity || 0;
      item.stock.weight -= weight || 0;
      item.stock.bags -= bags || 0;
    } else {
      item.stock.quantity = quantity !== undefined ? quantity : item.stock.quantity;
      item.stock.weight = weight !== undefined ? weight : item.stock.weight;
      item.stock.bags = bags !== undefined ? bags : item.stock.bags;
    }

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
