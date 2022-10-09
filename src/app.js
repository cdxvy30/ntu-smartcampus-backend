import logger, { apiLogger } from './logger';
import { initialize } from './util/initialize';
import apiRoute from './api';

const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const express = require('express');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const swaggerUi = require('swagger-ui-express');
const swaggerApiDoc = require('../public/document/api-doc.json');

const app = express();

app.use(cors());
app.use(helmet());
app.use(fileUpload());
app.use(compression());
app.use(express.json({ limit: '5000kb' }));
app.use(express.urlencoded({ limit: '5000kb' }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api-doc', swaggerUi.serve, swaggerUi.setup(swaggerApiDoc));

app.use('/api', apiLogger);

app.use('/api', apiRoute);

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

app.listen(process.env.SERVER_PORT || 8000, async () => {
  await initialize();
  logger.info(`server start at http://localhost:${process.env.SERVER_PORT}`);
});
