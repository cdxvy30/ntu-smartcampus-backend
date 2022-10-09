const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const UserModel = sequelize.define('user-management', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  _id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  displayName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  department: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  role: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  validated: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  staffCardImage: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});
