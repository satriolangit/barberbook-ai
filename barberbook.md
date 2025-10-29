# Barberbook AI Booking Assistant - Comprehensive Analysis

## Project Overview
Barberbook is an AI-powered virtual assistant for barbershop booking management. It leverages Google's Gemini AI to understand customer messages, extract booking intents and entities, and manage the booking flow through a conversational interface. The system is built using Node.js, TypeScript, Google Gemini AI, PostgreSQL, and pgvector for semantic search capabilities.

## Architecture & Technologies Stack

### Core Technologies
- **Node.js/TypeScript**: Main application runtime and type safety
- **Express.js**: Web framework for handling HTTP requests
- **Google Gemini AI**: Natural language processing for intent recognition and conversation management
- **PostgreSQL**: Database for storing bookings, customer information, and conversation logs
- **pgvector**: PostgreSQL extension for vector embeddings and semantic search
- **Docker**: Containerization for consistent deployment
- **dotenv**: Environment variable management

### Key Dependencies
- `@google/generative-ai`: Gemini API client
- `pg`: PostgreSQL client with type parsing
- `pgvector`: Vector operations for semantic search
- `express`: Web framework
- `axios`: HTTP client
- Testing: Jest, Supertest, TS-Jest

## Core System Components

### 1. API Layer (`/src/app.ts`, `/src/routes/`)
- **Routes**:
  - `POST /simulate`: Main endpoint for processing user messages
  - `POST /services/refresh-embedding`: Refreshes service embeddings in the database
- **Request Processing Chain**: User Message → AI Analysis → Conversation Flow → Response Generation → Logging

### 2. AI & NLP Layer (`/src/services/gemini*.ts`)
- **Gemini Client** (`geminiClient.ts`): Interfaces with Google Gemini API for both text generation and embeddings
- **Orchestrator** (`geminiOrchestrator.ts`): Analyzes user messages, extracts intent and entities, and generates dynamic service context using RAG (Retrieval-Augmented Generation)
- **Embedding Service** (`embeddingService.ts`): Creates and manages vector embeddings for services to enable semantic search

### 3. Conversation Management (`/src/services/conversation*.ts`)
- **Orchestrator** (`conversationOrchestrator.ts`): Complex state machine managing multi-turn conversations, slot filling, and booking flows
- **Session Manager** (`sessionManager.ts`): Maintains conversation state between user interactions
- **Slot Utilities** (`slotUtils.ts`): Manages required/optional data fields for booking flows

### 4. Business Logic Layer (`/src/services/bookingService.ts`)
- **Booking Operations**: Create, check availability, confirm, cancel bookings
- **Availability Management**: Implements database-level locking to prevent double-booking
- **Booking Summary**: Generates formatted confirmation messages

### 5. Data Layer (`/src/config/db.ts`)
- **Connection Pool**: Managed PostgreSQL connection pool with type parsers
- **Type Conversion**: Automatic conversion for numeric, timestamp, and integer types
- **Vector Support**: Integration with pgvector for semantic search capabilities

### 6. Configuration (`/src/config/`)
- **Prompt Configuration** (`prompt.ts`): Sophisticated system prompt with examples and rules for AI behavior
- **Conversation Flow** (`conversationFlow.ts`): State machines defining conversation paths for different intents
- **Database Configuration** (`db.ts`): PostgreSQL connection setup with type parsing

## Database Schema

The system uses PostgreSQL with pgvector extension and includes:

### Core Tables:
1. **customers**: Customer information (phone, name)
2. **bookings**: Booking details (customer, service, date, time, barber, payment)
3. **conversation_sessions**: Maintains conversation state and context per user
4. **conversation_logs**: Logs all interactions with intent and entities
5. **barbers**: Barber information (name, active status)
6. **services**: Service catalog with duration, price, and vector embeddings

### Vector Search:
- Services table includes `vector(1536)` column for semantic similarity matching
- Embeddings generated using Google's text-embedding-004 model

## Key Features & Capabilities

### 1. Intelligent Intent Recognition
- **Booking Flows**: start_booking, confirm_booking, change_booking, cancel_booking
- **Information Queries**: ask_services, ask_prices, ask_availability, ask_queue_status
- **Conversational**: greeting, smalltalk, help, farewell
- **Context Preservation**: Maintains booking context during multi-turn conversations

### 2. Semantic Service Matching
- Uses vector embeddings to match user requests to available services
- Provides semantic search capabilities through pgvector
- Dynamic service context based on user query relevance

### 3. Conversation State Management
- Tracks multi-turn booking conversations
- Preserves context during information gathering
- Handles soft intent switching without losing session data
- Implements slot-filling for missing booking information

### 4. Concurrent Booking Protection
- Uses database-level locking (FOR UPDATE SKIP LOCKED) 
- Prevents double-booking of the same time slot
- Implements availability checking with time overlap detection

### 5. Comprehensive Logging
- Stores all interactions in conversation_logs table
- Tracks intent and entity extraction for analytics
- Maintains session context for conversation continuity

## System Flow

1. **User Message**: Received via POST `/simulate` endpoint
2. **AI Analysis**: Gemini processes message for intent/entity extraction
3. **Contextual Processing**: Conversation orchestrator manages flow based on current state
4. **Slot Filling**: System collects required information for booking
5. **Availability Check**: Verifies barber availability with database locking
6. **Booking Creation**: Saves booking to database
7. **Response Generation**: Returns formatted response to user
8. **Logging**: Records interaction in conversation logs

## Configuration

### Environment Variables:
- `GEMINI_API_KEY`: Google Gemini API key
- `GEMINI_MODEL_NAME`: Gemini model (default: gemini-2.5-flash)
- Database connection details (host, user, password, database)
- Application port (default: 4000)

### Docker Setup:
- PostgreSQL 15 with automatic schema initialization
- pgvector extension for vector operations
- Pre-configured database schema via init.sql

## Development & Operational Aspects

### Scripts:
- `npm run dev`: Development server with auto-reload
- `npm run build`: TypeScript compilation
- `npm run start`: Production server startup
- `npm test`: Run Jest test suite

### Error Handling:
- Graceful fallback for unknown intents
- AI response parsing error recovery
- Database connection error management
- Validation for required booking fields

This system represents a sophisticated AI-powered booking assistant that combines advanced NLP capabilities with robust backend systems to provide a natural, conversational booking experience for barbershop services.