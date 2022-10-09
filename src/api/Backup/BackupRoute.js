import { Router } from 'express';
import * as controller from './BackupController';

const router = Router();

router.route('/')
  .post(controller.postBackup);

module.exports = router;
