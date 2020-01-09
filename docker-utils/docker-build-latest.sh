PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
 docker buildx build --platform linux/386,linux/amd64,linux/arm64,linux/arm/v7,linux/arm/v6 -t maxill1/ialarm-mqtt:latest -t maxill1/ialarm-mqtt:$PACKAGE_VERSION . --push