const express = require('express');
const { body, validationResult } = require('express-validator');
const { ContactService } = require('../models/Contact');

const router = express.Router();

// Validation middleware
const validateIdentifyRequest = [
  body('email').optional().isEmail().withMessage('Must be a valid email address'),
  body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Routes
router.post('/identify', validateIdentifyRequest, async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Either email or phoneNumber is required' });
    }

    // Find existing contacts that match either email or phoneNumber
    const existingContacts = await ContactService.findByEmailOrPhone(email, phoneNumber);

    if (existingContacts.length === 0) {
      // Create new primary contact if no matches found
      const newContact = await ContactService.create({
        email,
        phoneNumber,
        linkPrecedence: 'primary'
      });

      return res.json({
        contact: {
          primaryContatctId: newContact._id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    // Find the primary contact
    let primaryContact = existingContacts.find(contact => contact.linkPrecedence === 'primary');
    const secondaryContacts = existingContacts.filter(contact => contact.linkPrecedence === 'secondary');

    // If no primary contact found, make the oldest contact primary
    if (!primaryContact) {
      primaryContact = existingContacts[0];
      await ContactService.update(primaryContact._id, { linkPrecedence: 'primary' });

      // Update other contacts to be secondary
      for (const contact of existingContacts.slice(1)) {
        await ContactService.update(contact._id, {
          linkPrecedence: 'secondary',
          linkedId: primaryContact._id
        });
        secondaryContacts.push(contact);
      }
    }

    // Check if we need to create a new secondary contact
    const hasNewInfo = (email && !existingContacts.some(c => c.email === email)) ||
                      (phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber));

    if (hasNewInfo) {
      const newSecondaryContact = await ContactService.create({
        email,
        phoneNumber,
        linkPrecedence: 'secondary',
        linkedId: primaryContact._id
      });
      secondaryContacts.push(newSecondaryContact);
    }

    // Collect all unique emails and phone numbers
    const allContacts = [primaryContact, ...secondaryContacts];
    const emails = [...new Set(allContacts.map(c => c.email).filter(Boolean))];
    const phoneNumbers = [...new Set(allContacts.map(c => c.phoneNumber).filter(Boolean))];

    return res.json({
      contact: {
        primaryContatctId: primaryContact._id,
        emails,
        phoneNumbers,
        secondaryContactIds: secondaryContacts.map(c => c._id)
      }
    });

  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Documentation route
router.get('/', (req, res) => {
  res.json({
    name: 'Bitespeed Identity Reconciliation API',
    version: '1.0.0',
    endpoints: {
      identify: {
        method: 'POST',
        path: '/identify',
        description: 'Identifies and consolidates contact information',
        body: {
          email: 'string (optional)',
          phoneNumber: 'string (optional)'
        },
        response: {
          contact: {
            primaryContactId: 'number',
            emails: 'string[]',
            phoneNumbers: 'string[]',
            secondaryContactIds: 'number[]'
          }
        }
      }
    }
  });
});

module.exports = router;