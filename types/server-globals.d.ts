// Ambient declarations for the serverless API functions and their tests.
// The project intentionally avoids a full @types/node dependency; only the
// globals the server code actually uses are declared here.
declare const process: {
  env: Record<string, string | undefined>;
};
