import { config } from '../config';

const Sequelize = require('sequelize');

let sequelize;

if (config.development.db_url) {
  sequelize = new Sequelize(config.development.db_url);
} else {
  sequelize = new Sequelize(
    config.development.database,
    config.development.username,
    config.development.password,
    {
      dialect: config.development.dialect,
      host: config.development.host,
      logging: false,
    },
  );
}

module.exports = sequelize;
