const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const ShapeFileModel = sequelize.define('shape-file-management', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  path: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'owner-id': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  version: {
    type: Sequelize.DOUBLE,
    allowNull: false,
  },
  public: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

export const ShapeDataModel = sequelize.define('shape-data-management', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  'shapefile-id': {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'key-property-name': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'owner-id': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  version: {
    type: Sequelize.DOUBLE,
    allowNull: false,
  },
  public: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

export const CommonFileModel = sequelize.define('common-file-management', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'shapefile-id': {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  'key-property-value': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  path: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'owner-id': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  version: {
    type: Sequelize.DOUBLE,
    allowNull: false,
  },
  public: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});
