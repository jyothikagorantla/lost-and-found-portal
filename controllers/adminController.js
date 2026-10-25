const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');

const adminController = {
  /**
   * Admin dashboard view with statistics and platform overview
   */
  async showDashboard(req, res) {
    try {
      const [
        totalUsers,
        totalLost,
        totalFound,
        activeReports,
        resolvedReports,
        pendingReports,
        pendingClaims,
        recentUsers,
        recentItems,
        recentClaims,
      ] = await Promise.all([
        User.countDocuments(),
        Item.countDocuments({ type: 'lost' }),
        Item.countDocuments({ type: 'found' }),
        Item.countDocuments({ status: 'active' }),
        Item.countDocuments({ status: 'resolved' }),
        Item.countDocuments({ status: 'pending_review' }),
        Claim.countDocuments({ status: 'pending' }),
        User.find().sort({ createdAt: -1 }).limit(5).select('-passwordHash'),
        Item.find().populate('reportedBy', 'name').sort({ createdAt: -1 }).limit(5),
        Claim.find().populate('item', 'title').populate('claimant', 'name').sort({ createdAt: -1 }).limit(5),
      ]);

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - Lost & Found Portal',
        stats: {
          totalUsers,
          totalLost,
          totalFound,
          activeReports,
          resolvedReports,
          pendingReports,
          pendingClaims,
        },
        recentUsers,
        recentItems,
        recentClaims,
      });
    } catch (err) {
      console.error('[AdminController.showDashboard]', err);
      req.flash('error', 'Error loading admin dashboard.');
      res.redirect('/dashboard');
    }
  },

  /**
   * Manage and search users
   */
  async listUsers(req, res) {
    try {
      const { q = '', role = '', status = '' } = req.query;
      const filter = {};

      if (q && q.trim()) {
        const queryTerm = q.trim();
        filter.$or = [
          { name: { $regex: queryTerm, $options: 'i' } },
          { email: { $regex: queryTerm, $options: 'i' } },
          { phone: { $regex: queryTerm, $options: 'i' } },
        ];
      }

      if (role && ['user', 'admin'].includes(role)) {
        filter.role = role;
      }

      if (status && ['active', 'suspended'].includes(status)) {
        filter.accountStatus = status;
      }

      const users = await User.find(filter).sort({ createdAt: -1 }).select('-passwordHash');

      // Attach report counts for each user
      const usersWithStats = await Promise.all(
        users.map(async (u) => {
          const reportCount = await Item.countDocuments({ reportedBy: u._id });
          const claimCount = await Claim.countDocuments({ claimant: u._id });
          return {
            ...u.toObject(),
            reportCount,
            claimCount,
          };
        })
      );

      res.render('admin/users', {
        title: 'Manage Users - Admin Portal',
        users: usersWithStats,
        query: { q, role, status },
      });
    } catch (err) {
      console.error('[AdminController.listUsers]', err);
      req.flash('error', 'Error retrieving users.');
      res.redirect('/admin');
    }
  },

  /**
   * Toggle user account status (active <-> suspended)
   */
  async toggleUserStatus(req, res) {
    const { userId } = req.params;

    try {
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error', 'User not found.');
        return res.redirect('/admin/users');
      }

      // Prevent admin from suspending themselves
      if (user._id.toString() === req.session.user._id.toString()) {
        req.flash('error', 'You cannot suspend your own admin account.');
        return res.redirect('/admin/users');
      }

      user.accountStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
      await user.save();

      req.flash(
        'success',
        `User "${user.name}" status updated to ${user.accountStatus.toUpperCase()}.`
      );
      return res.redirect('/admin/users');
    } catch (err) {
      console.error('[AdminController.toggleUserStatus]', err);
      req.flash('error', 'Error toggling user status.');
      res.redirect('/admin/users');
    }
  },

  /**
   * Manage all items across platform
   */
  async listItems(req, res) {
    try {
      const { q = '', type = '', category = '', status = '' } = req.query;
      const filter = {};

      if (q && q.trim()) {
        const queryTerm = q.trim();
        filter.$or = [
          { title: { $regex: queryTerm, $options: 'i' } },
          { location: { $regex: queryTerm, $options: 'i' } },
        ];
      }

      if (type && ['lost', 'found'].includes(type)) {
        filter.type = type;
      }

      if (category && Item.CATEGORIES.includes(category)) {
        filter.category = category;
      }

      if (status && ['active', 'pending_review', 'claimed', 'resolved', 'rejected'].includes(status)) {
        filter.status = status;
      }

      const items = await Item.find(filter)
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 });

      res.render('admin/items', {
        title: 'Manage Items - Admin Portal',
        items,
        categories: Item.CATEGORIES,
        query: { q, type, category, status },
      });
    } catch (err) {
      console.error('[AdminController.listItems]', err);
      req.flash('error', 'Error retrieving items.');
      res.redirect('/admin');
    }
  },

  /**
   * Update item status or moderate report
   */
  async updateItemStatus(req, res) {
    const { itemId } = req.params;
    const { status } = req.body;

    const allowed = ['active', 'pending_review', 'claimed', 'resolved', 'rejected'];
    if (!allowed.includes(status)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/admin/items');
    }

    try {
      const item = await Item.findByIdAndUpdate(itemId, { status }, { new: true });

      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/admin/items');
      }

      req.flash('success', `Item "${item.title}" status changed to ${status.toUpperCase()}.`);
      return res.redirect('/admin/items');
    } catch (err) {
      console.error('[AdminController.updateItemStatus]', err);
      req.flash('error', 'Error updating item status.');
      res.redirect('/admin/items');
    }
  },

  /**
   * Remove / delete an inappropriate item
   */
  async deleteItem(req, res) {
    const { itemId } = req.params;

    try {
      const item = await Item.findById(itemId);
      if (!item) {
        req.flash('error', 'Item not found.');
        return res.redirect('/admin/items');
      }

      // Remove uploaded image if local
      if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', 'public', item.imageUrl);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.warn('Could not delete image file:', e.message);
          }
        }
      }

      await Claim.deleteMany({ item: item._id });
      await Notification.deleteMany({ relatedItem: item._id });
      await Item.findByIdAndDelete(item._id);

      req.flash('success', `Item "${item.title}" was permanently removed by Admin.`);
      return res.redirect('/admin/items');
    } catch (err) {
      console.error('[AdminController.deleteItem]', err);
      req.flash('error', 'Error removing item.');
      res.redirect('/admin/items');
    }
  },

  /**
   * Manage and review all claims
   */
  async listClaims(req, res) {
    try {
      const { status = '' } = req.query;
      const filter = {};

      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        filter.status = status;
      }

      const claims = await Claim.find(filter)
        .populate('item')
        .populate('claimant', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      res.render('admin/claims', {
        title: 'Manage Claims - Admin Portal',
        claims,
        query: { status },
      });
    } catch (err) {
      console.error('[AdminController.listClaims]', err);
      req.flash('error', 'Error loading claims.');
      res.redirect('/admin');
    }
  },
};

module.exports = adminController;
