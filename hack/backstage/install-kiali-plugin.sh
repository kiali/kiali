#!/usr/bin/env bash
#
# hack/add-kiali.sh - Integrate the Kiali plugin into a local Backstage installation
#
# Usage: $(basename "$0") [-h] [-b BASE_PATH] [-u KIALI_URL]
#
# Options:
#   -h            Show this help message and exit
#   -b BASE_PATH  Base path of the Backstage project (default: .)
#   -u KIALI_URL  URL of the Kiali instance to configure (default: http://localhost:20001/kiali/)
#

set -euo pipefail

show_help() {
  cat <<EOF
Usage: $(basename "$0") [-h] [-b BASE_PATH] [-u KIALI_URL]

Options:
  -h            Show this help message and exit
  -b BASE_PATH  Base path of the Backstage project (default: .)
  -u KIALI_URL  URL of the Kiali instance to configure (default: http://localhost:20001/kiali/)
EOF
}

# Defaults
BASE_PATH="."
KIALI_URL="http://localhost:20001/kiali/"

# Parse flags
while getopts ":hb:u:" opt; do
  case ${opt} in
    h) show_help; exit 0 ;;
    b) BASE_PATH=$OPTARG ;;
    u) KIALI_URL=$OPTARG ;;
    \?) echo "Error: Invalid option -$OPTARG" >&2; show_help; exit 1 ;;
    :) echo "Error: Option -$OPTARG requires an argument." >&2; show_help; exit 1 ;;
  esac
done
shift $((OPTIND -1))

echo "Base path: $BASE_PATH"
echo "Kiali URL: $KIALI_URL"

# Remember current directory and switch into BASE_PATH
ORIGINAL_DIR=$(pwd)
pushd "$BASE_PATH" > /dev/null

FRONTEND_APP_FILE="packages/app/src/App.tsx"
FRONTEND_ROOT_FILE="packages/app/src/components/Root/Root.tsx"
ENTITY_PAGE_FILE="packages/app/src/components/catalog/EntityPage.tsx"
APPCONFIG_FILE="app-config.yaml"
BACKEND_INDEX_FILE="packages/backend/src/index.ts"
CATALOG_DIR="../../catalog"
ENTITIES_YAML="$CATALOG_DIR/kialiEntities.yaml"
REMOTE_YAML_URL="https://raw.githubusercontent.com/backstage/community-plugins/98ff2e9b3c339941f46dbfaea85d17a10a0beb73/workspaces/kiali/examples/kialiEntities.yaml"

# 0) Download example entities YAML
mkdir -p "$CATALOG_DIR"
curl -sSL "$REMOTE_YAML_URL" -o "$ENTITIES_YAML"
echo "✅ Downloaded kialiEntities.yaml to $ENTITIES_YAML"

# 1) Install frontend and backend plugins
echo "Installing @backstage-community/plugin-kiali in frontend..."
yarn --cwd packages/app add @backstage-community/plugin-kiali
echo "Installing @backstage-community/plugin-kiali-backend in backend..."
yarn --cwd packages/backend add @backstage-community/plugin-kiali-backend

# 2) Add import of KialiPage in App.tsx
if ! grep -q "import { KialiPage } from '@backstage-community/plugin-kiali';" "$FRONTEND_APP_FILE"; then
  sed -i "/import { catalogEntityCreatePermission } from '@backstage\/plugin-catalog-common\/alpha';/a import { KialiPage } from '@backstage-community/plugin-kiali';" "$FRONTEND_APP_FILE"
  echo "✅ Added import of KialiPage in App.tsx"
fi

# 3) Insert the /kiali route in App.tsx
if ! grep -q 'path="/kiali"' "$FRONTEND_APP_FILE"; then
  sed -i '/<\/FlatRoutes>/i\
    <Route path="\/kiali" element={<KialiPage />} />' "$FRONTEND_APP_FILE"
  echo "✅ Added /kiali route in App.tsx"
fi

