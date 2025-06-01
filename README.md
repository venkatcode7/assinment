# Bitespeed Identity Reconciliation Service

This service implements the Bitespeed Identity Reconciliation backend task. It helps track and identify customers across multiple purchases even when they use different contact information.

## API Endpoint

### POST /identify

Identifies and consolidates contact information based on email and/or phone number.

**Request Format:**
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

**Response Format:**
```json
{
  "contact": {
    "primaryContactId": number,
    "emails": string[],
    "phoneNumbers": string[],
    "secondaryContactIds": number[]
  }
}
```

## How It Works

1. When a request is received, the service checks if the provided email or phone number matches any existing contacts.
2. If no matches are found, a new primary contact is created.
3. If matches are found, the service determines the correct primary contact (the oldest one) and links all related contacts.
4. If multiple primary contacts are found, all but the oldest are converted to secondary contacts.
5. If new contact information is provided (email or phone not seen before), a new secondary contact is created and linked to the primary.
6. The response includes consolidated information about the contact: primary ID, all emails, all phone numbers, and IDs of all secondary contacts.

## Database Schema

The service uses a Contact collection with the following structure:

```
{
  id: Int
  phoneNumber: String?
  email: String?
  linkedId: Int? // the ID of another Contact linked to this one
  linkPrecedence: "secondary"|"primary" // "primary" if it's the first Contact
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime?
}
```

## Installation and Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Ensure MongoDB is installed and running on your system
   - The default connection URL is `mongodb://localhost:27017/bitespeed`
   - If you need to use a different MongoDB URL, set it in your `.env` file
4. Start the server: `npm start`
5. For development with hot reloading: `npm run dev`

## Deployment

The service is deployed at: localserver

## 📷 Screenshot

![Button Screenshot](Screenshot1.jpeg?raw=true)
![Button Screenshot](Screenshot2.jpeg?raw=true)
## Technologies Used

- Node.js
- Express.js
- MongoDB (for database)
- Mongoose (ODM for MongoDB)
- Express Validator (for input validation)
