const express = require('express');
const { body, param, query } = require('express-validator');
const contributionController = require('../controllers/contribution.controller');
const validationController = require('../controllers/validation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Validation rules
const createContributionValidation = [
  param('datasetId')
    .isInt({ min: 1 })
    .withMessage('Dataset ID must be a positive integer'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('tags')
    .optional(),
  body('annotations')
    .optional()
    .isJSON()
    .withMessage('Annotations must be valid JSON'),
  body('textContent')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('Text content must not exceed 50,000 characters'),
  body('structuredData')
    .optional()
    .isJSON()
    .withMessage('Structured data must be valid JSON')
];

const updateContributionValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contribution ID must be a positive integer'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('tags')
    .optional(),
  body('annotations')
    .optional()
    .isJSON()
    .withMessage('Annotations must be valid JSON')
];

const createValidationValidation = [
  param('contributionId')
    .isInt({ min: 1 })
    .withMessage('Contribution ID must be a positive integer'),
  body('status')
    .isIn(['approved', 'rejected', 'needs_review'])
    .withMessage('Status must be approved, rejected, or needs_review'),
  body('confidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Confidence must be between 0 and 1'),
  body('notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters')
    .trim(),
  body('validationCriteria')
    .optional()
    .isJSON()
    .withMessage('Validation criteria must be valid JSON'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a non-negative integer')
];

const updateValidationValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Validation ID must be a positive integer'),
  body('status')
    .optional()
    .isIn(['approved', 'rejected', 'needs_review'])
    .withMessage('Status must be approved, rejected, or needs_review'),
  body('confidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Confidence must be between 0 and 1'),
  body('notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters')
    .trim(),
  body('validationCriteria')
    .optional()
    .isJSON()
    .withMessage('Validation criteria must be valid JSON'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a non-negative integer')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['created_at', 'updated_at', 'validationStatus', 'dataType'])
    .withMessage('Sort by must be created_at, updated_at, validationStatus, or dataType'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const datasetIdValidation = [
  param('datasetId')
    .isInt({ min: 1 })
    .withMessage('Dataset ID must be a positive integer')
];

const userIdValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const contributionIdValidation = [
  param('contributionId')
    .isInt({ min: 1 })
    .withMessage('Contribution ID must be a positive integer')
];

// All routes require authentication
router.use(authenticate);

// Contribution routes
router.get('/datasets/:datasetId/contributions',
  datasetIdValidation,
  paginationValidation,
  contributionController.getContributionsForDataset
);

router.post('/datasets/:datasetId/contributions',
  createContributionValidation,
  contributionController.createContribution
);

router.get('/contributions/:id',
  idValidation,
  contributionController.getContributionById
);

router.put('/contributions/:id',
  updateContributionValidation,
  contributionController.updateContribution
);

router.delete('/contributions/:id',
  idValidation,
  contributionController.deleteContribution
);

router.get('/users/:userId/contributions',
  userIdValidation,
  paginationValidation,
  contributionController.getUserContributions
);

// Validation routes
router.post('/contributions/:contributionId/validations',
  createValidationValidation,
  validationController.createValidation
);

router.get('/contributions/:contributionId/validations',
  contributionIdValidation,
  validationController.getValidationsForContribution
);

router.put('/validations/:id',
  updateValidationValidation,
  validationController.updateValidation
);

router.delete('/validations/:id',
  idValidation,
  validationController.deleteValidation
);

// Get pending contributions for validation
router.get('/validations/pending',
  paginationValidation,
  validationController.getPendingContributions
);

module.exports = router;