# 4) Add import of KialiIcon in Root.tsx
if ! grep -q "import { KialiIcon } from '@backstage-community/plugin-kiali';" "$FRONTEND_ROOT_FILE"; then
  sed -i "/import GroupIcon from '@material-ui\/icons\/People';/a import { KialiIcon } from '@backstage-community/plugin-kiali';" "$FRONTEND_ROOT_FILE"
  echo "✅ Added import of KialiIcon in Root.tsx"
fi

# 5) Add SidebarItem for Kiali in Root.tsx
if ! grep -q 'SidebarItem icon={KialiIcon} to="kiali" text="Kiali"' "$FRONTEND_ROOT_FILE"; then
  sed -i "/<SidebarItem icon={LibraryBooks} to=\"docs\" text=\"Docs\" \/>/a\          <SidebarItem icon={KialiIcon} to=\"kiali\" text=\"Kiali\" />" "$FRONTEND_ROOT_FILE"
  echo "✅ Added Kiali SidebarItem in Root.tsx"
fi

# 6) Add import of EntityKialiContent in EntityPage.tsx
if ! grep -q "import { EntityKialiContent }" "$ENTITY_PAGE_FILE"; then
  sed -i "/import { ReportIssue } from '@backstage\/plugin-techdocs-module-addons-contrib';/a import { EntityKialiContent } from '@backstage-community/plugin-kiali';" "$ENTITY_PAGE_FILE"
  echo "✅ Added import of EntityKialiContent in EntityPage.tsx"
fi

# 7) Insert /kiali route in serviceEntityPage of EntityPage.tsx
if ! ( grep -q 'serviceEntityPage' "$ENTITY_PAGE_FILE" && grep -q 'path=\"/kiali\"' "$ENTITY_PAGE_FILE" ); then
  sed -i '/const serviceEntityPage = (/,/const websiteEntityPage =/{
    /path="\/kubernetes"/,/<\/EntityLayout.Route>/{
      /<\/EntityLayout.Route>/a\
    <EntityLayout.Route path="\/kiali" title="kiali">\
      <EntityKialiContent />\
    </EntityLayout.Route>
    }
  }' "$ENTITY_PAGE_FILE"
  echo "✅ Added /kiali route in serviceEntityPage of EntityPage.tsx"
fi

# 8) Add the kiali section to app-config.yaml
if ! grep -q '^kiali:' "$APPCONFIG_FILE"; then
  cat <<EOF >> "$APPCONFIG_FILE"

kiali:
  providers:
    - name: 'default'
      url: '$KIALI_URL'
      skipTLSVerify: true
EOF
  echo "✅ Added kiali configuration section to app-config.yaml"
fi

# 9) Register catalog location for the downloaded YAML
if grep -q "target: $ENTITIES_YAML" "$APPCONFIG_FILE"; then
  echo "ℹ️  $ENTITIES_YAML is already registered in app-config.yaml"
else
  if grep -q '^[[:space:]]*locations:' "$APPCONFIG_FILE"; then
    sed -i "/^[[:space:]]*locations:/a\    - type: file\n      target: $ENTITIES_YAML" "$APPCONFIG_FILE"
    echo "✅ Added $ENTITIES_YAML to catalog.locations"
  else
    sed -i "/^catalog:/a\  locations:\n    - type: file\n      target: $ENTITIES_YAML" "$APPCONFIG_FILE"
    echo "✅ Created catalog.locations and added $ENTITIES_YAML"
  fi
fi

# 10) Enable plugin-kiali-backend in backend index.ts
if ! grep -q "plugin-kiali-backend" "$BACKEND_INDEX_FILE"; then
  sed -i "\|backend.add(import('@backstage/plugin-kubernetes-backend'));|a\\
  backend.add(import('@backstage-community/plugin-kiali-backend'));" "$BACKEND_INDEX_FILE"
  echo "✅ Enabled plugin-kiali-backend in backend index.ts"
fi

# Return to original directory
popd > /dev/null
echo "Returned to $ORIGINAL_DIR"
