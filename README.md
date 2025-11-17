<div align="center">
  <img src="frontend/public/pantrie-logo-light.png#gh-dark-mode-only" width="200" alt="Pantrie Logo">
  <img src="frontend/public/pantrie-logo-dark.png#gh-light-mode-only" width="200" alt="Pantrie Logo">

  <h1>Pantrie</h1>
  <p><strong>A self-hosted household inventory manager and shopping companion</strong></p>

  [![GitHub Release](https://img.shields.io/github/v/release/untraceablez/pantrie)](https://github.com/untraceablez/pantrie/releases)
  [![License](https://img.shields.io/github/license/untraceablez/pantrie)](https://github.com/untraceablez/pantrie/blob/001-household-inventory/LICENSE)
  [![GitHub Stars](https://img.shields.io/github/stars/untraceablez/pantrie)](https://github.com/untraceablez/pantrie/stargazers)
  [![GitHub Issues](https://img.shields.io/github/issues/untraceablez/pantrie)](https://github.com/untraceablez/pantrie/issues)

  [No Demo Yet](https://demo.pantrie.org) · [Documentation](https://docs.pantrie.org) · [Report Bug](https://github.com/untraceablez/pantrie/issues)
</div>

---

## What is Pantrie?

Pantrie is a self-hosted web application for managing your household inventory. Keep track of what you have, where it's stored, and when it expires. Built with modern web technologies and designed for families and households who want to reduce waste and stay organized.

Inspired by [Mealie](https://github.com/mealie-recipes/mealie), Pantrie brings the same philosophy of simple, self-hosted household management to your pantry, fridge, and storage spaces.

## Features

- **Multi-User Households** - Share your inventory with family members, each with their own role and permissions
- **Smart Inventory Tracking** - Track items with quantities, units, expiration dates, purchase dates, and locations
- **Role-Based Access** - Admin, Editor, and Viewer roles to control who can modify your inventory
- **Barcode Support** - Scan and store item barcodes for quick lookup
- **Category & Location Management** - Organize items by category (Food, Cleaning, etc.) and location (Pantry, Fridge, etc.)
- **Custom Allergen Tracking** - Track allergens specific to your household's needs
- **Dark Mode** - Beautiful light and dark themes for comfortable viewing
- **REST API** - Full API access with Swagger documentation
- **Self-Hosted** - Your data stays with you, deploy anywhere with Docker

## Screenshots

*(Coming soon)*

## Getting Started

### Docker Deployment (Recommended)

The easiest way to get started with Pantrie is using Docker. All services (PostgreSQL, Redis, Backend, Frontend) are containerized and managed together.

**Prerequisites:**
- Docker 20.10+
- Docker Compose 2.0+

**Quick Start:**
```bash
# Clone the repository
git clone https://github.com/untraceablez/pantrie.git
cd pantrie

# Start all services
./scripts/docker-start.sh
```

Visit `http://localhost:5173` to start using Pantrie!

**Docker Management Commands:**
```bash
# Start the environment
./scripts/docker-start.sh

# Stop the environment (preserves data)
./scripts/docker-stop.sh

# View logs (all services)
./scripts/docker-logs.sh

# View logs (specific service)
./scripts/docker-logs.sh backend

# Open a shell in a container
./scripts/docker-shell.sh backend
./scripts/docker-shell.sh postgres

# Reset everything (WARNING: deletes all data!)
./scripts/docker-reset.sh
```

**What's Running:**
- **Frontend:** http://localhost:5173 (React + Vite)
- **Backend API:** http://localhost:8000 (FastAPI)
- **API Documentation:** http://localhost:8000/api/docs (Swagger UI)
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

### Manual Installation (Advanced)

For development without Docker:

**Prerequisites:**
- Python 3.11+
- Node.js 20+
- PostgreSQL 16+
- Redis 7+

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database configuration
alembic upgrade head
uvicorn src.main:app --reload
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

Full installation instructions available in the [documentation](https://pantrie.org).

## Tech Stack

**Backend:**
- FastAPI - Modern Python web framework
- SQLAlchemy - Async ORM
- PostgreSQL - Primary database
- Redis - Caching and real-time updates
- Alembic - Database migrations

**Frontend:**
- React 18 with TypeScript
- Vite - Lightning-fast build tool
- TanStack Query - Data fetching and caching
- Zustand - State management
- Tailwind CSS - Utility-first styling

## Roadmap

Pantrie is under active development. Here's what's planned:

- [ ] Recipe integration (sync with Mealie!)
- [ ] Notification system for expiring items
- [ ] Import/export functionality
- [ ] Multi-language support

See the [project board](https://github.com/untraceablez/pantrie/projects) for detailed progress.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you'd like to contribute:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Non-code contributions are welcome too!** Help with documentation, bug reports, feature suggestions, and testing are all valuable.

## Community

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/untraceablez/pantrie/issues)
- **Discussions:** [GitHub Discussions](https://github.com/untraceablez/pantrie/discussions)
- **Discord:** *(Coming soon)*

## API Documentation

Pantrie includes a fully documented REST API. Once running, visit:

- **Swagger UI:** `http://localhost:8000/api/docs`
- **ReDoc:** `http://localhost:8000/api/redoc`

## Development

We use VSCode Dev Containers for a consistent development environment. If you have VSCode and Docker installed:

```bash
git clone https://github.com/untraceablez/pantrie.git
cd pantrie
code .
# VSCode will prompt to reopen in container
```

For manual setup, see [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Inspiration

Pantrie was inspired by [Mealie](https://github.com/mealie-recipes/mealie), an excellent self-hosted recipe manager. If you're using Pantrie, you should definitely check out Mealie for managing your recipes and meal planning!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find Pantrie useful, consider:

- Starring the repo ⭐
- Reporting bugs and requesting features
- Contributing code or documentation
- Sharing with friends who might find it useful

---

<div align="center">
  Made with ❤️ for homes everywhere
</div>
