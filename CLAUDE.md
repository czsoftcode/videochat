# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Run
- `php bin/console cache:clear` - Clear Symfony cache
- `php bin/console asset-map:compile` - Compile frontend assets
- `php bin/console server:run` - Run development server

### Lint
- `php bin/console lint:container` - Validate service container
- `php bin/console lint:twig` - Validate Twig templates
- `php bin/console lint:yaml` - Validate YAML files

### Tests
- `php bin/phpunit` - Run all tests
- `php bin/phpunit tests/Path/To/TestFile.php` - Run specific test file
- `php bin/phpunit --filter testMethodName` - Run specific test method

## Code Style

- PHP Version: >=8.2
- Symfony Version: 7.2.*
- Namespace: App\\ (PSR-4)
- Use type declarations for properties and function parameters
- Use fluent setters when appropriate for entities
- Follow Symfony naming conventions (e.g., EntityRepository, EntityController)
- Use dependency injection via constructor
- Use services.yaml for service configuration
- All API responses should use proper HTTP status codes