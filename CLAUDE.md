# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint & Test Commands
- Run server: `symfony server:start` or `docker-compose up`
- Run test suite: `php bin/phpunit`
- Run single test: `php bin/phpunit tests/ClassName/MethodNameTest.php`
- Run tests with filter: `php bin/phpunit --filter=testMethodName`
- Lint Twig templates: `php bin/console lint:twig templates/`
- Lint YAML: `php bin/console lint:yaml config/`
- Clear cache: `php bin/console cache:clear`

## Code Style Guidelines
- **PHP**: Follow PSR-12 coding standards, PHP 8.2+ features allowed
- **Indentation**: 4 spaces (no tabs)
- **Naming**: camelCase for methods/variables, PascalCase for classes, SCREAMING_SNAKE for constants
- **Imports**: Group Symfony components first, then App namespaces, and other dependencies
- **Controller**: Use attribute routing, typehint parameters, return Response objects
- **Error Handling**: Use exceptions with meaningful messages, validate inputs in controllers
- **Repository Pattern**: Keep DB queries in repository classes, not in controllers
- **API Responses**: Use JsonResponse with explicit HTTP status codes
- **Security**: Use Symfony security annotations/attributes, validate CSRF tokens
- **JavaScript/CSS**: Never use inline styles or scripts - always place in separate files
- **Asset Organization**: 
  - JavaScript files go in `assets/js/` directory
  - CSS files go in `assets/styles/` directory
  - Import them in app.js/app.css or the importmap