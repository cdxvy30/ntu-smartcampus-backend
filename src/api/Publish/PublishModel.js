const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const PublishModel = sequelize.define('publish-management', {
  id: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true,
  },
  status: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'arcgis-user': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'arcgis-password': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'arcgis-portal': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'service-name': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'file-names': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  'owner-id': {
    type: Sequelize.STRING,
    allowNull: false,
  },
  message: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: true,
  },
});
