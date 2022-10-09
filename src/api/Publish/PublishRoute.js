import { Router } from 'express';
import * as controller from './PublishController';

const router = Router();

router.route('/')
  .post(controller.publishService);

router.route('/apply')
  .post(controller.applyPublish);

router.route('/status')
  .get(controller.getPublishStatus);

module.exports = router;
