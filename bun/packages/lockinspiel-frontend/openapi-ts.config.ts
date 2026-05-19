import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: ['./src/openapi/auth.json', './src/openapi/user.json', './src/openapi/timekeeper.json'], // sign up at app.heyapi.dev
  output: './src/api-client',
  plugins: [
    // ...other plugins
    '@hey-api/client-angular',
    '@hey-api/schemas',
    {
      name: '@hey-api/sdk',
      operations: {
        containerName: '{{name}}Service',
        strategy: 'byTags',
      },
      auth: true,
    },
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
  ],
});
