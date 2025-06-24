# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Prompt Fighters" (AI Hero Battle), a turn-based combat game where players create AI-generated characters and battle them against each other. The game uses LLMs to generate character backgrounds, images, and battle narratives.

## Architecture

**Full-stack application with Docker containerization:**
- **Frontend**: Angular 20 with TypeScript, Tailwind CSS, and Angular Material
- **Backend**: Django 5.0 with Django REST Framework
- **Database**: PostgreSQL
- **Task Queue**: Redis + Celery for background AI processing
- **Authentication**: Google OAuth with JWT tokens
- **AI Integration**: Google Gemini API for character generation and battle simulation

## Development Commands

### Frontend (Angular)
```bash
cd frontend
npm install                    # Install dependencies
npm run start                 # Start dev server on http://localhost:4200
npm run build                 # Build for production
ng serve                      # Alternative dev server command
```

### Backend (Django)
```bash
cd backend
python manage.py migrate      # Run database migrations
python manage.py runserver    # Start dev server on http://localhost:8000
python manage.py collectstatic # Collect static files
python manage.py createsuperuser # Create admin user
```

### Docker Development
```bash
# Start all services (recommended for development)
docker-compose up --build -d

# View logs
docker-compose logs web
docker-compose logs celery

# Stop services
docker-compose down

# Database operations through Docker
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

## Core Data Models

### Character Model (backend/game/models.py:15)
- UUID primary key, belongs to Player
- Stats: strength, agility, luck, rarity (1-5)
- AI-generated: prompt, skill_description, image_url
- Battle history: win_count, loss_count

### Battle Model (backend/game/models.py:33)
- Links two characters, determines winner
- Stores battle_log as JSON with detailed turn-by-turn combat
- Status: PENDING/COMPLETED/ERROR for async battle processing

### Player Model (backend/game/models.py:6)
- OneToOne with Django User
- Tracks creation and last login times

## Key Architecture Patterns

### Authentication Flow
1. Google OAuth in frontend (login.component.ts:85)
2. JWT token exchange via backend API
3. Token-based authentication for all API calls

### Battle System
1. Battle creation triggers Celery task (game/tasks.py)
2. AI generates battle narrative using character stats/descriptions
3. Battle results stored in JSON format with detailed logs
4. Real-time status updates through polling

### Character Creation
1. Player provides character name
2. AI generates background story, stats, and description
3. Character image generated and stored in media folder
4. Stats allocated based on AI-determined character archetype

## Environment Configuration

### Required Environment Variables (.env file in backend/)
```
DJANGO_SECRET_KEY=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
POSTGRES_DB=aiherobattle
POSTGRES_USER=aihero
POSTGRES_PASSWORD=aiheropass
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```

### Google OAuth Setup
- Update client_id in frontend/src/app/login/login.component.ts:85
- Configure authorized origins in Google Cloud Console

## API Endpoints

All APIs require JWT authentication except auth endpoints:
- `/api/auth/` - Google OAuth token exchange
- `/api/characters/` - CRUD operations for characters
- `/api/battles/` - Battle creation and history
- `/api/players/me/` - Current player profile

## File Structure Notes

### Frontend Structure
- `src/app/interfaces/` - TypeScript interfaces matching Django models
- `src/app/services/` - API services and authentication
- `src/app/components/` - Reusable UI components
- `src/app/pages/` - Page-level components

### Backend Structure
- `backend/game/` - Main game logic (models, views, tasks)
- `backend/backend/` - Django configuration
- `media/` - User-uploaded and AI-generated images

## Development Tips

- Use `docker-compose up --build -d` for consistent development environment
- Backend runs on port 8000, frontend on 4200
- Celery workers handle AI generation tasks - check logs if characters/battles aren't processing
- Character images are stored in media/ directory and served via Django
- Battle logs are stored as JSON - use Django admin to inspect detailed battle data