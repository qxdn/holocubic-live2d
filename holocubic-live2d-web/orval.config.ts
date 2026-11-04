import { defineConfig } from "orval"

export default defineConfig({
  api: {
    input: {
      target: "../holocubic-live2d-server/openapi.json",
      filters: { mode: "exclude", tags: ["AI", "Chat"] },
    },
    output: {
      target: "./src/api/generated.ts",
      schemas: "./src/api/models",
      client: "react-query",
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: "./src/api/request.ts",
          name: "request",
          inferred: true,
        },
      },
    },
  },
})
