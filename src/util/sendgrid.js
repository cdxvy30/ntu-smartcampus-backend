import logger from '../logger';
import { config } from '../config';

const errorLog = (message) => {
  logger.error(`[Sendgrid] ${message}`);
};

const infoLog = (message) => {
  logger.info(`[Sendgrid] ${message}`);
};

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(config.development.sendgridApiKey);

const CreateMessage = (to, subject, text, html) => {
  const msg = {
    to,
    from: config.development.sendgridAccount,
    subject,
    text,
    html,
  };
  return msg;
};

export const sendEmail = async (to, subject, text, html) => {
  const msg = CreateMessage(to, subject, text, html);

  try {
    await sgMail.send(msg);
    infoLog(`Email sent to ${to}`);
  } catch (err) {
    errorLog(`${err} / @sendgrid.sendEmail`);
  }
};
