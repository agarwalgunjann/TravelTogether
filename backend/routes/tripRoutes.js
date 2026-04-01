const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const auth = require('../middleware/auth');

router.get('/', tripController.getTrips);
router.post('/', auth, tripController.createTrip);
router.delete('/:id', auth, tripController.deleteTrip);
router.post('/:id/join', auth, tripController.joinTrip);
router.post('/:id/leave', auth, tripController.leaveTrip);
router.get('/:id/messages', auth, tripController.getMessages);
router.post('/:id/messages', auth, tripController.sendMessage);
router.post('/:id/checklist', auth, tripController.addChecklistItem);
router.patch('/:id/checklist/:itemId', auth, tripController.toggleChecklistItem);

module.exports = router;
