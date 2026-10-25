const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  claimValidationRules,
  claimReviewValidationRules,
} = require('../middleware/validation');

// My claims
router.get('/my-claims', ensureAuthenticated, claimController.showMyClaims);

// Claim an item
router.get('/item/:itemId/create', ensureAuthenticated, claimController.showCreateForm);
router.post(
  '/item/:itemId',
  ensureAuthenticated,
  upload.single('evidenceImage'),
  claimValidationRules,
  claimController.createClaim
);

// View single claim
router.get('/:id', ensureAuthenticated, claimController.showClaim);

// Review claim (approve / reject)
router.post(
  '/:id/review',
  ensureAuthenticated,
  claimReviewValidationRules,
  claimController.reviewClaim
);

module.exports = router;
