# Publishing Guide

## Pre-publish Checklist

✅ Build completed successfully
✅ All dependencies listed in package.json
✅ TypeScript declarations generated
✅ README.md included
✅ Models directory included

## Publishing to npm

1. **Login to npm** (if not already logged in):
   ```bash
   npm login
   ```

2. **Verify package contents** (dry run):
   ```bash
   npm pack --dry-run
   ```

3. **Publish the package**:
   ```bash
   npm publish
   ```

   Or if publishing for the first time with a scoped package:
   ```bash
   npm publish --access public
   ```

## Testing After Publishing

### Option 1: Install and test locally
```bash
# In a new directory
mkdir test-ocr && cd test-ocr
npm init -y
npm install ocr-receipt-scanner

# Copy your models and test image
# Then run the test script (see test-after-install.js)
```

### Option 2: Test in your current project
```bash
npm install ocr-receipt-scanner
# Then use the package in your code
```

### Test Script
See `test-after-install.js` for a complete test script that you can use after installation.

## Package Contents

The published package includes:
- `build/` - Compiled JavaScript and TypeScript declarations
- `models/` - Model files (detection, recognition, character dictionary)
- `README.md` - Documentation
- `package.json` - Package metadata and dependencies

## Version Management

To publish updates:
1. Update version in package.json
2. Update CHANGELOG if needed
3. Run `npm run build`
4. Run `npm publish`

