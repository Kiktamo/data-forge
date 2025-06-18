const express = require('express');
const { body, param, query } = require('express-validator');
const datasetController = require('../controllers/dataset.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

// Dataset validation rules
const createDatasetValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Dataset name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'collaborative'])
    .withMessage('Visibility must be public, private, or collaborative'),
  body('dataType')
    .isIn(['image', 'text', 'structured'])
    .withMessage('Data type must be image, text, or structured'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be a string between 1 and 50 characters')
];

const updateDatasetValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Dataset name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'collaborative'])
    .withMessage('Visibility must be public, private, or collaborative'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be a string between 1 and 50 characters')
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
    .isIn(['created_at', 'updated_at', 'name', 'contributionCount'])
    .withMessage('Sort by must be created_at, updated_at, name, or contributionCount'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Dataset ID must be a positive integer')
];

const versionValidation = [
  body('versionDescription')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Version description must not exceed 500 characters')
    .trim(),
  body('incrementType')
    .optional()
    .isIn(['major', 'minor', 'patch'])
    .withMessage('Increment type must be major, minor, or patch')
];

const userIdValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

// Public routes (no authentication required, but can be enhanced with auth)
router.get('/', 
  optionalAuth, 
  paginationValidation, 
  datasetController.getDatasets
);

router.get('/:id', 
  idValidation, 
  optionalAuth, 
  datasetController.getDatasetById
);

router.get('/:id/stats', 
  idValidation, 
  optionalAuth, 
  datasetController.getDatasetStats
);

router.get('/:id/history', 
  idValidation, 
  optionalAuth, 
  paginationValidation,
  datasetController.getDatasetHistory
);

router.get('/user/:userId', 
  userIdValidation, 
  optionalAuth, 
  paginationValidation, 
  datasetController.getUserDatasets
);

// Protected routes (require authentication)
router.use(authenticate);

router.post('/', 
  createDatasetValidation, 
  datasetController.createDataset
);

router.put('/:id', 
  idValidation, 
  updateDatasetValidation, 
  datasetController.updateDataset
);

router.delete('/:id', 
  idValidation, 
  datasetController.deleteDataset
);

router.post('/:id/version', 
  idValidation, 
  versionValidation, 
  datasetController.createDatasetVersion
);

module.exports = router;