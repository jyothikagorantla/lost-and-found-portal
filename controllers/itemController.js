const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const matchingService = require('../services/matchingService');
const notificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const itemController = {
  /**
   * Home page view with real DB statistics and recent items
   */
  async showHome(req, res) {
    try {
      const [totalReports, resolvedCount, activeCount, recentLost, recentFound] = await Promise.all([
        Item.countDocuments({ status: { $ne: 'rejected' } }),
        Item.countDocuments({ status: 'resolved' }),
        Item.countDocuments({ status: 'active' }),
        Item.find({ type: 'lost', status: 'active' }).sort({ createdAt: -1 }).limit(4),
        Item.find({ type: 'found', status: 'active' }).sort({ createdAt: -1 }).limit(4),
      ]);

      res.render('index', {
        title: 'Lost & Found Portal - Connect Lost Items with Owners',
        stats: {
          totalReports,
          resolvedCount,
          activeCount,
        },
        recentLost,
        recentFound,
        categories: Item.CATEGORIES,
      });
    } catch (err) {
      console.error('[ItemController.showHome]', err);
      res.render('index', {
        title: 'Lost & Found Portal',
        stats: { totalReports: 0, resolvedCount: 0, activeCount: 0 },
        recentLost: [],
        recentFound: [],
        categories: Item.CATEGORIES,
      });
    }
  },

  /**
   * Browse and Search Items with filters, sorting, and pagination
   */
  async browseItems(req, res) {
    try {
      const {
        q = '',
        type = '',
        category = '',
        location = '',
        status = '',
        startDate = '',
        endDate = '',
        sort = 'newest',
        page = 1,
      } = req.query;

      const currentPage = Math.max(1, parseInt(page, 10) || 1);
      const limit = 9;
      const skip = (currentPage - 1) * limit;

      const filter = {};

      // Do not show rejected items to regular users
      filter.status = { $ne: 'rejected' };

      // Type filter (lost, found)
      if (type && ['lost', 'found'].includes(type.toLowerCase())) {
        filter.type = type.toLowerCase();
      }

      // Category filter
      if (category && Item.CATEGORIES.includes(category)) {
        filter.category = category;
      }

      // Status filter
      if (status && ['active', 'claimed', 'resolved'].includes(status.toLowerCase())) {
        filter.status = status.toLowerCase();
      }

      // Location filter
      if (location && location.trim() !== '') {
        filter.location = { $regex: location.trim(), $options: 'i' };
      }

      // Search query (title, description, or location)
      if (q && q.trim() !== '') {
        const queryTerm = q.trim();
        filter.$or = [
          { title: { $regex: queryTerm, $options: 'i' } },
          { description: { $regex: queryTerm, $options: 'i' } },
          { location: { $regex: queryTerm, $options: 'i' } },
        ];
      }

      // Date range filter
      if (startDate || endDate) {
        filter.itemDate = {};
        if (startDate) {
          filter.itemDate.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filter.itemDate.$lte = end;
        }
      }

      // Sorting
      let sortOption = { createdAt: -1 };
      if (sort === 'oldest') {
        sortOption = { createdAt: 1 };
      } else if (sort === 'date_desc') {
        sortOption = { itemDate: -1 };
      } else if (sort === 'date_asc') {
        sortOption = { itemDate: 1 };
      } else if (sort === 'title_asc') {
        sortOption = { title: 1 };
      }

      const [totalItems, items] = await Promise.all([
        Item.countDocuments(filter),
        Item.find(filter)
          .populate('reportedBy', 'name')
          .sort(sortOption)
          .skip(skip)
          .limit(limit),
      ]);

      const totalPages = Math.ceil(totalItems / limit) || 1;

      res.render('items/index', {
        title: 'Browse Items - Lost & Found Portal',
        items,
        categories: Item.CATEGORIES,
        query: {
          q,
          type,
          category,
          location,
          status,
          startDate,
          endDate,
          sort,
        },
        pagination: {
          currentPage,
          totalPages,
          totalItems,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
        },
      });
    } catch (err) {
      console.error('[ItemController.browseItems]', err);
      req.flash('error', 'Error loading items. Please try again.');
      res.redirect('/');
    }
  },

  /**
   * Show report form (lost or found)
   */
  showCreateForm(req, res) {
    const reportType = req.path.includes('report-found') || req.query.type === 'found' ? 'found' : 'lost';

    res.render('items/create', {
      title: reportType === 'lost' ? 'Report Lost Item - Lost & Found Portal' : 'Report Found Item - Lost & Found Portal',
      reportType,
      categories: Item.CATEGORIES,
      errors: [],
      formData: {
        type: reportType,
        itemDate: new Date().toISOString().split('T')[0],
      },
    });
  },

  /**
   * Handle item submission (lost or found)
   */
  async createItem(req, res) {
    const errors = validationResult(req);
    const { title, type, category, description, location, itemDate, additionalPrivateNotes } = req.body;
    const reportType = type === 'found' ? 'found' : 'lost';

    if (!errors.isEmpty()) {
      return res.status(422).render('items/create', {
        title: reportType === 'lost' ? 'Report Lost Item - Lost & Found Portal' : 'Report Found Item - Lost & Found Portal',
        reportType,
        categories: Item.CATEGORIES,
        errors: errors.array(),
        formData: req.body,
      });
    }

    try {
      let imageUrl = '/images/default-item.svg';
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }

      const newItem = await Item.create({
        title,
        type,
        category,
        description,
        location,
        itemDate: new Date(itemDate),
        imageUrl,
        additionalPrivateNotes: additionalPrivateNotes || '',
        reportedBy: req.session.user._id,
        status: 'active',
      });

      // Run matching engine asynchronously to notify user of potential matches
      matchingService.notifyIfMatchesFound(newItem).catch((err) => {
        console.error('Background matching error:', err.message);
      });

      req.flash('success', `Your ${type} item report has been submitted successfully!`);
      return res.redirect(`/items/${newItem._id}`);
    } catch (err) {
      console.error('[ItemController.createItem]', err);
      req.flash('error', 'Failed to submit report. Please try again.');
      return res.status(500).render('items/create', {
        title: reportType === 'lost' ? 'Report Lost Item' : 'Report Found Item',
        reportType,
        categories: Item.CATEGORIES,
        errors: [{ msg: 'Server error while saving report.' }],
        formData: req.body,
      });
    }
  },

  /**
   * Show single item details
   */
  async showItem(req, res) {
    try {
      const item = await Item.findById(req.params.id).populate('reportedBy', 'name email role createdAt');

      if (!item) {
        req.flash('error', 'Item report not found.');
        return res.status(404).render('404', {
          title: 'Item Not Found',
          path: req.originalUrl,
        });
      }

      const currentUserId = req.session.user ? req.session.user._id.toString() : null;
      const isAdmin = req.session.user && req.session.user.role === 'admin';
      const isOwner = currentUserId && item.reportedBy && item.reportedBy._id.toString() === currentUserId;

      // Only owner or admin can see private notes
      const canViewPrivateNotes = isOwner || isAdmin;

      // Check if logged-in user already has an active claim
      let existingUserClaim = null;
      if (currentUserId && !isOwner) {
        existingUserClaim = await Claim.findOne({
          item: item._id,
          claimant: currentUserId,
        }).sort({ createdAt: -1 });
      }

      // Fetch received claims if the viewer is the owner or admin
      let receivedClaims = [];
      if (isOwner || isAdmin) {
        receivedClaims = await Claim.find({ item: item._id })
          .populate('claimant', 'name email phone createdAt')
          .sort({ createdAt: -1 });
      }

      // Find potential matches using matching service
      let potentialMatches = [];
      try {
        potentialMatches = await matchingService.findMatches(item, 3);
      } catch (matchErr) {
        console.error('Error finding matches:', matchErr.message);
      }

      res.render('items/show', {
        title: `${item.title} (${item.type.toUpperCase()}) - Lost & Found Portal`,
        item,
        isOwner,
        isAdmin,
        canViewPrivateNotes,
        existingUserClaim,
        receivedClaims,
        potentialMatches,
      });
    } catch (err) {
      console.error('[ItemController.showItem]', err);
      req.flash('error', 'Invalid item ID.');
      res.redirect('/items');
    }
  },

  /**
   * Show edit item form
   */
  async showEditForm(req, res) {
    try {
      const item = await Item.findById(req.params.id);

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isOwner = item.reportedBy.toString() === currentUserId;

      if (!isOwner && !isAdmin) {
        req.flash('error', 'Unauthorized. You can only edit your own reports.');
        return res.redirect(`/items/${item._id}`);
      }

      res.render('items/edit', {
        title: `Edit ${item.title} - Lost & Found Portal`,
        item,
        categories: Item.CATEGORIES,
        errors: [],
        formData: {
          title: item.title,
          type: item.type,
          category: item.category,
          description: item.description,
          location: item.location,
          itemDate: new Date(item.itemDate).toISOString().split('T')[0],
          additionalPrivateNotes: item.additionalPrivateNotes || '',
          status: item.status,
        },
      });
    } catch (err) {
      console.error('[ItemController.showEditForm]', err);
      req.flash('error', 'Error fetching item for edit.');
      res.redirect('/items');
    }
  },

  /**
   * Handle update item
   */
  async updateItem(req, res) {
    const errors = validationResult(req);
    const { title, type, category, description, location, itemDate, additionalPrivateNotes, status } = req.body;

    try {
      const item = await Item.findById(req.params.id);

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isOwner = item.reportedBy.toString() === currentUserId;

      if (!isOwner && !isAdmin) {
        req.flash('error', 'Unauthorized. You can only edit your own reports.');
        return res.redirect(`/items/${item._id}`);
      }

      if (!errors.isEmpty()) {
        return res.status(422).render('items/edit', {
          title: `Edit ${item.title} - Lost & Found Portal`,
          item,
          categories: Item.CATEGORIES,
          errors: errors.array(),
          formData: req.body,
        });
      }

      item.title = title;
      item.type = type;
      item.category = category;
      item.description = description;
      item.location = location;
      item.itemDate = new Date(itemDate);
      item.additionalPrivateNotes = additionalPrivateNotes || '';

      // Only allow status changes that make sense
      if (status && ['active', 'claimed', 'resolved'].includes(status)) {
        item.status = status;
      }

      // If new image was uploaded, update and optionally delete old custom image
      if (req.file) {
        if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
          const oldPath = path.join(__dirname, '..', 'public', item.imageUrl);
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (unlinkErr) {
              console.warn('Could not remove old upload file:', unlinkErr.message);
            }
          }
        }
        item.imageUrl = `/uploads/${req.file.filename}`;
      }

      await item.save();

      req.flash('success', 'Report details updated successfully!');
      return res.redirect(`/items/${item._id}`);
    } catch (err) {
      console.error('[ItemController.updateItem]', err);
      req.flash('error', 'Error updating report.');
      res.redirect(`/items/${req.params.id}`);
    }
  },

  /**
   * Handle delete item
   */
  async deleteItem(req, res) {
    try {
      const item = await Item.findById(req.params.id);

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items/my-reports');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isOwner = item.reportedBy.toString() === currentUserId;

      if (!isOwner && !isAdmin) {
        req.flash('error', 'Unauthorized. You can only delete your own reports.');
        return res.redirect(`/items/${item._id}`);
      }

      // Check if there are active pending claims
      const pendingClaimsCount = await Claim.countDocuments({
        item: item._id,
        status: 'pending',
      });

      if (pendingClaimsCount > 0 && !isAdmin) {
        req.flash(
          'error',
          `Cannot delete report: There are ${pendingClaimsCount} active claim(s) pending review for this item. Please review or reject the claims before deleting.`
        );
        return res.redirect(`/items/${item._id}`);
      }

      // Clean up uploaded image if exists
      if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', 'public', item.imageUrl);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkErr) {
            console.warn('Could not remove image file:', unlinkErr.message);
          }
        }
      }

      // Remove associated claims and notifications
      await Claim.deleteMany({ item: item._id });
      await Notification.deleteMany({ relatedItem: item._id });
      await Item.findByIdAndDelete(item._id);

      req.flash('success', 'Report deleted successfully.');
      return res.redirect('/items/my-reports');
    } catch (err) {
      console.error('[ItemController.deleteItem]', err);
      req.flash('error', 'Error deleting report.');
      res.redirect('/items/my-reports');
    }
  },

  /**
   * Mark item as resolved
   */
  async markAsResolved(req, res) {
    try {
      const item = await Item.findById(req.params.id);

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/items');
      }

      const currentUserId = req.session.user._id.toString();
      const isAdmin = req.session.user.role === 'admin';
      const isOwner = item.reportedBy.toString() === currentUserId;

      if (!isOwner && !isAdmin) {
        req.flash('error', 'Unauthorized to update this report.');
        return res.redirect(`/items/${item._id}`);
      }

      item.status = 'resolved';
      await item.save();

      // Notify claimants of item resolution
      const approvedClaim = await Claim.findOne({ item: item._id, status: 'approved' });
      if (approvedClaim) {
        await notificationService.create({
          recipient: approvedClaim.claimant,
          message: `The item "${item.title}" for your approved claim has been marked as recovered and resolved!`,
          type: 'item_resolved',
          relatedItem: item._id,
          relatedClaim: approvedClaim._id,
        });
      }

      req.flash('success', 'Item has been marked as resolved/recovered! Congratulations on reuniting the item.');
      return res.redirect(`/items/${item._id}`);
    } catch (err) {
      console.error('[ItemController.markAsResolved]', err);
      req.flash('error', 'Error resolving item.');
      res.redirect(`/items/${req.params.id}`);
    }
  },

  /**
   * Show logged-in user's reports
   */
  async showMyReports(req, res) {
    try {
      const userId = req.session.user._id;
      const { type = 'all', status = 'all' } = req.query;

      const filter = { reportedBy: userId };
      if (type && ['lost', 'found'].includes(type)) {
        filter.type = type;
      }
      if (status && ['active', 'claimed', 'resolved'].includes(status)) {
        filter.status = status;
      }

      const reports = await Item.find(filter).sort({ createdAt: -1 });

      res.render('items/my-reports', {
        title: 'My Reports - Lost & Found Portal',
        reports,
        currentFilter: { type, status },
      });
    } catch (err) {
      console.error('[ItemController.showMyReports]', err);
      req.flash('error', 'Could not load your reports.');
      res.redirect('/dashboard');
    }
  },
};

module.exports = itemController;
