const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const ValidationModel = sequelize.define('validation-management', {
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
  'owner-id': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  version: {
    type: Sequelize.DOUBLE,
    allowNull: false,
  },
  validated: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  downloadable: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
});
