# Publishing to GitHub Marketplace

This guide will help you publish the Setup KubeSolo Action to the GitHub Marketplace.

## Prerequisites

1. A GitHub account
2. A public GitHub repository for this action
3. The action code (already created in this directory)

## Steps to Publish

### 1. Create a GitHub Repository

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Setup KubeSolo GitHub Action"

# Create a new repository on GitHub (https://github.com/new)
# Name it: setup-kubesolo
# Make it public (required for marketplace)

# Add remote and push
git remote add origin https://github.com/fenio/setup-kubesolo.git
git branch -M main
git push -u origin main
```

### 2. Create a Release

GitHub Actions are published via releases with semantic version tags.

**Option A: Via GitHub Web Interface**

1. Go to your repository on GitHub
2. Click on "Releases" (right sidebar)
3. Click "Create a new release"
4. Create a new tag: `v1` (or `v1.0.0` for more specific versioning)
5. Set release title: "v1.0.0 - Initial Release"
6. Add release notes from CHANGELOG.md
7. Check "Set as the latest release"
8. Click "Publish release"

**Option B: Via Command Line**

```bash
# Create and push tag
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# Then create release on GitHub web interface
```

### 3. Publish to Marketplace

1. Go to your repository on GitHub
2. You should see a banner asking "Publish this Action to the GitHub Marketplace?"
3. Click "Draft a release" if you haven't already
4. Check the box "Publish this Action to the GitHub Marketplace"
5. Select primary category: "Continuous integration"
6. Select additional categories (optional):
   - "Deployment"
   - "Utilities"
7. Review the terms
8. Click "Publish release"

Your action will now be available at:
```
https://github.com/marketplace/actions/setup-kubesolo
```

### 4. Create Major Version Tags

GitHub recommends maintaining major version tags (v1, v2, etc.) that point to the latest minor/patch version:

```bash
# Create v1 tag pointing to v1.0.0
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force

# Users can now reference your action as:
# uses: fenio/setup-kubesolo@v1
```

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version (v2.0.0): Incompatible API changes
- **MINOR** version (v1.1.0): New features, backward compatible
- **PATCH** version (v1.0.1): Bug fixes, backward compatible

### Creating New Releases

```bash
# Make your changes
git add .
git commit -m "Add new feature"

# Update CHANGELOG.md

# Create new version tag
git tag -a v1.1.0 -m "Add feature X"
git push origin v1.1.0

# Update major version tag
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force

# Create GitHub release via web interface
```

## Action Marketplace Guidelines

Ensure your action follows GitHub's guidelines:

- ✅ Public repository
- ✅ action.yml in repository root
- ✅ Clear README with usage examples
- ✅ Appropriate branding (icon and color)
- ✅ Proper inputs and outputs documentation
- ✅ MIT License (or another OSI-approved license)

## Testing Before Publishing

Test your action before publishing:

1. Create a test repository
2. Reference your action using the repository path:

```yaml
steps:
  - uses: fenio/setup-kubesolo@main
```

3. Verify all functionality works
4. Check the test workflow: `.github/workflows/test.yml`

## Marketing Your Action

After publishing:

1. Add a badge to README:
```markdown
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Setup%20KubeSolo-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=github)](https://github.com/marketplace/actions/setup-kubesolo)
```

2. Share on social media
3. Add to relevant awesome lists
4. Write a blog post about it
5. Submit to:
   - [Awesome Actions](https://github.com/sdras/awesome-actions)
   - [Kubernetes community](https://kubernetes.io/community/)

## Maintaining Your Action

### Update Process

1. Make changes
2. Update CHANGELOG.md
3. Test thoroughly
4. Create new release
5. Update version tags
6. Communicate breaking changes clearly

### Support

- Monitor GitHub Issues
- Respond to pull requests
- Keep dependencies updated
- Test with new KubeSolo versions

## Troubleshooting

### Action Not Appearing in Marketplace

- Ensure repository is public
- Verify action.yml is valid
- Check that you published the release
- Wait a few minutes for indexing

### Users Report Issues

- Check the test workflow
- Review GitHub Actions logs
- Test with the reported configuration
- Update documentation if needed

## Quick Reference

### Repository Structure
```
setup-kubesolo/
├── action.yml              # Action definition (REQUIRED)
├── README.md               # Documentation (REQUIRED)
├── LICENSE                 # License file (REQUIRED)
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guidelines
├── EXAMPLES.md             # Usage examples
├── .gitignore             # Git ignore rules
└── .github/
    └── workflows/
        └── test.yml        # Test workflow
```

### Version Tags
```bash
# Patch version (bug fixes)
git tag v1.0.1

# Minor version (new features)
git tag v1.1.0

# Major version (breaking changes)
git tag v2.0.0

# Major version pointer
git tag -fa v1
```

### Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Publishing Actions to Marketplace](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)
- [Action Metadata Syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
- [KubeSolo Documentation](https://kubesolo.io/documentation)

## Ready to Publish!

Your Setup KubeSolo Action is ready to be published to the GitHub Marketplace. Follow the steps above to make it available to the community.

Good luck! 🚀
