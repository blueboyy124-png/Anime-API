# Contributing to MiruroAPI

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/MiruroAPI.git`
3. Create a branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on https://anime-api-one-cyan.vercel.app/
```

## Project Structure

```
MiruroAPI/
├── server.js              # Express entry point
├── src/
│   ├── helpers/           # AniList, pipe, cache integrations
│   └── routes/            # Express routes
├── public/                # Static files (landing page, Swagger UI)
└── docs/                  # API documentation
```

## Adding a New Endpoint

1. Create helper in `src/helpers/yourHelper.js` if needed
2. Add route in `src/routes/apiRoutes.js`
3. Update `docs/endpoints.md` with documentation
4. Test with `curl https://anime-api-one-cyan.vercel.app//api/your-endpoint`

## Code Style

- Use CommonJS (`require`/`module.exports`)
- Add JSDoc comments for new functions
- Follow existing patterns in the codebase
- Keep helpers focused on one task

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance

## Pull Request Guidelines

- Keep PRs focused on one feature or fix
- Update CHANGELOG.md with your changes
- Test your changes locally before submitting
- Follow existing code style

## Reporting Issues

- Use GitHub Issues for bug reports
- Include steps to reproduce
- Include expected vs actual behavior
- Include your Node.js version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
