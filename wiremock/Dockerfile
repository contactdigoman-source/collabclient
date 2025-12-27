# Custom WireMock image with ColabClient API mappings
# This image includes all API stub mappings baked in

FROM wiremock/wiremock:latest

# Copy all mappings into the image
COPY mappings/ /home/wiremock/mappings/

# Set working directory
WORKDIR /home/wiremock

# Expose WireMock port
EXPOSE 8080

# Health check to ensure WireMock is running
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8080/__admin/health || exit 1

# WireMock will automatically load mappings from /home/wiremock/mappings
# Default command includes response templating and verbose logging
CMD ["--global-response-templating", "--verbose", "--disable-request-logging=false"]







