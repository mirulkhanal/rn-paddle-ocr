# Version Management and Publishing

## Version Numbering

This package follows [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

## Publishing New Versions

### Option 1: Use npm scripts (Recommended)

```bash
# Patch version (1.0.0 → 1.0.1) - for bug fixes
npm run version:patch

# Minor version (1.0.0 → 1.1.0) - for new features
npm run version:minor

# Major version (1.0.0 → 2.0.0) - for breaking changes
npm run version:major
```

These scripts will:
1. Bump the version in package.json
2. Create a git commit with the version change
3. Create a git tag

**Then manually publish:**
```bash
npm publish
```

### Option 2: Manual version bump

```bash
# Bump version manually
npm version patch   # or minor, or major

# Then publish
npm publish
```

### Option 3: Specify version directly

```bash
# Set specific version
npm version 1.0.1

# Then publish
npm publish
```

## Git Workflow

### Initial Setup

```bash
# Initialize git (already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: React Native OCR receipt scanner v1.0.0"

# Add remote (replace with your repo URL)
git remote add origin <your-repo-url>

# Push to remote
git push -u origin main
```

### After Publishing a New Version

When you run `npm version`, it automatically:
- Updates package.json version
- Creates a git commit
- Creates a git tag (e.g., v1.0.1)

You should push these changes:

```bash
# Push commits and tags
git push && git push --tags
```

## Workflow Example

```bash
# 1. Make your changes to the code
# ... edit files ...

# 2. Build to ensure everything compiles
npm run build

# 3. Commit your changes
git add .
git commit -m "Fix: Update file system adapter handling"

# 4. Bump version
npm run version:patch

# 5. Review changes, then publish
npm publish

# 6. Push to git (including tags)
git push && git push --tags
```

## Checking Current Version

```bash
# Check package.json version
npm version

# Or view package.json
cat package.json | grep version
```

## Unpublishing (if needed)

⚠️ **Warning**: Only unpublish within 72 hours of publishing, and only if no one is using it.

```bash
# Unpublish a specific version
npm unpublish ocr-receipt-scanner@1.0.0

# Unpublish entire package (only if no versions are being used)
npm unpublish ocr-receipt-scanner --force
```

## Best Practices

1. **Always test before publishing**: Run `npm run build` and test your changes
2. **Write meaningful commit messages**: Describe what changed
3. **Update CHANGELOG.md**: Document changes for users (create this file if needed)
4. **Tag releases**: Git tags are automatically created by `npm version`
5. **Follow semantic versioning**: Don't break APIs in patch versions

