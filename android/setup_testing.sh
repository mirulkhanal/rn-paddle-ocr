#!/bin/bash
# Setup script for testing Android module independently

set -e

echo "🔧 Setting up Android module for standalone testing..."

# Check if we're in the android directory
if [ ! -f "build.gradle" ]; then
    echo "❌ Error: Please run this script from the android/ directory"
    exit 1
fi

# Check for Gradle
if command -v gradle &> /dev/null; then
    echo "✅ Gradle found: $(gradle --version | head -n 3)"
    GRADLE_CMD="gradle"
elif [ -f "../gradlew" ]; then
    echo "✅ Found Gradle wrapper at project root"
    GRADLE_CMD="../gradlew"
else
    echo "⚠️  Gradle not found. You have two options:"
    echo ""
    echo "Option 1: Install Gradle"
    echo "  brew install gradle"
    echo "  Then run this script again"
    echo ""
    echo "Option 2: Use Android Studio"
    echo "  1. Open Android Studio"
    echo "  2. File → Open → Select this android/ folder"
    echo "  3. Android Studio will set everything up automatically"
    echo ""
    exit 1
fi

# Generate Gradle wrapper
echo ""
echo "📦 Generating Gradle wrapper..."
$GRADLE_CMD wrapper --gradle-version 8.0

echo ""
echo "✅ Setup complete!"
echo ""
echo "Now you can run tests with:"
echo "  ./gradlew test"
echo ""
echo "Or open this folder in Android Studio and run tests from there."

