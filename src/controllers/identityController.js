const Contact = require('../models/contact');

// Main controller for the /identify endpoint
const identifyContact = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    
    // Validate input - at least one of email or phoneNumber is required
    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: {
          message: 'At least one of email or phoneNumber is required'
        }
      });
    }

    // Find all contacts matching the provided email or phone
    const existingContacts = await Contact.findByEmailOrPhone(email, phoneNumber);
    
    // If no existing contacts, create a new primary contact
    if (existingContacts.length === 0) {
      const newContactId = await Contact.create({
        email,
        phoneNumber,
        linkedId: null,
        linkPrecedence: 'primary'
      });
      
      const newContact = await Contact.getById(newContactId);
      
      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    // Process the existing contacts to find primary and related secondaries
    const result = await processContacts(existingContacts, email, phoneNumber);
    
    return res.status(200).json({
      contact: result
    });
  } catch (error) {
    console.error('Error in identifyContact:', error);
    return res.status(500).json({
      error: {
        message: 'An error occurred while processing the request'
      }
    });
  }
};

// Process contacts to determine primary and related secondaries
const processContacts = async (contacts, email, phoneNumber) => {
  // Find primary contacts (those with linkPrecedence='primary')
  const primaryContacts = contacts.filter(c => c.linkPrecedence === 'primary');
  
  // Find secondary contacts (those with linkPrecedence='secondary')
  const secondaryContacts = contacts.filter(c => c.linkPrecedence === 'secondary');
  
  let primaryContactId;
  let allRelatedContacts = [];
  
  // Case 1: No primary contacts found (should be rare due to how we create contacts)
  if (primaryContacts.length === 0) {
    // This should generally not happen based on our design, but handle just in case
    // Get the oldest secondary contact and find its primary
    const oldestSecondary = secondaryContacts.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt))[0];
    
    const primary = await Contact.getById(oldestSecondary.linkedId);
    primaryContactId = primary.id;
    
    // Get all contacts related to this primary
    allRelatedContacts = await Contact.getAllRelatedContacts(primaryContactId);
  }
  // Case 2: Only one primary contact found
  else if (primaryContacts.length === 1) {
    primaryContactId = primaryContacts[0].id;
    
    // Get all contacts related to this primary
    allRelatedContacts = await Contact.getAllRelatedContacts(primaryContactId);
    
    // Check if we need to create a new secondary contact
    const needNewSecondary = shouldCreateNewSecondary(allRelatedContacts, email, phoneNumber);
    
    if (needNewSecondary) {
      // Create a new secondary contact
      await Contact.create({
        email: needNewSecondary.newEmail ? email : null,
        phoneNumber: needNewSecondary.newPhone ? phoneNumber : null,
        linkedId: primaryContactId,
        linkPrecedence: 'secondary'
      });
      
      // Refresh related contacts
      allRelatedContacts = await Contact.getAllRelatedContacts(primaryContactId);
    }
  }
  // Case 3: Multiple primary contacts found - we need to determine which is the "real" primary
  else {
    // Sort primary contacts by creation date (oldest first)
    const sortedPrimaries = primaryContacts.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt));
    
    // The oldest becomes the "real" primary
    const oldestPrimary = sortedPrimaries[0];
    primaryContactId = oldestPrimary.id;
    
    // All other primaries need to be converted to secondary
    for (let i = 1; i < sortedPrimaries.length; i++) {
      const primaryToConvert = sortedPrimaries[i];
      
      // Update this contact to be a secondary linked to the oldest primary
      await Contact.update(primaryToConvert.id, {
        linkedId: primaryContactId,
        linkPrecedence: 'secondary'
      });
      
      // Also update any secondaries that were linked to this primary
      const secondariesToUpdate = await Contact.getSecondaryContacts(primaryToConvert.id);
      for (const secondary of secondariesToUpdate) {
        await Contact.update(secondary.id, {
          linkedId: primaryContactId,
          linkPrecedence: 'secondary'
        });
      }
    }
    
    // Get all contacts related to the oldest primary (which now includes the converted primaries)
    allRelatedContacts = await Contact.getAllRelatedContacts(primaryContactId);
    
    // Check if we need to create a new secondary contact
    const needNewSecondary = shouldCreateNewSecondary(allRelatedContacts, email, phoneNumber);
    
    if (needNewSecondary) {
      // Create a new secondary contact
      await Contact.create({
        email: needNewSecondary.newEmail ? email : null,
        phoneNumber: needNewSecondary.newPhone ? phoneNumber : null,
        linkedId: primaryContactId,
        linkPrecedence: 'secondary'
      });
      
      // Refresh related contacts
      allRelatedContacts = await Contact.getAllRelatedContacts(primaryContactId);
    }
  }
  
  // Format the response
  return formatResponse(allRelatedContacts);
};

// Determine if we need to create a new secondary contact
const shouldCreateNewSecondary = (contacts, email, phoneNumber) => {
  // Check if the provided email is new
  const newEmail = email && !contacts.some(contact => contact.email === email);
  
  // Check if the provided phone is new
  const newPhone = phoneNumber && !contacts.some(contact => contact.phoneNumber === phoneNumber);
  
  // We should create a new secondary if either email or phone is new
  if (newEmail || newPhone) {
    return { newEmail, newPhone };
  }
  
  return false;
};

// Format the response according to requirements
const formatResponse = (contacts) => {
  // The first contact is the primary
  const primary = contacts[0];
  // The rest are secondaries
  const secondaries = contacts.slice(1);
  
  // Collect unique emails and phone numbers
  const emails = [];
  const phoneNumbers = [];
  const secondaryIds = [];
  
  // Add primary contact details first
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
  
  // Add secondary contact details
  for (const secondary of secondaries) {
    if (secondary.email && !emails.includes(secondary.email)) {
      emails.push(secondary.email);
    }
    
    if (secondary.phoneNumber && !phoneNumbers.includes(secondary.phoneNumber)) {
      phoneNumbers.push(secondary.phoneNumber);
    }
    
    secondaryIds.push(secondary.id);
  }
  
  return {
    primaryContactId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaryIds
  };
};

module.exports = {
  identifyContact
};