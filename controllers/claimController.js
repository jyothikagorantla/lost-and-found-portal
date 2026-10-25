const Claim = require('../models/Claim');
const Item = require('../models/Item');
const notificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');

const claimController = {
  /**
   * Render claim submission form for an item
   */
  async showCreateForm(req, res) {
    try {
      const item = await Item.findById(req.params.itemId).populate('reportedBy', 'name');

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items');
      }

      const userId = req.session.user._id.toString();

      // Cannot claim own item
      if (item.reportedBy._id.toString() === userId) {
        req.flash('error', 'You cannot submit an ownership claim on your own report.');
        return res.redirect(`/items/${item._id}`);
      }

      // Check if already claimed or resolved
      if (item.status === 'resolved') {
        req.flash('error', 'This item has already been marked as resolved and recovered.');
        return res.redirect(`/items/${item._id}`);
      }

      // Check if user already submitted a pending claim
      const existingClaim = await Claim.findOne({
        item: item._id,
        claimant: userId,
        status: { $in: ['pending', 'approved'] },
      });

      if (existingClaim) {
        req.flash('info', 'You already have an active or approved claim for this item.');
        return res.redirect(`/items/${item._id}`);
      }

      res.render('claims/create', {
        title: `Claim Ownership: ${item.title} - Lost & Found Portal`,
        item,
        errors: [],
        formData: {},
      });
    } catch (err) {
      console.error('[ClaimController.showCreateForm]', err);
      req.flash('error', 'Error opening claim form.');
      res.redirect('/items');
    }
  },

  /**
   * Submit an ownership claim
   */
  async createClaim(req, res) {
    const errors = validationResult(req);
    const { explanation } = req.body;
    const itemId = req.params.itemId;
    const userId = req.session.user._id.toString();

    try {
      const item = await Item.findById(itemId).populate('reportedBy');

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items');
      }

      if (item.reportedBy._id.toString() === userId) {
        req.flash('error', 'You cannot submit an ownership claim on your own report.');
        return res.redirect(`/items/${item._id}`);
      }

      // Check for duplicate pending claim
      const existingClaim = await Claim.findOne({
        item: item._id,
        claimant: userId,
        status: 'pending',
      });

      if (existingClaim) {
        req.flash('error', 'You already have a pending claim for this item.');
        return res.redirect(`/items/${item._id}`);
      }

      if (!errors.isEmpty()) {
        return res.status(422).render('claims/create', {
          title: `Claim Ownership: ${item.title}`,
          item,
          errors: errors.array(),
          formData: { explanation },
        });
      }

      let evidenceImage = '';
      if (req.file) {
        evidenceImage = `/uploads/${req.file.filename}`;
      }

      const claim = await Claim.create({
        item: item._id,
        claimant: userId,
        explanation,
        evidenceImage,
        status: 'pending',
      });

      // Increment claimCount on Item
      await Item.findByIdAndUpdate(item._id, { $inc: { claimCount: 1 } });

      // Notify the item's reporter
      await notificationService.create({
        recipient: item.reportedBy._id,
        message: `${req.session.user.name} submitted an ownership claim for your report "${item.title}". Please review it.`,
        type: 'claim_submitted',
        relatedItem: item._id,
        relatedClaim: claim._id,
      });

      req.flash(
        'success',
        'Your ownership claim has been submitted successfully! The reporter or an administrator will review your evidence.'
      );
      return res.redirect(`/claims/my-claims`);
    } catch (err) {
      console.error('[ClaimController.createClaim]', err);
      req.flash('error', 'Error submitting claim.');
      return res.redirect(`/items/${itemId}`);
    }
  },

  /**
   * View logged-in user's claims
   */
  async showMyClaims(req, res) {
    try {
      const userId = req.session.user._id;

      const claims = await Claim.find({ claimant: userId })
        .populate('item')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 });

      res.render('claims/index', {
        title: 'My Claims - Lost & Found Portal',
        claims,
      });
    } catch (err) {
      console.error('[ClaimController.showMyClaims]', err);
      req.flash('error', 'Could not load your claims.');
      res.redirect('/dashboard');
    }
  },

  /**
   * View single claim details
   */
  async showClaim(req, res) {
    try {
      const claim = await Claim.findById(req.params.id)
        .populate({
          path: 'item',
          populate: { path: 'reportedBy', select: 'name email phone' },
        })
        .populate('claimant', 'name email phone createdAt')
        .populate('reviewedBy', 'name email');

      if (!claim) {
        req.flash('error', 'Claim not found.');
        return res.redirect('/dashboard');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isClaimant = claim.claimant._id.toString() === currentUserId;
      const isItemReporter =
        claim.item && claim.item.reportedBy && claim.item.reportedBy._id.toString() === currentUserId;

      // Access control: only claimant, reporter of the item, or admin can view
      if (!isClaimant && !isItemReporter && !isAdmin) {
        req.flash('error', 'Unauthorized access to claim details.');
        return res.status(403).redirect('/dashboard');
      }

      res.render('claims/show', {
        title: `Claim Details - ${claim.item ? claim.item.title : 'Item'}`,
        claim,
        isClaimant,
        isItemReporter,
        isAdmin,
      });
    } catch (err) {
      console.error('[ClaimController.showClaim]', err);
      req.flash('error', 'Error fetching claim.');
      res.redirect('/dashboard');
    }
  },

  /**
   * Review claim (Approve or Reject) by Item Reporter or Admin
   */
  async reviewClaim(req, res) {
    const { status, reviewNotes } = req.body;
    const claimId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      req.flash('error', 'Invalid claim status action.');
      return res.redirect(`/claims/${claimId}`);
    }

    try {
      const claim = await Claim.findById(claimId).populate('item').populate('claimant');

      if (!claim) {
        req.flash('error', 'Claim not found.');
        return res.redirect('/dashboard');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isItemReporter =
        claim.item && claim.item.reportedBy && claim.item.reportedBy.toString() === currentUserId;

      if (!isItemReporter && !isAdmin) {
        req.flash('error', 'Unauthorized: Only the item reporter or an admin can review this claim.');
        return res.status(403).redirect(`/claims/${claimId}`);
      }

      // Update claim
      claim.status = status;
      claim.reviewNotes = reviewNotes || '';
      claim.reviewedBy = currentUserId;
      claim.reviewedAt = new Date();
      await claim.save();

      // If approved, update Item status to 'claimed'
      if (status === 'approved' && claim.item) {
        await Item.findByIdAndUpdate(claim.item._id, { status: 'claimed' });
      }

      // Notify claimant of the decision
      await notificationService.create({
        recipient: claim.claimant._id,
        message: `Your ownership claim for "${claim.item.title}" was ${status.toUpperCase()}.${
          reviewNotes ? ` Note: "${reviewNotes}"` : ''
        }`,
        type: status === 'approved' ? 'claim_approved' : 'claim_rejected',
        relatedItem: claim.item._id,
        relatedClaim: claim._id,
      });

      req.flash('success', `Claim has been ${status} successfully.`);
      return res.redirect(`/claims/${claimId}`);
    } catch (err) {
      console.error('[ClaimController.reviewClaim]', err);
      req.flash('error', 'Error updating claim decision.');
      res.redirect(`/claims/${claimId}`);
    }
  },
};

module.exports = claimController;
