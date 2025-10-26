# Barberbook MVP - Single Booking System Documentation

## Overview
Barberbook is an AI-powered virtual assistant for barbershop booking management. The system leverages Google's Gemini AI to understand customer messages, extract booking intents and entities, and manage the booking flow through a conversational interface.

## Architecture

### Core Components
- **Express Server**: Main application server handling HTTP requests
- **Gemini AI**: Natural language processing for intent and entity recognition
- **Session Manager**: Tracks user conversation state and context
- **Database Layer**: PostgreSQL integration for storing logs and session data
- **Conversation Orchestrator**: Manages booking flow logic and slot filling
- **Logging Service**: Records all user and system interactions

### Request Flow
```
User Message → Gemini AI Analysis → Intent Recognition → Conversation Orchestrator → Response Generation → Database Logging
```

## File Structure
```
src/
├── app.ts            # Express application setup
├── config/
│   ├── db.ts         # PostgreSQL connection pool
│   └── prompt.ts     # AI system prompt
├── controllers/
│   └── chatController.ts # Main message processing logic
├── services/
│   ├── geminiClient.ts       # Gemini API client
│   ├── geminiOrchestrator.ts # AI analysis and parsing
│   └── (other services)
```

## API Endpoints

### POST `/simulate`
Processes user messages and returns structured responses.

#### Request Body
```json
{
  "user_id": "string (optional)",
  "message": "string (required)"
}
```

#### Response Format
```json
{
  "reply": "string",
  "intent": "string",
  "entities": "object",
  "mode": "string",
  "next_state": "string"
}
```

## Intent Classification

### Smalltalk Intents
- `greeting`: Handling greetings and welcome messages
- `smalltalk`: General conversation and chitchat
- `farewell`: Goodbye and closing messages
- `help`: Help and assistance requests

### Booking-Related Intents
- `start_booking`: Initiating a new booking
- `ask_availability`: Checking slot availability
- `ask_services`: Querying available services and prices
- `confirm_booking`: Confirming booking details
- `cancel_booking`: Canceling existing bookings
- `check_booking_status`: Checking booking status
- `change_booking_time`: Modifying booking time
- `choose_payment_method`: Selecting payment methods

### Error Handling
- `unknown_intent`: Used when the system cannot determine the user's intent

## Entity Extraction

The system extracts the following entities from user messages:

| Entity | Type | Description |
|--------|------|-------------|
| customer_name | string/null | Name of the customer |
| service_name | string/null | Type of service requested |
| date | string/null | Booking date in ISO format |
| time | string/null | Booking time in HH:mm format |
| barber_name | string/null | Preferred barber name |
| payment_method | string/null | Payment method preference |
| payment_status | string/null | Payment status |
| booking_id | string/null | Booking identifier |

## Conversation Flow Management

### Session States
The system maintains conversation context through session management:
- Tracks active booking flows
- Maintains collected entities across multiple messages
- Manages state transitions during booking process

### Response Modes
- `direct_reply`: For immediate conversational responses
- `slot_filling`: When collecting missing booking information
- `completed`: When booking flow is finished
- `fallback`: When intent is unclear

## Database Integration

The system uses PostgreSQL with:
- Connection pooling for efficiency
- Type parsing for numeric and timestamp values
- Logging table for conversation history
- Session management storage

## Environment Variables

Required configuration:
- `GEMINI_API_KEY`: Google Gemini API key
- `DB_USER`: Database username
- `DB_HOST`: Database host
- `DB_NAME`: Database name
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port (default: 5432)
- `GEMINI_MODEL_NAME`: Gemini model name (default: gemini-2.5-flash)
- `PORT`: Application port (default: 4000)

## Error Handling

The system implements comprehensive error handling:
- Graceful fallback for unknown intents
- Database connection error management
- AI response parsing error recovery
- Validation for required fields

## AI Prompt System

The system uses a sophisticated prompt that:
- Provides clear instructions for intent and entity recognition
- Handles both structured JSON responses and natural language replies
- Maintains conversation context across messages
- Guides the AI on proper response formatting
- Includes examples for various scenarios

## Development and Deployment

### Scripts
- `npm run dev`: Start development server with auto-reload
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Start production server from compiled files

### Dependencies
- Express.js for web framework
- Google Generative AI for AI processing
- PostgreSQL for database
- Dotenv for environment management
- TypeScript for type safety

## Business Logic

The system handles complex booking scenarios:
- Multi-turn conversations to collect all booking details
- Context preservation across messages
- Smart entity extraction with temporal awareness
- Validation of booking requirements
- Integration with backend systems for actual booking processing