const Sequelize = require('sequelize');
const sequelize = require('../../util/sequelize');

export const SensorModel = sequelize.define('sensor-management', {
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
  public: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

export const SensorDataSchema = [
  {
    name: '"name"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"url"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"date"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"query"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"content-type"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"body"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"X"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"Y"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
  {
    name: '"response"',
    type: 'VARCHAR (255)',
    constraint: 'NOT NULL',
  },
];
