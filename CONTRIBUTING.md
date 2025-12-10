# Contributing to Setup KubeSolo Action

Thank you for your interest in contributing to the Setup KubeSolo Action!

## How to Contribute

### Reporting Issues

If you find a bug or have a feature request:

1. Check if the issue already exists in the [Issues](../../issues) section
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - GitHub Actions workflow logs (if applicable)

### Submitting Changes

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes (`git commit -am 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Create a Pull Request

### Testing

Before submitting a PR, ensure:

- Your changes work with the latest version of KubeSolo
- All test workflows pass
- Documentation is updated if needed
- Examples are updated if the API changed

### Code Style

- Use clear, descriptive variable names
- Add comments for complex logic
- Follow shell scripting best practices
- Keep the action.yml and setup.sh files well-organized

## Development Setup

To test your changes locally:

1. Fork and clone the repository
2. Make your changes to `action.yml` or `setup.sh`
3. Create a test workflow in `.github/workflows/` that uses your local action:

```yaml
- uses: ./
  with:
    # your test parameters
```

4. Push to your fork and check the Actions tab

## Questions?

Feel free to open an issue for any questions about contributing!
