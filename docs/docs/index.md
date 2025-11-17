# Pantrie Documentation

Welcome to the Pantrie documentation! Pantrie is a modern household inventory management system designed to help you track food items, manage expiration dates, track allergens, nutritional information, and reduce food waste.

## Features

- **Barcode Scanning**: Quickly add items by scanning barcodes, powered by Open Food Facts
- **Multi-Household Support**: Manage multiple households with role-based permissions
- **Location Tracking**: Organize items by custom locations (fridge, pantry, freezer, etc.)
- **Custom Allergen Tracking**: Define household-specific allergens and get automatic warnings
- **Expiration Tracking**: Never miss expiration dates with visual indicators
- **Smart Search**: Find items quickly with search and filtering
- **Nutrition Information**: View detailed nutrition facts from Open Food Facts database

## Documentation Overview

### :rocket: Getting Started

Get Pantrie up and running quickly with our step-by-step guides:

- **[Installation](getting-started/installation.md)** - System requirements and installation instructions
- **[Quick Start](getting-started/quick-start.md)** - Get started with Pantrie in minutes
- **[Configuration](getting-started/configuration.md)** - Configure Pantrie for your environment

### :book: User Guide

Learn how to use Pantrie's features:

- **[Overview](user-guide/overview.md)** - Introduction to Pantrie's user interface
- **[Households](user-guide/households.md)** - Managing households and members
- **[Inventory Management](user-guide/inventory.md)** - Adding, editing, and organizing items
- **[Locations](user-guide/locations.md)** - Setting up and managing storage locations
- **[Barcode Scanning](user-guide/barcode-scanning.md)** - Using the barcode scanner feature
- **[Custom Allergens](user-guide/allergens.md)** - Setting up allergen tracking

### :globe_with_meridians: API Documentation

Integrate with Pantrie's RESTful API:

- **[Overview](api/overview.md)** - API introduction and concepts
- **[Authentication](api/authentication.md)** - JWT-based authentication system
- **[Endpoints](api/endpoints.md)** - Complete API endpoint reference

### :hammer_and_wrench: Development

Contributing to Pantrie or setting up a development environment:

- **[Architecture](development/architecture.md)** - System architecture and design patterns
- **[Backend Setup](development/backend.md)** - Setting up the FastAPI backend
- **[Frontend Setup](development/frontend.md)** - Setting up the React frontend
- **[Database](development/database.md)** - Database schema and migrations
- **[Contributing](development/contributing.md)** - Contribution guidelines

### :rocket: Deployment

Deploy Pantrie to production:

- **[Overview](deployment/overview.md)** - Deployment options and considerations
- **[Docker](deployment/docker.md)** - Docker-based deployment guide
- **[Environment Variables](deployment/environment.md)** - Configuration reference
- **Reverse Proxy Setup**:
    - **[Cloudflare Tunnels](deployment/cloudflare-tunnels.md)** - Secure tunneling without port forwarding
    - **[NGINX Proxy Manager](deployment/nginx-proxy-manager.md)** - Web-based reverse proxy management

## Technology Stack

### Backend
- **FastAPI**: Modern, high-performance Python web framework
- **PostgreSQL**: Reliable and powerful database
- **SQLAlchemy**: ORM for database operations
- **Alembic**: Database migration management
- **Redis**: Caching layer for improved performance

### Frontend
- **React**: Modern UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast development and build tooling
- **Axios**: HTTP client for API communication
- **React Router**: Client-side routing

## Getting Help

If you encounter any issues or have questions:

1. Check the [User Guide](user-guide/overview.md)
2. Review the [API Documentation](api/overview.md)
3. Open an issue on [GitHub](https://github.com/untraceablez/pantrie/issues)

## License

This project is licensed under the MIT License.
