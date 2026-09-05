#!/bin/bash
# Create a release tag and trigger the build workflow

set -e

VERSION="${1:-v1.0.0}"
REMOTE="${2:-origin}"

# Validate version format
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo "Error: Invalid version format. Expected v<major>.<minor>.<patch>, got: $VERSION"
    exit 1
fi

echo "Creating release for version: $VERSION"

# Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo "Error: Tag $VERSION already exists"
    exit 1
fi

# Ensure we're on a clean working tree
if ! git diff-index --quiet HEAD --; then
    echo "Error: Working tree is not clean. Commit your changes first."
    exit 1
fi

# Create annotated tag
echo "Creating tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION"

# Push tag to remote
echo "Pushing tag to $REMOTE..."
git push "$REMOTE" "$VERSION"

echo ""
echo "✓ Release tag $VERSION created and pushed successfully!"
echo "✓ GitHub Actions workflow will now build and create the release"
echo ""
echo "Check the progress at: https://github.com/$(git remote get-url $REMOTE | sed 's/.*:\|.git//g')/actions"
