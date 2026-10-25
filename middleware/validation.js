const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');

// Registration validation rules
const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters long.')
    .escape(),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9+\s\-()]{7,20}$/)
    .withMessage('Please enter a valid phone number (digits and optional +, -, ()).'),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
];

// Login validation rules
const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

// Item validation rules (for both lost and found)
const itemValidationRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Item title is required.')
    .isLength({ min: 2, max: 120 })
    .withMessage('Item title must be between 2 and 120 characters.'),
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Item type is required.')
    .isIn(['lost', 'found'])
    .withMessage('Item type must be either "lost" or "found".'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required.')
    .isIn(Item.CATEGORIES)
    .withMessage('Invalid category selected.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.')
    .isLength({ min: 5, max: 3000 })
    .withMessage('Description must be between 5 and 3000 characters.'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters.'),
  body('itemDate')
    .notEmpty()
    .withMessage('Date is required.')
    .isISO8601()
    .withMessage('Please provide a valid date.')
    .custom((value) => {
      const inputDate = new Date(value);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (inputDate > tomorrow) {
        throw new Error('Date cannot be in the future.');
      }
      return true;
    }),
  body('additionalPrivateNotes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Private notes cannot exceed 1000 characters.'),
];

// Claim validation rules
const claimValidationRules = [
  body('explanation')
    .trim()
    .notEmpty()
    .withMessage('Explanation and proof of ownership are required.')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Explanation must be between 10 and 2000 characters long.'),
];

// Claim review validation rules
const claimReviewValidationRules = [
  body('status')
    .trim()
    .notEmpty()
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either "approved" or "rejected".'),
  body('reviewNotes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Review notes cannot exceed 1000 characters.'),
];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  itemValidationRules,
  claimValidationRules,
  claimReviewValidationRules,
  validationResult,
};
