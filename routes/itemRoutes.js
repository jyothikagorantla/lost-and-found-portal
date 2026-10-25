const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { itemValidationRules } = require('../middleware/validation');

// Specific paths before dynamic parameters
router.get('/', itemController.browseItems);
router.get('/report-lost', ensureAuthenticated, itemController.showCreateForm);
router.get('/report-found', ensureAuthenticated, itemController.showCreateForm);
router.get('/new', ensureAuthenticated, itemController.showCreateForm);
router.get('/my-reports', ensureAuthenticated, itemController.showMyReports);

// Create item
router.post(
  '/',
  ensureAuthenticated,
  upload.single('image'),
  itemValidationRules,
  itemController.createItem
);

// Show single item
router.get('/:id', itemController.showItem);

// Edit item
router.get('/:id/edit', ensureAuthenticated, itemController.showEditForm);
router.post(
  '/:id/update',
  ensureAuthenticated,
  upload.single('image'),
  itemValidationRules,
  itemController.updateItem
);
router.put(
  '/:id',
  ensureAuthenticated,
  upload.single('image'),
  itemValidationRules,
  itemController.updateItem
);

// Delete item
router.post('/:id/delete', ensureAuthenticated, itemController.deleteItem);
router.delete('/:id', ensureAuthenticated, itemController.deleteItem);

// Mark item resolved
router.post('/:id/resolve', ensureAuthenticated, itemController.markAsResolved);

module.exports = router;
