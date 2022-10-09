const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const PointDataModel = sequelize.define('point-data-management', {
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
  'x-property-name': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'y-property-name': {
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
