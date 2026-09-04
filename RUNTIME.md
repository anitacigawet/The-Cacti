# Portable runtime

This ZIP contains the built application and its production Node packages. You do not need pnpm or a build step.

## Start it

1. Install [Node.js](https://nodejs.org/) 20.19+ on the Node 20 line, or 22.12+.
2. Extract the ZIP to a normal writable folder.
3. On Windows, run `run.bat`. On macOS or Linux, run `sh run.sh`.
4. Open the `Server running on ...` address printed in the console. It normally uses [http://localhost:3002](http://localhost:3002), but selects a higher free port when 3002 is busy.

The launcher copies `.env.example` to `.env` the first time it runs. The app can start and its public pages can be viewed without credentials. Google sign-in, generated analysis, and email alerts require their corresponding values in `.env`.

Runtime data is created under `data/` beside the application. Keep `.env` and `data/` private. See [Configuration](docs/CONFIGURATION.md) for every setting.

## Google sign-in

For the default local address, configure this authorized redirect URI in a Google OAuth web application:

```text
http://localhost:3002/api/auth/google/callback
```

Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `JWT_SECRET`, `PUBLIC_URL`, and `OWNER_EMAIL` in `.env` before signing in.

To use sign-in on another port, stop the server, set `PORT` and `PUBLIC_URL` to the same chosen free port, update the Google authorized redirect URI to that port, and restart the server.
