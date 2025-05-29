const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  linkedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: false
  },
  linkPrecedence: {
    type: String,
    enum: ['primary', 'secondary'],
    default: 'primary'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    required: false
  }
});

// Check if model exists before creating
const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

class ContactService {
  static async findByEmailOrPhone(email, phoneNumber) {
    if (!email && !phoneNumber) return [];

    const query = {
      deletedAt: null,
      $or: []
    };

    if (email) query.$or.push({ email });
    if (phoneNumber) query.$or.push({ phoneNumber });

    return await Contact.find(query).sort({ createdAt: 1 });
  }

  static async create(data) {
    const contact = new Contact(data);
    await contact.save();
    return contact;
  }

  static async update(id, data) {
    await Contact.findByIdAndUpdate(id, {
      ...data,
      updatedAt: new Date()
    });
    return id;
  }

  static async getById(id) {
    return await Contact.findOne({ _id: id, deletedAt: null });
  }

  static async getSecondaryContacts(primaryId) {
    return await Contact.find({
      linkedId: primaryId,
      deletedAt: null
    }).sort({ createdAt: 1 });
  }

  static async getAllRelatedContacts(primaryId) {
    const primary = await this.getById(primaryId);
    if (!primary) return [];
    
    const secondaries = await this.getSecondaryContacts(primaryId);
    return [primary, ...secondaries];
  }
}

module.exports = { Contact, ContactService };